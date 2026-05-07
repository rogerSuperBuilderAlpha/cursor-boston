/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { SpellDefinition } from "../../../types";
import { buildSpellTiers } from "../_tier-builder";

export const RED_PRODUCTION_SPELLS: SpellDefinition[] = buildSpellTiers({
  caste: "red",
  type: "production",
  baseStrength: 30,
  tiers: [
    {
      id: "red-production-forge-boon",
      name: "Forge Boon",
      description: "Forges run hot for 100 turns; modest cap boost.",
    },
    {
      id: "red-production-bellows-rite-t2",
      name: "Bellows Rite",
      description: "Bellows breathe themselves. Smiths sleep in shifts; output never stops.",
    },
    {
      id: "red-production-ironwake-t3",
      name: "Ironwake",
      description: "Ore answers when called. Carts arrive without drivers.",
    },
    {
      id: "red-production-anvil-chorus-t4",
      name: "Anvil Chorus",
      description: "A thousand hammers strike together, on the beat. Cap surges.",
    },
    {
      id: "red-production-first-anvil-t5",
      name: "The First Anvil",
      description: "Older than the realm. Its ring carries to every forge for 100 turns.",
    },
  ],
});
