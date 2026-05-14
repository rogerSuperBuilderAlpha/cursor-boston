/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { SpellDefinition } from "../../../types";
import { buildSpellTiers } from "../_tier-builder";

export const GREEN_PRODUCTION_SPELLS: SpellDefinition[] = buildSpellTiers({
  caste: "green",
  type: "production",
  baseStrength: 50,
  tiers: [
    {
      id: "green-production-bloom",
      name: "Bloom",
      description: "Every field redoubles its yield for 100 turns.",
    },
    {
      id: "green-production-orchard-vow-t2",
      name: "Orchard Vow",
      description: "Trees fruit twice in a season. Carts run heavy on every road.",
    },
    {
      id: "green-production-deeproot-t3",
      name: "Deeproot",
      description: "Roots find water no map shows. The realm fattens for 100 turns.",
    },
    {
      id: "green-production-living-fields-t4",
      name: "Living Fields",
      description: "The fields choose to be tilled. The cap rises with the corn.",
    },
    {
      id: "green-production-the-old-grove-t5",
      name: "The Old Grove",
      description: "Older than the realm. It has fed armies before. It will again.",
    },
  ],
});
