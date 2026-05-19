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
import { setTileInscriptionServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";
import { checkUpstashRateLimit } from "@/lib/upstash-rate-limit";

const PostBody = z.object({
  inscription: z.string().max(120),
});

// POST /api/game/tile/[tileId]/inscription
//
// Owner-only. Sets a short (≤120 char) inscription on the tile. The
// inscription is surfaced to other players via intel scans + post-
// attack outcome views. No turn cost; Upstash-rate-limited 20/day.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tileId: string }> }
) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);

    const limit = await checkUpstashRateLimit(`inscription:${user.uid}`, {
      windowMs: 24 * 60 * 60 * 1000,
      maxRequests: 20,
    });
    if (!limit.success) {
      return apiError(
        `Inscription edits limited to 20/day. Retry in ${limit.retryAfter ?? 3600}s.`,
        429
      );
    }

    const { tileId } = await params;
    if (!tileId) return apiError("tileId is required", 400);

    const bodyOrError = await parseRequestBody(request);
    if (bodyOrError instanceof NextResponse) return bodyOrError;
    const parsed = PostBody.safeParse(bodyOrError);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? "Invalid body", 400);
    }

    const tile = await setTileInscriptionServer(
      user.uid,
      tileId,
      parsed.data.inscription
    );
    return apiSuccess({ tile });
  } catch (error) {
    return mapGameError(error);
  }
}
