/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess, parseRequestBody } from "@/lib/api-response";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  MAX_PROPHECY_LENGTH,
  ProphecyEmptyError,
  ProphecyInvalidSealError,
  ProphecySealAlreadyBrokenError,
  ProphecyTooLongError,
  createProphecyServer,
  listPropheciesByAuthorServer,
  listPropheciesForSealServer,
} from "@/lib/game/prophecies";
import type { GamePlayer } from "@/lib/game/types";
import { getVerifiedUser } from "@/lib/server-auth";
import { checkUpstashRateLimit } from "@/lib/upstash-rate-limit";

const PostBody = z.object({
  targetSealNumber: z.number().int().min(1).max(7),
  prediction: z.string().min(1).max(MAX_PROPHECY_LENGTH),
});

// GET /api/game/prophecies?seal=N   — list for a specific seal
// GET /api/game/prophecies?authorId=X — list by author
export async function GET(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);
    const params = new URL(request.url).searchParams;
    const seal = params.get("seal");
    const authorId = params.get("authorId");
    if (seal) {
      const n = Number(seal);
      if (!Number.isInteger(n) || n < 1 || n > 7) {
        return apiError("Invalid seal number", 400);
      }
      const prophecies = await listPropheciesForSealServer(n);
      const res = apiSuccess({ prophecies });
      res.headers.set("Cache-Control", "private, max-age=30, must-revalidate");
      return res;
    }
    if (authorId) {
      const prophecies = await listPropheciesByAuthorServer(authorId);
      return apiSuccess({ prophecies });
    }
    return apiError("Provide ?seal=N or ?authorId=X", 400);
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Server error",
      500
    );
  }
}

// POST /api/game/prophecies — file a new prediction. Rate-limited 1/day.
export async function POST(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);

    const limit = await checkUpstashRateLimit(`prophecy:${user.uid}`, {
      windowMs: 24 * 60 * 60 * 1000,
      maxRequests: 1,
    });
    if (!limit.success) {
      return apiError(
        `Prophecies limited to 1/day. Retry in ${limit.retryAfter ?? 3600}s.`,
        429
      );
    }

    const bodyOrError = await parseRequestBody(request);
    if (bodyOrError instanceof NextResponse) return bodyOrError;
    const parsed = PostBody.safeParse(bodyOrError);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? "Invalid body", 400);
    }

    const db = getAdminDb();
    if (!db) return apiError("Server not configured", 500);
    const playerSnap = await db.collection("game_players").doc(user.uid).get();
    const player = playerSnap.exists
      ? (playerSnap.data() as GamePlayer)
      : null;

    const prophecy = await createProphecyServer({
      author: {
        userId: user.uid,
        displayName: player?.displayName?.trim() || "Unknown general",
        caste: player?.caste ?? null,
      },
      targetSealNumber: parsed.data.targetSealNumber,
      rawPrediction: parsed.data.prediction,
    });
    return apiSuccess({ prophecy });
  } catch (error) {
    if (error instanceof ProphecyEmptyError) return apiError(error.message, 400);
    if (error instanceof ProphecyTooLongError) return apiError(error.message, 400);
    if (error instanceof ProphecyInvalidSealError) return apiError(error.message, 400);
    if (error instanceof ProphecySealAlreadyBrokenError) return apiError(error.message, 409);
    return apiError(
      error instanceof Error ? error.message : "Server error",
      500
    );
  }
}
