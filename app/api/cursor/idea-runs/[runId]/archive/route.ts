/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { cursorContract } from "@/lib/api-schemas/cursor";
import { archiveCursorAgent, getCursorApiKeyForUser } from "@/lib/cursor/cloud-agents";
import {
  getUserOwnedIdeaRun,
  serializeCursorIdeaRun,
} from "@/lib/cursor/idea-run-store";
import { CURSOR_IDEA_RUNS_COLLECTION } from "@/lib/cursor/idea-runs";
import { getAdminDb } from "@/lib/firebase-admin";
import { logger } from "@/lib/logger";
import { getVerifiedUser } from "@/lib/server-auth";

// @contracts: cursorContract.archiveIdeaRun (lib/api-schemas/cursor.ts)

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

void cursorContract.archiveIdeaRun;

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
    if (run.cursorAgentId) {
      try {
        const apiKey = await getCursorApiKeyForUser(db, user.uid);
        await archiveCursorAgent(apiKey, run.cursorAgentId);
      } catch (err) {
        logger.logError(err, { stage: "cursor_idea_run_archive_agent", uid: user.uid, runId });
      }
    }

    const now = new Date();
    const updates = {
      archivedAt: now,
      updatedAt: now,
    };
    await db.collection(CURSOR_IDEA_RUNS_COLLECTION).doc(run.id).set(updates, { merge: true });

    return NextResponse.json({
      ok: true,
      run: serializeCursorIdeaRun({ ...run, ...updates }),
    });
  } catch (err) {
    logger.logError(err, { stage: "cursor_idea_run_archive", uid: user.uid, runId });
    return NextResponse.json({ error: "archive_failed" }, { status: 500 });
  }
}
