/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { Caste, CasteProfile } from "../types";

// MTG-inspired asymmetric balance. Sum of unitTypeBonuses ≈ 3.0 and sum of
// spellTypeBonuses ≈ 3.15 across each row, so totals stay close while flavor
// differs. Tile-capacity multiplier is the only non-combat lever.
//
// supplyMultiplier scales each caste's payoff for clustering tiles. Green/White
// lean concentrated (held-line / long-defense lore); Blue/Black are happy
// spread out (patient tide / cost-paid-forward). Isolated tiles always get
// the -15% floor regardless of caste.
// May 2026 (sim feature): three new SpellType bonuses per caste —
// siege / disarm / attrition. Each row sums to ~3.0 across the new types
// to mirror the ~3.15 sum on offense/defense/production/intel. Per-caste
// flavor:
//   white  — purifier; light disarms wards, not built for siege/attrition
//   blue   — sly raider; even attrition; modest disarm; little stomach for siege
//   black  — pestilence; attrition is its bread and butter
//   red    — fire breaks walls; siege is its specialty
//   green  — patient growth; disarm via grove-magic; little raid potential
export const CASTE_PROFILES: Record<Caste, CasteProfile> = {
  white: {
    caste: "white",
    tileCapacityMultiplier: 1.0,
    unitTypeBonuses: { ground: 1.2, siege: 0.9, air: 1.0 },
    spellTypeBonuses: {
      defense: 1.3,
      offense: 0.85,
      production: 1.0,
      intel: 1.0,
      siege: 0.85,
      disarm: 1.30,
      attrition: 0.85,
    },
    supplyMultiplier: 1.25,
  },
  blue: {
    caste: "blue",
    tileCapacityMultiplier: 0.9,
    unitTypeBonuses: { ground: 0.95, siege: 0.95, air: 1.2 },
    spellTypeBonuses: {
      defense: 0.95,
      offense: 0.95,
      production: 1.3,
      intel: 1.2,
      siege: 0.85,
      disarm: 1.10,
      attrition: 1.05,
    },
    supplyMultiplier: 0.75,
  },
  black: {
    caste: "black",
    tileCapacityMultiplier: 1.0,
    unitTypeBonuses: { ground: 1.05, siege: 1.05, air: 1.05 },
    spellTypeBonuses: {
      defense: 0.9,
      offense: 1.3,
      production: 0.9,
      intel: 1.0,
      siege: 1.00,
      disarm: 0.95,
      attrition: 1.30,
    },
    supplyMultiplier: 0.5,
  },
  red: {
    caste: "red",
    tileCapacityMultiplier: 1.0,
    unitTypeBonuses: { ground: 1.0, siege: 1.2, air: 1.0 },
    spellTypeBonuses: {
      defense: 0.85,
      offense: 1.3,
      production: 0.95,
      intel: 0.9,
      siege: 1.30,
      disarm: 0.85,
      attrition: 1.00,
    },
    supplyMultiplier: 1.0,
  },
  green: {
    caste: "green",
    tileCapacityMultiplier: 1.2,
    unitTypeBonuses: { ground: 1.2, siege: 0.95, air: 0.95 },
    spellTypeBonuses: {
      defense: 1.0,
      offense: 0.95,
      production: 1.1,
      intel: 1.3,
      siege: 1.00,
      disarm: 1.10,
      attrition: 0.85,
    },
    supplyMultiplier: 1.5,
  },
};

export function getCasteProfile(caste: Caste): CasteProfile {
  return CASTE_PROFILES[caste];
}
