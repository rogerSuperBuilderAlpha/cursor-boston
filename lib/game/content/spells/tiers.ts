/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { SpellTier } from "../../types";

// Territory thresholds (tiles held) at which each spell tier unlocks.
// Tier 1 is always available; tier 5 is end-game.
export const TIER_MIN_TILES: Record<SpellTier, number> = {
  1: 0,
  2: 500,
  3: 1500,
  4: 5000,
  5: 20000,
};

// Turn cost per tier. Higher-tier spells consume more of the weekly turn pool.
export const TIER_TURN_COST: Record<SpellTier, number> = {
  1: 5,
  2: 8,
  3: 12,
  4: 18,
  5: 25,
};

// Strength multiplier vs the tier-1 baseStrength for the same caste/type.
export const TIER_STRENGTH_MULTIPLIER: Record<SpellTier, number> = {
  1: 1,
  2: 1.8,
  3: 3.3,
  4: 6,
  5: 11,
};

export function tierOfSpellId(spellId: string): SpellTier {
  const m = /-t([1-5])$/.exec(spellId);
  if (!m) return 1;
  return Number(m[1]) as SpellTier;
}
