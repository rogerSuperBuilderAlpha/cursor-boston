/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { SpellDefinition } from "../../../types";
import { buildSpellTiers } from "../_tier-builder";

export const BLUE_DEFENSE_SPELLS: SpellDefinition[] = buildSpellTiers({
  caste: "blue",
  type: "defense",
  baseStrength: 30,
  tiers: [
    {
      id: "blue-defense-mirror-veil",
      name: "Mirror Veil",
      description: "A sheet of conjured glass; some of the blow returns to the sender.",
    },
    {
      id: "blue-defense-deepwater-ward-t2",
      name: "Deepwater Ward",
      description: "The tile rises in fathoms. Climbers drown without water.",
    },
    {
      id: "blue-defense-storm-circle-t3",
      name: "Storm Circle",
      description: "Lightning circles the perimeter. None pass without paying.",
    },
    {
      id: "blue-defense-tidewall-t4",
      name: "Tidewall",
      description: "The sea is borrowed and stood vertical. It returns when the wave breaks.",
    },
    {
      id: "blue-defense-stillborn-storm-t5",
      name: "Stillborn Storm",
      description: "A glass shard from a storm that never finished. Attackers freeze mid-stride.",
    },
  ],
});
