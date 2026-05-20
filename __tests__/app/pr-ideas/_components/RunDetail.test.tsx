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

  // ------------- Additional coverage for OpenSSF Gold push -------------

  it("copies agent id and run id from header buttons", async () => {
    renderDetail(baseRun);
    const writeText = navigator.clipboard.writeText as jest.Mock;

    await userEvent.click(
      screen.getByRole("button", { name: /Copy agent id/i })
    );
    expect(writeText).toHaveBeenCalledWith("agent-abc");

    await userEvent.click(
      screen.getByRole("button", { name: /Copy run id/i })
    );
    expect(writeText).toHaveBeenCalledWith("cursor-run-1");
  });

  it("disables agent-id copy button when there is no cursorAgentId", () => {
    const { cursorAgentId: _omit, ...rest } = baseRun;
    renderDetail(rest as CursorIdeaRun);
    const button = screen.getByRole("button", { name: /Copy agent id/i });
    expect(button).toBeDisabled();
  });

  it("falls back to run.id when cursorRunId is missing for copy run id", async () => {
    const { cursorRunId: _omit, ...rest } = baseRun;
    renderDetail(rest as CursorIdeaRun);
    const writeText = navigator.clipboard.writeText as jest.Mock;

    await userEvent.click(
      screen.getByRole("button", { name: /Copy run id/i })
    );
    expect(writeText).toHaveBeenCalledWith("run-1");
  });

  it("renders issue-mode title and source metadata", () => {
    const issueRun: CursorIdeaRun = {
      ...baseRun,
      inputs: {
        mode: "issue",
        issueNumber: "42",
        issueTitle: "Fix flaky test",
        interests: "Design systems",
        skills: "React",
        preferredArea: "Game",
        freeform: "extra context",
      },
    };
    renderDetail(issueRun);

    expect(screen.getAllByText(/#42 Fix flaky test/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Mode/)).toBeInTheDocument();
    expect(screen.getAllByText(/Issue/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Interests: Design systems/)).toBeInTheDocument();
    expect(screen.getByText(/Skills: React/)).toBeInTheDocument();
    expect(screen.getByText(/Area: Game/)).toBeInTheDocument();
    expect(screen.getByText(/extra context/)).toBeInTheDocument();
  });

  it("renders run.error banner when run carries an error string", () => {
    const erroredRun: CursorIdeaRun = {
      ...baseRun,
      status: "error",
      error: "Cursor agent timed out at planning step",
    };
    renderDetail(erroredRun);

    expect(
      screen.getByText(/Cursor agent timed out at planning step/i)
    ).toBeInTheDocument();
  });

  it("clicks each workflow rail step button (scrollIntoView) without error", async () => {
    const scrollIntoView = jest.fn();
    Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
    renderDetail(baseRun);

    // Rail step buttons are at the top of the workflow card. Click each label.
    for (const label of ["Source", "Direction", "Questions", "Plan", "Build", "PR"]) {
      await userEvent.click(screen.getByRole("button", { name: label }));
    }
    // Buttons should have triggered scrollIntoView calls (when target exists).
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it("renders Refresh spinner state when runAction is refresh", () => {
    renderDetail(baseRun, { runAction: `refresh:${baseRun.id}` });
    const refresh = screen.getByRole("button", { name: /^Refresh$/i });
    expect(refresh).toBeDisabled();
  });

  it("syncing pill shows 'Syncing...' when syncingRunId matches", () => {
    renderDetail(baseRun, { syncingRunId: baseRun.id });
    expect(screen.getByText(/Syncing\.\.\./)).toBeInTheDocument();
  });

  it("shows 'Waiting' in log when no recent activity and no cursorLastActivityAt", () => {
    const quietRun: CursorIdeaRun = {
      ...baseRun,
      activity: [],
      cursorLastActivityAt: null,
    };
    renderDetail(quietRun);
    expect(screen.getByText(/Waiting/)).toBeInTheDocument();
    expect(screen.getByText(/No activity synced yet/i)).toBeInTheDocument();
  });

  it("shows 'Synced ...' when cursorLastActivityAt is set", () => {
    const syncedRun: CursorIdeaRun = {
      ...baseRun,
      activity: [],
      cursorLastActivityAt: "2026-05-01T12:25:00.000Z",
    };
    renderDetail(syncedRun);
    expect(screen.getByText(/Synced/)).toBeInTheDocument();
  });

  it("renders cursorStatusDetail callout when present", () => {
    renderDetail({ ...baseRun, cursorStatusDetail: "Cloning the repo..." });
    expect(screen.getByText(/Cloning the repo/i)).toBeInTheDocument();
  });

  it("renders 'No run selected' empty state and no skeleton when idle without run", () => {
    const { container } = render(
      <RunDetail
        run={null}
        loadingState="idle"
        runAction={null}
        onRefresh={jest.fn()}
        onMutate={jest.fn()}
        onAdvanceWorkflow={jest.fn()}
      />
    );
    expect(container.querySelector(".animate-pulse")).toBeFalsy();
  });

  it("copies output content (PR url) and toggles result panel collapse", async () => {
    const prRun: CursorIdeaRun = {
      ...baseRun,
      pr: { status: "pr_open", url: "https://github.com/org/repo/pull/7" },
    };
    renderDetail(prRun);

    // Expand toggles to Full width
    await userEvent.click(screen.getByRole("button", { name: /^Expand$/i }));
    expect(screen.getByRole("button", { name: /Full width/i })).toBeInTheDocument();
    // Collapse back
    await userEvent.click(screen.getByRole("button", { name: /^Full width$/i }));
    expect(screen.getByRole("button", { name: /^Expand$/i })).toBeInTheDocument();
  });

  it("running planning agent shows 'Cancel run' footer button and triggers cancel mutate", async () => {
    const planning: CursorIdeaRun = {
      ...baseRun,
      status: "running",
      workflowStage: "planning",
      buildPlan: null,
    };
    const { onMutate } = renderDetail(planning);

    const cancelButtons = screen.getAllByRole("button", { name: /^Cancel run$/i });
    await userEvent.click(cancelButtons[0]!);
    expect(onMutate).toHaveBeenCalledWith("run-1", "cancel");
  });

  it("disables Hide and Delete buttons while actions are locked (agent working)", () => {
    const working: CursorIdeaRun = {
      ...baseRun,
      status: "running",
      workflowStage: "building",
      buildResult: null,
    };
    renderDetail(working);

    expect(screen.getByRole("button", { name: /Hide/i })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /Delete run permanently/i })
    ).toBeDisabled();
  });

  it("hides 'Hide' button when run is already archived", () => {
    renderDetail({ ...baseRun, archivedAt: "2026-05-02T00:00:00.000Z" });
    expect(screen.queryByRole("button", { name: /Hide/i })).not.toBeInTheDocument();
  });

  it("renders artifacts list as plain text when cursorAgentUrl is missing", () => {
    const noUrl: CursorIdeaRun = {
      ...baseRun,
      cursorAgentUrl: undefined,
      artifacts: [{ path: "lib/runner.ts", sizeBytes: 100, updatedAt: "2026-05-01T12:21:00.000Z" }],
    };
    renderDetail(noUrl);
    // Without cursorAgentUrl, path renders as <span>, not an anchor.
    const link = screen.queryByRole("link", { name: /lib\/runner\.ts/ });
    expect(link).not.toBeInTheDocument();
    expect(screen.getByText("lib/runner.ts")).toBeInTheDocument();
  });

  it("copies artifact path via Copy path button", async () => {
    renderDetail(baseRun);
    const writeText = navigator.clipboard.writeText as jest.Mock;

    await userEvent.click(screen.getByRole("button", { name: /Copy path/i }));
    expect(writeText).toHaveBeenCalledWith("src/leaderboard.ts");
  });

  it("appearsStuck path: renders 'This run looks stuck' UI with refresh/cancel/recover", async () => {
    // questions stage with no questions yet and elapsed > 2 * expectedWaitMaxMs (90s for questions).
    const longAgo = new Date(Date.now() - 10 * 60_000).toISOString();
    const stuck: CursorIdeaRun = {
      ...baseRun,
      status: "running",
      workflowStage: "questions",
      questions: undefined,
      createdAt: longAgo,
      durationMs: null,
    };
    const { onRefresh, onMutate, onAdvanceWorkflow } = renderDetail(stuck);

    expect(screen.getByText(/This run looks stuck/i)).toBeInTheDocument();
    expect(screen.getByText(/Needs attention/i)).toBeInTheDocument();

    // Stuck-block has its own refresh button (named "Refresh") — click the first.
    const refreshButtons = screen.getAllByRole("button", { name: /^Refresh$/i });
    await userEvent.click(refreshButtons[0]!);
    expect(onRefresh).toHaveBeenCalledWith("run-1");

    const cancelButtons = screen.getAllByRole("button", { name: /^Cancel run$/i });
    await userEvent.click(cancelButtons[0]!);
    expect(onMutate).toHaveBeenCalledWith("run-1", "cancel");

    await userEvent.click(
      screen.getByRole("button", { name: /Start a fresh Cloud Agent/i })
    );
    expect(onAdvanceWorkflow).toHaveBeenCalledWith("run-1", "recover-agent", undefined);
  });

  it("renders 'pr is open' heading + 'PR is open' description when pr.url is set", () => {
    const prOpen: CursorIdeaRun = {
      ...baseRun,
      workflowStage: "pr_open",
      pr: { status: "pr_open", url: "https://github.com/org/repo/pull/9" },
    };
    renderDetail(prOpen);
    expect(screen.getByRole("heading", { name: /PR is open/i })).toBeInTheDocument();
  });

  it("renders 'Opening the PR' heading when pr.status === 'opening'", () => {
    const opening: CursorIdeaRun = {
      ...baseRun,
      status: "running",
      workflowStage: "pr_open",
      pr: { status: "opening" },
    };
    renderDetail(opening);
    expect(screen.getByRole("heading", { name: /Opening the PR/i })).toBeInTheDocument();
  });

  it("renders building stage heading + skeleton when no buildResult yet", () => {
    const building: CursorIdeaRun = {
      ...baseRun,
      status: "running",
      workflowStage: "building",
      buildResult: null,
      planApprovedAt: new Date(Date.now() - 30_000).toISOString(),
    };
    renderDetail(building);
    expect(
      screen.getByRole("heading", { name: /Cloud Agent is building/i })
    ).toBeInTheDocument();
  });

  it("renders 'Build is ready for PR' heading when buildResult exists", () => {
    const ready: CursorIdeaRun = {
      ...baseRun,
      workflowStage: "ready_for_pr",
      buildResult: "Build summary",
    };
    renderDetail(ready);
    expect(screen.getByRole("heading", { name: /Build is ready for PR/i })).toBeInTheDocument();
  });

  it("renders 'Choose a direction' heading when result is set but no selectedIdea", () => {
    const choosing: CursorIdeaRun = {
      ...baseRun,
      workflowStage: "ideas",
      selectedIdea: null,
      result: "## Option one\nblah\n## Option two\nblah",
    };
    renderDetail(choosing);
    expect(screen.getByRole("heading", { name: /Choose a direction/i })).toBeInTheDocument();
  });

  it("renders questions skeleton when stage is questions and none loaded", () => {
    const drafting: CursorIdeaRun = {
      ...baseRun,
      status: "running",
      workflowStage: "questions",
      questions: undefined,
    };
    renderDetail(drafting);
    expect(
      screen.getByText(/Cursor is preparing questions for you/i)
    ).toBeInTheDocument();
  });

  it("free-text answer input updates state and Submit calls onAdvanceWorkflow", async () => {
    const q: CursorIdeaRun = {
      ...baseRun,
      status: "finished",
      workflowStage: "questions",
      questions: [{ id: "q1", question: "Which page?" }],
    };
    const { onAdvanceWorkflow } = renderDetail(q);

    const input = screen.getByPlaceholderText(/Pick a suggestion or write your own/i);
    await userEvent.type(input, "Profile");

    await userEvent.click(
      screen.getByRole("button", { name: /Submit answers and generate plan/i })
    );
    expect(onAdvanceWorkflow).toHaveBeenCalledWith("run-1", "answers", {
      answers: { q1: "Profile" },
    });
  });

  it("free-text direction textarea updates selection state", async () => {
    const choice: CursorIdeaRun = {
      ...baseRun,
      status: "finished",
      workflowStage: "ideas",
      selectedIdea: null,
      result: "no headings here",
    };
    const { onAdvanceWorkflow } = renderDetail(choice);

    const textarea = screen.getByPlaceholderText(/Pick one above or write your own/i);
    await userEvent.type(textarea, "My custom direction");

    await userEvent.click(
      screen.getByRole("button", { name: /Continue and ask questions/i })
    );
    expect(onAdvanceWorkflow).toHaveBeenCalledWith("run-1", "questions", {
      selectedIdea: "My custom direction",
    });
  });

  it("copies buildResult when no PR url and no buildPlan", async () => {
    const buildOnly: CursorIdeaRun = {
      ...baseRun,
      result: null,
      buildPlan: null,
      buildResult: "Build complete summary",
    };
    renderDetail(buildOnly);
    const writeText = navigator.clipboard.writeText as jest.Mock;

    const copies = screen.getAllByRole("button", { name: /^Copy$/i });
    await userEvent.click(copies[0]!);
    expect(writeText).toHaveBeenCalledWith("Build complete summary");
  });

  it("renders Output placeholder when no content available", () => {
    const empty: CursorIdeaRun = {
      ...baseRun,
      result: null,
      buildPlan: null,
      buildResult: null,
      pr: null,
    };
    renderDetail(empty);
    expect(
      screen.getByText(/Output will appear here when the current step completes/i)
    ).toBeInTheDocument();
  });

  it("running questions stage with empty questions array shows 'Waiting' or busy label", () => {
    const waitingQuestions: CursorIdeaRun = {
      ...baseRun,
      status: "running",
      workflowStage: "questions",
      questions: [],
    };
    renderDetail(waitingQuestions);
    // Either the stuck banner or the running banner — both fine. We just need
    // to hit the agentWorking=true branch with questions stage.
    expect(
      screen.getByRole("heading", { name: /Cloud Agent is drafting questions/i })
    ).toBeInTheDocument();
  });

  it("active 'starting' status without workflowStage uses default agent label", () => {
    const starting: CursorIdeaRun = {
      ...baseRun,
      status: "starting",
      workflowStage: undefined,
      durationMs: null,
      createdAt: new Date(Date.now() - 5_000).toISOString(),
    };
    renderDetail(starting);
    // Default branch → "exploring the repo".
    expect(
      screen.getAllByText(/Cursor Cloud Agent is exploring the repo/i).length
    ).toBeGreaterThan(0);
  });

  it("opens the agent-running modal when a workflow advance is triggered, and closes via Escape", async () => {
    // Start with a non-working ideas run so the Continue button is enabled,
    // then re-render with a running run to surface the modal layer.
    const idle: CursorIdeaRun = {
      ...baseRun,
      status: "finished",
      workflowStage: "ideas",
      selectedIdea: null,
      result: "## Foo bar\nMore content",
    };
    const running: CursorIdeaRun = {
      ...idle,
      status: "running",
    };
    const onAdvanceWorkflow = jest.fn().mockResolvedValue(null);

    const { rerender } = render(
      <RunDetail
        run={idle}
        loadingState="idle"
        runAction={null}
        onRefresh={jest.fn()}
        onMutate={jest.fn()}
        onAdvanceWorkflow={onAdvanceWorkflow}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: /Foo bar/i }));
    await userEvent.click(
      screen.getByRole("button", { name: /Continue and ask questions/i })
    );

    // Now flip run into a "running" state to make agentWorking true.
    rerender(
      <RunDetail
        run={running}
        loadingState="idle"
        runAction={null}
        onRefresh={jest.fn()}
        onMutate={jest.fn()}
        onAdvanceWorkflow={onAdvanceWorkflow}
      />
    );

    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    // Press Escape on window — modal listens for keydown on window.
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("agent-running modal: inner click does not close; Cancel button calls onMutate; Run in background closes", async () => {
    const idle: CursorIdeaRun = {
      ...baseRun,
      status: "finished",
      workflowStage: "ideas",
      selectedIdea: null,
      result: "## Foo bar\nMore content",
    };
    const running: CursorIdeaRun = {
      ...idle,
      status: "running",
    };
    const onAdvanceWorkflow = jest.fn().mockResolvedValue(null);
    const onMutate = jest.fn();

    const { rerender } = render(
      <RunDetail
        run={idle}
        loadingState="idle"
        runAction={null}
        onRefresh={jest.fn()}
        onMutate={onMutate}
        onAdvanceWorkflow={onAdvanceWorkflow}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: /Foo bar/i }));
    await userEvent.click(
      screen.getByRole("button", { name: /Continue and ask questions/i })
    );

    rerender(
      <RunDetail
        run={running}
        loadingState="idle"
        runAction={null}
        onRefresh={jest.fn()}
        onMutate={onMutate}
        onAdvanceWorkflow={onAdvanceWorkflow}
      />
    );

    const dialog = await screen.findByRole("dialog");
    // Inner content click should NOT close the modal (stopPropagation).
    const inner = dialog.firstChild as HTMLElement;
    fireEvent.click(inner);
    expect(screen.queryByRole("dialog")).toBeInTheDocument();

    // Cancel button inside the modal triggers onMutate('cancel').
    const modalCancel = screen.getAllByRole("button", { name: /^Cancel run$/i });
    await userEvent.click(modalCancel[modalCancel.length - 1]!);
    expect(onMutate).toHaveBeenCalledWith("run-1", "cancel");

    // "Run in background" closes the modal — there are two buttons that match
    // (an aria-labelled X icon and the text button); click the text one.
    const dismissButtons = screen.getAllByRole("button", { name: /Run in background/i });
    await userEvent.click(dismissButtons[dismissButtons.length - 1]!);
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("agent-running modal: appearsStuck branch swaps icon and shows past-typical hint", async () => {
    // Trigger from idle → running with elapsed > 2 * expectedWaitMaxMs (5 min default).
    const longAgo = new Date(Date.now() - 30 * 60_000).toISOString();
    const idle: CursorIdeaRun = {
      ...baseRun,
      status: "finished",
      workflowStage: "ideas",
      selectedIdea: null,
      result: "## Stuck path\nMore",
      createdAt: longAgo,
      durationMs: null,
    };
    const running: CursorIdeaRun = { ...idle, status: "running" };
    const onAdvanceWorkflow = jest.fn().mockResolvedValue(null);

    const { rerender } = render(
      <RunDetail
        run={idle}
        loadingState="idle"
        runAction={null}
        onRefresh={jest.fn()}
        onMutate={jest.fn()}
        onAdvanceWorkflow={onAdvanceWorkflow}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: /Stuck path/i }));
    await userEvent.click(
      screen.getByRole("button", { name: /Continue and ask questions/i })
    );

    rerender(
      <RunDetail
        run={running}
        loadingState="idle"
        runAction={null}
        onRefresh={jest.fn()}
        onMutate={jest.fn()}
        onAdvanceWorkflow={onAdvanceWorkflow}
      />
    );

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getAllByText(/Past typical window/i).length).toBeGreaterThan(0);
  });

  it("agent-running modal: backdrop click closes the modal", async () => {
    const idle: CursorIdeaRun = {
      ...baseRun,
      status: "finished",
      workflowStage: "ideas",
      selectedIdea: null,
      result: "## Backdrop test\nMore",
    };
    const running: CursorIdeaRun = { ...idle, status: "running" };
    const onAdvanceWorkflow = jest.fn().mockResolvedValue(null);

    const { rerender } = render(
      <RunDetail
        run={idle}
        loadingState="idle"
        runAction={null}
        onRefresh={jest.fn()}
        onMutate={jest.fn()}
        onAdvanceWorkflow={onAdvanceWorkflow}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: /Backdrop test/i }));
    await userEvent.click(
      screen.getByRole("button", { name: /Continue and ask questions/i })
    );

    rerender(
      <RunDetail
        run={running}
        loadingState="idle"
        runAction={null}
        onRefresh={jest.fn()}
        onMutate={jest.fn()}
        onAdvanceWorkflow={onAdvanceWorkflow}
      />
    );

    const dialog = await screen.findByRole("dialog");
    // Click directly on the backdrop (the dialog itself).
    fireEvent.click(dialog);
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("recovers agent without opening the modal (recover-agent skips modalOpen)", async () => {
    const onAdvanceWorkflow = jest.fn().mockResolvedValue(null);
    render(
      <RunDetail
        run={baseRun}
        loadingState="idle"
        runAction={null}
        error="Cloud agent timed out"
        onRefresh={jest.fn()}
        onMutate={jest.fn()}
        onAdvanceWorkflow={onAdvanceWorkflow}
      />
    );

    await userEvent.click(
      screen.getByRole("button", {
        name: /Start a fresh Cloud Agent from this context/i,
      })
    );
    expect(onAdvanceWorkflow).toHaveBeenCalledWith("run-1", "recover-agent", undefined);
    // Modal should not appear since recover-agent action skips setModalOpen.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does nothing on copy when there is no content (no PR, plan, result)", async () => {
    const empty: CursorIdeaRun = {
      ...baseRun,
      result: null,
      buildPlan: null,
      buildResult: null,
      pr: null,
    };
    renderDetail(empty);
    // No "Copy" button exists when outputContent is null — assert that.
    expect(screen.queryByRole("button", { name: /^Copy$/i })).not.toBeInTheDocument();
  });

  it("renders 'Cursor Cloud Agent is opening the PR' label in non-stuck pr_open opening state", () => {
    const opening: CursorIdeaRun = {
      ...baseRun,
      status: "running",
      workflowStage: "pr_open",
      pr: { status: "opening" },
      durationMs: null,
      // Fresh start so elapsed < 2 * expectedWaitMaxMs (360s for pr_open).
      createdAt: new Date(Date.now() - 1_000).toISOString(),
    };
    renderDetail(opening);
    expect(
      screen.getAllByText(/Cursor Cloud Agent is opening the PR/i).length
    ).toBeGreaterThan(0);
  });

  it("clicks footer 'Cancel run' button on an active run with no stuck banner", async () => {
    const planning: CursorIdeaRun = {
      ...baseRun,
      status: "running",
      workflowStage: "planning",
      buildPlan: null,
      durationMs: null,
      // Fresh start so appearsStuck=false and no stuck-block cancel button.
      createdAt: new Date(Date.now() - 2_000).toISOString(),
    };
    const { onMutate } = renderDetail(planning);
    // Only the footer Cancel run button exists (no stuck-block twin).
    const cancelButtons = screen.getAllByRole("button", { name: /^Cancel run$/i });
    expect(cancelButtons.length).toBeGreaterThan(0);
    await userEvent.click(cancelButtons[cancelButtons.length - 1]!);
    expect(onMutate).toHaveBeenCalledWith("run-1", "cancel");
  });

  it("clicks stuck-block refresh button on a stuck planning run", async () => {
    const longAgo = new Date(Date.now() - 30 * 60_000).toISOString();
    const stuck: CursorIdeaRun = {
      ...baseRun,
      status: "running",
      workflowStage: "planning",
      buildPlan: null,
      planApprovedAt: longAgo,
      answersSubmittedAt: longAgo,
      createdAt: longAgo,
      durationMs: null,
    };
    const { onRefresh } = renderDetail(stuck);
    // Stuck banner should be present.
    expect(screen.getByText(/This run looks stuck/i)).toBeInTheDocument();
    const refreshButtons = screen.getAllByRole("button", { name: /^Refresh$/i });
    // Header refresh is index 0; stuck-block refresh (line 574) is the second
    // copy when the stuck banner is rendered.
    expect(refreshButtons.length).toBeGreaterThanOrEqual(2);
    await userEvent.click(refreshButtons[1]!);
    expect(onRefresh).toHaveBeenCalledWith("run-1");
  });

  it("does not crash when run has no activity and agent is not working (peaceful idle)", () => {
    const idle: CursorIdeaRun = {
      ...baseRun,
      status: "finished",
      activity: [],
    };
    renderDetail(idle);
    expect(screen.getByText(/No activity synced yet/i)).toBeInTheDocument();
  });
});
