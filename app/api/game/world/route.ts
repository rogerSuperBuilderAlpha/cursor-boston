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
import { getVerifiedUser } from "@/lib/server-auth";

// @contracts: gameContract.getWorld (lib/api-schemas/game.ts)
//
// Global map fetch.
//
// Two modes (additive — back-compat preserved):
//   • Bare GET → returns { tiles, owners } for the entire world. Legacy mode.
//     Kept so existing callers don't break, but new clients should pass bbox.
//   • GET ?qMin=&qMax=&rMin=&rMax= → returns { tiles } for the bbox only.
//     No owners — fetch /api/game/owners separately (snapshot-cached on the
//     client). Slashes per-action read cost from O(world) to O(viewport).
function parseBbox(url: URL): {
  qMin: number;
  qMax: number;
  rMin: number;
  rMax: number;
} | null {
  // All four params must be explicitly present. Without this guard,
  // Number(null) === 0 collapses a bare GET into a degenerate bbox of
  // (0,0)..(0,0) — which matches exactly one tile (0_0) and silently
  // breaks the "fetch whole world" code path.
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

export async function GET(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);

    const url = new URL(request.url);
    const bbox = parseBbox(url);
    if (bbox) {
      const tiles = await getMapTilesInBoundsServer(bbox);
      const res = apiSuccess({ tiles });
      // Bbox-keyed responses are identical for all users → CDN-cacheable.
      // 60s shared cache + 120s stale-while-revalidate keeps refresh storms
      // off Firestore while bounding staleness to 1 minute.
      res.headers.set(
        "Cache-Control",
        "public, max-age=30, s-maxage=60, stale-while-revalidate=120"
      );
      return res;
    }

    const [tiles, owners] = await Promise.all([
      getAllMapTilesServer(),
      getAllOwnerSummariesServer(),
    ]);
    const res = apiSuccess({ tiles, owners });
    // Bare GET returns the same global snapshot for every caller. Cache
    // aggressively at the edge — at 3K+ tiles this is by far the most
    // expensive read path. Once the 🌐 world view migrates to bbox + a
    // separate owners endpoint, this branch can be capped to bbox-only.
    res.headers.set(
      "Cache-Control",
      "public, max-age=30, s-maxage=60, stale-while-revalidate=120"
    );
    return res;
  } catch (error) {
    return mapGameError(error);
  }
}
