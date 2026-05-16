/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 */

import {
  displayState,
  formatIdeaRunsApiError,
  formatIdeaRunsApiErrorMessage,
  hasLaunchableIdeaContent,
  emptyIdeaForm,
  type CursorIdeaRun,
} from "@/app/pr-ideas/_lib/types";

describe("displayState", () => {
  const base: CursorIdeaRun = {
    id: "r1",
    status: "finished",
    workflowStage: "pr_open",
    prompt: "p",
    inputs: {},
    pr: { status: "opening" },
  };

  it("treats PR opening as running (not finished)", () => {
    expect(displayState(base)).toBe("running");
  });

  it("returns pr_open when URL is present", () => {
    expect(
      displayState({
        ...base,
        pr: { status: "pr_open", url: "https://github.com/org/repo/pull/1" },
      })
    ).toBe("pr_open");
  });

  it("returns awaiting_input when questions need answers", () => {
    expect(
      displayState({
        ...base,
        status: "running",
        workflowStage: "questions",
        questions: [{ id: "q1", question: "Why?" }],
        pr: { status: "not_started" },
      })
    ).toBe("awaiting_input");
  });

  it("returns failed for error status", () => {
    expect(
      displayState({
        ...base,
        status: "error",
        pr: { status: "not_started" },
      })
    ).toBe("failed");
  });
});

describe("formatIdeaRunsApiError", () => {
  it("maps cursor_not_connected", () => {
    expect(formatIdeaRunsApiErrorMessage("cursor_not_connected")).toMatch(/connect/i);
  });

  it("appends error id when provided", () => {
    expect(formatIdeaRunsApiError("list_failed", "abc12345")).toContain("Ref: abc12345");
  });
});

describe("hasLaunchableIdeaContent", () => {
  it("is false for empty idea form", () => {
    expect(hasLaunchableIdeaContent(emptyIdeaForm())).toBe(false);
  });

  it("is true when freeform has text", () => {
    expect(hasLaunchableIdeaContent({ ...emptyIdeaForm(), freeform: "hello" })).toBe(true);
  });

  it("requires an issue in issue mode", () => {
    expect(
      hasLaunchableIdeaContent({
        ...emptyIdeaForm(),
        mode: "issue",
        issue: null,
      })
    ).toBe(false);
  });
});
