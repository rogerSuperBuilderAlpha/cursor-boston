/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { SpellDefinition } from "../../../types";

// Siege-spell baseStrength is the *fraction* subtracted from the target
// tile's standing-defense floor at midpoint dice (1.0). Realized magnitude
// = baseStrength × magicMultiplier × casteSpellTypeBonus × dice. Caps at
// SIEGE_DEBUFF_MAX_MAGNITUDE (0.30) per call. White's caste bonus is 0.85
// — order is good at holding lines, less suited to breaking them.
export const WHITE_SIEGE_SPELLS: SpellDefinition[] = [
  {
    id: "white-siege-judgement-light",
    caste: "white",
    type: "siege",
    name: "Judgement Light",
    description:
      "A blade of sunlight rests on a section of wall and never moves. Stone gives up first.",
    baseStrength: 0.05,
    tier: 1,
    minTilesRequired: 0,
    turnCost: 5,
  },
];
