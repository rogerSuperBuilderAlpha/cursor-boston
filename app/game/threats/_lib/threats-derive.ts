/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { computeSupplyMultiplier } from "@/lib/game/combat";
import type { Caste, LandType, MapTile } from "@/lib/game/types";
import type { OwnerSummary } from "@/app/game/_lib/dashboard-types";

/**
 * Six axial neighbor offsets for a pointy-top hex grid. Identical to the
 * one in `dashboard-helpers.ts` — kept local so this lib is server/client-
 * agnostic and pure.
 */
const HEX_NEIGHBORS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, -1],
  [-1, 1],
] as const;

export interface ThreatEntry {
  /** The enemy tile that borders one or more of the player's tiles. */
  enemyTile: MapTile;
  /** Owner identity (caste, name, shielded). May be null if not in worldOwners. */
  enemyOwner: OwnerSummary | null;
  /** All player-owned tiles that border this enemy tile. */
  candidateSources: MapTile[];
  /** Strongest of the candidate sources, pre-picked for one-click attack. */
  bestSource: MapTile;
  /** Best source's effective strength (units × supply multiplier). */
  bestSourceStrength: number;
  /** Best source's supply multiplier (for display). */
  bestSourceSupply: number;
  /** (best source units) / max(1, enemy tile units). Sort key. */
  myAdvantage: number;
}

function totalUnits(tile: MapTile): number {
  // BASE+SUPER: displayed totals always sum the intrinsic garrison with
  // recruited reinforcements. Threat-derivation, advantage scoring, and
  // every consumer downstream uses this composite count.
  const baseUnits = tile.baseUnits ?? { ground: 0, siege: 0, air: 0 };
  return (
    tile.units.ground +
    tile.units.siege +
    tile.units.air +
    baseUnits.ground +
    baseUnits.siege +
    baseUnits.air
  );
}

/**
 * Walk every owned tile, find adjacent enemy tiles, and group by the enemy
 * tile (each enemy tile becomes one ThreatEntry). For each group we compute
 * the best source (highest units × supply mult), and a sortable advantage
 * score so the page can show the easiest matchup first.
 *
 * Pure: no React, no fetches, no globals. Trivial to unit-test.
 */
export function deriveThreatEntries(args: {
  myUserId: string;
  myCaste: Caste | null;
  myTiles: ReadonlyArray<MapTile>;
  worldTiles: ReadonlyArray<MapTile>;
  worldOwners: ReadonlyMap<string, OwnerSummary>;
}): ThreatEntry[] {
  const { myUserId, myCaste, myTiles, worldTiles, worldOwners } = args;
  if (worldTiles.length === 0 || myTiles.length === 0) return [];

  // Index my tiles + world tiles by axial coordinate so we can scan
  // 6 neighbors per tile in O(1).
  const myByCoord = new Map<string, MapTile>();
  for (const t of myTiles) myByCoord.set(`${t.q},${t.r}`, t);
  const worldByCoord = new Map<string, MapTile>();
  for (const t of worldTiles) worldByCoord.set(`${t.q},${t.r}`, t);

  // For each owned tile, build the set of friendly-neighbor land types
  // once. We need this to compute supply multiplier per source candidate.
  const friendlyNeighborsByTile = new Map<
    string,
    Array<{ tileId: string; landType: LandType }>
  >();
  for (const mine of myTiles) {
    const neighbors: Array<{ tileId: string; landType: LandType }> = [];
    for (const [dq, dr] of HEX_NEIGHBORS) {
      const key = `${mine.q + dq},${mine.r + dr}`;
      const f = myByCoord.get(key);
      if (!f) continue;
      // Only assigned tiles contribute to supply.
      if (f.type === "unassigned" || f.type === "unrevealed") continue;
      neighbors.push({ tileId: f.tileId, landType: f.type });
    }
    friendlyNeighborsByTile.set(mine.tileId, neighbors);
  }

  // Collect every enemy tile that borders at least one of my tiles, deduped
  // by tileId. For each enemy tile, accumulate the list of my candidate
  // sources (= my tiles that touch it).
  type Bucket = {
    enemyTile: MapTile;
    sources: MapTile[];
  };
  const buckets = new Map<string, Bucket>();
  for (const mine of myTiles) {
    for (const [dq, dr] of HEX_NEIGHBORS) {
      const key = `${mine.q + dq},${mine.r + dr}`;
      const enemy = worldByCoord.get(key);
      if (!enemy) continue;
      if (!enemy.ownerId || enemy.ownerId === myUserId) continue;
      let bucket = buckets.get(enemy.tileId);
      if (!bucket) {
        bucket = { enemyTile: enemy, sources: [] };
        buckets.set(enemy.tileId, bucket);
      }
      bucket.sources.push(mine);
    }
  }

  const entries: ThreatEntry[] = [];
  for (const bucket of buckets.values()) {
    if (bucket.sources.length === 0) continue;
    let bestSource = bucket.sources[0]!;
    let bestStrength = -1;
    let bestSupply = 1;
    for (const src of bucket.sources) {
      const supply = myCaste
        ? computeSupplyMultiplier(
            myCaste,
            friendlyNeighborsByTile.get(src.tileId) ?? []
          )
        : 1;
      const strength = totalUnits(src) * supply;
      if (
        strength > bestStrength ||
        (strength === bestStrength && src.tileId < bestSource.tileId)
      ) {
        bestStrength = strength;
        bestSupply = supply;
        bestSource = src;
      }
    }
    const enemyUnits = Math.max(1, totalUnits(bucket.enemyTile));
    const myAdvantage = bestStrength / enemyUnits;
    entries.push({
      enemyTile: bucket.enemyTile,
      enemyOwner: worldOwners.get(bucket.enemyTile.ownerId ?? "") ?? null,
      candidateSources: bucket.sources,
      bestSource,
      bestSourceStrength: bestStrength,
      bestSourceSupply: bestSupply,
      myAdvantage,
    });
  }

  // Default sort: easiest matchup (highest myAdvantage) first.
  entries.sort((a, b) => b.myAdvantage - a.myAdvantage);
  return entries;
}
