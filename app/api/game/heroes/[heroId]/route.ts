/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { gameContract } from "@/lib/api-schemas/game";
import { getAdminDb } from "@/lib/firebase-admin";
import { mapGameError } from "@/lib/game/api-error-map";
import { getHeroDetailServer } from "@/lib/game/heroes-server";
import { getVerifiedUser } from "@/lib/server-auth";

// GET /api/game/heroes/[heroId]
//
// Hero detail + first page of events, both visibility-filtered. Returns
// 404 when the hero doesn't exist.
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ heroId: string }> }
) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);

    const { heroId } = await context.params;
    const parsed = gameContract.getHeroDetail.pathParams.safeParse({ heroId });
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? "Invalid heroId", 400);
    }

    const db = getAdminDb();
    if (!db) return apiError("Firestore not configured", 500);

    const result = await getHeroDetailServer({
      db,
      viewerId: user.uid,
      heroId: parsed.data.heroId,
    });
    if (!result) return apiError("Hero not found", 404);

    return apiSuccess({
      hero: result.hero,
      events: result.events,
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    });
  } catch (error) {
    return mapGameError(error);
  }
}
