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
import { getRecentAttacksServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";
import { gameContract } from "@/lib/api-schemas/game";

export async function GET(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);

    const url = new URL(request.url);
    const queryParse = gameContract.getAttacks.query.safeParse({
      limit: url.searchParams.get("limit") ?? undefined,
      cursor: url.searchParams.get("cursor") ?? undefined,
      side: url.searchParams.get("side") ?? undefined,
    });
    if (!queryParse.success) {
      return apiError(queryParse.error.issues[0]?.message ?? "Invalid query", 400);
    }
    const side = queryParse.data.side ?? "all";
    const limit = clampLimit(queryParse.data.limit ?? null, DEFAULT_PAGE_LIMIT);
    const cursor = parseCursor(queryParse.data.cursor ?? null);

    const { items, nextCursor, hasMore } = await getRecentAttacksServer({
      userId: user.uid,
      side,
      limit,
      cursor,
    });
    return apiSuccess({ attacks: items, nextCursor, hasMore });
  } catch (error) {
    return mapGameError(error);
  }
}
