/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { SpellDefinition } from "../../../types";

// Attrition-spell baseStrength is the *count* of defender units killed at
// midpoint dice (1.0). Realized magnitude = baseStrength × magicMultiplier
// × casteSpellTypeBonus × dice; distributed across unit types proportional
// to current composition. White's caste bonus is 0.85 — Order doesn't
// poison wells.
export const WHITE_ATTRITION_SPELLS: SpellDefinition[] = [
  {
    id: "white-attrition-decree-of-decimation",
    caste: "white",
    type: "attrition",
    name: "Decree of Decimation",
    description:
      "A formal pronouncement, read aloud at the gates. By dawn, every tenth defender has laid down arms — or worse.",
    baseStrength: 30,
    tier: 1,
    minTilesRequired: 0,
    turnCost: 5,
  },
];
