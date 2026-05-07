/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import { logger } from "@/lib/logger";
import { parseRequestBody } from "@/lib/api-response";
import { getClientIdentifier } from "@/lib/rate-limit";
import { checkUpstashRateLimit } from "@/lib/upstash-rate-limit";
import { sanitizeText } from "@/lib/sanitize";
import { getDisplayName } from "@/lib/utils";
import { communityContract } from "@/lib/api-schemas/community";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COMMUNITY_RATE_LIMIT = { windowMs: 60 * 1000, maxRequests: 10 };

export async function POST(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request as unknown as Request);
    const rateResult = await checkUpstashRateLimit(`community-post:${clientId}`, COMMUNITY_RATE_LIMIT);
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

    const db = getAdminDb();
    if (!db) {
      logger.error("Firebase Admin is not configured for posts");
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const bodyOrError = await parseRequestBody(request);
    if (bodyOrError instanceof NextResponse) return bodyOrError;

    // Validate via the contract schema so the API surface and the runtime
    // check stay in lockstep with the OpenAPI spec.
    const sanitizedRaw = sanitizeText(
      typeof bodyOrError.content === "string" ? bodyOrError.content : ""
    );
    const parsed = communityContract.createPost.body.safeParse({
      content: sanitizedRaw,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request body" },
        { status: 400 }
      );
    }
    const sanitizedContent = parsed.data.content;

    const authorName = getDisplayName(user);

    const messageRef = db.collection("communityMessages").doc();
    await messageRef.set({
      content: sanitizedContent,
      authorId: user.uid,
      authorName,
      authorPhoto: user.picture || null,
      createdAt: FieldValue.serverTimestamp(),
      likeCount: 0,
      dislikeCount: 0,
      replyCount: 0,
      repostCount: 0,
    });

    return NextResponse.json({ messageId: messageRef.id });
  } catch (error) {
    logger.logError(error, { endpoint: "/api/community/post" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
