/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { SpellDefinition } from "../../../types";
import { buildSpellTiers } from "../_tier-builder";

export const RED_OFFENSE_SPELLS: SpellDefinition[] = buildSpellTiers({
  caste: "red",
  type: "offense",
  baseStrength: 75,
  tiers: [
    {
      id: "red-offense-inferno",
      name: "Inferno",
      description: "A column of fire taller than the tile it lands on. Red's signature.",
    },
    {
      id: "red-offense-magma-spear-t2",
      name: "Magma Spear",
      description: "A single thrown spear, white-hot. The line breaks where it lands.",
    },
    {
      id: "red-offense-firestorm-t3",
      name: "Firestorm",
      description: "Wind feeds wind. The defender's banners burn first; their captains next.",
    },
    {
      id: "red-offense-volcanic-ruin-t4",
      name: "Volcanic Ruin",
      description: "The tile remembers being a mountain. The mountain remembers itself.",
    },
    {
      id: "red-offense-sunshatter-t5",
      name: "Sunshatter",
      description: "The sun is dragged down for a single beat. Defenders see nothing else, ever.",
    },
  ],
});
