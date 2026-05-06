/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { Caste, CasteProfile } from "../types";

// MTG-inspired asymmetric balance. Sum of unitTypeBonuses ≈ 3.0 and sum of
// spellTypeBonuses ≈ 3.15 across each row, so totals stay close while flavor
// differs. Tile-capacity multiplier is the only non-combat lever.
export const CASTE_PROFILES: Record<Caste, CasteProfile> = {
  white: {
    caste: "white",
    tileCapacityMultiplier: 1.0,
    unitTypeBonuses: { ground: 1.2, siege: 0.9, air: 1.0 },
    spellTypeBonuses: { defense: 1.3, offense: 0.85, production: 1.0 },
  },
  blue: {
    caste: "blue",
    tileCapacityMultiplier: 0.9,
    unitTypeBonuses: { ground: 0.95, siege: 0.95, air: 1.2 },
    spellTypeBonuses: { defense: 0.95, offense: 0.95, production: 1.3 },
  },
  black: {
    caste: "black",
    tileCapacityMultiplier: 1.0,
    unitTypeBonuses: { ground: 1.05, siege: 1.05, air: 1.05 },
    spellTypeBonuses: { defense: 0.9, offense: 1.3, production: 0.9 },
  },
  red: {
    caste: "red",
    tileCapacityMultiplier: 1.0,
    unitTypeBonuses: { ground: 1.0, siege: 1.2, air: 1.0 },
    spellTypeBonuses: { defense: 0.85, offense: 1.3, production: 0.95 },
  },
  green: {
    caste: "green",
    tileCapacityMultiplier: 1.2,
    unitTypeBonuses: { ground: 1.2, siege: 0.95, air: 0.95 },
    spellTypeBonuses: { defense: 1.0, offense: 0.95, production: 1.1 },
  },
};

export function getCasteProfile(caste: Caste): CasteProfile {
  return CASTE_PROFILES[caste];
}
