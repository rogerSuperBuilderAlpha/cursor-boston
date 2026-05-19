/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { cursorContract } from "@/lib/api-schemas/cursor";
import { cancelCursorRun, getCursorApiKeyForUser } from "@/lib/cursor/cloud-agents";
import {
  getUserOwnedIdeaRun,
  isTerminalCursorRunStatus,
  serializeCursorIdeaRun,
} from "@/lib/cursor/idea-run-store";
import { CURSOR_IDEA_RUNS_COLLECTION } from "@/lib/cursor/idea-runs";
import { getAdminDb } from "@/lib/firebase-admin";
import { logger } from "@/lib/logger";
import { getVerifiedUser } from "@/lib/server-auth";

// @contracts: cursorContract.cancelIdeaRun (lib/api-schemas/cursor.ts)

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

void cursorContract.cancelIdeaRun;

interface RouteContext {
  params: Promise<{ runId: string }>;
}

export async function POST(
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
    const runIdToCancel = activeRunId(run);
    if (!isTerminalCursorRunStatus(run.status) && run.cursorAgentId && runIdToCancel) {
      const apiKey = await getCursorApiKeyForUser(db, user.uid);
      await cancelCursorRun(apiKey, run.cursorAgentId, runIdToCancel);
    }

    const updates = {
      status: "cancelled" as const,
      error: null,
      finishedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    await db.collection(CURSOR_IDEA_RUNS_COLLECTION).doc(run.id).set(updates, { merge: true });

    return NextResponse.json({
      ok: true,
      run: serializeCursorIdeaRun({ ...run, ...updates }),
    });
  } catch (err) {
    logger.logError(err, { stage: "cursor_idea_run_cancel", uid: user.uid, runId });
    return NextResponse.json({ error: "cancel_failed" }, { status: 500 });
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
  if (run.workflowStage === "planning") return run.planRunId ?? run.cursorRunId;
  if (run.workflowStage === "building") return run.buildRunId ?? run.cursorRunId;
  if (run.workflowStage === "pr_open") return run.prRunId ?? run.buildRunId ?? run.cursorRunId;
  return run.cursorRunId;
}
