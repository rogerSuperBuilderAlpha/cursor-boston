/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Distribute `totalCycles` build-cycles across `tileIds` (in threat-ranked
 * order, top-threat first), favoring earlier entries. Linear weights:
 * rank 0 gets weight N, rank N-1 gets weight 1, total = N(N+1)/2. The top
 * tile receives roughly N times the bottom tile's share, with remainder
 * cycles falling to the most-threatened tiles first.
 *
 * Returns plan entries with `cycles > 0` only.
 */
export function buildThreatPriorityPlan(
  threatRankedTileIds: ReadonlyArray<string>,
  totalCycles: number
): Array<{ tileId: string; cycles: number }> {
  const N = threatRankedTileIds.length;
  if (N === 0 || totalCycles <= 0) return [];
  const weights = threatRankedTileIds.map((_, i) => N - i);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const cycles = threatRankedTileIds.map((_, i) =>
    Math.floor((totalCycles * weights[i]) / totalWeight)
  );
  let assigned = cycles.reduce((a, b) => a + b, 0);
  // Top-down remainder allocation so the most-threatened tile picks up the
  // leftover when totalCycles doesn't divide evenly.
  let cursor = 0;
  while (assigned < totalCycles) {
    cycles[cursor % N]++;
    assigned++;
    cursor++;
  }
  return threatRankedTileIds
    .map((tileId, idx) => ({ tileId, cycles: cycles[idx] }))
    .filter((p) => p.cycles > 0);
}
