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
import {
  DEFAULT_PAGE_LIMIT,
  clampLimit,
  parseCursor,
} from "@/lib/firestore-pagination";
import { mapGameError } from "@/lib/game/api-error-map";
import {
  HERO_EVENTS_PAGE_SIZE,
  getHeroEventsServer,
} from "@/lib/game/heroes-server";
import { getVerifiedUser } from "@/lib/server-auth";

// GET /api/game/heroes/[heroId]/events
//
// Paginated event log for a hero with visibility filtering applied.
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ heroId: string }> }
) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);

    const { heroId } = await context.params;
    const pathParse = gameContract.getHeroEvents.pathParams.safeParse({
      heroId,
    });
    if (!pathParse.success) {
      return apiError(
        pathParse.error.issues[0]?.message ?? "Invalid heroId",
        400
      );
    }

    const url = new URL(request.url);
    const queryParse = gameContract.getHeroEvents.query.safeParse({
      limit: url.searchParams.get("limit") ?? undefined,
      cursor: url.searchParams.get("cursor") ?? undefined,
    });
    if (!queryParse.success) {
      return apiError(
        queryParse.error.issues[0]?.message ?? "Invalid query",
        400
      );
    }

    const db = getAdminDb();
    if (!db) return apiError("Firestore not configured", 500);

    const limit = clampLimit(
      queryParse.data.limit ?? null,
      DEFAULT_PAGE_LIMIT,
      HERO_EVENTS_PAGE_SIZE
    );
    const cursor = parseCursor(queryParse.data.cursor ?? null);

    const result = await getHeroEventsServer({
      db,
      viewerId: user.uid,
      heroId: pathParse.data.heroId,
      cursor,
      limit,
    });

    return apiSuccess({
      events: result.items,
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    });
  } catch (error) {
    return mapGameError(error);
  }
}
