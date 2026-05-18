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
  MAX_PACT_STATEMENT_LENGTH,
  PactEmptyError,
  PactSelfTargetError,
  PactTargetNotFoundError,
  PactTooLongError,
  createPactServer,
  listPactsForPlayerServer,
} from "@/lib/game/pacts";
import type { GamePlayer } from "@/lib/game/types";
import { getVerifiedUser } from "@/lib/server-auth";
import { checkUpstashRateLimit } from "@/lib/upstash-rate-limit";

const PostBody = z.object({
  targetId: z.string().min(1).max(200),
  statement: z.string().min(1).max(MAX_PACT_STATEMENT_LENGTH),
  durationDays: z.number().int().min(1).max(30).optional(),
});

// GET /api/game/pacts?playerId=...
// Lists active + recent pacts where `playerId` is author or target.
export async function GET(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);
    const playerId =
      new URL(request.url).searchParams.get("playerId") ?? user.uid;
    const pacts = await listPactsForPlayerServer(playerId);
    const res = apiSuccess({ pacts });
    res.headers.set("Cache-Control", "private, max-age=30, must-revalidate");
    return res;
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Server error",
      500
    );
  }
}

// POST /api/game/pacts
// Files a new public pact targeting another player. Rate-limited 1/day.
export async function POST(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);

    const limit = await checkUpstashRateLimit(`pact:${user.uid}`, {
      windowMs: 24 * 60 * 60 * 1000,
      maxRequests: 1,
    });
    if (!limit.success) {
      return apiError(
        `Pacts limited to 1/day. Retry in ${limit.retryAfter ?? 3600}s.`,
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

    const pact = await createPactServer({
      author: {
        userId: user.uid,
        displayName: player?.displayName?.trim() || "Unknown general",
        caste: player?.caste ?? null,
      },
      targetId: parsed.data.targetId,
      rawStatement: parsed.data.statement,
      ...(parsed.data.durationDays
        ? { durationMs: parsed.data.durationDays * 24 * 60 * 60 * 1000 }
        : {}),
    });
    return apiSuccess({ pact });
  } catch (error) {
    if (error instanceof PactSelfTargetError) return apiError(error.message, 400);
    if (error instanceof PactEmptyError) return apiError(error.message, 400);
    if (error instanceof PactTooLongError) return apiError(error.message, 400);
    if (error instanceof PactTargetNotFoundError) return apiError(error.message, 404);
    return apiError(
      error instanceof Error ? error.message : "Server error",
      500
    );
  }
}
