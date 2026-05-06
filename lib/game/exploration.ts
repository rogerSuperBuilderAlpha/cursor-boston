/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { AxialCoord } from "./world-gen";
import {
  axialFromTileId,
  hexDistance,
  neighbors,
  tileIdFromAxial,
} from "./world-gen";

// ───── Public types ─────

export interface FrontierSample {
  tile: AxialCoord;
  tileId: string;
  // Hex distance from the player's nearest owned tile to this candidate.
  distanceToCore: number;
  // Count of the 6 axial neighbors that are owned by some other player.
  hostileNeighbors: number;
  // 0..100 risk indicator surfaced to the player. Combines distance
  // (further from your core = costlier to support) and hostile-neighbor
  // count. Ground-truth combat outcome is unaffected.
  riskScore: number;
}

// ───── Distance / centroid helpers ─────

/**
 * Average position of `tileIds` in axial space. Returns origin if empty.
 * Output is rounded to the nearest integer hex.
 */
export function hexCentroid(tileIds: ReadonlyArray<string>): AxialCoord {
  if (tileIds.length === 0) return { q: 0, r: 0 };
  let sumQ = 0;
  let sumR = 0;
  for (const id of tileIds) {
    const c = axialFromTileId(id);
    sumQ += c.q;
    sumR += c.r;
  }
  return {
    q: Math.round(sumQ / tileIds.length),
    r: Math.round(sumR / tileIds.length),
  };
}

/**
 * Smallest hex-distance from `target` to any tile in `ownedTileIds`.
 * Returns `Number.POSITIVE_INFINITY` if the player owns nothing.
 */
export function distanceToNearestOwned(
  target: AxialCoord,
  ownedTileIds: ReadonlyArray<string>
): number {
  if (ownedTileIds.length === 0) return Number.POSITIVE_INFINITY;
  let best = Number.POSITIVE_INFINITY;
  for (const id of ownedTileIds) {
    const c = axialFromTileId(id);
    const d = hexDistance(c, target);
    if (d < best) best = d;
  }
  return best;
}

// ───── Frontier sampling ─────

/**
 * Probability the next frontier tile is biased toward an enemy-adjacent
 * coord. Smooth ramp from 5% at 25 tiles held to ~40% at 200, capped at 60%.
 */
export function hostileSpawnProbability(tilesHeld: number): number {
  return Math.min(0.6, 0.05 + 0.0019 * Math.max(0, tilesHeld - 25));
}

/**
 * Risk score 0..100. Hostile neighbors weigh heavily; distance from
 * the player's core adds linearly. Pure presentation — gameplay outcomes
 * are determined by combat resolution, not this number.
 */
export function riskScore(args: {
  hostileNeighbors: number;
  distanceToCore: number;
}): number {
  // Per-neighbor weight tuned so that 3 hostile neighbors with no distance
  // already lands near 50; 6 hostile neighbors saturates closer to 90.
  const fromHostiles = Math.min(70, args.hostileNeighbors * 12);
  // Distance contributes more slowly; 5 hexes from core ≈ +15, 20 hexes ≈ +30.
  const fromDistance = Math.min(30, args.distanceToCore * 1.5);
  return Math.round(Math.min(100, fromHostiles + fromDistance));
}

/**
 * Coords on the hex ring at exactly distance `r` from `center`. r=0 returns
 * just the center; r=1 returns 6 coords; r=2 returns 12; r=N returns 6N.
 *
 * Implemented as a brute-force scan of the bounding diamond — fine because
 * `r` is typically small (≤ 12).
 */
export function ringCoords(center: AxialCoord, r: number): AxialCoord[] {
  if (r <= 0) return [{ ...center }];
  const out: AxialCoord[] = [];
  for (let dq = -r; dq <= r; dq++) {
    const drMin = Math.max(-r, -dq - r);
    const drMax = Math.min(r, -dq + r);
    for (let dr = drMin; dr <= drMax; dr++) {
      const candidate = { q: center.q + dq, r: center.r + dr };
      if (hexDistance(center, candidate) === r) out.push(candidate);
    }
  }
  return out;
}

export interface SampleFrontierArgs {
  ownedTileIds: ReadonlyArray<string>;
  isClaimed: (tileId: string) => boolean;
  isHostile: (tileId: string) => boolean;
  tilesHeld: number;
  rng: () => number;
  // Maximum rings to scan outward before giving up. Default 12 — at our
  // spacing this is more than enough for any current player.
  maxRings?: number;
}

/**
 * Pick a candidate frontier tile to claim. Algorithm:
 *
 * 1. Find the centroid of the player's owned tiles.
 * 2. Pick a target ring biased outward as `tilesHeld` grows
 *    (`minRing = 1 + floor(tilesHeld/40)`, plus a small random spread).
 * 3. With probability `hostileSpawnProbability(tilesHeld)`, prefer a coord
 *    on or near the ring with at least one hostile neighbor.
 * 4. Walk outward through rings until we find an unclaimed coord.
 *
 * Returns null if no unclaimed coord is found within `maxRings`. The caller
 * should refund the turn / surface an error in that case.
 */
export function sampleFrontierTile(
  args: SampleFrontierArgs
): FrontierSample | null {
  const center = hexCentroid(args.ownedTileIds);
  const minRing = Math.max(1, 1 + Math.floor(args.tilesHeld / 40));
  const ringSpread = 4;
  const targetRing = minRing + Math.floor(args.rng() * ringSpread);
  const wantHostile = args.rng() < hostileSpawnProbability(args.tilesHeld);
  const maxRings = args.maxRings ?? 12;

  // Build a search order: target ring first, then expand outward.
  const ringOrder: number[] = [targetRing];
  for (let r = targetRing + 1; r <= maxRings; r++) ringOrder.push(r);
  for (let r = targetRing - 1; r >= 1; r--) ringOrder.push(r);

  let bestNonHostile: FrontierSample | null = null;

  for (const r of ringOrder) {
    // Shuffle this ring's coords so we don't always pick the same direction.
    const coords = ringCoords(center, r);
    for (let i = coords.length - 1; i > 0; i--) {
      const j = Math.floor(args.rng() * (i + 1));
      [coords[i], coords[j]] = [coords[j], coords[i]];
    }

    for (const c of coords) {
      const tileId = tileIdFromAxial(c.q, c.r);
      if (args.isClaimed(tileId)) continue;

      // Count hostile neighbors at this coord.
      const ns = neighbors(c.q, c.r);
      let hostileCount = 0;
      for (const n of ns) {
        if (args.isHostile(tileIdFromAxial(n.q, n.r))) hostileCount++;
      }

      const distance = distanceToNearestOwned(c, args.ownedTileIds);
      const sample: FrontierSample = {
        tile: c,
        tileId,
        distanceToCore: Number.isFinite(distance) ? distance : 0,
        hostileNeighbors: hostileCount,
        riskScore: riskScore({
          hostileNeighbors: hostileCount,
          distanceToCore: Number.isFinite(distance) ? distance : 0,
        }),
      };

      if (wantHostile && hostileCount > 0) {
        return sample;
      }
      if (!wantHostile) {
        return sample;
      }
      // We wanted hostile but this is non-hostile — remember it as a
      // fallback so we don't fail outright if the world is friendly here.
      if (bestNonHostile === null) bestNonHostile = sample;
    }
  }

  return bestNonHostile;
}
