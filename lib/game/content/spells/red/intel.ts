/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { SpellDefinition } from "../../../types";

// Red's spy is a forge-scout: it reads a tile for its weakest face. The
// reveal is narrow, but the caster gets a small offense bonus on follow-up.
export const RED_INTEL_SPELLS: SpellDefinition[] = [
  {
    id: "red-intel-forge-sight-t2",
    caste: "red",
    type: "intel",
    name: "Forge Sight",
    baseStrength: 0,
    description:
      "A red lens reads the target's seam. Reveals the unit type the attacker should lead with, and tags the tile for +10% offense against it for 5 turns.",
    tier: 2,
    minTilesRequired: 1500,
    turnCost: 8,
    intelScope: "weak-face",
  },
];
