/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { cursorContract } from "@/lib/api-schemas/cursor";
import {
  getCursorApiKeyForUser,
  getCursorRunSnapshot,
  launchPrIdeaRun,
  MissingCursorConnectionError,
} from "@/lib/cursor/cloud-agents";
import {
  applyRunSnapshot,
  applyWorkflowRunSnapshot,
  cursorIdeaRunFromSnapshot,
  isTerminalCursorRunStatus,
  serializeCursorIdeaRun,
} from "@/lib/cursor/idea-run-store";
import {
  buildPrIdeaPrompt,
  CURSOR_IDEA_RUNS_COLLECTION,
  normalizeRunInputs,
  type CursorIdeaRunRecord,
} from "@/lib/cursor/idea-runs";
import { getAdminDb } from "@/lib/firebase-admin";
import { logger } from "@/lib/logger";
import { withMiddleware, rateLimitConfigs } from "@/lib/middleware";
import { getVerifiedUser } from "@/lib/server-auth";

// @contracts: cursorContract.launchIdeaRun, cursorContract.listIdeaRuns (lib/api-schemas/cursor.ts)

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdminDb = NonNullable<ReturnType<typeof getAdminDb>>;

void cursorContract.listIdeaRuns;

async function handlePost(request: NextRequest): Promise<NextResponse> {
  const user = await getVerifiedUser(request);
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const parsedBody = cursorContract.launchIdeaRun.body.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const inputs = normalizeRunInputs(parsedBody.data);
  const prompt = buildPrIdeaPrompt(inputs);
  const docRef = db.collection(CURSOR_IDEA_RUNS_COLLECTION).doc();
  const now = FieldValue.serverTimestamp();
  const baseRun: Omit<CursorIdeaRunRecord, "id"> = {
    userId: user.uid,
    type: "pr_ideas",
    status: "starting",
    workflowStage: "ideas",
    prompt,
    inputs,
    result: null,
    selectedIdea: null,
    questions: [],
    buildPlan: null,
    buildResult: null,
    pr: { status: "not_started" },
    artifacts: [],
    error: null,
    createdAt: now,
    updatedAt: now,
    finishedAt: null,
    archivedAt: null,
  };

  try {
    const apiKey = await getCursorApiKeyForUser(db, user.uid);
    await docRef.set(baseRun);

    const launched = await launchPrIdeaRun(apiKey, prompt, docRef.id);
    await docRef.set(
      {
        cursorAgentId: launched.cursorAgentId,
        cursorRunId: launched.cursorRunId,
        cursorAgentUrl: launched.cursorAgentUrl,
        status: "running",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const run: CursorIdeaRunRecord = {
      id: docRef.id,
      ...baseRun,
      ...launched,
      status: "running",
    };

    return NextResponse.json({ ok: true, run: serializeCursorIdeaRun(run) }, { status: 202 });
  } catch (err) {
    if (err instanceof MissingCursorConnectionError) {
      return NextResponse.json({ error: "cursor_not_connected" }, { status: 404 });
    }

    await docRef
      .set(
        {
          ...baseRun,
          status: "error",
          error: "Could not launch Cursor agent",
          finishedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
      .catch(() => undefined);
    logger.logError(err, { stage: "cursor_idea_run_launch", uid: user.uid });
    return NextResponse.json({ error: "launch_failed" }, { status: 500 });
  }
}

async function handleGet(request: NextRequest): Promise<NextResponse> {
  const user = await getVerifiedUser(request);
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }

  try {
    const shouldRefresh = request.nextUrl.searchParams.get("refresh") !== "false";
    const snap = await db
      .collection(CURSOR_IDEA_RUNS_COLLECTION)
      .where("userId", "==", user.uid)
      .get();
    let runs = snap.docs
      .map(cursorIdeaRunFromSnapshot)
      .filter((run) => run.type === "pr_ideas")
      .sort((a, b) => timestampMillis(b.createdAt) - timestampMillis(a.createdAt))
      .slice(0, 10);

    if (shouldRefresh) {
      runs = await refreshNonTerminalRuns(db, user.uid, runs);
    }

    return NextResponse.json({
      ok: true,
      runs: runs.map(serializeCursorIdeaRun),
    });
  } catch (err) {
    logger.logError(err, { stage: "cursor_idea_runs_list", uid: user.uid });
    return NextResponse.json({ error: "list_failed" }, { status: 500 });
  }
}

function timestampMillis(value: CursorIdeaRunRecord["createdAt"]): number {
  if (!value) return 0;
  if (typeof value === "string") return Date.parse(value) || 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") {
    return value.toMillis();
  }
  return 0;
}

async function refreshNonTerminalRuns(
  db: AdminDb,
  uid: string,
  runs: CursorIdeaRunRecord[]
): Promise<CursorIdeaRunRecord[]> {
  const refreshable = runs.filter(
    (run) =>
      run.cursorAgentId &&
      activeRunId(run) &&
      (!isTerminalCursorRunStatus(run.status) ||
        needsWorkflowRefresh(run))
  );
  if (refreshable.length === 0) return runs;

  let apiKey: string;
  try {
    apiKey = await getCursorApiKeyForUser(db, uid);
  } catch {
    return runs;
  }

  const refreshed = new Map<string, CursorIdeaRunRecord>();
  await Promise.all(
    refreshable.map(async (run) => {
      try {
        const snapshot = await getCursorRunSnapshot(apiKey, run.cursorAgentId!, activeRunId(run)!);
        refreshed.set(
          run.id,
          run.workflowStage === "questions" ||
            run.workflowStage === "planning" ||
            run.workflowStage === "building" ||
            run.workflowStage === "pr_open"
            ? await applyWorkflowRunSnapshot(db, run, snapshot)
            : await applyRunSnapshot(db, run, snapshot)
        );
      } catch (err) {
        logger.logError(err, { stage: "cursor_idea_runs_refresh", uid, runId: run.id });
      }
    })
  );

  return runs.map((run) => refreshed.get(run.id) ?? run);
}

function activeRunId(run: CursorIdeaRunRecord): string | undefined {
  if (run.workflowStage === "questions") return run.questionRunId ?? run.cursorRunId;
  if (run.workflowStage === "building") return run.buildRunId ?? run.cursorRunId;
  if (run.workflowStage === "planning") return run.planRunId ?? run.cursorRunId;
  if (run.workflowStage === "pr_open") return run.prRunId ?? run.buildRunId ?? run.cursorRunId;
  return run.cursorRunId;
}

function needsWorkflowRefresh(run: CursorIdeaRunRecord): boolean {
  return (
    (run.workflowStage === "questions" && (!run.questions || run.questions.length === 0)) ||
    (run.workflowStage === "planning" && !run.buildPlan) ||
    (run.workflowStage === "building" && !run.buildResult) ||
    (run.workflowStage === "pr_open" && run.pr?.status === "opening")
  );
}

export const POST = withMiddleware(rateLimitConfigs.standard, handlePost);
export const GET = withMiddleware(rateLimitConfigs.standard, handleGet);
