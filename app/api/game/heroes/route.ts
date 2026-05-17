/**
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
  HEROES_LIST_PAGE_SIZE,
  getHeroesListServer,
} from "@/lib/game/heroes-server";
import { getVerifiedUser } from "@/lib/server-auth";

// GET /api/game/heroes
//
// Paginated list of heroes. The visibility filter is applied per-row by
// `applyHeroVisibility` inside `getHeroesListServer` — clients never see
// raw `currentTileId` / `stamina` for heroes they aren't entitled to.
export async function GET(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);

    const url = new URL(request.url);
    const queryParse = gameContract.getHeroesList.query.safeParse({
      limit: url.searchParams.get("limit") ?? undefined,
      cursor: url.searchParams.get("cursor") ?? undefined,
      scope: url.searchParams.get("scope") ?? undefined,
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
      HEROES_LIST_PAGE_SIZE
    );
    const cursor = parseCursor(queryParse.data.cursor ?? null);
    const scope = queryParse.data.scope ?? "all";

    const { items, nextCursor, hasMore } = await getHeroesListServer({
      db,
      viewerId: user.uid,
      scope,
      cursor,
      limit,
    });

    return apiSuccess({ heroes: items, nextCursor, hasMore });
  } catch (error) {
    return mapGameError(error);
  }
}
