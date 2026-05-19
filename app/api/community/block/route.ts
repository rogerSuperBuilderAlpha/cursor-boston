/**
 * SPDX-License-Identifier: GPL-3.0-only
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
import { checkUpstashRateLimit } from "@/lib/upstash-rate-limit";
import { communityContract } from "@/lib/api-schemas/community";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BLOCK_RATE_LIMIT = { windowMs: 60 * 1000, maxRequests: 30 };

export async function POST(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await checkUpstashRateLimit(`community-block:${user.uid}`, BLOCK_RATE_LIMIT);
    if (!rl.success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }
    const parsed = communityContract.block.body.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid body" },
        { status: 400 }
      );
    }
    const { targetUid } = parsed.data;
    if (targetUid === user.uid) {
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

    const parsed = communityContract.unblock.query.safeParse({
      targetUid: request.nextUrl.searchParams.get("targetUid") ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Missing targetUid" },
        { status: 400 }
      );
    }
    const { targetUid } = parsed.data;

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
