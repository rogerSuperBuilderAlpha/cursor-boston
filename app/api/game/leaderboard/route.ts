/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import {
  clampLimit,
  parseCursor,
  DEFAULT_PAGE_LIMIT,
} from "@/lib/firestore-pagination";
import { mapGameError } from "@/lib/game/api-error-map";
import { getLeaderboardServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";

export async function GET(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);

    const url = new URL(request.url);
    const limit = clampLimit(url.searchParams.get("limit"), DEFAULT_PAGE_LIMIT);
    const cursor = parseCursor(url.searchParams.get("cursor"));

    const { items, nextCursor, hasMore } = await getLeaderboardServer({
      limit,
      cursor,
    });
    return apiSuccess({
      players: items.map((p) => ({
        userId: p.userId,
        displayName: p.displayName ?? "",
        caste: p.caste,
        phase: p.phase,
        tilesHeld: p.stats.tilesHeld,
        unitsAlive: p.stats.unitsAlive,
        attacksWon: p.stats.attacksWon,
        attacksLost: p.stats.attacksLost,
      })),
      nextCursor,
      hasMore,
    });
  } catch (error) {
    return mapGameError(error);
  }
}
