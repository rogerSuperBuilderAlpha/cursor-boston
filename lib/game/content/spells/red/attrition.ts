/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { SpellDefinition } from "../../../types";

export const RED_ATTRITION_SPELLS: SpellDefinition[] = [
  {
    id: "red-attrition-emberswarm",
    caste: "red",
    type: "attrition",
    name: "Emberswarm",
    description:
      "A drift of orange motes settles on the tile and never quite goes out. The garrison spends the night putting itself out.",
    baseStrength: 30,
    tier: 1,
    minTilesRequired: 0,
    turnCost: 5,
  },
];
