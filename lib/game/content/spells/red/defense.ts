/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { SpellDefinition } from "../../../types";
import { buildSpellTiers } from "../_tier-builder";

export const RED_DEFENSE_SPELLS: SpellDefinition[] = buildSpellTiers({
  caste: "red",
  type: "defense",
  baseStrength: 25,
  tiers: [
    {
      id: "red-defense-fire-wall",
      name: "Fire Wall",
      description: "A seared moat that stalls — but doesn't stop — the attacker.",
    },
    {
      id: "red-defense-ember-hail-t2",
      name: "Ember Hail",
      description: "Embers fall thick as snow. Banners catch first.",
    },
    {
      id: "red-defense-foundry-trench-t3",
      name: "Foundry Trench",
      description: "Molten iron pours along the perimeter and refuses to cool.",
    },
    {
      id: "red-defense-pyric-circle-t4",
      name: "Pyric Circle",
      description: "Flame walks itself in a slow ring. Few cross it standing.",
    },
    {
      id: "red-defense-forge-heart-t5",
      name: "Heart of the Forge",
      description: "The First Anvil rings once. Attackers' weapons soften in their hands.",
    },
  ],
});
