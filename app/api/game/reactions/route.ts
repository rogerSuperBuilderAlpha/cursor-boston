/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess, parseRequestBody } from "@/lib/api-response";
import {
  ReactionInvalidEmojiError,
  ReactionInvalidScopeError,
  ReactionMissingHeroIdError,
  ReactionTargetNotFoundError,
  toggleReactionServer,
} from "@/lib/game/reactions";
import { REACTION_EMOJIS } from "@/lib/game/types";
import { getVerifiedUser } from "@/lib/server-auth";
import { checkUpstashRateLimit } from "@/lib/upstash-rate-limit";

const PutBody = z.object({
  scope: z.enum(["chat", "feed", "hero_event"]),
  docId: z.string().min(1).max(200),
  emoji: z.enum(REACTION_EMOJIS),
  heroId: z.string().min(1).max(200).optional(),
});

// PUT /api/game/reactions
//
// Toggles a single user's reaction on a target doc (chat message,
// community-feed event, or hero-event row). Idempotent via the
// game_reactions tracker — calling PUT with the same emoji twice
// reverts to "not reacted". Counters on the target doc are updated
// atomically with FieldValue.increment.
export async function PUT(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);

    const limit = await checkUpstashRateLimit(`reaction:${user.uid}`, {
      windowMs: 60_000,
      maxRequests: 60,
    });
    if (!limit.success) {
      return apiError(
        `Slow down — too many reactions. Retry in ${limit.retryAfter ?? 30}s.`,
        429
      );
    }

    const bodyOrError = await parseRequestBody(request);
    if (bodyOrError instanceof NextResponse) return bodyOrError;
    const parsed = PutBody.safeParse(bodyOrError);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? "Invalid body", 400);
    }

    const result = await toggleReactionServer({
      userId: user.uid,
      scope: parsed.data.scope,
      docId: parsed.data.docId,
      emoji: parsed.data.emoji,
      heroId: parsed.data.heroId,
    });
    return apiSuccess({
      active: result.active,
      reactions: result.reactions,
    });
  } catch (error) {
    if (error instanceof ReactionTargetNotFoundError) {
      return apiError(error.message, 404);
    }
    if (
      error instanceof ReactionInvalidScopeError ||
      error instanceof ReactionInvalidEmojiError ||
      error instanceof ReactionMissingHeroIdError
    ) {
      return apiError(error.message, 400);
    }
    return apiError(
      error instanceof Error ? error.message : "Server error",
      500
    );
  }
}
