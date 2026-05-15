/**
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
  buildIdeaQuestionsPrompt,
  CURSOR_IDEA_RUNS_COLLECTION,
  validateIdeaWorkflowAction,
} from "@/lib/cursor/idea-runs";
import { getAdminDb } from "@/lib/firebase-admin";
import { logger } from "@/lib/logger";
import { getVerifiedUser } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

void cursorContract.requestIdeaQuestions;

interface RouteContext {
  params: Promise<{ runId: string }>;
}

export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const user = await getVerifiedUser(request);
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const db = getAdminDb();
  if (!db) return NextResponse.json({ error: "not_configured" }, { status: 500 });

  const body = await request.json().catch(() => null);
  const parsedBody = cursorContract.requestIdeaQuestions.body.safeParse(body);
  if (!parsedBody.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const { runId } = await context.params;
  const run = await getUserOwnedIdeaRun(db, user.uid, runId);
  if (!run?.cursorAgentId) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const transitionError = validateIdeaWorkflowAction(run, "questions");
  if (transitionError) {
    return NextResponse.json({ error: transitionError }, { status: 409 });
  }

  try {
    const apiKey = await getCursorApiKeyForUser(db, user.uid);
    const selectedIdea = parsedBody.data.selectedIdea.trim();
    const prompt = buildIdeaQuestionsPrompt(selectedIdea);
    const followUp = await sendCursorFollowUp(apiKey, run.cursorAgentId, prompt, `${run.id}:questions`);
    const updates: Partial<typeof run> & Record<string, unknown> = {
      selectedIdea,
      questions: [],
      workflowStage: "questions",
      status: "running",
      questionRunId: followUp.cursorRunId,
      updatedAt: FieldValue.serverTimestamp(),
    };
    await db.collection(CURSOR_IDEA_RUNS_COLLECTION).doc(run.id).set(updates, { merge: true });
    return NextResponse.json(
      { ok: true, run: serializeCursorIdeaRun({ ...run, ...updates }) },
      { status: 202 }
    );
  } catch (err) {
    logger.logError(err, { stage: "cursor_idea_questions", uid: user.uid, runId });
    return NextResponse.json({ error: "agent_recovery_required" }, { status: 409 });
  }
}
