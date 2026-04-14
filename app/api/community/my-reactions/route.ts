/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/server-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { getClientIdentifier, checkRateLimit } from "@/lib/rate-limit";
import type { ReactionType } from "@/types/feed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_LIMIT = { windowMs: 60 * 1000, maxRequests: 120 };
const MAX_IDS = 60;
const IN_CHUNK = 10;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

export async function GET(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request as unknown as Request);
    const rateResult = checkRateLimit(`community-my-reactions:${clientId}`, RATE_LIMIT);
    if (!rateResult.success) {
      return NextResponse.json(
        { error: "Too many requests", retryAfterSeconds: rateResult.retryAfter },
        { status: 429, headers: { "Retry-After": String(rateResult.retryAfter || 60) } }
      );
    }

    const user = await getVerifiedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const raw = request.nextUrl.searchParams.get("messageIds") || "";
    const messageIds = [
      ...new Set(
        raw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      ),
    ].slice(0, MAX_IDS);

    if (messageIds.length === 0) {
      return NextResponse.json({ reactions: {} as Record<string, ReactionType> });
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const reactions: Record<string, ReactionType> = {};

    for (const ids of chunk(messageIds, IN_CHUNK)) {
      const snap = await db
        .collection("messageReactions")
        .where("userId", "==", user.uid)
        .where("messageId", "in", ids)
        .get();

      snap.docs.forEach((doc) => {
        const data = doc.data();
        const mid = data.messageId as string | undefined;
        const type = data.type as ReactionType | undefined;
        if (mid && (type === "like" || type === "dislike")) {
          reactions[mid] = type;
        }
      });
    }

    return NextResponse.json({ reactions });
  } catch (e) {
    console.error("[api/community/my-reactions]", e);
    return NextResponse.json({ error: "Failed to load reactions" }, { status: 500 });
  }
}
