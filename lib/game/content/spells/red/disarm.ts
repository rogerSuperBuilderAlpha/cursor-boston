/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { SpellDefinition } from "../../../types";

export const RED_DISARM_SPELLS: SpellDefinition[] = [
  {
    id: "red-disarm-cinderbreak",
    caste: "red",
    type: "disarm",
    name: "Cinderbreak",
    description:
      "A blacksmith's hammer, swung in a small forge in the caster's mind, lands on the defender's brightest enchantment.",
    baseStrength: 0.4,
    tier: 1,
    minTilesRequired: 0,
    turnCost: 5,
  },
];
