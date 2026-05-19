/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { mapGameError } from "@/lib/game/api-error-map";
import { getMyMapServer } from "@/lib/game/data-server";
import {
  deriveMyMapFromSnapshot,
  readWorldSnapshotServer,
} from "@/lib/game/world-snapshot";
import { getVerifiedUser } from "@/lib/server-auth";

// @contracts: gameContract.getMyMap (lib/api-schemas/game.ts)
//
// Personal map view: only own tiles + the enemy ring touching them, plus
// owner summaries for those enemies. Reads `game_world_snapshots/latest`
// and filters in-memory — that's 1 Firestore read per call instead of
// ~50. Falls back to the live-query implementation only if no snapshot
// exists yet (first deploy / wiped snapshots).
//
// Staleness contract: the snapshot is rebuilt every ~5 min by the cron
// at /api/internal/snapshots/rebuild?only=game-world (and at the end of
// the weekly NPC cron). The player's own actions update local client
// state from each action's response, so a player's own builds/attacks
// are reflected immediately on the client. Only OTHER players' changes
// (incoming attacks, captures) ride the snapshot delay.
export async function GET(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);

    const cached = await readWorldSnapshotServer();
    if (cached) {
      const view = deriveMyMapFromSnapshot(cached.snapshot, user.uid);
      const res = apiSuccess(view);
      // Per-user response — browser-only cache. Action handlers update
      // local state from their own response, so this 60s window only
      // affects rapid refresh-button mashing and route transitions.
      res.headers.set("Cache-Control", "private, max-age=60, must-revalidate");
      if (cached.isStale) res.headers.set("X-World-Snapshot-Stale", "true");
      res.headers.set(
        "X-World-Snapshot-GeneratedAt",
        cached.snapshot.generatedAt
      );
      return res;
    }

    // Snapshot missing — fall back to the live implementation. Logged via
    // the snapshot logger, but expected only on first deploy.
    const { myTiles, borderTiles, owners } = await getMyMapServer(user.uid);
    const res = apiSuccess({ myTiles, borderTiles, owners });
    res.headers.set("Cache-Control", "private, max-age=30, must-revalidate");
    return res;
  } catch (error) {
    return mapGameError(error);
  }
}
