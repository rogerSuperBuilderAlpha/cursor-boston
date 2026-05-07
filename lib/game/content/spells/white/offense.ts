/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { SpellDefinition } from "../../../types";
import { buildSpellTiers } from "../_tier-builder";

export const WHITE_OFFENSE_SPELLS: SpellDefinition[] = buildSpellTiers({
  caste: "white",
  type: "offense",
  baseStrength: 25,
  tiers: [
    {
      id: "white-offense-smite",
      name: "Smite",
      description: "A focused beam of righteous force. Modest but reliable.",
    },
    {
      id: "white-offense-radiant-lance-t2",
      name: "Radiant Lance",
      description: "A spear of noon-light. Pierces shield and shadow alike.",
    },
    {
      id: "white-offense-judgment-t3",
      name: "Judgment",
      description: "The earth tilts. Whoever stood guilty cannot stand at all.",
    },
    {
      id: "white-offense-host-of-saints-t4",
      name: "Host of Saints",
      description: "A column of armoured visions joins the charge. The enemy hears bells.",
    },
    {
      id: "white-offense-iron-circlet-t5",
      name: "Iron Circlet",
      description: "The First General's crown rolls onto the field. The battle is decided.",
    },
  ],
});
