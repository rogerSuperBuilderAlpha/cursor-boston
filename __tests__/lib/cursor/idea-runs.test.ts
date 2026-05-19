/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import {
  buildApprovedImplementationPrompt,
  buildIdeaPlanPrompt,
  buildIdeaQuestionsPrompt,
  buildOpenPrPrompt,
  buildPrIdeaPrompt,
  normalizeRunInputs,
  validateIdeaWorkflowAction,
} from "@/lib/cursor/idea-runs";
import type { CursorIdeaRunRecord } from "@/lib/cursor/idea-runs";

describe("normalizeRunInputs", () => {
  it("never returns explicit undefined values when fields are missing", () => {
    const inputs = normalizeRunInputs({ mode: "issue", issueNumber: "12" });
    for (const [key, value] of Object.entries(inputs)) {
      expect(value).toBeDefined();
      expect(key).not.toBe("interests");
    }
    expect(inputs.mode).toBe("issue");
    expect(inputs.issueNumber).toBe("12");
    expect("interests" in inputs).toBe(false);
    expect("skills" in inputs).toBe(false);
  });

  it("keeps the values that were set", () => {
    const inputs = normalizeRunInputs({
      mode: "idea",
      interests: "react",
      preferredArea: "ui",
    });
    expect(inputs.mode).toBe("idea");
    expect(inputs.interests).toBe("react");
    expect(inputs.preferredArea).toBe("ui");
    expect("skills" in inputs).toBe(false);
  });

  it("treats whitespace-only strings as unset", () => {
    const inputs = normalizeRunInputs({ mode: "idea", interests: "   " });
    expect("interests" in inputs).toBe(false);
  });
});

describe("Cursor idea run prompts", () => {
  it("builds an issue-mode prompt with the selected issue and user context", () => {
    const prompt = buildPrIdeaPrompt({
      mode: "issue",
      issueNumber: "123",
      issueTitle: "Improve onboarding",
      issueUrl: "https://github.com/org/repo/issues/123",
      issueLabels: "good first issue,frontend",
      issueBody: "Make the first-run experience clearer.",
      freeform: "Keep it small and UI-focused.",
    });

    expect(prompt).toContain("Selected GitHub issue:");
    expect(prompt).toContain("#123 Improve onboarding");
    expect(prompt).toContain("cloud-agent-dev");
    expect(prompt).toContain("Make the first-run experience clearer.");
    expect(prompt).toContain("Keep it small and UI-focused.");
    expect(prompt).toContain("Return 2-4 concrete");
  });

  it("builds a questions prompt for the selected idea", () => {
    const prompt = buildIdeaQuestionsPrompt("Add dark mode toggle");
    expect(prompt).toContain("Add dark mode toggle");
    expect(prompt).toContain("exactly 3");
    expect(prompt).toContain("valid JSON");
  });

  it("includes answered questions in the plan prompt", () => {
    const prompt = buildIdeaPlanPrompt("Ship feature X", [
      { id: "q1", question: "Scope?", answer: "Small" },
    ]);
    expect(prompt).toContain("Ship feature X");
    expect(prompt).toContain("Scope?");
    expect(prompt).toContain("Small");
  });
});

function workflowRun(
  overrides: Partial<CursorIdeaRunRecord> = {},
): CursorIdeaRunRecord {
  return {
    id: "run-1",
    userId: "u1",
    type: "pr_ideas",
    status: "running",
    workflowStage: "ideas",
    cursorAgentId: "agent-1",
    prompt: "",
    inputs: {},
    result: "ideas ready",
    selectedIdea: null,
    questions: [],
    buildPlan: null,
    buildResult: null,
    pr: null,
    ...overrides,
  };
}

