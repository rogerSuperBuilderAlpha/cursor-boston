/**
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage push #9 — useIdeaRuns (447 LOC, was 0% coverage).
 */
import { renderHook, act, waitFor } from "@testing-library/react";
import type { User } from "firebase/auth";
import { useIdeaRuns } from "@/app/pr-ideas/_hooks/useIdeaRuns";

const mockReplace = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

const USER = {
  uid: "u1",
  getIdToken: jest.fn().mockResolvedValue("test-token"),
} as unknown as User;

function fakeResponse(opts: {
  ok: boolean;
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
}) {
  const headers = new Headers(opts.headers ?? {});
  return {
    ok: opts.ok,
    status: opts.status ?? (opts.ok ? 200 : 500),
    headers,
    json: () => Promise.resolve(opts.body ?? {}),
  } as never;
}

const FAKE_RUN = {
  id: "run-1",
  status: "pending",
  title: "Test idea",
} as never;

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn();
});

describe("useIdeaRuns", () => {
  describe("initial state + auto-load", () => {
    it("returns empty state when cursorConnected=false", () => {
      const { result } = renderHook(() =>
        useIdeaRuns({ user: USER, cursorConnected: false }),
      );
      expect(result.current.runs).toEqual([]);
      expect(result.current.hasRuns).toBe(false);
      expect(result.current.hasActiveRun).toBe(false);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("returns empty state when user is null", () => {
      const { result } = renderHook(() =>
        useIdeaRuns({ user: null, cursorConnected: true }),
      );
      expect(result.current.runs).toEqual([]);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("auto-loads runs on mount when user + cursorConnected", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        fakeResponse({ ok: true, body: { runs: [FAKE_RUN] } }),
      );
      const { result } = renderHook(() =>
        useIdeaRuns({ user: USER, cursorConnected: true }),
      );
      await waitFor(() => expect(result.current.runs).toHaveLength(1));
      expect(result.current.selectedRun?.id).toBe("run-1");
    });
  });

  describe("loadRuns", () => {
    it("sets pollPausedUntil on 429 with Retry-After", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        fakeResponse({
          ok: false,
          status: 429,
          body: { error: "rate_limited" },
          headers: { "Retry-After": "30" },
        }),
      );
      const { result } = renderHook(() =>
        useIdeaRuns({ user: USER, cursorConnected: true }),
      );
      await waitFor(() => expect(result.current.error).toContain("Pausing refresh"));
    });

    it("sets generic error on 4xx", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        fakeResponse({ ok: false, status: 400, body: { error: "bad_request", errorId: "x1" } }),
      );
      const { result } = renderHook(() =>
        useIdeaRuns({ user: USER, cursorConnected: true }),
      );
      await waitFor(() => expect(result.current.error).toBeTruthy());
    });

    it("bumps poll failures on 5xx", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        fakeResponse({ ok: false, status: 500, body: {} }),
      );
      const { result } = renderHook(() =>
        useIdeaRuns({ user: USER, cursorConnected: true }),
      );
      await waitFor(() => expect(result.current.error).toBeTruthy());
    });

    it("sets network-error message on fetch throw", async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("offline"));
      const { result } = renderHook(() =>
        useIdeaRuns({ user: USER, cursorConnected: true }),
      );
      await waitFor(() => expect(result.current.error).toContain("Network error"));
    });
  });

  describe("launchIdeaRun", () => {
    const FORM = {
      mode: "freeform" as const,
      interests: ["ai"],
      skills: ["ts"],
      preferredArea: [],
      constraints: [],
      freeform: "Build a thing",
      issue: null,
    };

    it("returns null when user is missing", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        fakeResponse({ ok: true, body: { runs: [] } }),
      );
      const { result } = renderHook(() =>
        useIdeaRuns({ user: null, cursorConnected: true }),
      );
      const run = await result.current.launchIdeaRun(FORM);
      expect(run).toBeNull();
    });

    it("redirects to /profile/cursor when error is cursor_not_connected", async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(fakeResponse({ ok: true, body: { runs: [] } })) // mount load
        .mockResolvedValueOnce(
          fakeResponse({ ok: false, status: 412, body: { error: "cursor_not_connected" } }),
        );
      const { result } = renderHook(() =>
        useIdeaRuns({ user: USER, cursorConnected: true }),
      );
      await waitFor(() => expect(result.current.loadingState).toBe("idle"));
      await act(async () => {
        await result.current.launchIdeaRun(FORM);
      });
      expect(mockReplace).toHaveBeenCalledWith(expect.stringContaining("/profile/cursor"));
    });

    it("prepends new run + selects it on success", async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(fakeResponse({ ok: true, body: { runs: [] } }))
        .mockResolvedValueOnce(fakeResponse({ ok: true, body: { run: FAKE_RUN } }));
      const { result } = renderHook(() =>
        useIdeaRuns({ user: USER, cursorConnected: true }),
      );
      await waitFor(() => expect(result.current.loadingState).toBe("idle"));
      await act(async () => {
        const run = await result.current.launchIdeaRun(FORM);
        expect(run?.id).toBe("run-1");
      });
      expect(result.current.runs).toHaveLength(1);
      expect(result.current.selectedRun?.id).toBe("run-1");
    });

    it("sets network-error when fetch throws", async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(fakeResponse({ ok: true, body: { runs: [] } }))
        .mockRejectedValueOnce(new Error("offline"));
      const { result } = renderHook(() =>
        useIdeaRuns({ user: USER, cursorConnected: true }),
      );
      await waitFor(() => expect(result.current.loadingState).toBe("idle"));
      await act(async () => {
        const run = await result.current.launchIdeaRun(FORM);
        expect(run).toBeNull();
      });
      expect(result.current.error).toContain("Network error while launching");
    });

    it("sets error from API errorId/error on !ok", async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(fakeResponse({ ok: true, body: { runs: [] } }))
        .mockResolvedValueOnce(
          fakeResponse({ ok: false, status: 400, body: { error: "validation_failed", errorId: "abc" } }),
        );
      const { result } = renderHook(() =>
        useIdeaRuns({ user: USER, cursorConnected: true }),
      );
      await waitFor(() => expect(result.current.loadingState).toBe("idle"));
      await act(async () => {
        await result.current.launchIdeaRun(FORM);
      });
      expect(result.current.error).toBeTruthy();
    });
  });

  describe("loadGithubIssues", () => {
    it("populates issues on success", async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(fakeResponse({ ok: true, body: { runs: [] } }))
        .mockResolvedValueOnce(
          fakeResponse({
            ok: true,
            body: {
              issues: [
                {
                  number: 7,
                  title: "Bug",
                  url: "https://example.com/7",
                  body: null,
                  labels: [],
                },
              ],
            },
          }),
        );
      const { result } = renderHook(() =>
        useIdeaRuns({ user: USER, cursorConnected: true }),
      );
      await waitFor(() => expect(result.current.loadingState).toBe("idle"));
      await act(async () => {
        await result.current.loadGithubIssues();
      });
      expect(result.current.githubIssues).toHaveLength(1);
    });

    it("sets error when API returns !ok", async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(fakeResponse({ ok: true, body: { runs: [] } }))
        .mockResolvedValueOnce(fakeResponse({ ok: false, status: 500, body: {} }));
      const { result } = renderHook(() =>
        useIdeaRuns({ user: USER, cursorConnected: true }),
      );
      await waitFor(() => expect(result.current.loadingState).toBe("idle"));
      await act(async () => {
        await result.current.loadGithubIssues();
      });
      expect(result.current.githubIssuesError).toContain("Could not load");
    });

    it("sets network error on fetch throw", async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(fakeResponse({ ok: true, body: { runs: [] } }))
        .mockRejectedValueOnce(new Error("net"));
      const { result } = renderHook(() =>
        useIdeaRuns({ user: USER, cursorConnected: true }),
      );
      await waitFor(() => expect(result.current.loadingState).toBe("idle"));
      await act(async () => {
        await result.current.loadGithubIssues();
      });
      expect(result.current.githubIssuesError).toContain("Network error");
    });

    it("is a no-op when user is null", async () => {
      const { result } = renderHook(() =>
        useIdeaRuns({ user: null, cursorConnected: true }),
      );
      await act(async () => {
        await result.current.loadGithubIssues();
      });
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe("refreshRun", () => {
    it("redirects when refreshSkipped=cursor_not_connected", async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(fakeResponse({ ok: true, body: { runs: [FAKE_RUN] } }))
        .mockResolvedValueOnce(
          fakeResponse({ ok: true, body: { refreshSkipped: "cursor_not_connected" } }),
        );
      const { result } = renderHook(() =>
        useIdeaRuns({ user: USER, cursorConnected: true }),
      );
      await waitFor(() => expect(result.current.runs).toHaveLength(1));
      await act(async () => {
        await result.current.refreshRun("run-1");
      });
      expect(mockReplace).toHaveBeenCalledWith(expect.stringContaining("/profile/cursor"));
    });

    it("updates the run on success", async () => {
      const UPDATED = { ...FAKE_RUN, status: "complete" };
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(fakeResponse({ ok: true, body: { runs: [FAKE_RUN] } }))
        .mockResolvedValueOnce(fakeResponse({ ok: true, body: { run: UPDATED } }));
      const { result } = renderHook(() =>
        useIdeaRuns({ user: USER, cursorConnected: true }),
      );
      await waitFor(() => expect(result.current.runs).toHaveLength(1));
      await act(async () => {
        await result.current.refreshRun("run-1");
      });
      expect(result.current.runs[0]?.status).toBe("complete");
    });

    it("sets error when !ok", async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(fakeResponse({ ok: true, body: { runs: [FAKE_RUN] } }))
        .mockResolvedValueOnce(
          fakeResponse({ ok: false, status: 500, body: { error: "boom" } }),
        );
      const { result } = renderHook(() =>
        useIdeaRuns({ user: USER, cursorConnected: true }),
      );
      await waitFor(() => expect(result.current.runs).toHaveLength(1));
      await act(async () => {
        await result.current.refreshRun("run-1");
      });
      expect(result.current.error).toBeTruthy();
    });

    it("sets network error on throw", async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(fakeResponse({ ok: true, body: { runs: [FAKE_RUN] } }))
        .mockRejectedValueOnce(new Error("nope"));
      const { result } = renderHook(() =>
        useIdeaRuns({ user: USER, cursorConnected: true }),
      );
      await waitFor(() => expect(result.current.runs).toHaveLength(1));
      await act(async () => {
        await result.current.refreshRun("run-1");
      });
      expect(result.current.error).toContain("Network error");
    });
  });

  describe("clearError", () => {
    it("clears the error state", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        fakeResponse({ ok: false, status: 500, body: { error: "boom" } }),
      );
      const { result } = renderHook(() =>
        useIdeaRuns({ user: USER, cursorConnected: true }),
      );
      await waitFor(() => expect(result.current.error).toBeTruthy());
      act(() => result.current.clearError());
      expect(result.current.error).toBeNull();
    });
  });

  describe("mutateRun", () => {
    beforeEach(() => {
      jest.spyOn(window, "confirm").mockReturnValue(true);
    });
    afterEach(() => {
      jest.spyOn(window, "confirm").mockRestore();
    });

    it("delete: removes run from list and re-selects", async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(fakeResponse({ ok: true, body: { runs: [FAKE_RUN] } }))
        .mockResolvedValueOnce(fakeResponse({ ok: true, body: {} }));
      const { result } = renderHook(() =>
        useIdeaRuns({ user: USER, cursorConnected: true }),
      );
      await waitFor(() => expect(result.current.runs).toHaveLength(1));
      await act(async () => {
        await result.current.mutateRun("run-1", "delete");
      });
      expect(result.current.runs).toHaveLength(0);
    });

    it("delete: returns early if user cancels window.confirm", async () => {
      (window.confirm as jest.Mock).mockReturnValue(false);
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        fakeResponse({ ok: true, body: { runs: [FAKE_RUN] } }),
      );
      const { result } = renderHook(() =>
        useIdeaRuns({ user: USER, cursorConnected: true }),
      );
      await waitFor(() => expect(result.current.runs).toHaveLength(1));
      const fetchCallsBefore = (global.fetch as jest.Mock).mock.calls.length;
      await act(async () => {
        await result.current.mutateRun("run-1", "delete");
      });
      expect((global.fetch as jest.Mock).mock.calls.length).toBe(fetchCallsBefore);
    });

    it("cancel: replaces run with updated payload", async () => {
      const UPDATED = { ...FAKE_RUN, status: "cancelled" };
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(fakeResponse({ ok: true, body: { runs: [FAKE_RUN] } }))
        .mockResolvedValueOnce(fakeResponse({ ok: true, body: { run: UPDATED } }));
      const { result } = renderHook(() =>
        useIdeaRuns({ user: USER, cursorConnected: true }),
      );
      await waitFor(() => expect(result.current.runs).toHaveLength(1));
      await act(async () => {
        await result.current.mutateRun("run-1", "cancel");
      });
      expect(result.current.runs[0]?.status).toBe("cancelled");
    });

    it("sets error when API !ok", async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(fakeResponse({ ok: true, body: { runs: [FAKE_RUN] } }))
        .mockResolvedValueOnce(
          fakeResponse({ ok: false, status: 500, body: { error: "boom" } }),
        );
      const { result } = renderHook(() =>
        useIdeaRuns({ user: USER, cursorConnected: true }),
      );
      await waitFor(() => expect(result.current.runs).toHaveLength(1));
      await act(async () => {
        await result.current.mutateRun("run-1", "archive");
      });
      expect(result.current.error).toBeTruthy();
    });

    it("sets network error on throw", async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(fakeResponse({ ok: true, body: { runs: [FAKE_RUN] } }))
        .mockRejectedValueOnce(new Error("net"));
      const { result } = renderHook(() =>
        useIdeaRuns({ user: USER, cursorConnected: true }),
      );
      await waitFor(() => expect(result.current.runs).toHaveLength(1));
      await act(async () => {
        await result.current.mutateRun("run-1", "archive");
      });
      expect(result.current.error).toContain("Network error");
    });
  });

  describe("advanceWorkflow", () => {
    it("updates the run on success", async () => {
      const UPDATED = { ...FAKE_RUN, status: "questions-answered" };
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(fakeResponse({ ok: true, body: { runs: [FAKE_RUN] } }))
        .mockResolvedValueOnce(fakeResponse({ ok: true, body: { run: UPDATED } }));
      const { result } = renderHook(() =>
        useIdeaRuns({ user: USER, cursorConnected: true }),
      );
      await waitFor(() => expect(result.current.runs).toHaveLength(1));
      await act(async () => {
        const run = await result.current.advanceWorkflow("run-1", "answers", { foo: "bar" });
        expect(run?.id).toBe("run-1");
      });
      expect(result.current.runs[0]?.status).toBe("questions-answered");
    });

    it("sets run-scoped error for agent_recovery_required", async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(fakeResponse({ ok: true, body: { runs: [FAKE_RUN] } }))
        .mockResolvedValueOnce(
          fakeResponse({ ok: false, status: 409, body: { error: "agent_recovery_required" } }),
        );
      const { result } = renderHook(() =>
        useIdeaRuns({ user: USER, cursorConnected: true }),
      );
      await waitFor(() => expect(result.current.runs).toHaveLength(1));
      await act(async () => {
        await result.current.advanceWorkflow("run-1", "approve-plan");
      });
      expect(result.current.runErrors["run-1"]).toContain("Cloud Agent");
    });

    it("sets generic run-scoped error on !ok", async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(fakeResponse({ ok: true, body: { runs: [FAKE_RUN] } }))
        .mockResolvedValueOnce(
          fakeResponse({ ok: false, status: 400, body: { error: "boom", errorId: "x" } }),
        );
      const { result } = renderHook(() =>
        useIdeaRuns({ user: USER, cursorConnected: true }),
      );
      await waitFor(() => expect(result.current.runs).toHaveLength(1));
      await act(async () => {
        await result.current.advanceWorkflow("run-1", "approve-plan");
      });
      expect(result.current.runErrors["run-1"]).toBeTruthy();
    });

    it("sets network error on throw", async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(fakeResponse({ ok: true, body: { runs: [FAKE_RUN] } }))
        .mockRejectedValueOnce(new Error("net"));
      const { result } = renderHook(() =>
        useIdeaRuns({ user: USER, cursorConnected: true }),
      );
      await waitFor(() => expect(result.current.runs).toHaveLength(1));
      await act(async () => {
        await result.current.advanceWorkflow("run-1", "open-pr");
      });
      expect(result.current.runErrors["run-1"]).toContain("Network error");
    });
  });
});
