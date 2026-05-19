/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { SpellDefinition } from "../../../types";

export const GREEN_ATTRITION_SPELLS: SpellDefinition[] = [
  {
    id: "green-attrition-thornbloom",
    caste: "green",
    type: "attrition",
    name: "Thornbloom",
    description:
      "Briars push up through the parade ground overnight. Soldiers know to step over them; horses don't.",
    baseStrength: 30,
    tier: 1,
    minTilesRequired: 0,
    turnCost: 5,
  },
];
