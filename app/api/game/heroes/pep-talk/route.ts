/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess, parseRequestBody } from "@/lib/api-response";
import { mapGameError } from "@/lib/game/api-error-map";
import { pepTalkHeroServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";
import { checkUpstashRateLimit } from "@/lib/upstash-rate-limit";

const PostBody = z.object({
  tileId: z.string().min(1).max(200),
});

// POST /api/game/heroes/pep-talk
// Grants +15 stamina to the hero on `tileId`. Caller must be at 0 turns.
// Rate-limited 3/day per player.
export async function POST(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);

    const limit = await checkUpstashRateLimit(`peptalk:${user.uid}`, {
      windowMs: 24 * 60 * 60 * 1000,
      maxRequests: 3,
    });
    if (!limit.success) {
      return apiError(
        `Pep talks limited to 3/day. Retry in ${limit.retryAfter ?? 3600}s.`,
        429
      );
    }

    const bodyOrError = await parseRequestBody(request);
    if (bodyOrError instanceof NextResponse) return bodyOrError;
    const parsed = PostBody.safeParse(bodyOrError);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? "Invalid body", 400);
    }

    const tile = await pepTalkHeroServer({
      callerUserId: user.uid,
      tileId: parsed.data.tileId,
    });
    return apiSuccess({ tile });
  } catch (error) {
    return mapGameError(error);
  }
}
