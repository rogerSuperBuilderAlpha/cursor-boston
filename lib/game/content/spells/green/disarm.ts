/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { SpellDefinition } from "../../../types";

export const GREEN_DISARM_SPELLS: SpellDefinition[] = [
  {
    id: "green-disarm-grovebind",
    caste: "green",
    type: "disarm",
    name: "Grovebind",
    description:
      "Grove-magic notices the defender's wards are not from the grove. It politely shows them to the door.",
    baseStrength: 0.4,
    tier: 1,
    minTilesRequired: 0,
    turnCost: 5,
  },
];
