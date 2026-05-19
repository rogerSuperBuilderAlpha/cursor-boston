/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

import { render, screen, waitFor } from "@testing-library/react";
import { useAuth } from "@/contexts/AuthContext";
import { makeAuthUser } from "@/__tests__/app/_shared/game-dashboard-mocks";
import type { CursorIdeaRun } from "@/app/pr-ideas/_lib/types";

const finishedRun: CursorIdeaRun = {
  id: "run-1",
  status: "finished",
  workflowStage: "ideas",
  prompt: "Improve the game dashboard",
  inputs: { mode: "idea", freeform: "dashboard" },
  result: "Try surfacing threats earlier.",
  createdAt: "2026-05-01T00:00:00.000Z",
};

jest.mock("@/app/pr-ideas/_hooks/useIdeaRuns", () => ({
  useIdeaRuns: () => ({
    runs: [finishedRun],
    selectedRun: finishedRun,
    selectedRunId: "run-1",
    setSelectedRunId: jest.fn(),
    hasRuns: true,
    loadingState: "idle",
    runAction: null,
    syncingRunId: null,
    error: null,
    runErrors: {},
    githubIssues: [],
    githubIssuesLoading: false,
    githubIssuesError: null,
    loadRuns: jest.fn(),
    loadGithubIssues: jest.fn(),
    launchIdeaRun: jest.fn(),
    refreshRun: jest.fn(),
    mutateRun: jest.fn(),
    advanceWorkflow: jest.fn(),
    clearError: jest.fn(),
  }),
}));

jest.mock("@/components/cookbook/PromptMarkdown", () => ({
  PromptMarkdown: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

const mockUseAuth = useAuth as jest.Mock;

describe("PR ideas page", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser("u1"),
      userProfile: {
        cursor: {
          apiKeyFingerprint: "cur_1234",
          monthlyCapUsd: 20,
        },
      },
      loading: false,
    });
  });

  it("renders PR Studio with selected run", async () => {
    const Page = (await import("@/app/pr-ideas/page")).default;
    render(<Page />);

    await waitFor(() => {
      expect(screen.getByText(/PR Studio/i)).toBeInTheDocument();
      expect(screen.getByText(/Improve the game dashboard/i)).toBeInTheDocument();
    });
  });
});
