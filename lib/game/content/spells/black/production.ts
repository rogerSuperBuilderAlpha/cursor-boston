/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { SpellDefinition } from "../../../types";
import { buildSpellTiers } from "../_tier-builder";

export const BLACK_PRODUCTION_SPELLS: SpellDefinition[] = buildSpellTiers({
  caste: "black",
  type: "production",
  baseStrength: 30,
  tiers: [
    {
      id: "black-production-necromancy",
      name: "Necromancy",
      description: "The fallen are reckoned among the living. Modest cap boost.",
    },
    {
      id: "black-production-conscript-dead-t2",
      name: "Conscript the Dead",
      description: "Every cemetery in the realm is read aloud. Names answer.",
    },
    {
      id: "black-production-hungering-fields-t3",
      name: "Hungering Fields",
      description: "The crops eat the crows. The crows eat what comes after. The cap rises.",
    },
    {
      id: "black-production-black-feast-t4",
      name: "Black Feast",
      description: "The dead pass plates among the living. Capacity climbs sharply.",
    },
    {
      id: "black-production-stillborn-host-t5",
      name: "Stillborn Host",
      description: "Soldiers are produced who were never born. Cap surges past reason.",
    },
  ],
});
