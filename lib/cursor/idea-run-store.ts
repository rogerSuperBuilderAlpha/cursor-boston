/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import {
  FieldValue,
  Timestamp,
  type DocumentData,
  type DocumentSnapshot,
  type Firestore,
} from "firebase-admin/firestore";
import {
  CURSOR_IDEA_RUNS_COLLECTION,
  type CursorIdeaQuestion,
  type CursorIdeaRunRecord,
  type CursorIdeaRunStatus,
} from "./idea-runs";
import type { CursorRunSnapshot } from "./cloud-agents";

const TERMINAL_STATUSES = new Set<CursorIdeaRunStatus>(["finished", "error", "cancelled"]);

export function isTerminalCursorRunStatus(status: CursorIdeaRunStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function serializeCursorIdeaRun(
  run: CursorIdeaRunRecord
): Omit<
  CursorIdeaRunRecord,
  | "createdAt"
  | "updatedAt"
  | "finishedAt"
  | "archivedAt"
  | "cursorLastActivityAt"
  | "answersSubmittedAt"
  | "planApprovedAt"
  | "pr"
> & {
  createdAt?: string | null;
  updatedAt?: string | null;
  finishedAt?: string | null;
  archivedAt?: string | null;
  cursorLastActivityAt?: string | null;
  answersSubmittedAt?: string | null;
  planApprovedAt?: string | null;
  pr?: (NonNullable<CursorIdeaRunRecord["pr"]> & {
    openedAt?: string | null;
    lastCommentedAt?: string | null;
    mergedAt?: string | null;
  }) | null;
} {
  return {
    ...run,
    createdAt: serializeTimestamp(run.createdAt),
    updatedAt: serializeTimestamp(run.updatedAt),
    finishedAt: serializeTimestamp(run.finishedAt),
    archivedAt: serializeTimestamp(run.archivedAt),
    cursorLastActivityAt: serializeTimestamp(run.cursorLastActivityAt),
    answersSubmittedAt: serializeTimestamp(run.answersSubmittedAt),
    planApprovedAt: serializeTimestamp(run.planApprovedAt),
    pr: run.pr
      ? {
          ...run.pr,
          openedAt: serializeTimestamp(run.pr.openedAt),
          lastCommentedAt: serializeTimestamp(run.pr.lastCommentedAt),
          mergedAt: serializeTimestamp(run.pr.mergedAt),
        }
      : run.pr,
  };
}

export function cursorIdeaRunFromSnapshot(
  doc: DocumentSnapshot<DocumentData>
): CursorIdeaRunRecord {
  const data = doc.data();
  if (!data) {
    throw new Error("Cursor idea run snapshot has no data");
  }
  return {
    id: doc.id,
    userId: data.userId,
    type: "pr_ideas",
    status: data.status,
    workflowStage: data.workflowStage,
    cursorAgentId: data.cursorAgentId,
    cursorRunId: data.cursorRunId,
    cursorAgentUrl: data.cursorAgentUrl,
    questionRunId: data.questionRunId,
    planRunId: data.planRunId,
    buildRunId: data.buildRunId,
    prRunId: data.prRunId,
    prompt: data.prompt,
    inputs: data.inputs ?? {},
    result: data.result ?? null,
    selectedIdea: data.selectedIdea ?? null,
    questions: data.questions ?? [],
    answersSubmittedAt: data.answersSubmittedAt,
    buildPlan: data.buildPlan ?? null,
    buildResult: data.buildResult ?? null,
    planApprovedAt: data.planApprovedAt,
    pr: data.pr ?? null,
    git: data.git,
    artifacts: data.artifacts,
    activity: data.activity,
    cursorStatusDetail: data.cursorStatusDetail ?? null,
    cursorLastActivityAt: data.cursorLastActivityAt,
    durationMs: data.durationMs ?? null,
    error: data.error ?? null,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    finishedAt: data.finishedAt,
    archivedAt: data.archivedAt,
  };
}

export async function getUserOwnedIdeaRun(
  db: Firestore,
  uid: string,
  runId: string
): Promise<CursorIdeaRunRecord | null> {
  const doc = await db.collection(CURSOR_IDEA_RUNS_COLLECTION).doc(runId).get();
  if (!doc.exists) return null;
  const run = cursorIdeaRunFromSnapshot(doc);
  return run.userId === uid ? run : null;
}

export async function applyRunSnapshot(
  db: Firestore,
  run: CursorIdeaRunRecord,
  snapshot: CursorRunSnapshot
): Promise<CursorIdeaRunRecord> {
  const updates: Partial<CursorIdeaRunRecord> & Record<string, unknown> = {
    status: snapshot.status,
    result: snapshot.result ?? run.result ?? null,
    git: snapshot.git ?? run.git ?? null,
    artifacts: snapshot.artifacts ?? run.artifacts ?? [],
    activity: snapshot.activity ?? run.activity ?? [],
    cursorStatusDetail: snapshot.cursorStatusDetail ?? run.cursorStatusDetail ?? null,
    cursorLastActivityAt: FieldValue.serverTimestamp(),
    durationMs: snapshot.durationMs ?? run.durationMs ?? null,
    error: snapshot.status === "error" ? run.error ?? "Cursor run failed" : null,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (isTerminalCursorRunStatus(snapshot.status) && !run.finishedAt) {
    updates.finishedAt = FieldValue.serverTimestamp();
  }

  if (hasMeaningfulSnapshotChange(run, updates)) {
    await db.collection(CURSOR_IDEA_RUNS_COLLECTION).doc(run.id).set(updates, { merge: true });
  }

  return {
    ...run,
    ...updates,
  } as CursorIdeaRunRecord;
}

export async function applyWorkflowRunSnapshot(
  db: Firestore,
  run: CursorIdeaRunRecord,
  snapshot: CursorRunSnapshot
): Promise<CursorIdeaRunRecord> {
  const updates: Partial<CursorIdeaRunRecord> & Record<string, unknown> = {
    status: snapshot.status,
    git: snapshot.git ?? run.git ?? null,
    artifacts: snapshot.artifacts ?? run.artifacts ?? [],
    activity: snapshot.activity ?? run.activity ?? [],
    cursorStatusDetail: snapshot.cursorStatusDetail ?? run.cursorStatusDetail ?? null,
    cursorLastActivityAt: FieldValue.serverTimestamp(),
    durationMs: snapshot.durationMs ?? run.durationMs ?? null,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (run.workflowStage === "building" && isTerminalCursorRunStatus(snapshot.status)) {
    updates.buildResult = snapshot.result ?? run.buildResult ?? null;
    updates.workflowStage = snapshot.status === "finished" ? "ready_for_pr" : run.workflowStage;
    updates.error = snapshot.status === "error" ? "Cursor build failed" : null;
  } else if (run.workflowStage === "questions" && isTerminalCursorRunStatus(snapshot.status)) {
    updates.questions =
      snapshot.status === "finished"
        ? parseAgentQuestions(snapshot.result) ?? run.questions ?? []
        : run.questions ?? [];
    updates.error = snapshot.status === "error" ? "Cursor could not create questions" : null;
  } else if (run.workflowStage === "planning" && isTerminalCursorRunStatus(snapshot.status)) {
    updates.buildPlan = snapshot.result ?? run.buildPlan ?? null;
    updates.workflowStage = snapshot.status === "finished" ? "plan_approval" : run.workflowStage;
    updates.error = snapshot.status === "error" ? "Cursor could not create the build plan" : null;
  } else if (run.workflowStage === "pr_open" && isTerminalCursorRunStatus(snapshot.status)) {
    const prUrl = firstPrUrl(snapshot.git) ?? run.pr?.url ?? null;
    updates.pr = {
      ...(run.pr ?? { status: "opening" as const }),
      status: prUrl ? "pr_open" : run.pr?.status ?? "opening",
      url: prUrl,
    };
    updates.workflowStage = prUrl ? "pr_open" : run.workflowStage;
    updates.error = snapshot.status === "error" ? "Cursor could not open the PR" : null;
  }

  if (hasMeaningfulSnapshotChange(run, updates)) {
    await db.collection(CURSOR_IDEA_RUNS_COLLECTION).doc(run.id).set(updates, { merge: true });
  }
  return {
    ...run,
    ...updates,
  } as CursorIdeaRunRecord;
}

function parseAgentQuestions(value: unknown): CursorIdeaRunRecord["questions"] | null {
  if (typeof value !== "string") return null;
  const jsonText = extractJsonArray(value);
  if (!jsonText) return null;
  try {
    const parsed = JSON.parse(jsonText) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed
      .map((item, index) => normalizeQuestion(item, index))
      .filter((item): item is CursorIdeaQuestion => Boolean(item))
      .slice(0, 5);
  } catch {
    return null;
  }
}

function extractJsonArray(value: string): string | null {
  const start = value.indexOf("[");
  const end = value.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return null;
  return value.slice(start, end + 1);
}

function normalizeQuestion(item: unknown, index: number): CursorIdeaQuestion | null {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  const question = typeof record.question === "string" ? record.question.trim() : "";
  if (!question) return null;
  const rawSuggestions = Array.isArray(record.suggestions) ? record.suggestions : [];
  return {
    id: typeof record.id === "string" && record.id.trim() ? record.id.trim() : `q${index + 1}`,
    question,
    suggestions: rawSuggestions
      .filter((suggestion): suggestion is string => typeof suggestion === "string")
      .map((suggestion) => suggestion.trim())
      .filter(Boolean)
      .slice(0, 5),
  };
}

function firstPrUrl(git: unknown): string | null {
  const branches = (git as { branches?: Array<{ prUrl?: unknown }> } | undefined)?.branches;
  if (!Array.isArray(branches)) return null;
  const prUrl = branches.find((branch) => typeof branch.prUrl === "string" && branch.prUrl)?.prUrl;
  return typeof prUrl === "string" ? prUrl : null;
}

function hasMeaningfulSnapshotChange(
  run: CursorIdeaRunRecord,
  updates: Partial<CursorIdeaRunRecord> & Record<string, unknown>
): boolean {
  const ignoredKeys = new Set(["updatedAt", "cursorLastActivityAt"]);
  return Object.entries(updates).some(([key, value]) => {
    if (ignoredKeys.has(key)) return false;
    return JSON.stringify((run as unknown as Record<string, unknown>)[key]) !== JSON.stringify(value);
  });
}

function serializeTimestamp(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return null;
}
