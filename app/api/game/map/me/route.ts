/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { mapGameError } from "@/lib/game/api-error-map";
import { getMyMapServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";

// @contracts: gameContract.getMyMap (lib/api-schemas/game.ts)
//
// Personal map view: only own tiles + the enemy ring touching them, plus
// owner summaries for those enemies. Replaces the unbounded /api/game/world
// fetch on the busy game pages — read cost scales with kingdom perimeter,
// not world size.
export async function GET(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);
    const { myTiles, borderTiles, owners } = await getMyMapServer(user.uid);
    const res = apiSuccess({ myTiles, borderTiles, owners });
    // Per-user response — browser-only cache. Action handlers update local
    // state from their own responses, so rapid refresh-button mashing is the
    // only thing that benefits here. 30s caps reads at ≤2/min/user even
    // under aggressive refresh, while keeping post-attack staleness short.
    res.headers.set(
      "Cache-Control",
      "private, max-age=30, must-revalidate"
    );
    return res;
  } catch (error) {
    return mapGameError(error);
  }
}
