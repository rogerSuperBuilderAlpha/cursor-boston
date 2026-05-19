/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { SpellDefinition } from "../../../types";
import { buildSpellTiers } from "../_tier-builder";

export const BLACK_DEFENSE_SPELLS: SpellDefinition[] = buildSpellTiers({
  caste: "black",
  type: "defense",
  baseStrength: 25,
  tiers: [
    {
      id: "black-defense-shadow-pact",
      name: "Shadow Pact",
      description: "Whispers turn aside the attacker's first wave. Weakest defensive ward.",
    },
    {
      id: "black-defense-bone-shroud-t2",
      name: "Bone Shroud",
      description: "Old bones rise like a fence. Attackers must climb their own dead.",
    },
    {
      id: "black-defense-grave-vigil-t3",
      name: "Grave Vigil",
      description: "The recently fallen stand again, silent, hand-in-hand around the tile.",
    },
    {
      id: "black-defense-ossuary-t4",
      name: "Ossuary Wall",
      description: "Every grave in the realm contributes a single rib. The wall is tall.",
    },
    {
      id: "black-defense-final-rite-t5",
      name: "The Final Rite",
      description: "A name is read aloud. The attacker's vanguard forgets why they came.",
    },
  ],
});
