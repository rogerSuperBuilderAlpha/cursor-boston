/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { SpellDefinition } from "../../../types";

// White's spy is a single-target lens — pinpoint, never misses, never spreads.
// "Long defense" lore: White watches its own walls, not its neighbors'.
export const WHITE_INTEL_SPELLS: SpellDefinition[] = [
  {
    id: "white-intel-watchers-vigil-t2",
    caste: "white",
    type: "intel",
    name: "Watcher's Vigil",
    baseStrength: 0,
    description:
      "A single icon-lit watch is set on the target tile. Reveals exact unit count, land type, and the tier of any armed defense spell. No collateral information.",
    tier: 2,
    minTilesRequired: 1500,
    turnCost: 8,
    intelScope: "tile",
  },
];
