/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { FieldValue, Timestamp } from "firebase-admin/firestore";

export const CURSOR_IDEA_RUNS_COLLECTION = "cursorAgentRuns";
export const CURSOR_BOSTON_REPO_URL =
  "https://github.com/rogerSuperBuilderAlpha/cursor-boston";
export const CURSOR_BOSTON_STARTING_REF = "develop";
export const CURSOR_BOSTON_CLOUD_AGENT_BASE_REF = "cloud-agent-dev";

export type CursorIdeaRunStatus = "starting" | "running" | "finished" | "error" | "cancelled";
export type CursorIdeaWorkflowStage =
  | "ideas"
  | "questions"
  | "planning"
  | "plan_approval"
  | "building"
  | "ready_for_pr"
  | "pr_open"
  | "pr_commented_on"
  | "pr_merged";

export interface CursorIdeaRunInputs {
  mode?: "idea" | "issue";
  interests?: string;
  skills?: string;
  preferredArea?: string;
  constraints?: string;
  freeform?: string;
  issueNumber?: string;
  issueTitle?: string;
  issueBody?: string;
  issueUrl?: string;
  issueLabels?: string;
}

export interface CursorIdeaRunArtifact {
  path: string;
  sizeBytes: number;
  updatedAt: string;
}

export interface CursorIdeaRunActivity {
  id: string;
  role: "user" | "assistant";
  summary: string;
  kind?: "message" | "thinking" | "status" | "tool" | "shell";
}

export interface CursorIdeaQuestion {
  id: string;
  question: string;
  suggestions?: string[];
  answer?: string;
}

export interface CursorIdeaPrState {
  status: "not_started" | "opening" | "pr_open" | "pr_commented_on" | "pr_merged";
  url?: string | null;
  number?: number | null;
  openedAt?: Timestamp | FieldValue | Date | string | null;
  lastCommentedAt?: Timestamp | FieldValue | Date | string | null;
  mergedAt?: Timestamp | FieldValue | Date | string | null;
}

export interface CursorIdeaRunRecord {
  id: string;
  userId: string;
  type: "pr_ideas";
  status: CursorIdeaRunStatus;
  workflowStage?: CursorIdeaWorkflowStage;
  cursorAgentId?: string;
  cursorRunId?: string;
  cursorAgentUrl?: string;
  questionRunId?: string;
  planRunId?: string;
  buildRunId?: string;
  prRunId?: string;
  prompt: string;
  inputs: CursorIdeaRunInputs;
  result?: string | null;
  selectedIdea?: string | null;
  questions?: CursorIdeaQuestion[];
  answersSubmittedAt?: Timestamp | FieldValue | Date | string | null;
  buildPlan?: string | null;
  buildResult?: string | null;
  planApprovedAt?: Timestamp | FieldValue | Date | string | null;
  pr?: CursorIdeaPrState | null;
  git?: unknown;
  artifacts?: CursorIdeaRunArtifact[];
  activity?: CursorIdeaRunActivity[];
  cursorStatusDetail?: string | null;
  cursorLastActivityAt?: Timestamp | FieldValue | Date | string | null;
  durationMs?: number | null;
  error?: string | null;
  createdAt?: Timestamp | FieldValue | Date | string | null;
  updatedAt?: Timestamp | FieldValue | Date | string | null;
  finishedAt?: Timestamp | FieldValue | Date | string | null;
  archivedAt?: Timestamp | FieldValue | Date | string | null;
}

