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
  HeroLoreEmptyError,
  HeroLoreForbiddenError,
  HeroLoreTooLongError,
  HeroNotFoundError,
  MAX_EPITAPH_LENGTH,
  createHeroEpitaphServer,
  listHeroEpitaphsServer,
} from "@/lib/game/hero-lore";
import type { GamePlayer } from "@/lib/game/types";
import { getVerifiedUser } from "@/lib/server-auth";
import { checkUpstashRateLimit } from "@/lib/upstash-rate-limit";

const PostBody = z.object({
  body: z.string().min(1).max(MAX_EPITAPH_LENGTH),
});

// GET /api/game/heroes/[heroId]/epitaph
//
// Lists non-deleted epitaphs for a hero (newest first). Empty array if
// the hero is alive or no one has eulogized yet.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ heroId: string }> }
) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);
    const { heroId } = await params;
    if (!heroId) return apiError("heroId is required", 400);
    const epitaphs = await listHeroEpitaphsServer(heroId);
    const res = apiSuccess({ epitaphs });
    res.headers.set("Cache-Control", "private, max-age=30, must-revalidate");
    return res;
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Server error",
      500
    );
  }
}

// POST /api/game/heroes/[heroId]/epitaph
//
// Submit an epitaph for a fallen / limbo hero. Rate-limited 5/day.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ heroId: string }> }
) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);

    const limit = await checkUpstashRateLimit(`epitaph:${user.uid}`, {
      windowMs: 24 * 60 * 60 * 1000,
      maxRequests: 5,
    });
    if (!limit.success) {
      return apiError(
        `Epitaphs limited to 5/day. Retry in ${limit.retryAfter ?? 3600}s.`,
        429
      );
    }

    const { heroId } = await params;
    if (!heroId) return apiError("heroId is required", 400);
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

    const epitaph = await createHeroEpitaphServer({
      heroId,
      authorId: user.uid,
      authorDisplayName: player?.displayName?.trim() || "Unknown general",
      authorCaste: player?.caste ?? null,
      rawBody: parsed.data.body,
    });
    return apiSuccess({ epitaph });
  } catch (error) {
    if (error instanceof HeroNotFoundError) return apiError(error.message, 404);
    if (error instanceof HeroLoreEmptyError) return apiError(error.message, 400);
    if (error instanceof HeroLoreTooLongError) return apiError(error.message, 400);
    if (error instanceof HeroLoreForbiddenError) return apiError(error.message, 400);
    return apiError(
      error instanceof Error ? error.message : "Server error",
      500
    );
  }
}
