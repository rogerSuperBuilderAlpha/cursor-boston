/**
 * @jest-environment jsdom
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import type { User } from "firebase/auth";
import { useIdeaRuns } from "@/app/pr-ideas/_hooks/useIdeaRuns";
import type { CursorIdeaRun } from "@/app/pr-ideas/_lib/types";

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: jest.fn(),
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
