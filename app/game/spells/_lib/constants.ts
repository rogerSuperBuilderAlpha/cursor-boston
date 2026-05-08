/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { SpellType } from "@/lib/game/types";

// 5 tiers, in display order. Min-tiles & turn-cost come from each spell's own
// fields — this list is only used to render the row scaffolding so locked
// tiers still appear with their requirement.
export const TIERS: Array<{ tier: 1 | 2 | 3 | 4 | 5; minTiles: number }> = [
  { tier: 1, minTiles: 0 },
  { tier: 2, minTiles: 500 },
  { tier: 3, minTiles: 1500 },
  { tier: 4, minTiles: 5000 },
  { tier: 5, minTiles: 20000 },
];

// Column order in the tier × type table. Defense first because that's the
// only column with bulk-arm UX, and reading "what should I cast right now"
// usually starts with "what's keeping me alive".
export const TYPE_COLUMNS: SpellType[] = ["defense", "offense", "production"];

export const TYPE_LABEL: Record<SpellType, string> = {
  defense: "Defense",
  offense: "Offense",
  production: "Production",
};

export const RARITY_TEXT: Record<string, string> = {
  common: "text-neutral-500 dark:text-neutral-400",
  rare: "text-blue-600 dark:text-blue-400",
  epic: "text-purple-600 dark:text-purple-400",
  legendary: "text-amber-600 dark:text-amber-400",
};
