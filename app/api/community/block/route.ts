/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * POST   /api/community/block      — block a user (owner-only write)
 * DELETE /api/community/block      — unblock
 *
 * Writes a doc at `userBlocks/{ownerUid}/blocked/{targetUid}`.
 *
 * Feed-side filtering (hiding blocked users' posts in queries) is a
 * follow-up — see TODO at end of file.
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import { logger } from "@/lib/logger";
import { parseRequestBody } from "@/lib/api-response";
import { checkUpstashRateLimit } from "@/lib/upstash-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BLOCK_RATE_LIMIT = { windowMs: 60 * 1000, maxRequests: 30 };

export async function POST(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await checkUpstashRateLimit(`community-block:${user.uid}`, BLOCK_RATE_LIMIT);
    if (!rl.success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

    const bodyOrError = await parseRequestBody(request);
    if (bodyOrError instanceof NextResponse) return bodyOrError;
    const { targetUid } = bodyOrError;

    if (typeof targetUid !== "string" || !targetUid || targetUid === user.uid) {
      return NextResponse.json({ error: "Invalid targetUid" }, { status: 400 });
    }

    const db = getAdminDb();
    if (!db) return NextResponse.json({ error: "Server not configured" }, { status: 500 });

    await db
      .collection("userBlocks")
      .doc(user.uid)
      .collection("blocked")
      .doc(targetUid)
      .set({
        targetUid,
        blockedAt: FieldValue.serverTimestamp(),
      });

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.logError(err, { endpoint: "/api/community/block", area: "community-safety" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const targetUid = request.nextUrl.searchParams.get("targetUid");
    if (!targetUid) {
      return NextResponse.json({ error: "Missing targetUid" }, { status: 400 });
    }

    const db = getAdminDb();
    if (!db) return NextResponse.json({ error: "Server not configured" }, { status: 500 });

    await db
      .collection("userBlocks")
      .doc(user.uid)
      .collection("blocked")
      .doc(targetUid)
      .delete();

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.logError(err, { endpoint: "/api/community/block", area: "community-safety" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// TODO(P1 follow-up): filter community feed queries to exclude posts
// authored by users in the caller's userBlocks/blocked subcollection.
// Lives in the feed-fetcher module (lib/community/data-server.ts or
// equivalent). Out of scope for the 2026-Q2 review push; tracked
// separately under Chunk D follow-up.
