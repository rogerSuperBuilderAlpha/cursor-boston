/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { cursorContract } from "@/lib/api-schemas/cursor";
import {
  getCursorApiKeyForUser,
  launchCursorAgentRun,
  sendCursorFollowUp,
} from "@/lib/cursor/cloud-agents";
import { getUserOwnedIdeaRun, serializeCursorIdeaRun } from "@/lib/cursor/idea-run-store";
import {
  buildApprovedImplementationPrompt,
  CURSOR_IDEA_RUNS_COLLECTION,
  validateIdeaWorkflowAction,
} from "@/lib/cursor/idea-runs";
import { getAdminDb } from "@/lib/firebase-admin";
import { logger } from "@/lib/logger";
import { getVerifiedUser } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

void cursorContract.approveIdeaPlan;

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
  if (!run?.cursorAgentId || !run.buildPlan) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const transitionError = validateIdeaWorkflowAction(run, "approve-plan");
  if (transitionError) {
    return NextResponse.json({ error: transitionError }, { status: 409 });
  }

  try {
    const apiKey = await getCursorApiKeyForUser(db, user.uid);
    const prompt = buildApprovedImplementationPrompt(run.buildPlan);
    const followUp = await sendCursorFollowUp(apiKey, run.cursorAgentId, prompt, `${run.id}:build`).catch(
      (err) => {
        logger.logError(err, { stage: "cursor_idea_approve_plan_followup", uid: user.uid, runId });
        return null;
      }
    );
    const freshRun = followUp
      ? null
      : await launchCursorAgentRun(apiKey, prompt, `${run.id}:build:fresh`, {
        name: "Cursor Boston PR build",
        autoCreatePR: false,
      });
    const buildRunId = followUp?.cursorRunId ?? freshRun?.cursorRunId;
    if (!buildRunId) {
      throw new Error("Cursor build run did not return an id");
    }
    const updates = {
      ...(followUp
        ? {}
        : {
            cursorAgentId: freshRun!.cursorAgentId,
            cursorAgentUrl: freshRun!.cursorAgentUrl,
          }),
      buildRunId,
      planApprovedAt: FieldValue.serverTimestamp(),
      workflowStage: "building",
      status: "running",
      updatedAt: FieldValue.serverTimestamp(),
    } satisfies Partial<typeof run> & Record<string, unknown>;
    await db.collection(CURSOR_IDEA_RUNS_COLLECTION).doc(run.id).set(updates, { merge: true });
    return NextResponse.json(
      { ok: true, run: serializeCursorIdeaRun({ ...run, ...updates }) },
      { status: 202 }
    );
  } catch (err) {
    logger.logError(err, { stage: "cursor_idea_approve_plan", uid: user.uid, runId });
    return NextResponse.json({ error: "approval_failed" }, { status: 500 });
  }
}
