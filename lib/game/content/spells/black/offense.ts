/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { SpellDefinition } from "../../../types";
import { buildSpellTiers } from "../_tier-builder";

export const BLACK_OFFENSE_SPELLS: SpellDefinition[] = buildSpellTiers({
  caste: "black",
  type: "offense",
  baseStrength: 70,
  tiers: [
    {
      id: "black-offense-blood-tide",
      name: "Blood Tide",
      description: "A rolling crimson surge that breaks lines and resolve.",
    },
    {
      id: "black-offense-marrow-rot-t2",
      name: "Marrow Rot",
      description: "Defenders' bones soften over the span of a single charge.",
    },
    {
      id: "black-offense-corpsewake-t3",
      name: "Corpsewake",
      description: "The attacker's fallen rise mid-fall and swing on the way down.",
    },
    {
      id: "black-offense-soulfray-t4",
      name: "Soul Fray",
      description: "A scream too low to hear. Defenders forget who their friends are.",
    },
    {
      id: "black-offense-empty-throne-t5",
      name: "The Empty Throne",
      description: "A chair appears at the centre of the tile. No one survives looking at it.",
    },
  ],
});
