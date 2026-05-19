/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { SpellDefinition } from "../../../types";

// Black's attrition bonus is 1.30 — pestilence is what Black does, and it
// shows in the realized magnitude.
export const BLACK_ATTRITION_SPELLS: SpellDefinition[] = [
  {
    id: "black-attrition-bone-fever",
    caste: "black",
    type: "attrition",
    name: "Bone Fever",
    description:
      "A dry sickness moves through the garrison faster than orders can. By morning, the surgeon is the busiest officer on the wall.",
    baseStrength: 30,
    tier: 1,
    minTilesRequired: 0,
    turnCost: 5,
  },
];
