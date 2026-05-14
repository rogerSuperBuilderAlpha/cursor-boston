/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { cursorContract } from "@/lib/api-schemas/cursor";
import { getCursorApiKeyForUser, launchCursorAgentRun } from "@/lib/cursor/cloud-agents";
import { getUserOwnedIdeaRun, serializeCursorIdeaRun } from "@/lib/cursor/idea-run-store";
import {
  buildApprovedImplementationPrompt,
  buildIdeaPlanPrompt,
  buildIdeaQuestionsPrompt,
  CURSOR_IDEA_RUNS_COLLECTION,
} from "@/lib/cursor/idea-runs";
import { getAdminDb } from "@/lib/firebase-admin";
import { logger } from "@/lib/logger";
import { getVerifiedUser } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

void cursorContract.recoverIdeaAgent;

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
  if (!run) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const prompt = recoveryPromptForRun(run);
  if (!prompt) return NextResponse.json({ error: "recovery_not_available" }, { status: 409 });

  try {
    const apiKey = await getCursorApiKeyForUser(db, user.uid);
    const freshRun = await launchCursorAgentRun(apiKey, prompt.prompt, `${run.id}:${prompt.stage}:fresh:${Date.now()}`, {
      name: prompt.name,
      autoCreatePR: prompt.stage === "pr",
    });
    const updates: Partial<typeof run> & Record<string, unknown> = {
      cursorAgentId: freshRun.cursorAgentId,
      cursorAgentUrl: freshRun.cursorAgentUrl,
      status: "running",
      workflowStage: prompt.workflowStage,
      error: null,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (prompt.stage === "questions") updates.questionRunId = freshRun.cursorRunId;
    if (prompt.stage === "plan") updates.planRunId = freshRun.cursorRunId;
    if (prompt.stage === "build") updates.buildRunId = freshRun.cursorRunId;
    if (prompt.stage === "pr") {
      updates.prRunId = freshRun.cursorRunId;
      updates.pr = {
        ...(run.pr ?? {}),
        status: "opening" as const,
        openedAt: FieldValue.serverTimestamp(),
      };
    }

    await db.collection(CURSOR_IDEA_RUNS_COLLECTION).doc(run.id).set(updates, { merge: true });
    return NextResponse.json({ ok: true, run: serializeCursorIdeaRun({ ...run, ...updates }) }, { status: 202 });
  } catch (err) {
    logger.logError(err, { stage: "cursor_idea_recover_agent", uid: user.uid, runId });
    return NextResponse.json({ error: "recovery_failed" }, { status: 500 });
  }
}

function recoveryPromptForRun(run: Awaited<ReturnType<typeof getUserOwnedIdeaRun>>) {
  if (!run) return null;
  if (run.workflowStage === "ideas") {
    if (!run.result && !run.selectedIdea) return null;
    return {
      stage: "questions" as const,
      workflowStage: "questions" as const,
      name: "Cursor Boston PR questions",
      prompt: buildIdeaQuestionsPrompt(run.selectedIdea || run.result || "Continue from the selected idea."),
    };
  }
  if (run.workflowStage === "questions" && run.selectedIdea && run.questions && run.questions.length > 0) {
    return {
      stage: "plan" as const,
      workflowStage: "planning" as const,
      name: "Cursor Boston PR plan",
      prompt: buildIdeaPlanPrompt(run.selectedIdea, run.questions),
    };
  }
  if (run.workflowStage === "plan_approval" && run.buildPlan) {
    return {
      stage: "build" as const,
      workflowStage: "building" as const,
      name: "Cursor Boston PR build",
      prompt: buildApprovedImplementationPrompt(run.buildPlan),
    };
  }
  if (run.workflowStage === "ready_for_pr" && run.buildResult) {
    return {
      stage: "pr" as const,
      workflowStage: "pr_open" as const,
      name: "Cursor Boston PR open",
      prompt: "Open a pull request for the completed build. Use the existing changes and return the PR URL.",
    };
  }
  return null;
}
