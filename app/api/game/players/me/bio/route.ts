/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess, parseRequestBody } from "@/lib/api-response";
import { mapGameError } from "@/lib/game/api-error-map";
import { setPlayerBioServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";
import { checkUpstashRateLimit } from "@/lib/upstash-rate-limit";

const PostBody = z.object({
  bio: z.string().max(500),
});

// POST /api/game/players/me/bio
//
// Sets the caller's public profile bio. No turn cost. Sanitized server-
// side via sanitizeText() inside setPlayerBioServer. Empty string clears
// the bio. Rate-limited per-user via Upstash (in-memory fallback).
export async function POST(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);

    const limit = await checkUpstashRateLimit(`bio:${user.uid}`, {
      windowMs: 24 * 60 * 60 * 1000,
      maxRequests: 5,
    });
    if (!limit.success) {
      return apiError(
        `Bio edits limited to 5/day. Try again in ${limit.retryAfter ?? 3600}s.`,
        429
      );
    }

    const bodyOrError = await parseRequestBody(request);
    if (bodyOrError instanceof NextResponse) return bodyOrError;
    const parsed = PostBody.safeParse(bodyOrError);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? "Invalid body", 400);
    }

    const player = await setPlayerBioServer(user.uid, parsed.data.bio);
    return apiSuccess({ player });
  } catch (error) {
    return mapGameError(error);
  }
}
