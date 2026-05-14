/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

// Military baseline (kept as the legacy constant for any header copy or
// fallback math that wants "the number"). The actual per-cycle yield depends
// on the tile's land type — see UNITS_PER_CYCLE_BY_LAND / unitsPerCycleForLand.
export const UNITS_PER_CYCLE = 10;
export const TURNS_PER_CYCLE = 5;

// Per-land-type recruit yield (matches the server's
// BUILD_UNITS_PER_TURN_BY_LAND in lib/game/data-server.ts). Military trains
// 10 units per cycle, food and magic train 5 — magic and food tiles can
// recruit but at half pace, since training soldiers is what military tiles
// are *for*.
import type { LandType } from "@/lib/game/types";
export const UNITS_PER_CYCLE_BY_LAND: Record<LandType, number> = {
  unrevealed: 0,
  unassigned: 0,
  military: 10,
  food: 5,
  magic: 5,
};
export function unitsPerCycleForLand(landType: LandType): number {
  return UNITS_PER_CYCLE_BY_LAND[landType] ?? 0;
}
// Conservative lower bound on units-per-cycle across recruitable types.
// Used by the cap-math UI so we never *under-predict* how many cycles fit
// (worst-case the user fires fewer cycles than predicted, never more).
export const MIN_UNITS_PER_CYCLE_RECRUITABLE = 5;

export const RARITY_TEXT: Record<string, string> = {
  common: "text-neutral-500 dark:text-neutral-400",
  rare: "text-blue-600 dark:text-blue-400",
  epic: "text-purple-600 dark:text-purple-400",
  legendary: "text-amber-600 dark:text-amber-400",
};
