/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess, parseRequestBody } from "@/lib/api-response";
import { gameContract } from "@/lib/api-schemas/game";
import {
  COMMUNITY_PAGE_SIZE,
  CommunityMessageEmptyError,
  CommunityMessageTooLongError,
  CommunityMessageWrongCasteError,
  MAX_MESSAGE_LENGTH,
  createCommunityMessage,
  listRecentCommunityMessages,
} from "@/lib/game/community";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import { checkUpstashRateLimit } from "@/lib/upstash-rate-limit";
import type { ChatScope, GamePlayer } from "@/lib/game/types";

const CHAT_SCOPE_REGEX = /^(global|caste:(white|blue|black|red|green))$/;

function parseScopeParam(value: string | null): ChatScope {
  if (!value || !CHAT_SCOPE_REGEX.test(value)) return "global";
  return value as ChatScope;
}

// @contracts: gameContract.getCommunityChat, gameContract.postCommunityChat
void gameContract.getCommunityChat;
void gameContract.postCommunityChat;

const PostBody = z.object({
  body: z.string().min(1).max(MAX_MESSAGE_LENGTH),
  scope: z
    .string()
    .regex(CHAT_SCOPE_REGEX, "Invalid scope")
    .optional(),
});

// GET /api/game/community/chat
//
// Returns the most recent non-deleted chat messages for the community
// board. Authenticated read so unsigned-in visitors don't see the
// firehose; matches the rest of the game endpoints.
export async function GET(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);
    const scope = parseScopeParam(
      new URL(request.url).searchParams.get("scope")
    );
    const messages = await listRecentCommunityMessages(
      COMMUNITY_PAGE_SIZE,
      scope
    );
    const res = apiSuccess({ messages, scope });
    res.headers.set(
      "Cache-Control",
      "private, max-age=10, must-revalidate"
    );
    return res;
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Server error",
      500
    );
  }
}

// POST /api/game/community/chat
//
// Authenticated players post a chat message. Rate-limited per-user to
// 10 posts per 60s via Upstash (in-memory fallback if Redis isn't
// configured). Body must be 1–500 chars after trimming. The author's
// displayName + caste are read from their player doc and denormalized
// onto the message at write time so the chat renderer doesn't need a
// join.
export async function POST(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);

    const limit = await checkUpstashRateLimit(`chat-post:${user.uid}`, {
      windowMs: 60_000,
      maxRequests: 10,
    });
    if (!limit.success) {
      return apiError(
        `Slow down — rate-limited. Try again in ${limit.retryAfter ?? 30}s.`,
        429
      );
    }

    const bodyOrError = await parseRequestBody(request);
    if (bodyOrError instanceof NextResponse) return bodyOrError;
    const parsed = PostBody.safeParse(bodyOrError);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? "Invalid body", 400);
    }

    // Pull author display info from the player doc so the chat row can
    // render without a follow-up read.
    const db = getAdminDb();
    if (!db) return apiError("Server not configured", 500);
    const playerSnap = await db
      .collection("game_players")
      .doc(user.uid)
      .get();
    const player = playerSnap.exists
      ? (playerSnap.data() as GamePlayer)
      : null;

    const message = await createCommunityMessage({
      userId: user.uid,
      displayName: player?.displayName?.trim() || "Unknown general",
      caste: player?.caste ?? null,
      body: parsed.data.body,
      scope: parsed.data.scope as ChatScope | undefined,
    });
    return apiSuccess({ message });
  } catch (error) {
    if (error instanceof CommunityMessageEmptyError) {
      return apiError(error.message, 400);
    }
    if (error instanceof CommunityMessageTooLongError) {
      return apiError(error.message, 400);
    }
    if (error instanceof CommunityMessageWrongCasteError) {
      return apiError(error.message, 403);
    }
    return apiError(
      error instanceof Error ? error.message : "Server error",
      500
    );
  }
}
