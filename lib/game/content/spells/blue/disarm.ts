/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { SpellDefinition } from "../../../types";

export const BLUE_DISARM_SPELLS: SpellDefinition[] = [
  {
    id: "blue-disarm-mistwhisper",
    caste: "blue",
    type: "disarm",
    name: "Mistwhisper",
    description:
      "Fog rolls across the tile carrying a single instruction in a voice the wards already trust. Most listen.",
    baseStrength: 0.4,
    tier: 1,
    minTilesRequired: 0,
    turnCost: 5,
  },
];
