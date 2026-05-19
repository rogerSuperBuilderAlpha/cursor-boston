/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RunDetail } from "@/app/pr-ideas/_components/RunDetail";
import type { CursorIdeaRun } from "@/app/pr-ideas/_lib/types";

jest.mock("@/components/cookbook/PromptMarkdown", () => ({
  PromptMarkdown: ({ content }: { content: string }) => <div>{content}</div>,
}));

const baseRun: CursorIdeaRun = {
  id: "run-1",
  status: "finished",
  workflowStage: "ideas",
  prompt: "Add a community leaderboard",
  inputs: { mode: "idea", freeform: "leaderboard" },
  result: "## Suggestion one\nDetails here.\n## Suggestion two\nMore details.",
  createdAt: "2026-05-01T12:00:00.000Z",
  updatedAt: "2026-05-01T12:15:00.000Z",
  finishedAt: "2026-05-01T12:30:00.000Z",
  durationMs: 1_800_000,
  cursorAgentId: "agent-abc",
  cursorRunId: "cursor-run-1",
  cursorAgentUrl: "https://cursor.com/agents/abc",
  activity: [
    {
      id: "a1",
      role: "assistant",
      summary: "Explored repository structure",
      kind: "message",
    },
  ],
  artifacts: [{ path: "src/leaderboard.ts", sizeBytes: 1200, updatedAt: "2026-05-01T12:20:00.000Z" }],
};

function renderDetail(
  run: CursorIdeaRun | null,
  overrides: Partial<React.ComponentProps<typeof RunDetail>> = {}
) {
  const onRefresh = jest.fn();
  const onMutate = jest.fn();
  const onAdvanceWorkflow = jest.fn().mockResolvedValue(null);

  render(
    <RunDetail
      run={run}
      loadingState={overrides.loadingState ?? "idle"}
      runAction={overrides.runAction ?? null}
      syncingRunId={overrides.syncingRunId ?? null}
      error={overrides.error ?? null}
      onRefresh={overrides.onRefresh ?? onRefresh}
      onMutate={overrides.onMutate ?? onMutate}
      onAdvanceWorkflow={overrides.onAdvanceWorkflow ?? onAdvanceWorkflow}
    />
  );

  return { onRefresh, onMutate, onAdvanceWorkflow };
}

