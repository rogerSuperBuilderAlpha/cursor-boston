/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { SpellDefinition } from "../../../types";

export const BLACK_SIEGE_SPELLS: SpellDefinition[] = [
  {
    id: "black-siege-rotgnaw",
    caste: "black",
    type: "siege",
    name: "Rotgnaw",
    description:
      "The walls were always going to age. Black just gives them a reason to do it tonight.",
    baseStrength: 0.05,
    tier: 1,
    minTilesRequired: 0,
    turnCost: 5,
  },
];
