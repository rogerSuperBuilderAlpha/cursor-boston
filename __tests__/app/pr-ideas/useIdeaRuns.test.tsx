/**
 * @jest-environment jsdom
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import type { User } from "firebase/auth";
import { useIdeaRuns } from "@/app/pr-ideas/_hooks/useIdeaRuns";
import type { CursorIdeaRun } from "@/app/pr-ideas/_lib/types";

const mockReplace = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

const mockUser = {
  getIdToken: jest.fn().mockResolvedValue("test-token"),
} as unknown as User;

const FINISHED_RUN: CursorIdeaRun = {
  id: "run-1",
  status: "finished",
  workflowStage: "ideas",
  prompt: "test",
  inputs: { mode: "idea" },
};

const ACTIVE_RUN: CursorIdeaRun = {
  id: "run-2",
  status: "running",
  workflowStage: "questions",
  prompt: "active",
  inputs: { mode: "idea" },
  questions: [],
};

describe("useIdeaRuns", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it("loads runs on mount when cursor is connected", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ runs: [FINISHED_RUN] }),
    });

    const { result } = renderHook(() =>
      useIdeaRuns({ user: mockUser, cursorConnected: true })
    );

    await waitFor(() => {
      expect(result.current.runs).toHaveLength(1);
    });
    expect(result.current.hasRuns).toBe(true);
    expect(result.current.selectedRun?.id).toBe("run-1");
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/cursor/idea-runs?refresh=false",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
        }),
      })
    );
  });

  it("does not fetch when cursor is disconnected", async () => {
    const { result } = renderHook(() =>
      useIdeaRuns({ user: mockUser, cursorConnected: false })
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.current.runs).toEqual([]);
  });

  it("launchIdeaRun posts form payload and selects the new run", async () => {
    const launched: CursorIdeaRun = {
      ...ACTIVE_RUN,
      id: "run-new",
      status: "starting",
    };

    (global.fetch as jest.Mock).mockImplementation(async (url: string, init) => {
      if (init?.method === "POST" && url.endsWith("/api/cursor/idea-runs")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ run: launched }),
        };
      }
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({ runs: [] }),
      };
    });

    const { result } = renderHook(() =>
      useIdeaRuns({ user: mockUser, cursorConnected: true })
    );

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    let created: CursorIdeaRun | null = null;
    await act(async () => {
      created = await result.current.launchIdeaRun({
        mode: "idea",
        interests: ["oss"],
        skills: ["ts"],
        preferredArea: ["web"],
        constraints: [],
        freeform: "ship it",
        issue: null,
      });
    });

    expect(created?.id).toBe("run-new");
    expect(result.current.runs[0]?.id).toBe("run-new");
    expect(result.current.selectedRunId).toBe("run-new");
  });

  it("mutateRun delete removes run after confirm", async () => {
    const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(true);

    (global.fetch as jest.Mock).mockImplementation(async (url: string, init) => {
      if (init?.method === "DELETE") {
        return { ok: true, status: 200, json: async () => ({}) };
      }
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({ runs: [FINISHED_RUN, ACTIVE_RUN] }),
      };
    });

    const { result } = renderHook(() =>
      useIdeaRuns({ user: mockUser, cursorConnected: true })
    );

    await waitFor(() => expect(result.current.runs).toHaveLength(2), {
      timeout: 10000,
    });

    await act(async () => {
      await result.current.mutateRun("run-1", "delete");
    });

    expect(result.current.runs.find((r) => r.id === "run-1")).toBeUndefined();
    confirmSpy.mockRestore();
  });

  it("refreshRun updates a single run in the list", async () => {
    const refreshed = { ...FINISHED_RUN, prompt: "Updated prompt" };
    (global.fetch as jest.Mock).mockImplementation(async (url: string, init) => {
      if (
        (!init?.method || init.method === "GET") &&
        url === "/api/cursor/idea-runs/run-1"
      ) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ run: refreshed }),
        };
      }
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({ runs: [FINISHED_RUN] }),
      };
    });

    const { result } = renderHook(() =>
      useIdeaRuns({ user: mockUser, cursorConnected: true }),
    );
    await waitFor(() => expect(result.current.runs).toHaveLength(1), {
      timeout: 10000,
    });

    await act(async () => {
      await result.current.refreshRun("run-1");
    });

    expect(result.current.runs[0]?.prompt).toBe("Updated prompt");
    expect(result.current.loadingState).toBe("idle");
  });

  it("advanceWorkflow posts and merges returned run", async () => {
    const updated = {
      ...ACTIVE_RUN,
      workflowStage: "planning" as const,
      buildPlan: "## Plan",
    };
    (global.fetch as jest.Mock).mockImplementation(async (url: string, init) => {
      if (init?.method === "POST" && url.endsWith("/approve-plan")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ run: updated }),
        };
      }
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({ runs: [ACTIVE_RUN] }),
      };
    });

    const { result } = renderHook(() =>
      useIdeaRuns({ user: mockUser, cursorConnected: true }),
    );
    await waitFor(() => expect(result.current.runs).toHaveLength(1));

    let returned: CursorIdeaRun | null = null;
    await act(async () => {
      returned = await result.current.advanceWorkflow("run-2", "approve-plan");
    });

    expect(returned?.buildPlan).toBe("## Plan");
    expect(result.current.runs[0]?.buildPlan).toBe("## Plan");
  });

  it("setSelectedRunId switches the active run", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ runs: [FINISHED_RUN, ACTIVE_RUN] }),
    });

    const { result } = renderHook(() =>
      useIdeaRuns({ user: mockUser, cursorConnected: true }),
    );

    await waitFor(() => expect(result.current.runs).toHaveLength(2));

    act(() => {
      result.current.setSelectedRunId("run-2");
    });

    expect(result.current.selectedRunId).toBe("run-2");
    expect(result.current.selectedRun?.id).toBe("run-2");
  });

  it("loadGithubIssues fetches issues once", async () => {
    (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
      if (url.endsWith("/api/cursor/github-issues")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            issues: [{ number: 42, title: "Fix tests", body: "", url: "https://github.com/x/y/issues/42", labels: [] }],
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({ runs: [] }),
      };
    });

    const { result } = renderHook(() =>
      useIdeaRuns({ user: mockUser, cursorConnected: true }),
    );

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    await act(async () => {
      await result.current.loadGithubIssues();
    });

    expect(result.current.githubIssues).toHaveLength(1);
    expect(result.current.githubIssues[0]?.number).toBe(42);
  });

  it("pauses polling after repeated 500 errors", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      headers: { get: () => null },
      json: async () => ({ error: "list_failed", errorId: "e1" }),
    });

    const { result, rerender } = renderHook(() =>
      useIdeaRuns({ user: mockUser, cursorConnected: true }),
    );

    await waitFor(() => expect(result.current.error).toBeTruthy());

    (global.fetch as jest.Mock).mockClear();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      headers: { get: () => null },
      json: async () => ({ error: "list_failed", errorId: "e2" }),
    });

    await act(async () => {
      await result.current.loadRuns(true, "refreshing");
    });
    await act(async () => {
      await result.current.loadRuns(true, "refreshing");
    });
    rerender();

    expect(result.current.error).toMatch(/Polling paused/i);
  });

  it("redirects to cursor profile when launch reports cursor_not_connected", async () => {
    (global.fetch as jest.Mock).mockImplementation(async (url: string, init) => {
      if (init?.method === "POST" && url.endsWith("/api/cursor/idea-runs")) {
        return {
          ok: false,
          status: 400,
          json: async () => ({ error: "cursor_not_connected" }),
        };
      }
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({ runs: [] }),
      };
    });

    const { result } = renderHook(() =>
      useIdeaRuns({ user: mockUser, cursorConnected: true }),
    );
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    await act(async () => {
      const created = await result.current.launchIdeaRun({
        mode: "idea",
        interests: [],
        skills: [],
        preferredArea: [],
        constraints: [],
        freeform: "",
        issue: null,
      });
      expect(created).toBeNull();
    });

    expect(mockReplace).toHaveBeenCalledWith("/profile/cursor?return=/pr-ideas");
  });

  it("mutateRun archive updates the run in place", async () => {
    const archived = { ...FINISHED_RUN, status: "archived" as const };
    (global.fetch as jest.Mock).mockImplementation(async (url: string, init) => {
      if (init?.method === "POST" && url.endsWith("/archive")) {
        return { ok: true, status: 200, json: async () => ({ run: archived }) };
      }
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({ runs: [FINISHED_RUN] }),
      };
    });

    const { result } = renderHook(() =>
      useIdeaRuns({ user: mockUser, cursorConnected: true }),
    );
    await waitFor(() => expect(result.current.runs).toHaveLength(1));

    await act(async () => {
      await result.current.mutateRun("run-1", "archive");
    });

    expect(result.current.runs[0]?.status).toBe("archived");
  });

  it("mutateRun delete aborts when confirm is dismissed", async () => {
    jest.spyOn(window, "confirm").mockReturnValue(false);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ runs: [FINISHED_RUN] }),
    });

    const { result } = renderHook(() =>
      useIdeaRuns({ user: mockUser, cursorConnected: true }),
    );
    await waitFor(() => expect(result.current.runs).toHaveLength(1));

    await act(async () => {
      await result.current.mutateRun("run-1", "delete");
    });

    expect(result.current.runs).toHaveLength(1);
    expect(global.fetch).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/cursor/idea-runs/run-1"),
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("advanceWorkflow surfaces agent_recovery_required on the run", async () => {
    (global.fetch as jest.Mock).mockImplementation(async (url: string, init) => {
      if (init?.method === "POST" && url.endsWith("/recover-agent")) {
        return {
          ok: false,
          status: 409,
          json: async () => ({ error: "agent_recovery_required" }),
        };
      }
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({ runs: [ACTIVE_RUN] }),
      };
    });

    const { result } = renderHook(() =>
      useIdeaRuns({ user: mockUser, cursorConnected: true }),
    );
    await waitFor(() => expect(result.current.runs).toHaveLength(1));

    await act(async () => {
      const returned = await result.current.advanceWorkflow("run-2", "recover-agent");
      expect(returned).toBeNull();
    });

    expect(result.current.runErrors["run-2"]).toMatch(/no longer available/i);
  });

  it("refreshRun redirects when cursor is disconnected on the server", async () => {
    (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
      if (url === "/api/cursor/idea-runs/run-1") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ refreshSkipped: "cursor_not_connected" }),
        };
      }
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({ runs: [FINISHED_RUN] }),
      };
    });

    const { result } = renderHook(() =>
      useIdeaRuns({ user: mockUser, cursorConnected: true }),
    );
    await waitFor(() => expect(result.current.runs).toHaveLength(1));

    await act(async () => {
      await result.current.refreshRun("run-1");
    });

    expect(mockReplace).toHaveBeenCalledWith("/profile/cursor?return=/pr-ideas");
  });

  it("pauses refresh on 429 with Retry-After header", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 429,
      headers: { get: (name: string) => (name === "Retry-After" ? "30" : null) },
      json: async () => ({ error: "rate_limited" }),
    });

    const { result } = renderHook(() =>
      useIdeaRuns({ user: mockUser, cursorConnected: true }),
    );

    await waitFor(() => {
      expect(result.current.error).toMatch(/syncing too often/i);
    });
  });

  it("loadGithubIssues sets error when the API fails", async () => {
    (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
      if (url.endsWith("/api/cursor/github-issues")) {
        return { ok: false, status: 500, json: async () => ({}) };
      }
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({ runs: [] }),
      };
    });

    const { result } = renderHook(() =>
      useIdeaRuns({ user: mockUser, cursorConnected: true }),
    );
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    await act(async () => {
      await result.current.loadGithubIssues();
    });

    expect(result.current.githubIssuesError).toMatch(/Could not load GitHub issues/i);
  });

  it("clearError resets the banner message", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      headers: { get: () => null },
      json: async () => ({ error: "list_failed", errorId: "e1" }),
    });

    const { result } = renderHook(() =>
      useIdeaRuns({ user: mockUser, cursorConnected: true })
    );

    await waitFor(() => expect(result.current.error).toBeTruthy());

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });
});
