/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

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
  openedAt?: string | null;
  lastCommentedAt?: string | null;
  mergedAt?: string | null;
}

export interface CursorIdeaRun {
  id: string;
  status: CursorIdeaRunStatus;
  workflowStage?: CursorIdeaWorkflowStage;
  cursorAgentId?: string;
  cursorRunId?: string;
  questionRunId?: string;
  planRunId?: string;
  buildRunId?: string;
  prRunId?: string;
  cursorAgentUrl?: string;
  prompt: string;
  inputs: {
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
  };
  result?: string | null;
  selectedIdea?: string | null;
  questions?: CursorIdeaQuestion[];
  answersSubmittedAt?: string | null;
  buildPlan?: string | null;
  buildResult?: string | null;
  planApprovedAt?: string | null;
  pr?: CursorIdeaPrState | null;
  artifacts?: Array<{ path: string; sizeBytes: number; updatedAt: string }>;
  activity?: Array<{
    id: string;
    role: "user" | "assistant";
    summary: string;
    kind?: "message" | "thinking" | "status" | "tool" | "shell";
  }>;
  cursorStatusDetail?: string | null;
  cursorLastActivityAt?: string | null;
  durationMs?: number | null;
  error?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  finishedAt?: string | null;
  archivedAt?: string | null;
}

export const STATUS_STYLES: Record<CursorIdeaRunStatus, string> = {
  starting: "border-sky-500/30 bg-sky-500/10 text-sky-200",
  running: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  finished: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  error: "border-red-500/30 bg-red-500/10 text-red-200",
  cancelled: "border-neutral-600 bg-neutral-800 text-neutral-300",
};

export const IDEA_FIELD_OPTIONS = {
  interests: [
    "Design systems",
    "Community events",
    "Member onboarding",
    "Open source",
    "Mentorship",
    "Gamification",
  ],
  skills: [
    "React",
    "Next.js",
    "Firebase",
    "API routes",
    "Testing",
    "Docs",
    "Accessibility",
  ],
  preferredArea: [
    "Profile",
    "Events",
    "Game",
    "API",
    "Cookbook",
    "Questions",
    "Hackathons",
  ],
  constraints: [
    "Beginner-friendly",
    "Under 2 hours",
    "Small UI polish",
    "No database changes",
    "Test-focused",
    "Docs-only",
  ],
} as const;

export type IdeaFormKey = keyof typeof IDEA_FIELD_OPTIONS;
export interface GithubIssueOption {
  number: number;
  title: string;
  url: string;
  labels: string[];
  body: string | null;
  comments: number;
  updatedAt: string;
}

export interface LaunchFormState extends Record<IdeaFormKey, string[]> {
  mode: "idea" | "issue";
  freeform: string;
  issue?: GithubIssueOption | null;
}
export type IdeaFormState = Record<IdeaFormKey, string[]>;
export type LoadingState = "idle" | "initial" | "polling" | "refreshing";

export function emptyIdeaForm(): LaunchFormState {
  return {
    mode: "idea",
    interests: [],
    skills: [],
    preferredArea: [],
    constraints: [],
    freeform: "",
    issue: null,
  };
}

export function isActiveRun(status: CursorIdeaRunStatus): boolean {
  return status === "starting" || status === "running";
}

export type PrStudioDisplayState =
  | "queued"
  | "running"
  | "awaiting_input"
  | "finished"
  | "cancelled"
  | "failed"
  | "pr_open";

/** Single source of truth for status pill + rail dots (avoids contradictory raw chips). */
export function displayState(run: CursorIdeaRun): PrStudioDisplayState {
  if (run.pr?.url) return "pr_open";
  if (run.status === "error") return "failed";
  if (run.status === "cancelled") return "cancelled";
  if (run.pr?.status === "opening") return "running";
  if (run.workflowStage === "plan_approval" && run.buildPlan) return "awaiting_input";
  if (run.questions && run.questions.length > 0 && !run.answersSubmittedAt) return "awaiting_input";
  if (run.workflowStage === "ready_for_pr" && run.buildResult && !run.pr?.url) return "awaiting_input";
  if (run.result && !run.selectedIdea && run.workflowStage === "ideas") return "awaiting_input";
  if (run.status === "running" || run.status === "starting") return "running";
  if (run.workflowStage === "questions" && (!run.questions || run.questions.length === 0)) {
    return "running";
  }
  if (run.workflowStage === "planning" && !run.buildPlan) return "running";
  if (run.workflowStage === "building" && !run.buildResult) return "running";
  if (run.status === "finished") return "finished";
  return "queued";
}

