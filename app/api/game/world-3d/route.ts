/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

// Public read endpoint for the daily 3D world snapshot. Serves the doc
// at `game_world_snapshots/daily-3d`, written once per day by the
// `only=game-world-3d` cron branch in /api/internal/snapshots/rebuild.
//
// Anonymous access. ISR caches the response for 24h; combined with the
// daily writer, steady-state cost is effectively zero Firestore reads
// per visitor.

import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { readWorld3DSnapshotServer } from "@/lib/game/world-snapshot-3d";

// @contracts: gameContract.getWorld3d (lib/api-schemas/game.ts)
// Validates the response shape returned to anonymous visitors.
import "@/lib/api-schemas/game";

export const runtime = "nodejs";
export const revalidate = 86400; // 24h

const CACHE_HEADER =
  "public, max-age=300, s-maxage=86400, stale-while-revalidate=86400";

export async function GET() {
  try {
    const snapshot = await readWorld3DSnapshotServer();
    if (!snapshot) {
      // Pre-first-cron-run: respond with an empty world rather than 404
      // so the client renders an empty board (and the "no snapshot yet"
      // state is visible in the UI rather than a broken page).
      const res = NextResponse.json(
        { tiles: [], generatedAt: null, tileCount: 0 },
        { status: 200 }
      );
      // Short cache while the snapshot is missing — first cron run will
      // populate it within 24h.
      res.headers.set(
        "Cache-Control",
        "public, max-age=60, s-maxage=300, stale-while-revalidate=600"
      );
      return res;
    }

    const res = NextResponse.json(snapshot, { status: 200 });
    res.headers.set("Cache-Control", CACHE_HEADER);
    return res;
  } catch (error) {
    logger.logError(error, { endpoint: "/api/game/world-3d" });
    return NextResponse.json(
      { error: "Failed to read 3D world snapshot" },
      { status: 500 }
    );
  }
}
