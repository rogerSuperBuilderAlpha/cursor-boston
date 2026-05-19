/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { SpellDefinition } from "../../../types";
import { buildSpellTiers } from "../_tier-builder";

export const GREEN_DEFENSE_SPELLS: SpellDefinition[] = buildSpellTiers({
  caste: "green",
  type: "defense",
  baseStrength: 40,
  tiers: [
    {
      id: "green-defense-thornwall",
      name: "Thornwall",
      description: "A living hedge of barbed thorns rises overnight.",
    },
    {
      id: "green-defense-rootbind-t2",
      name: "Rootbind",
      description: "The earth catches the attackers' boots and keeps them.",
    },
    {
      id: "green-defense-greenwarden-t3",
      name: "Greenwarden's Vigil",
      description: "Old wood walks the perimeter. It has not slept in many years.",
    },
    {
      id: "green-defense-canopy-t4",
      name: "Canopy",
      description: "Trees grow tall and lock branches over the tile. Air units lose their lanes.",
    },
    {
      id: "green-defense-first-grove-t5",
      name: "The First Grove",
      description: "A circle of trees no axe has ever touched. Attackers find themselves outside, again.",
    },
  ],
});
