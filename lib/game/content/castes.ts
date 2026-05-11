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
    lore:
      "White moves slowly and remembers everything. Their banners are old, their drills older, and their pikemen will hold a road for as many days as the road needs holding. Sanctuaries glow on the hilltops at dusk; the priests do not explain how.",
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
    lore:
      "Blue plays the long economy. Their captains are astronomers, their air corps moves on currents no scout can chart, and their production magic refills granaries through a winter no one can quite remember surviving. They win wars that began three seasons ago.",
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
    lore:
      "Black armies are quiet at the edges and loud in the middle. Their reavers are bone-armored and tireless; their blood-tide spells fall on a battlefield like a price already settled. They take towns by walking through them. They keep no prisoners they can spare.",
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
    lore:
      "Red wars are decided in three days or three minutes. Their siege foundries turn out trebuchets that smell of pitch and bone-glue; their pyre-mortars throw heat that cracks stone. Their defenses are thin because their generals do not intend to need them.",
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
    lore:
      "Green takes ground and keeps it. Their wardens build deeper than other castes, and their tiles hold more soldiers per acre because the soldiers eat from the land they stand on. Their air is weak; they don't intend to leave the ground.",
  },
};

export function getCasteProfile(caste: Caste): CasteProfile {
  return CASTE_PROFILES[caste];
}
