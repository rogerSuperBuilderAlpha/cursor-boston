/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { mapGameError } from "@/lib/game/api-error-map";
import {
  createPlayerWithSpawnServer,
  getOwnedMapTilesServer,
  getPlayerServer,
} from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";

export async function GET(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);
    const player = await getPlayerServer(user.uid);
    if (!player) return apiSuccess({ player: null, tiles: [] });
    // Lightweight projection — strips neighborTileIds, upgradeIds, level,
    // and timestamps from the per-tile payload. Tile detail page fetches
    // the full GameTile separately via /api/game/tile/[tileId].
    const tiles = await getOwnedMapTilesServer(user.uid);
    return apiSuccess({ player, tiles });
  } catch (error) {
    return mapGameError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);
    const result = await createPlayerWithSpawnServer(user.uid);
    return apiSuccess(
      { player: result.player, tileIds: result.tileIds },
      201
    );
  } catch (error) {
    return mapGameError(error);
  }
}
