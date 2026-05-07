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
      return apiSuccess({ tiles });
    }

    const [tiles, owners] = await Promise.all([
      getAllMapTilesServer(),
      getAllOwnerSummariesServer(),
    ]);
    return apiSuccess({ tiles, owners });
  } catch (error) {
    return mapGameError(error);
  }
}
