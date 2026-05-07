/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import { logger } from "@/lib/logger";
import { checkUpstashRateLimit } from "@/lib/upstash-rate-limit";
import { sanitizeDocId } from "@/lib/sanitize";
import { communityContract } from "@/lib/api-schemas/community";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DELETE_RATE_LIMIT = { windowMs: 60 * 1000, maxRequests: 20 };

export async function POST(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateResult = await checkUpstashRateLimit(
      `community-delete:${user.uid}`,
      DELETE_RATE_LIMIT
    );
    if (!rateResult.success) {
      return NextResponse.json(
        { error: "Too many requests", retryAfterSeconds: rateResult.retryAfter },
        { status: 429, headers: { "Retry-After": String(rateResult.retryAfter || 60) } }
      );
    }

    const db = getAdminDb();
    if (!db) {
      logger.error("Firebase Admin is not configured for deletes");
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }
    const parsed = communityContract.deletePost.body.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid body" },
        { status: 400 }
      );
    }
    const { messageId } = parsed.data;

    const sanitizedId = sanitizeDocId(messageId);
    if (!sanitizedId) {
      return NextResponse.json({ error: "Invalid messageId format" }, { status: 400 });
    }

    const messageRef = db.collection("communityMessages").doc(sanitizedId);
    const messageSnap = await messageRef.get();

    if (!messageSnap.exists) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    const messageData = messageSnap.data();
    if (messageData?.authorId !== user.uid) {
      return NextResponse.json({ error: "Not authorized to delete this message" }, { status: 403 });
    }

    await messageRef.delete();

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.logError(error, { endpoint: "/api/community/delete" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
