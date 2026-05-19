/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { SpellDefinition } from "../../../types";

export const BLACK_DISARM_SPELLS: SpellDefinition[] = [
  {
    id: "black-disarm-grave-bargain",
    caste: "black",
    type: "disarm",
    name: "Grave Bargain",
    description:
      "Black offers each ward a deal it cannot refuse — and a price it didn't know it had been paying.",
    baseStrength: 0.4,
    tier: 1,
    minTilesRequired: 0,
    turnCost: 5,
  },
];
