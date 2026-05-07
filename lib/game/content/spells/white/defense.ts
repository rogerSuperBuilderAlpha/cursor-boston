/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { SpellDefinition } from "../../../types";
import { buildSpellTiers } from "../_tier-builder";

export const WHITE_DEFENSE_SPELLS: SpellDefinition[] = buildSpellTiers({
  caste: "white",
  type: "defense",
  baseStrength: 60,
  tiers: [
    {
      id: "white-defense-sanctuary",
      name: "Sanctuary",
      description: "Hallowed ground rejects the attacker. Strongest defensive ward.",
    },
    {
      id: "white-defense-bulwark-t2",
      name: "Bulwark of Saints",
      description: "Plate-mailed visions stand the wall. The line holds.",
    },
    {
      id: "white-defense-citadel-t3",
      name: "Citadel of Light",
      description: "Stone walls bloom from blessed earth. Few who climb them return.",
    },
    {
      id: "white-defense-aegis-t4",
      name: "Aegis of the First General",
      description: "An iron circlet's memory haunts the threshold. Attackers falter, then turn.",
    },
    {
      id: "white-defense-last-banner-t5",
      name: "The Last Banner",
      description: "Planted at noon. The wind never moves it. Attackers do not pass.",
    },
  ],
});
