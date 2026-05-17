/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { mapGameError } from "@/lib/game/api-error-map";
import { getPublicPlayerProfileServer } from "@/lib/game/data-server";
import { derivePlayerTitles } from "@/lib/game/titles";
import { getVerifiedUser } from "@/lib/server-auth";

// GET /api/game/players/[playerId]
//
// Public-safe player profile slice + derived titles. game_players is
// already world-readable for the leaderboard, so this endpoint exists
// mainly to colocate the titles derivation with the profile read.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ playerId: string }> }
) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);
    const { playerId } = await params;
    if (!playerId) return apiError("playerId is required", 400);

    const player = await getPublicPlayerProfileServer(playerId);
    if (!player) return apiError("Player not found", 404);

    const titles = derivePlayerTitles(player);

    const publicSlice = {
      userId: player.userId,
      displayName: player.displayName,
      caste: player.caste,
      phase: player.phase,
      tilesExplored: player.tilesExplored,
      stats: player.stats,
      heroCount: player.heroCount ?? 0,
      armageddonSealsBroken: player.armageddonSealsBroken ?? 0,
      seasonNumber: player.seasonNumber ?? 1,
      bio: player.bio ?? "",
      bioUpdatedAt: player.bioUpdatedAt ?? null,
      createdAt: player.createdAt,
    };

    const res = apiSuccess({ player: publicSlice, titles });
    res.headers.set("Cache-Control", "private, max-age=30, must-revalidate");
    return res;
  } catch (error) {
    return mapGameError(error);
  }
}
