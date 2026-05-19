/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import {
  buildIdeaPlanPrompt,
  buildIdeaQuestionsPrompt,
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
});
