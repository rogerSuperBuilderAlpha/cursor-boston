/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { SpellDefinition } from "../../../types";

// Disarm-spell baseStrength is the *fraction* of the defender's armed
// defense spell that gets nullified at midpoint dice (1.0). Realized
// magnitude clamped to [0, 1]. White's caste bonus is 1.30 — purification
// is a White specialty.
export const WHITE_DISARM_SPELLS: SpellDefinition[] = [
  {
    id: "white-disarm-purification",
    caste: "white",
    type: "disarm",
    name: "Purification",
    description:
      "A clean light passes through the tile. Wards drawn in haste come undone first; the careful ones, second.",
    baseStrength: 0.4,
    tier: 1,
    minTilesRequired: 0,
    turnCost: 5,
  },
];
