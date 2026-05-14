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
