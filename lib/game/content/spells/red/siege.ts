/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { SpellDefinition } from "../../../types";

// Red's siege bonus is 1.30 — fire is what breaks walls, and Red owns it.
export const RED_SIEGE_SPELLS: SpellDefinition[] = [
  {
    id: "red-siege-firebreath",
    caste: "red",
    type: "siege",
    name: "Firebreath",
    description:
      "A long, low column of flame plays across the rampart until the mortar gives. The defenders will rebuild — but later.",
    baseStrength: 0.05,
    tier: 1,
    minTilesRequired: 0,
    turnCost: 5,
  },
];