export function buildPrIdeaPrompt(inputs: CursorIdeaRunInputs): string {
  if (inputs.mode === "issue") return buildIssuePrompt(inputs);

  const interests = inputs.interests?.trim() || "not specified";
  const skills = inputs.skills?.trim() || "not specified";
  const preferredArea = inputs.preferredArea?.trim() || "not specified";
  const constraints = inputs.constraints?.trim() || "small, reviewable PRs preferred";
  const freeform = inputs.freeform?.trim() || "not specified";

  return [
    "You are helping a Cursor Boston member find practical pull request ideas for the Cursor Boston website and community platform.",
    "",
    "Repository:",
    `- ${CURSOR_BOSTON_REPO_URL}`,
    `- Start from the ${CURSOR_BOSTON_CLOUD_AGENT_BASE_REF} branch. That branch is kept as the Cloud Agent integration branch off ${CURSOR_BOSTON_STARTING_REF}.`,
    "",
    "Public site to understand product context:",
    "- https://cursorboston.com",
    "",
    "User context:",
    `- Interests: ${interests}`,
    `- Skills: ${skills}`,
    `- Preferred area: ${preferredArea}`,
    `- Constraints: ${constraints}`,
    `- What they want to do: ${freeform}`,
    "",
    "Task:",
    "Inspect the repository and public product context. Do not make commits, do not open a PR, and do not modify files.",
    "Return 3-5 concrete, small, reviewable PR ideas this member could contribute.",
    "",
    "For each idea include:",
    "1. Title",
    "2. Why it matters to Cursor Boston users",
    "3. Suggested implementation approach",
    "4. First files or directories to inspect",
    "5. Estimated difficulty",
    "6. Risks or test coverage to consider",
    "",
    "Prefer ideas that are useful, scoped, and likely to be accepted in a normal contributor PR.",
  ].join("\n");
}

function buildIssuePrompt(inputs: CursorIdeaRunInputs): string {
  const issueNumber = inputs.issueNumber?.trim() || "not specified";
  const issueTitle = inputs.issueTitle?.trim() || "not specified";
  const issueBody = inputs.issueBody?.trim() || "not specified";
  const issueUrl = inputs.issueUrl?.trim() || "not specified";
  const issueLabels = inputs.issueLabels?.trim() || "none";
  const freeform = inputs.freeform?.trim() || "not specified";

  return [
    "You are helping a Cursor Boston member evaluate a GitHub issue as a contribution PR target.",
    "",
    "Repository:",
    `- ${CURSOR_BOSTON_REPO_URL}`,
    `- Start from the ${CURSOR_BOSTON_CLOUD_AGENT_BASE_REF} branch. That branch is kept as the Cloud Agent integration branch off ${CURSOR_BOSTON_STARTING_REF}.`,
    "",
    "Selected GitHub issue:",
    `- Issue: #${issueNumber} ${issueTitle}`,
    `- URL: ${issueUrl}`,
    `- Labels: ${issueLabels}`,
    "",
    "Issue body:",
    issueBody,
    "",
    "User context:",
    `- What they want to do: ${freeform}`,
    "",
    "Task:",
    "Inspect the repository and public product context. Do not make commits, do not open a PR, and do not modify files.",
    "Return 2-4 concrete, small, reviewable implementation approaches for this issue.",
    "",
    "For each approach include:",
    "1. Title",
    "2. Why it addresses the issue",
    "3. Suggested implementation approach",
    "4. First files or directories to inspect",
    "5. Estimated difficulty",
    "6. Risks or test coverage to consider",
    "",
    "Prefer the smallest useful PR that can realistically be accepted.",
  ].join("\n");
}

export function buildIdeaQuestionsPrompt(selectedIdea: string): string {
  return [
    "The user selected this PR idea:",
    selectedIdea.trim(),
    "",
    "Ask exactly 3 concise clarification questions before planning the build.",
    "For each question, include 3-5 short suggested answers the user can pick from, while still allowing a custom answer.",
    "Return ONLY valid JSON in this shape:",
    '[{"id":"goal","question":"...","suggestions":["...","...","..."]}]',
    "Do not write the build plan yet. Do not modify files.",
  ].join("\n");
}