describe("validateIdeaWorkflowAction", () => {
  it("allows questions when ideas are ready and nothing selected yet", () => {
    expect(validateIdeaWorkflowAction(workflowRun(), "questions")).toBeNull();
  });

  it("rejects questions when agent id is missing", () => {
    expect(
      validateIdeaWorkflowAction(workflowRun({ cursorAgentId: undefined }), "questions"),
    ).toBe("agent_missing");
  });

  it("rejects approve-plan when plan is already approved", () => {
    expect(
      validateIdeaWorkflowAction(
        workflowRun({
          workflowStage: "plan_approval",
          buildPlan: "plan",
          planApprovedAt: new Date(),
        }),
        "approve-plan",
      ),
    ).toBe("plan_already_approved");
  });

  it("rejects open-pr when build output is missing", () => {
    expect(
      validateIdeaWorkflowAction(
        workflowRun({ workflowStage: "ready_for_pr", buildResult: null }),
        "open-pr",
      ),
    ).toBe("build_not_ready");
  });

  it("rejects questions when in wrong workflowStage", () => {
    expect(
      validateIdeaWorkflowAction(workflowRun({ workflowStage: "planning" }), "questions"),
    ).toBe("invalid_stage");
  });

  it("rejects questions when ideas are not ready (no result)", () => {
    expect(
      validateIdeaWorkflowAction(workflowRun({ result: null }), "questions"),
    ).toBe("ideas_not_ready");
  });

  it("rejects questions when selectedIdea already exists", () => {
    expect(
      validateIdeaWorkflowAction(
        workflowRun({ selectedIdea: "already chosen" }),
        "questions",
      ),
    ).toBe("direction_already_selected");
  });

  it("allows answers when ready", () => {
    expect(
      validateIdeaWorkflowAction(
        workflowRun({
          workflowStage: "questions",
          selectedIdea: "build it",
          questions: [{ id: "q1", question: "?", suggestions: ["a"] }],
        }),
        "answers",
      ),
    ).toBeNull();
  });

  it("rejects answers when agent missing", () => {
    expect(
      validateIdeaWorkflowAction(
        workflowRun({ cursorAgentId: undefined, workflowStage: "questions" }),
        "answers",
      ),
    ).toBe("agent_missing");
  });

  it("rejects answers when wrong workflowStage", () => {
    expect(
      validateIdeaWorkflowAction(
        workflowRun({ workflowStage: "ideas" }),
        "answers",
      ),
    ).toBe("invalid_stage");
  });

  it("rejects answers when no direction selected", () => {
    expect(
      validateIdeaWorkflowAction(
        workflowRun({
          workflowStage: "questions",
          selectedIdea: null,
        }),
        "answers",
      ),
    ).toBe("direction_missing");
  });

  it("rejects answers when no questions are ready", () => {
    expect(
      validateIdeaWorkflowAction(
        workflowRun({
          workflowStage: "questions",
          selectedIdea: "x",
          questions: [],
        }),
        "answers",
      ),
    ).toBe("questions_not_ready");
  });

  it("rejects answers when already submitted", () => {
    expect(
      validateIdeaWorkflowAction(
        workflowRun({
          workflowStage: "questions",
          selectedIdea: "x",
          questions: [{ id: "q1", question: "?", suggestions: [] }],
          answersSubmittedAt: new Date(),
        }),
        "answers",
      ),
    ).toBe("answers_already_submitted");
  });

  it("rejects approve-plan when in wrong workflowStage", () => {
    expect(
      validateIdeaWorkflowAction(
        workflowRun({ workflowStage: "questions", buildPlan: "p" }),
        "approve-plan",
      ),
    ).toBe("invalid_stage");
  });

  it("rejects approve-plan when buildPlan missing", () => {
    expect(
      validateIdeaWorkflowAction(
        workflowRun({ workflowStage: "plan_approval", buildPlan: null }),
        "approve-plan",
      ),
    ).toBe("plan_missing");
  });

  it("rejects open-pr when agent missing", () => {
    expect(
      validateIdeaWorkflowAction(
        workflowRun({ cursorAgentId: undefined, workflowStage: "ready_for_pr" }),
        "open-pr",
      ),
    ).toBe("agent_missing");
  });

  it("rejects open-pr when wrong workflowStage", () => {
    expect(
      validateIdeaWorkflowAction(
        workflowRun({ workflowStage: "planning", buildResult: "done" }),
        "open-pr",
      ),
    ).toBe("invalid_stage");
  });

  it("rejects open-pr when PR is already open", () => {
    expect(
      validateIdeaWorkflowAction(
        workflowRun({
          workflowStage: "ready_for_pr",
          buildResult: "done",
          pr: { status: "open", url: "https://github.com/x/y/pull/1" },
        }),
        "open-pr",
      ),
    ).toBe("pr_already_open");
  });

  it("allows open-pr when ready and pr.url absent (status alone is fine)", () => {
    expect(
      validateIdeaWorkflowAction(
        workflowRun({
          workflowStage: "ready_for_pr",
          buildResult: "done",
          pr: { status: "not_started" },
        }),
        "open-pr",
      ),
    ).toBeNull();
  });
});

describe("buildApprovedImplementationPrompt", () => {
  it("includes the approved build plan in the prompt body", () => {
    const prompt = buildApprovedImplementationPrompt("## Plan\n- step 1");
    expect(prompt).toContain("approved this build plan");
    expect(prompt).toContain("step 1");
    expect(prompt).toContain("Do not open a pull request yet");
  });
});

describe("buildOpenPrPrompt", () => {
  it("instructs the agent to open a PR against the cloud-agent base ref", () => {
    const prompt = buildOpenPrPrompt();
    expect(prompt).toContain("Open a pull request");
    expect(prompt).toContain("cloud-agent");
    expect(prompt).toContain("PR URL");
  });
});

describe("normalizeRunInputs — extra branches", () => {
  it("treats non-object input as empty {} with default mode='idea'", () => {
    const result = normalizeRunInputs(null);
    expect(result.mode).toBe("idea");
    expect("interests" in result).toBe(false);
  });

  it("treats undefined input as empty {} with default mode='idea'", () => {
    const result = normalizeRunInputs(undefined);
    expect(result.mode).toBe("idea");
  });

  it("clamps over-long text fields to their max length", () => {
    const big = "a".repeat(1000);
    const inputs = normalizeRunInputs({ mode: "idea", interests: big });
    // interests max is 500
    expect(inputs.interests?.length).toBeLessThanOrEqual(500);
  });
});
