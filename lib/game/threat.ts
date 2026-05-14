/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Per-tile threat assessment for friendly tiles. Two consumers today:
 *
 *   1. `/game/spells` bulk-arm-defense — sort target tiles so the most-exposed
 *      ones get armed first.
 *   2. `/game/recruit` auto-routing — distribute new units onto the tiles most
 *      likely to be attacked.
 *
 * A tile's `score` is constructed so that any tile bordering an unshielded
 * enemy outranks every non-bordering tile, regardless of distance — that
 * matches the attack model (`lib/game/data-server.ts`: attacks must come from
 * an adjacent enemy tile).
 */

import type { MapTile } from "./types";
import { axialFromTileId, hexDistance, neighborTileIds } from "./world-gen";

/**
 * Narrow shape of the owner record consumed here — only `shielded` matters
 * for the threat calculation. Both server (`OwnerSummary` in
 * `data-server.ts`) and client (`OwnerSummary` mirror in `app/game/page.tsx`,
 * `app/game/tiles/page.tsx`) types satisfy this shape, so callers can pass
 * whichever they have without a conversion step.
 */
export interface ThreatOwnerInfo {
  shielded: boolean;
}

/**
 * Per-tile threat record for one friendly tile.
 *
 * - `hostileNeighbors`: how many of the 6 adjacent tiles are owned by
 *   *unshielded* enemies. Shielded enemies cannot attack, so they don't
 *   contribute to attack likelihood.
 * - `distanceToEnemy`: hex-distance to the nearest unshielded enemy tile in
 *   the world. `Number.POSITIVE_INFINITY` if no unshielded enemy exists.
 * - `score`: composite ranking value. Higher = more likely to be attacked.
 */
export interface TileThreat {
  hostileNeighbors: number;
  distanceToEnemy: number;
  score: number;
}

export interface ComputeTileThreatArgs {
  /** Tiles the requesting user owns (the ones we score). */
  myTiles: ReadonlyArray<MapTile>;
  /** Every tile in the visible world (used to find enemy positions). */
  worldTiles: ReadonlyArray<MapTile>;
  /** Owner metadata keyed by `userId`. Provides shielded status. */
  owners: ReadonlyMap<string, ThreatOwnerInfo>;
  /** The viewer's own user id; tiles with this owner are skipped as "enemy". */
  myUserId: string;
}

/**
 * Build a `tileId → TileThreat` map for every owned tile in `myTiles`.
 *
 * Score formula:
 *
 *   score = hostileNeighbors * 1000 + 1 / (distanceToEnemy + 1)
 *
 * The `* 1000` ensures a single-bordering tile (`hostileNeighbors = 1`,
 * `score ≈ 1000.x`) always sorts above a non-bordering tile, even one that
 * is only 2 hexes away from an enemy (`score = 0 + 1/3 = 0.33`). Within the
 * bordering set, more hostile neighbors wins; within the non-bordering set,
 * closer wins.
 */
export function computeTileThreat(args: ComputeTileThreatArgs): Map<string, TileThreat> {
  const { myTiles, worldTiles, owners, myUserId } = args;

  // 1. Identify enemy tiles owned by an unshielded foreign player.
  const enemyTiles: MapTile[] = [];
  const enemyTileIds = new Set<string>();
  for (const t of worldTiles) {
    if (!t.ownerId || t.ownerId === myUserId) continue;
    const owner = owners.get(t.ownerId);
    // Treat unknown owners as unshielded — safer to over-count threat than
    // under-count when the owner record didn't make it into the response.
    if (owner && owner.shielded) continue;
    enemyTiles.push(t);
    enemyTileIds.add(t.tileId);
  }

  const out = new Map<string, TileThreat>();

  // 2. For each of my tiles, count hostile neighbors and find min distance
  //    to any enemy tile.
  for (const t of myTiles) {
    const adj = neighborTileIds(t.q, t.r);
    let hostileNeighbors = 0;
    for (const id of adj) {
      if (enemyTileIds.has(id)) hostileNeighbors++;
    }

    let distanceToEnemy = Number.POSITIVE_INFINITY;
    if (enemyTiles.length > 0) {
      const me = { q: t.q, r: t.r };
      for (const e of enemyTiles) {
        const d = hexDistance(me, { q: e.q, r: e.r });
        if (d < distanceToEnemy) distanceToEnemy = d;
      }
    }

    const distanceTerm = Number.isFinite(distanceToEnemy)
      ? 1 / (distanceToEnemy + 1)
      : 0;
    const score = hostileNeighbors * 1000 + distanceTerm;

    out.set(t.tileId, { hostileNeighbors, distanceToEnemy, score });
  }

  return out;
}

/**
 * Convenience: return tile ids ranked by descending threat score, with stable
 * ordering as a tiebreaker (axial coord). Tiles not present in `threat` are
 * appended at the end with score 0 — useful when callers want a complete
 * ordering of every owned tile.
 */
export function rankTileIdsByThreat(
  tileIds: ReadonlyArray<string>,
  threat: ReadonlyMap<string, TileThreat>
): string[] {
  return [...tileIds].sort((a, b) => {
    const sa = threat.get(a)?.score ?? 0;
    const sb = threat.get(b)?.score ?? 0;
    if (sa !== sb) return sb - sa;
    // Stable tiebreaker: axial coord (lex).
    const ca = axialFromTileId(a);
    const cb = axialFromTileId(b);
    if (ca.q !== cb.q) return ca.q - cb.q;
    return ca.r - cb.r;
  });
}
