/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { SpellDefinition } from "../../../types";
import { buildSpellTiers } from "../_tier-builder";

export const BLUE_OFFENSE_SPELLS: SpellDefinition[] = buildSpellTiers({
  caste: "blue",
  type: "offense",
  baseStrength: 30,
  tiers: [
    {
      id: "blue-offense-tempest",
      name: "Tempest",
      description: "Lightning-laced gale. Modest offense; blue's offensive option.",
    },
    {
      id: "blue-offense-riptide-t2",
      name: "Riptide",
      description: "The current pulls defenders off their feet, then off the tile.",
    },
    {
      id: "blue-offense-hailspear-t3",
      name: "Hailspear",
      description: "Hail the size of a fist, falling in straight lines. Cover does not help.",
    },
    {
      id: "blue-offense-typhoon-t4",
      name: "Typhoon",
      description: "A wall of rain wider than the battlefield. The defenders never see the charge.",
    },
    {
      id: "blue-offense-quiet-king-t5",
      name: "Whisper of the Quiet King",
      description: "He says nothing. The defenders' weapons rust through in a single afternoon.",
    },
  ],
});
