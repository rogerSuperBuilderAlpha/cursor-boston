/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { mapGameError } from "@/lib/game/api-error-map";
import {
  getAllMapTilesServer,
  getAllOwnerSummariesServer,
  getMapTilesInBoundsServer,
} from "@/lib/game/data-server";
import {
  filterSnapshotToBbox,
  readWorldSnapshotServer,
} from "@/lib/game/world-snapshot";
import { getVerifiedUser } from "@/lib/server-auth";

// @contracts: gameContract.getWorld (lib/api-schemas/game.ts)
//
// Global map fetch.
//
// Two modes (additive — back-compat preserved):
//   • Bare GET → returns { tiles, owners } for the entire world.
//   • GET ?qMin=&qMax=&rMin=&rMax= → returns { tiles } for the bbox only.
//
// Both modes prefer the periodic `game_world_snapshots/latest` doc — a
// single read instead of scanning ~3K tiles + every player. The route
// falls back to live queries only if no snapshot exists yet (e.g. first
// deploy before the cron has run). Snapshot rebuild lives at
// `/api/internal/snapshots/rebuild?only=game-world` and is also kicked
// off at the end of the weekly NPC cron.
function parseBbox(url: URL): {
  qMin: number;
  qMax: number;
  rMin: number;
  rMax: number;
} | null {
  const rawQMin = url.searchParams.get("qMin");
  const rawQMax = url.searchParams.get("qMax");
  const rawRMin = url.searchParams.get("rMin");
  const rawRMax = url.searchParams.get("rMax");
  if (
    rawQMin === null ||
    rawQMax === null ||
    rawRMin === null ||
    rawRMax === null
  ) {
    return null;
  }
  const qMin = Number(rawQMin);
  const qMax = Number(rawQMax);
  const rMin = Number(rawRMin);
  const rMax = Number(rawRMax);
  if (
    !Number.isFinite(qMin) ||
    !Number.isFinite(qMax) ||
    !Number.isFinite(rMin) ||
    !Number.isFinite(rMax)
  ) {
    return null;
  }
  if (qMin > qMax || rMin > rMax) return null;
  return { qMin, qMax, rMin, rMax };
}

const SNAPSHOT_CACHE = "public, max-age=60, s-maxage=300, stale-while-revalidate=600";
const LIVE_FALLBACK_CACHE =
  "public, max-age=30, s-maxage=60, stale-while-revalidate=120";

export async function GET(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);

    const url = new URL(request.url);
    const bbox = parseBbox(url);

    const cached = await readWorldSnapshotServer();
    if (cached) {
      const tiles = bbox
        ? filterSnapshotToBbox(cached.snapshot, bbox)
        : cached.snapshot.tiles;
      const body = bbox ? { tiles } : { tiles, owners: cached.snapshot.owners };
      const res = apiSuccess(body);
      res.headers.set("Cache-Control", SNAPSHOT_CACHE);
      if (cached.isStale) res.headers.set("X-World-Snapshot-Stale", "true");
      res.headers.set("X-World-Snapshot-GeneratedAt", cached.snapshot.generatedAt);
      return res;
    }

    // Fallback path — only on first request after a fresh deploy or if the
    // snapshot collection was wiped. Cron will repopulate it within minutes.
    if (bbox) {
      const tiles = await getMapTilesInBoundsServer(bbox);
      const res = apiSuccess({ tiles });
      res.headers.set("Cache-Control", LIVE_FALLBACK_CACHE);
      return res;
    }
    const [tiles, owners] = await Promise.all([
      getAllMapTilesServer(),
      getAllOwnerSummariesServer(),
    ]);
    const res = apiSuccess({ tiles, owners });
    res.headers.set("Cache-Control", LIVE_FALLBACK_CACHE);
    return res;
  } catch (error) {
    return mapGameError(error);
  }
}
