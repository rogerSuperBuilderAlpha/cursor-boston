/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { SpellDefinition } from "../../../types";

export const BLUE_ATTRITION_SPELLS: SpellDefinition[] = [
  {
    id: "blue-attrition-cold-current",
    caste: "blue",
    type: "attrition",
    name: "Cold Current",
    description:
      "An undertow finds the soldiers' boots. Drilled men keep their footing; the rest go where the river decides.",
    baseStrength: 30,
    tier: 1,
    minTilesRequired: 0,
    turnCost: 5,
  },
];
