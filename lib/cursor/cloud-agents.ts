/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { Firestore } from "firebase-admin/firestore";
import type { RunStatus, SDKArtifact, SDKAgentInfo } from "@cursor/sdk";
import { decryptApiKey, type EncryptedKey } from "./encryption";
import {
  CURSOR_BOSTON_CLOUD_AGENT_BASE_REF,
  CURSOR_BOSTON_REPO_URL,
  type CursorIdeaRunActivity,
  type CursorIdeaRunArtifact,
  type CursorIdeaRunStatus,
} from "./idea-runs";

export class MissingCursorConnectionError extends Error {
  constructor(message = "Cursor is not connected") {
    super(message);
    this.name = "MissingCursorConnectionError";
  }
}

export interface LaunchedCursorRun {
  cursorAgentId: string;
  cursorRunId: string;
  cursorAgentUrl: string;
}

export interface CursorRunSnapshot {
  status: CursorIdeaRunStatus;
  result?: string;
  git?: unknown;
  durationMs?: number;
  artifacts?: CursorIdeaRunArtifact[];
  activity?: CursorIdeaRunActivity[];
  cursorStatusDetail?: string | null;
}

export interface FollowUpCursorRun {
  cursorRunId: string;
}

interface RunGitInfoLike {
  branches?: Array<{ prUrl?: string }>;
}

export async function getCursorApiKeyForUser(
  db: Firestore,
  uid: string
): Promise<string> {
  const secretSnap = await db
    .collection("users")
    .doc(uid)
    .collection("secrets")
    .doc("cursor")
    .get();

  if (!secretSnap.exists) {
    throw new MissingCursorConnectionError();
  }

  const encrypted = secretSnap.data()?.apiKeyEncrypted as EncryptedKey | undefined;
  if (!encrypted) {
    throw new MissingCursorConnectionError("Cursor secret is missing");
  }

  return decryptApiKey(encrypted);
}

export async function launchPrIdeaRun(
  apiKey: string,
  prompt: string,
  idempotencyKey: string
): Promise<LaunchedCursorRun> {
  return launchCursorAgentRun(apiKey, prompt, idempotencyKey, {
    name: "Cursor Boston PR idea explorer",
    autoCreatePR: false,
  });
}

export async function launchCursorAgentRun(
  apiKey: string,
  prompt: string,
  idempotencyKey: string,
  options: { name?: string; autoCreatePR?: boolean } = {}
): Promise<LaunchedCursorRun> {
  const { Agent } = await import("@cursor/sdk");
  const agent = await Agent.create({
    apiKey,
    name: options.name ?? "Cursor Boston PR idea explorer",
    cloud: {
      repos: [
        {
          url: CURSOR_BOSTON_REPO_URL,
          startingRef: CURSOR_BOSTON_CLOUD_AGENT_BASE_REF,
        },
      ],
      autoCreatePR: options.autoCreatePR ?? false,
      skipReviewerRequest: true,
    },
    idempotencyKey,
  });

  try {
    const run = await agent.send(prompt, { idempotencyKey: `${idempotencyKey}:run` });
    return {
      cursorAgentId: agent.agentId,
      cursorRunId: run.id,
      cursorAgentUrl: `https://cursor.com/agents?id=${encodeURIComponent(agent.agentId)}`,
    };
  } finally {
    await agent[Symbol.asyncDispose]();
  }
}

export async function sendCursorFollowUp(
  apiKey: string,
  cursorAgentId: string,
  prompt: string,
  idempotencyKey: string,
  options: { autoCreatePR?: boolean } = {}
): Promise<FollowUpCursorRun> {
  const { Agent } = await import("@cursor/sdk");
  const agent = await Agent.resume(cursorAgentId, {
    apiKey,
    cloud: {
      repos: [
        {
          url: CURSOR_BOSTON_REPO_URL,
          startingRef: CURSOR_BOSTON_CLOUD_AGENT_BASE_REF,
        },
      ],
      autoCreatePR: options.autoCreatePR ?? false,
      skipReviewerRequest: true,
    },
  });

  try {
    const run = await agent.send(prompt, { idempotencyKey });
    return { cursorRunId: run.id };
  } finally {
    await agent[Symbol.asyncDispose]();
  }
}

