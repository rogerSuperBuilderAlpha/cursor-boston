/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * POST /api/community/report
 *
 * User-initiated abuse report on a community message. Closes the gap
 * surfaced by the 2026-Q2 OSS review (`docs/OPENSOURCE_REVIEW.md` §4):
 * a public platform with user-generated content needs a self-serve
 * reporting flow plus an admin moderation queue.
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import { logger } from "@/lib/logger";
import { checkUpstashRateLimit } from "@/lib/upstash-rate-limit";
import { sanitizeDocId } from "@/lib/sanitize";
import { communityContract } from "@/lib/api-schemas/community";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REPORT_RATE_LIMIT = { windowMs: 60 * 60 * 1000, maxRequests: 10 };

export async function POST(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = await checkUpstashRateLimit(`community-report:${user.uid}`, REPORT_RATE_LIMIT);
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many reports. Try again in an hour." },
        { status: 429, headers: rl.retryAfter ? { "Retry-After": String(rl.retryAfter) } : undefined }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }
    const parsed = communityContract.report.body.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid body" },
        { status: 400 }
      );
    }
    const { targetMessageId, reason, notes } = parsed.data;

    const sanitizedId = sanitizeDocId(targetMessageId);
    if (!sanitizedId) {
      return NextResponse.json({ error: "Invalid targetMessageId" }, { status: 400 });
    }
    const trimmedNotes = notes ?? "";

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    // Confirm the target exists. We don't reveal whether it does to
    // unauthorized callers, but for valid auth'd reports a 404 saves
    // the moderator from spending time on stale references.
    const messageRef = db.collection("communityMessages").doc(sanitizedId);
    const messageSnap = await messageRef.get();
    if (!messageSnap.exists) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    const reportRef = db.collection("communityReports").doc();
    await reportRef.set({
      reportId: reportRef.id,
      reporterUid: user.uid,
      reporterDisplayName: user.name ?? null,
      targetMessageId: sanitizedId,
      targetAuthorId: messageSnap.data()?.authorId ?? null,
      reason,
      notes: trimmedNotes,
      status: "open",
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, reportId: reportRef.id });
  } catch (err) {
    logger.logError(err, { endpoint: "/api/community/report", area: "community-safety" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
