/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { mapGameError } from "@/lib/game/api-error-map";
import { getLeaderboardServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";

export async function GET(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);

    const url = new URL(request.url);
    const limit = Math.max(
      1,
      Math.min(
        100,
        Number.parseInt(url.searchParams.get("limit") || "50", 10) || 50
      )
    );
    const players = await getLeaderboardServer(limit);
    return apiSuccess({
      players: players.map((p) => ({
        userId: p.userId,
        caste: p.caste,
        phase: p.phase,
        tilesHeld: p.stats.tilesHeld,
        unitsAlive: p.stats.unitsAlive,
        attacksWon: p.stats.attacksWon,
        attacksLost: p.stats.attacksLost,
      })),
    });
  } catch (error) {
    return mapGameError(error);
  }
}
