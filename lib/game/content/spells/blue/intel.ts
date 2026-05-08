/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { SpellDefinition } from "../../../types";

// Blue's spy spreads through tide and rumor — it sees a wider ring but the
// tide takes its time. Patient.
export const BLUE_INTEL_SPELLS: SpellDefinition[] = [
  {
    id: "blue-intel-tide-of-whispers-t2",
    caste: "blue",
    type: "intel",
    name: "Tide of Whispers",
    baseStrength: 0,
    description:
      "Whispers carried on a slow tide. Reveals the target tile and all six neighbors — units, owners, land types. No defense-spell information.",
    tier: 2,
    minTilesRequired: 1500,
    turnCost: 8,
    intelScope: "ring",
  },
];
