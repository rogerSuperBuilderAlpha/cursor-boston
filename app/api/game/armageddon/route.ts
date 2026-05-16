/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

// @contracts: getArmageddonHistory (lib/api-schemas/game.ts)
//
// Pure GET with a single numeric `limit` query param; clamped server-side.

import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { mapGameError } from "@/lib/game/api-error-map";
import { listArmageddonHistoryServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";

/**
 * GET /api/game/armageddon
 *
 * Returns past Armageddons (hall of fame), most-recent season first.
 * Each entry includes the 7 seal audit, top-10 weighted-draw winners,
 * and a top-50-by-tilesHeld snapshot. Used by the /game/armageddon
 * history page. Auth required.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);

    const url = new URL(request.url);
    const rawLimit = url.searchParams.get("limit");
    const limit = rawLimit ? Math.max(1, Math.min(200, Number(rawLimit))) : 50;

    const history = await listArmageddonHistoryServer(limit);
    return apiSuccess({ history });
  } catch (error) {
    return mapGameError(error);
  }
}
