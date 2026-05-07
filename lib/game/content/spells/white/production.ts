/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { SpellDefinition } from "../../../types";
import { buildSpellTiers } from "../_tier-builder";

export const WHITE_PRODUCTION_SPELLS: SpellDefinition[] = buildSpellTiers({
  caste: "white",
  type: "production",
  baseStrength: 25,
  tiers: [
    {
      id: "white-production-harvest-festival",
      name: "Harvest Festival",
      description: "Bells ring across the realm; food cap raised for 100 turns.",
    },
    {
      id: "white-production-blessed-fields-t2",
      name: "Blessed Fields",
      description: "Frost spares the wheat. Quartermasters report surplus.",
    },
    {
      id: "white-production-hearth-vow-t3",
      name: "Hearth Vow",
      description: "Every fire in the realm burns clean. Smiths and cooks both gain.",
    },
    {
      id: "white-production-feast-of-saints-t4",
      name: "Feast of Saints",
      description: "Tables stretch from horizon to horizon. None go hungry; cap surges.",
    },
    {
      id: "white-production-quiet-king-t5",
      name: "Vigil of the Quiet King",
      description: "He never spoke. He never lost. Cap thrums for 100 turns.",
    },
  ],
});