export async function getCursorRunSnapshot(
  apiKey: string,
  cursorAgentId: string,
  cursorRunId: string
): Promise<CursorRunSnapshot> {
  const { Agent } = await import("@cursor/sdk");
  const [run, agentInfo] = await Promise.all([
    Agent.getRun(cursorRunId, {
      runtime: "cloud",
      agentId: cursorAgentId,
      apiKey,
    }),
    Agent.get(cursorAgentId, { apiKey }).catch(() => null),
  ]);
  let conversation: unknown[] = [];
  let conversationStatusDetail: string | null = null;
  if (run.supports("conversation")) {
    try {
      conversation = await run.conversation();
    } catch (err) {
      conversationStatusDetail =
        "Cloud Agent is running, but log sync failed. Open Cursor if you need the live console.";
      // Surface the underlying SDK error to server logs so we can diagnose
      // "no updates from the cloud agent" reports without flying blind.
       
      console.warn("[cursor.snapshot] conversation() threw", {
        cursorAgentId,
        cursorRunId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  } else {
    conversationStatusDetail =
      run.unsupportedReason("conversation") ??
      "Cloud Agent log snapshots are not available for this run.";
  }
  const status = mapRunStatus(run.status);
  const activity = normalizeConversation(conversation);
  if (process.env.CURSOR_SNAPSHOT_DEBUG === "1") {
     
    console.info("[cursor.snapshot]", {
      cursorAgentId,
      cursorRunId,
      runStatus: run.status,
      conversationTurns: conversation.length,
      activityCount: activity.length,
      durationMs: run.durationMs,
      agentSummary: agentInfo?.summary,
    });
  }
  const snapshot: CursorRunSnapshot = {
    status,
    result: run.result,
    git: run.git,
    durationMs: run.durationMs,
    activity,
    cursorStatusDetail:
      [describeAgentInfo(agentInfo), conversationStatusDetail].filter(Boolean).join(" · ") ||
      null,
  };

  try {
    const agent = await Agent.resume(cursorAgentId, { apiKey, cloud: {} });
    try {
      snapshot.artifacts = normalizeArtifacts(await agent.listArtifacts());
    } finally {
      await agent[Symbol.asyncDispose]();
    }
  } catch {
    // Artifacts are best-effort and should not block status refresh.
  }

  return snapshot;
}

export async function cancelCursorRun(
  apiKey: string,
  cursorAgentId: string,
  cursorRunId: string
): Promise<void> {
  const { Agent } = await import("@cursor/sdk");
  await Agent.cancelRun(cursorRunId, {
    runtime: "cloud",
    agentId: cursorAgentId,
    apiKey,
  });
}

export async function archiveCursorAgent(
  apiKey: string,
  cursorAgentId: string
): Promise<void> {
  const { Agent } = await import("@cursor/sdk");
  await Agent.archive(cursorAgentId, { apiKey });
}

export async function unarchiveCursorAgent(
  apiKey: string,
  cursorAgentId: string
): Promise<void> {
  const { Agent } = await import("@cursor/sdk");
  await Agent.unarchive(cursorAgentId, { apiKey });
}

export async function deleteCursorAgent(
  apiKey: string,
  cursorAgentId: string
): Promise<void> {
  const { Agent } = await import("@cursor/sdk");
  await Agent.delete(cursorAgentId, { apiKey });
}

export function mapRunStatus(status: RunStatus): CursorIdeaRunStatus {
  switch (status) {
    case "running":
      return "running";
    case "finished":
      return "finished";
    case "cancelled":
      return "cancelled";
    case "error":
      return "error";
  }
}

function normalizeArtifacts(artifacts: SDKArtifact[]): CursorIdeaRunArtifact[] {
  return artifacts.map((artifact) => ({
    path: artifact.path,
    sizeBytes: artifact.sizeBytes,
    updatedAt: artifact.updatedAt,
  }));
}

function normalizeConversation(turns: unknown[]): CursorIdeaRunActivity[] {
  return turns
    .flatMap((turn, index) => conversationTurnToActivity(turn, index))
    .filter((message): message is CursorIdeaRunActivity => Boolean(message))
    .slice(-8);
}

function conversationTurnToActivity(
  turn: unknown,
  index: number
): Array<CursorIdeaRunActivity | null> {
  const record = turn as Record<string, unknown>;
  if (record.type === "agentConversationTurn" && record.turn && typeof record.turn === "object") {
    const inner = record.turn as Record<string, unknown>;
    const steps = Array.isArray(inner.steps) ? inner.steps : [];
    return steps.map((step, stepIndex) => conversationStepToActivity(step, index, stepIndex));
  }
  if (record.type === "shellConversationTurn" && record.turn && typeof record.turn === "object") {
    const inner = record.turn as Record<string, unknown>;
    const shellCommand = (inner.shellCommand as { command?: unknown } | undefined)?.command;
    const shellOutput = (inner.shellOutput as { stdout?: unknown; stderr?: unknown; exitCode?: unknown } | undefined);
    const summary =
      typeof shellCommand === "string"
        ? `Running shell command: \`${shellCommand}\``
        : typeof shellOutput?.stdout === "string" && shellOutput.stdout.trim()
          ? `Shell output: ${shellOutput.stdout.trim().slice(0, 500)}`
          : typeof shellOutput?.stderr === "string" && shellOutput.stderr.trim()
            ? `Shell error output: ${shellOutput.stderr.trim().slice(0, 500)}`
            : "";
    return summary
      ? [{ id: `conversation-${index}`, role: "assistant", kind: "shell", summary }]
      : [];
  }
  return [];
}

function conversationStepToActivity(
  value: unknown,
  turnIndex: number,
  stepIndex: number
): CursorIdeaRunActivity | null {
  if (!value || typeof value !== "object") return null;
  const step = value as Record<string, unknown>;
  const message = step.message as Record<string, unknown> | undefined;
  const text =
    typeof message?.text === "string"
      ? message.text
      : typeof step.text === "string"
        ? step.text
        : null;
  if (text) {
    return {
      id: `conversation-${turnIndex}-${stepIndex}`,
      role: step.type === "userMessage" ? "user" : "assistant",
      kind: "message",
      summary: text.slice(0, 500),
    };
  }
  if (step.type === "toolCall" && message && typeof message.type === "string") {
    return {
      id: `conversation-${turnIndex}-${stepIndex}`,
      role: "assistant",
      kind: "tool",
      summary: `Using tool: ${message.type}`,
    };
  }
  if (typeof step.type === "string" && step.type.toLowerCase().includes("thinking")) {
    return {
      id: `conversation-${turnIndex}-${stepIndex}`,
      role: "assistant",
      kind: "thinking",
      summary: "Thinking through the next step",
    };
  }
  return null;
}

function describeAgentInfo(agent: SDKAgentInfo | null): string | null {
  if (!agent) return null;
  const parts = [
    agent.status ? `Agent ${agent.status}` : null,
    agent.summary ? agent.summary : null,
    agent.archived ? "Archived" : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function firstPrUrlFromGit(git: unknown): string | null {
  const branches = (git as RunGitInfoLike | undefined)?.branches;
  if (!Array.isArray(branches)) return null;
  return branches.find((branch) => typeof branch.prUrl === "string" && branch.prUrl)?.prUrl ?? null;
}
