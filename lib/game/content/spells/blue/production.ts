/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { SpellDefinition } from "../../../types";
import { buildSpellTiers } from "../_tier-builder";

export const BLUE_PRODUCTION_SPELLS: SpellDefinition[] = buildSpellTiers({
  caste: "blue",
  type: "production",
  baseStrength: 70,
  tiers: [
    {
      id: "blue-production-arcane-surge",
      name: "Arcane Surge",
      description: "Floods the realm with raw mana for 100 turns. Blue's signature.",
    },
    {
      id: "blue-production-moonwell-t2",
      name: "Moonwell",
      description: "A pool that reflects no sky. Drinkers cast longer, drink less.",
    },
    {
      id: "blue-production-tide-clock-t3",
      name: "Tide Clock",
      description: "The tide changes on command. Mana floods predictably for 100 turns.",
    },
    {
      id: "blue-production-leyline-t4",
      name: "Leyline Convergence",
      description: "Three rivers meet inside a closed room. The realm hums with current.",
    },
    {
      id: "blue-production-nightless-sea-t5",
      name: "The Nightless Sea",
      description: "An ocean lit from below. Spells cast at half cost while it burns.",
    },
  ],
});
