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
    return apiSuccess({ myTiles, borderTiles, owners });
  } catch (error) {
    return mapGameError(error);
  }
}
