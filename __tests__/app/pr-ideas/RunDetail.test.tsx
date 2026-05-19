/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

import { render, screen } from "@testing-library/react";
import { RunDetail } from "@/app/pr-ideas/_components/RunDetail";
import type { CursorIdeaRun } from "@/app/pr-ideas/_lib/types";

jest.mock("@/components/cookbook/PromptMarkdown", () => ({
  PromptMarkdown: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

const finishedRun: CursorIdeaRun = {
  id: "run-1",
  status: "finished",
  workflowStage: "ideas",
  prompt: "Add a community leaderboard",
  inputs: { mode: "idea", freeform: "leaderboard" },
  result: "## Suggestion one\nDetails here.",
  createdAt: "2026-05-01T12:00:00.000Z",
  finishedAt: "2026-05-01T12:30:00.000Z",
  durationMs: 1_800_000,
};

describe("RunDetail", () => {
  it("renders run prompt and finished state", () => {
    render(
      <RunDetail
        run={finishedRun}
        loadingState="idle"
        runAction={null}
        onRefresh={jest.fn()}
        onMutate={jest.fn()}
        onAdvanceWorkflow={jest.fn().mockResolvedValue(null)}
      />,
    );
    expect(
      screen.getByText(/Add a community leaderboard/i),
    ).toBeInTheDocument();
  });

  it("shows skeleton on initial load with no run", () => {
    const { container } = render(
      <RunDetail
        run={null}
        loadingState="initial"
        runAction={null}
        onRefresh={jest.fn()}
        onMutate={jest.fn()}
        onAdvanceWorkflow={jest.fn()}
      />,
    );
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });
});
