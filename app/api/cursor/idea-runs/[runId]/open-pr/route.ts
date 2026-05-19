/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { cursorContract } from "@/lib/api-schemas/cursor";
import { getCursorApiKeyForUser, sendCursorFollowUp } from "@/lib/cursor/cloud-agents";
import { getUserOwnedIdeaRun, serializeCursorIdeaRun } from "@/lib/cursor/idea-run-store";
import {
  buildOpenPrPrompt,
  CURSOR_IDEA_RUNS_COLLECTION,
  validateIdeaWorkflowAction,
} from "@/lib/cursor/idea-runs";
import { getAdminDb } from "@/lib/firebase-admin";
import { logger } from "@/lib/logger";
import { getVerifiedUser } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

void cursorContract.openIdeaPr;

interface RouteContext {
  params: Promise<{ runId: string }>;
}

export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  void request;
  const user = await getVerifiedUser(request);
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const db = getAdminDb();
  if (!db) return NextResponse.json({ error: "not_configured" }, { status: 500 });

  const { runId } = await context.params;
  const run = await getUserOwnedIdeaRun(db, user.uid, runId);
  if (!run?.cursorAgentId) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const transitionError = validateIdeaWorkflowAction(run, "open-pr");
  if (transitionError) {
    return NextResponse.json({ error: transitionError }, { status: 409 });
  }

  try {
    const apiKey = await getCursorApiKeyForUser(db, user.uid);
    const followUp = await sendCursorFollowUp(apiKey, run.cursorAgentId, buildOpenPrPrompt(), `${run.id}:pr`, {
      autoCreatePR: true,
    });
    const updates = {
      prRunId: followUp.cursorRunId,
      workflowStage: "pr_open",
      pr: {
        ...(run.pr ?? {}),
        status: "opening" as const,
        openedAt: FieldValue.serverTimestamp(),
      },
      status: "running",
      updatedAt: FieldValue.serverTimestamp(),
    } satisfies Partial<typeof run> & Record<string, unknown>;
    await db.collection(CURSOR_IDEA_RUNS_COLLECTION).doc(run.id).set(updates, { merge: true });
    return NextResponse.json(
      { ok: true, run: serializeCursorIdeaRun({ ...run, ...updates }) },
      { status: 202 }
    );
  } catch (err) {
    logger.logError(err, { stage: "cursor_idea_open_pr", uid: user.uid, runId });
    return NextResponse.json({ error: "open_pr_failed" }, { status: 500 });
  }
}