describe("RunDetail", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
    });
  });

  it("renders run prompt, metadata, and finished output", () => {
    renderDetail(baseRun);

    expect(screen.getByText(/Add a community leaderboard/i)).toBeInTheDocument();
    expect(screen.getByText(/agent-abc/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Suggestion one/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/Explored repository structure/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open in Cursor/i })).toHaveAttribute(
      "href",
      "https://cursor.com/agents/abc"
    );
    expect(screen.getByText("src/leaderboard.ts")).toBeInTheDocument();
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
      />
    );
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });

  it("shows empty state when idle without a selected run", () => {
    renderDetail(null);
    expect(screen.getByText(/No run selected/i)).toBeInTheDocument();
  });

  it("calls refresh and mutate handlers from footer actions", async () => {
    const { onRefresh, onMutate } = renderDetail(baseRun);

    await userEvent.click(screen.getByRole("button", { name: /^Refresh$/i }));
    expect(onRefresh).toHaveBeenCalledWith("run-1");

    await userEvent.click(screen.getByRole("button", { name: /Hide/i }));
    expect(onMutate).toHaveBeenCalledWith("run-1", "archive");

    await userEvent.click(
      screen.getByRole("button", { name: /Delete run permanently/i })
    );
    expect(onMutate).toHaveBeenCalledWith("run-1", "delete");
  });

  it("advances direction selection into the questions workflow", async () => {
    const directionRun: CursorIdeaRun = {
      ...baseRun,
      status: "finished",
      workflowStage: "ideas",
      selectedIdea: null,
    };
    const { onAdvanceWorkflow } = renderDetail(directionRun);

    await userEvent.click(screen.getByRole("button", { name: /Suggestion one/i }));
    await userEvent.click(
      screen.getByRole("button", { name: /Continue and ask questions/i })
    );

    expect(onAdvanceWorkflow).toHaveBeenCalledWith("run-1", "questions", {
      selectedIdea: "Suggestion one",
    });
  });

  it("submits answers for the questions stage", async () => {
    const questionsRun: CursorIdeaRun = {
      ...baseRun,
      status: "finished",
      workflowStage: "questions",
      questions: [
        {
          id: "q1",
          question: "Which page should host the leaderboard?",
          suggestions: ["Events page", "Profile page"],
        },
      ],
    };
    const { onAdvanceWorkflow } = renderDetail(questionsRun);

    await userEvent.click(screen.getByRole("button", { name: /Events page/i }));
    await userEvent.click(
      screen.getByRole("button", { name: /Submit answers and generate plan/i })
    );

    expect(onAdvanceWorkflow).toHaveBeenCalledWith("run-1", "answers", {
      answers: { q1: "Events page" },
    });
  });

  it("shows plan approval and PR-open actions", async () => {
    const planRun: CursorIdeaRun = {
      ...baseRun,
      workflowStage: "plan_approval",
      buildPlan: "## Plan\nShip leaderboard MVP",
    };
    const { onAdvanceWorkflow } = renderDetail(planRun);

    await userEvent.click(screen.getByRole("button", { name: /Approve and build/i }));
    expect(onAdvanceWorkflow).toHaveBeenCalledWith("run-1", "approve-plan", undefined);

    const prReadyRun: CursorIdeaRun = {
      ...planRun,
      workflowStage: "ready_for_pr",
      buildResult: "Build complete",
      pr: { status: "not_started" },
    };
    const prRender = renderDetail(prReadyRun);
    await userEvent.click(screen.getByRole("button", { name: /Open a PR/i }));
    expect(prRender.onAdvanceWorkflow).toHaveBeenCalledWith("run-1", "open-pr", undefined);
  });

  it("renders PR link and copies output", async () => {
    const prRun: CursorIdeaRun = {
      ...baseRun,
      workflowStage: "pr_open",
      pr: { status: "pr_open", url: "https://github.com/org/repo/pull/42" },
      buildResult: "Build complete",
    };
    renderDetail(prRun);

    expect(screen.getByRole("link", { name: /View PR/i })).toHaveAttribute(
      "href",
      "https://github.com/org/repo/pull/42"
    );

    const copyButtons = screen.getAllByRole("button", { name: /Copy/i });
    await userEvent.click(copyButtons[copyButtons.length - 1]!);
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
  });

  it("shows recover-agent action when parent passes an error", async () => {
    const { onAdvanceWorkflow } = renderDetail(baseRun, {
      error: "Cloud agent timed out",
    });

    await userEvent.click(
      screen.getByRole("button", {
        name: /Start a fresh Cloud Agent from this context/i,
      })
    );
    expect(onAdvanceWorkflow).toHaveBeenCalledWith("run-1", "recover-agent", undefined);
  });

  it("shows agent-running UI for active planning runs", () => {
    const activeRun: CursorIdeaRun = {
      ...baseRun,
      status: "running",
      workflowStage: "planning",
      buildPlan: null,
      durationMs: null,
      createdAt: new Date(Date.now() - 30_000).toISOString(),
    };
    renderDetail(activeRun);

    expect(
      screen.getByRole("heading", {
        name: /Cloud Agent is creating the build plan/i,
      })
    ).toBeInTheDocument();
  });

  it("expands output panel width toggle", async () => {
    renderDetail({
      ...baseRun,
      buildPlan: "## Plan\nDetails",
      result: null,
    });

    await userEvent.click(screen.getByRole("button", { name: /^Expand$/i }));
    expect(screen.getByRole("button", { name: /Full width/i })).toBeInTheDocument();
  });
});
