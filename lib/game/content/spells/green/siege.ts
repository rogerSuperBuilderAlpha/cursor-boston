/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { SpellDefinition } from "../../../types";

export const GREEN_SIEGE_SPELLS: SpellDefinition[] = [
  {
    id: "green-siege-rootbreak",
    caste: "green",
    type: "siege",
    name: "Rootbreak",
    description:
      "Roots from a tree the defenders cleared a generation ago remember where the wall was put. They come up to take a look.",
    baseStrength: 0.05,
    tier: 1,
    minTilesRequired: 0,
    turnCost: 5,
  },
];