export function buildIdeaPlanPrompt(
  selectedIdea: string,
  questions: CursorIdeaQuestion[]
): string {
  const answers = questions
    .map((item, index) => `${index + 1}. ${item.question}\nAnswer: ${item.answer || "No answer"}`)
    .join("\n\n");

  return [
    "Create a build plan for the selected PR idea using the user's answers.",
    "",
    "Selected idea:",
    selectedIdea.trim(),
    "",
    "Clarifying answers:",
    answers,
    "",
    "Return a concise markdown build plan with:",
    "1. Scope",
    "2. Files likely to change",
    "3. Implementation steps",
    "4. Validation/test plan",
    "5. Risks",
    "",
    "Do not modify files yet. Do not open a PR.",
  ].join("\n");
}

export function buildApprovedImplementationPrompt(buildPlan: string): string {
  return [
    "The user approved this build plan:",
    buildPlan.trim(),
    "",
    "Implement the plan in the repository. Keep the change small and reviewable.",
    "After editing, run the relevant checks you can reasonably run.",
    "Do not open a pull request yet.",
    "When done, summarize what changed, what checks ran, and whether the build is ready for PR.",
  ].join("\n");
}

export function buildOpenPrPrompt(): string {
  return [
    "Open a pull request for the implemented work.",
    `Use ${CURSOR_BOSTON_CLOUD_AGENT_BASE_REF} as the base branch.`,
    "Use a concise title and a PR body with summary and test plan.",
    "After opening the PR, return the PR URL and current PR status.",
  ].join("\n");
}

export function normalizeRunInputs(value: unknown): CursorIdeaRunInputs {
  const input = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const result: CursorIdeaRunInputs = {
    mode: input.mode === "issue" ? "issue" : "idea",
  };
  const assignIfSet = (key: keyof CursorIdeaRunInputs, raw: unknown, max: number) => {
    const trimmed = normalizeOptionalText(raw, max);
    if (trimmed !== undefined) {
      (result as Record<string, unknown>)[key] = trimmed;
    }
  };
  assignIfSet("interests", input.interests, 500);
  assignIfSet("skills", input.skills, 500);
  assignIfSet("preferredArea", input.preferredArea, 160);
  assignIfSet("constraints", input.constraints, 500);
  assignIfSet("freeform", input.freeform, 2000);
  assignIfSet("issueNumber", input.issueNumber, 20);
  assignIfSet("issueTitle", input.issueTitle, 500);
  assignIfSet("issueBody", input.issueBody, 4000);
  assignIfSet("issueUrl", input.issueUrl, 500);
  assignIfSet("issueLabels", input.issueLabels, 500);
  return result;
}

export type CursorIdeaWorkflowAction = "questions" | "answers" | "approve-plan" | "open-pr";

export function validateIdeaWorkflowAction(
  run: CursorIdeaRunRecord,
  action: CursorIdeaWorkflowAction
): string | null {
  switch (action) {
    case "questions":
      if (!run.cursorAgentId) return "agent_missing";
      if (run.workflowStage !== "ideas") return "invalid_stage";
      if (!run.result) return "ideas_not_ready";
      if (run.selectedIdea) return "direction_already_selected";
      return null;
    case "answers":
      if (!run.cursorAgentId) return "agent_missing";
      if (run.workflowStage !== "questions") return "invalid_stage";
      if (!run.selectedIdea) return "direction_missing";
      if (!run.questions || run.questions.length === 0) return "questions_not_ready";
      if (run.answersSubmittedAt) return "answers_already_submitted";
      return null;
    case "approve-plan":
      if (!run.cursorAgentId) return "agent_missing";
      if (run.workflowStage !== "plan_approval") return "invalid_stage";
      if (!run.buildPlan) return "plan_missing";
      if (run.planApprovedAt) return "plan_already_approved";
      return null;
    case "open-pr":
      if (!run.cursorAgentId) return "agent_missing";
      if (run.workflowStage !== "ready_for_pr") return "invalid_stage";
      if (!run.buildResult) return "build_not_ready";
      if (run.pr?.url) return "pr_already_open";
      return null;
  }
}

function normalizeOptionalText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
}