export function displayStateLabel(state: PrStudioDisplayState): string {
  switch (state) {
    case "queued":
      return "queued";
    case "running":
      return "running";
    case "awaiting_input":
      return "needs your input";
    case "finished":
      return "finished";
    case "cancelled":
      return "cancelled";
    case "failed":
      return "failed";
    case "pr_open":
      return "PR open";
    default:
      return state;
  }
}

export const DISPLAY_STATE_PILL: Record<PrStudioDisplayState, string> = {
  queued: "border-neutral-600 bg-neutral-800 text-neutral-200",
  running: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  awaiting_input: "border-sky-500/30 bg-sky-500/10 text-sky-200",
  finished: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  cancelled: "border-neutral-600 bg-neutral-800 text-neutral-300",
  failed: "border-red-500/30 bg-red-500/10 text-red-200",
  pr_open: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
};

export const DISPLAY_STATE_DOT: Record<PrStudioDisplayState, string> = {
  queued: "bg-neutral-500",
  running: "bg-amber-400",
  awaiting_input: "bg-sky-400",
  finished: "bg-emerald-400",
  cancelled: "bg-neutral-500",
  failed: "bg-red-400",
  pr_open: "bg-emerald-400",
};

export const DISPLAY_STATE_RAIL_TEXT: Record<PrStudioDisplayState, string> = {
  queued: "text-neutral-400",
  running: "text-amber-300",
  awaiting_input: "text-sky-300",
  finished: "text-emerald-300",
  cancelled: "text-neutral-400",
  failed: "text-red-300",
  pr_open: "text-emerald-300",
};

/** Upper bound (ms) for "typical" wait — used for stuck detection (2× this). */
export function expectedWaitMaxMs(run: CursorIdeaRun): number {
  switch (run.workflowStage) {
    case "questions":
      return 90_000;
    case "planning":
      return 3 * 60_000;
    case "building":
      return 15 * 60_000;
    case "pr_open":
      return 3 * 60_000;
    case "ideas":
    default:
      return 5 * 60_000;
  }
}

export function typicalWaitLabel(run: CursorIdeaRun, pastTypicalWindow: boolean): string {
  if (pastTypicalWindow) return "Past typical window";
  switch (run.workflowStage) {
    case "questions":
      return "Typical: 30–90 seconds";
    case "planning":
      return "Typical: 1–3 minutes";
    case "building":
      return "Typical: 5–15 minutes";
    case "pr_open":
      return "Typical: 1–3 minutes";
    case "ideas":
    default:
      return "Typical: 2–5 minutes";
  }
}

export function hasLaunchableIdeaContent(form: LaunchFormState): boolean {
  if (form.mode === "issue") return Boolean(form.issue);
  return (
    form.interests.length > 0 ||
    form.skills.length > 0 ||
    form.preferredArea.length > 0 ||
    form.constraints.length > 0 ||
    form.freeform.trim().length > 0
  );
}

const IDEA_RUNS_ERROR_MESSAGES: Record<string, string> = {
  unauthenticated: "Sign in to continue.",
  not_found: "That run was not found.",
  not_configured: "Server is not configured for Cursor idea runs.",
  invalid_body: "Invalid request.",
  cursor_not_connected: "Connect your Cursor account first.",
  launch_failed: "Could not launch the Cloud Agent.",
  list_failed: "Could not load your runs.",
  refresh_failed: "Could not refresh that run.",
  delete_failed: "Could not delete that run.",
  approval_failed: "Could not approve the build plan.",
  agent_recovery_required: "Start a fresh Cloud Agent from this screen.",
};

export function formatIdeaRunsApiErrorMessage(code?: string): string {
  if (!code) return "Something went wrong.";
  return IDEA_RUNS_ERROR_MESSAGES[code] ?? `Error: ${code}`;
}

export function formatIdeaRunsApiError(code?: string, errorId?: string): string {
  const msg = formatIdeaRunsApiErrorMessage(code);
  return errorId ? `${msg} Ref: ${errorId}` : msg;
}

export function getRunTitle(run: CursorIdeaRun): string {
  if (run.inputs.mode === "issue" && run.inputs.issueNumber && run.inputs.issueTitle) {
    return `#${run.inputs.issueNumber} ${run.inputs.issueTitle}`;
  }
  return run.inputs.preferredArea || run.inputs.interests || "PR idea explorer";
}

export function formatRunDate(value?: string | null): string {
  if (!value) return "Just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDuration(ms?: number | null): string | null {
  if (!ms || ms < 0) return null;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}
