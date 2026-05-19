/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { SpellDefinition } from "../../../types";
import { buildSpellTiers } from "../_tier-builder";

export const GREEN_OFFENSE_SPELLS: SpellDefinition[] = buildSpellTiers({
  caste: "green",
  type: "offense",
  baseStrength: 35,
  tiers: [
    {
      id: "green-offense-stampede",
      name: "Stampede",
      description: "Beasts of the wood come unbidden, charging in green's name.",
    },
    {
      id: "green-offense-briarstrike-t2",
      name: "Briarstrike",
      description: "A volley of thrown thorns; some come back to the thrower.",
    },
    {
      id: "green-offense-vinerush-t3",
      name: "Vinerush",
      description: "Vines arrive ahead of the line and pull defenders down at the ankle.",
    },
    {
      id: "green-offense-pollenstorm-t4",
      name: "Pollen Storm",
      description: "Yellow drifts thick as snow. Defenders cough; defenders sleep.",
    },
    {
      id: "green-offense-walking-grove-t5",
      name: "The Walking Grove",
      description: "An entire wood folds itself onto the tile. The defenders are footnotes.",
    },
  ],
});
