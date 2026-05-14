/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { cursorContract } from "@/lib/api-schemas/cursor";
import {
  deleteCursorAgent,
  getCursorApiKeyForUser,
  getCursorRunSnapshot,
} from "@/lib/cursor/cloud-agents";
import {
  applyRunSnapshot,
  applyWorkflowRunSnapshot,
  getUserOwnedIdeaRun,
  serializeCursorIdeaRun,
} from "@/lib/cursor/idea-run-store";
import { CURSOR_IDEA_RUNS_COLLECTION } from "@/lib/cursor/idea-runs";
import { getAdminDb } from "@/lib/firebase-admin";
import { logger } from "@/lib/logger";
import { getVerifiedUser } from "@/lib/server-auth";

// @contracts: cursorContract.getIdeaRun, cursorContract.deleteIdeaRun (lib/api-schemas/cursor.ts)

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

void cursorContract.getIdeaRun;
void cursorContract.deleteIdeaRun;

interface RouteContext {
  params: Promise<{ runId: string }>;
}

export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const user = await getVerifiedUser(request);
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }

  const { runId } = await context.params;
  const run = await getUserOwnedIdeaRun(db, user.uid, runId);
  if (!run) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    if (run.cursorAgentId && activeRunId(run) && shouldRefreshFromCursor(run)) {
      const apiKey = await getCursorApiKeyForUser(db, user.uid);
      const snapshot = await getCursorRunSnapshot(apiKey, run.cursorAgentId, activeRunId(run)!);
      const refreshed =
        run.workflowStage === "questions" ||
        run.workflowStage === "planning" ||
        run.workflowStage === "building" ||
        run.workflowStage === "pr_open"
          ? await applyWorkflowRunSnapshot(db, run, snapshot)
          : await applyRunSnapshot(db, run, snapshot);
      return NextResponse.json({ ok: true, run: serializeCursorIdeaRun(refreshed) });
    }

    return NextResponse.json({ ok: true, run: serializeCursorIdeaRun(run) });
  } catch (err) {
    logger.logError(err, { stage: "cursor_idea_run_get", uid: user.uid, runId });
    return NextResponse.json({ error: "refresh_failed" }, { status: 500 });
  }
}

function activeRunId(run: {
  workflowStage?: string;
  cursorRunId?: string;
  questionRunId?: string;
  planRunId?: string;
  buildRunId?: string;
  prRunId?: string;
}) {
  if (run.workflowStage === "questions") return run.questionRunId ?? run.cursorRunId;
  if (run.workflowStage === "building") return run.buildRunId ?? run.cursorRunId;
  if (run.workflowStage === "planning") return run.planRunId ?? run.cursorRunId;
  if (run.workflowStage === "pr_open") return run.prRunId ?? run.buildRunId ?? run.cursorRunId;
  return run.cursorRunId;
}

function shouldRefreshFromCursor(run: {
  status: string;
  workflowStage?: string;
  questions?: unknown[];
  buildPlan?: string | null;
  buildResult?: string | null;
  pr?: { status?: string } | null;
}) {
  if (run.status === "starting" || run.status === "running") return true;
  return (
    (run.workflowStage === "questions" && (!run.questions || run.questions.length === 0)) ||
    (run.workflowStage === "planning" && !run.buildPlan) ||
    (run.workflowStage === "building" && !run.buildResult) ||
    (run.workflowStage === "pr_open" && run.pr?.status === "opening")
  );
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const user = await getVerifiedUser(request);
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }

  const { runId } = await context.params;
  const run = await getUserOwnedIdeaRun(db, user.uid, runId);
  if (!run) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    if (run.cursorAgentId) {
      try {
        const apiKey = await getCursorApiKeyForUser(db, user.uid);
        await deleteCursorAgent(apiKey, run.cursorAgentId);
      } catch (err) {
        logger.logError(err, { stage: "cursor_idea_run_delete_agent", uid: user.uid, runId });
      }
    }

    await db.collection(CURSOR_IDEA_RUNS_COLLECTION).doc(run.id).delete();
    return NextResponse.json({ deleted: true });
  } catch (err) {
    logger.logError(err, { stage: "cursor_idea_run_delete", uid: user.uid, runId });
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }
}
