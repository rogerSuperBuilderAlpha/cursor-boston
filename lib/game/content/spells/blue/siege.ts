/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { SpellDefinition } from "../../../types";

export const BLUE_SIEGE_SPELLS: SpellDefinition[] = [
  {
    id: "blue-siege-tideworks",
    caste: "blue",
    type: "siege",
    name: "Tideworks",
    description:
      "Salt water finds the cracks in the foundation and patiently widens them. Stones never invited it; stones can't ask it to leave.",
    baseStrength: 0.05,
    tier: 1,
    minTilesRequired: 0,
    turnCost: 5,
  },
];
