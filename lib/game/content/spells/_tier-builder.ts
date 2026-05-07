/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type {
  Caste,
  SpellDefinition,
  SpellTier,
  SpellType,
} from "../../types";
import {
  TIER_MIN_TILES,
  TIER_STRENGTH_MULTIPLIER,
  TIER_TURN_COST,
} from "./tiers";

interface TierEntry {
  // Tier 1 keeps its v1 id (e.g. "white-defense-sanctuary") so any Firestore
  // tile docs with armedDefenseSpellId still resolve. Higher tiers append
  // "-t2".."-t5".
  id: string;
  name: string;
  description: string;
}

interface BuildArgs {
  caste: Caste;
  type: SpellType;
  // Tier-1 baseStrength. Higher tiers scale by TIER_STRENGTH_MULTIPLIER.
  baseStrength: number;
  // Exactly 5 entries — one per tier in ascending order.
  tiers: [TierEntry, TierEntry, TierEntry, TierEntry, TierEntry];
}

export function buildSpellTiers(args: BuildArgs): SpellDefinition[] {
  return args.tiers.map((entry, idx) => {
    const tier = (idx + 1) as SpellTier;
    return {
      id: entry.id,
      caste: args.caste,
      type: args.type,
      name: entry.name,
      baseStrength: Math.round(
        args.baseStrength * TIER_STRENGTH_MULTIPLIER[tier]
      ),
      description: entry.description,
      tier,
      minTilesRequired: TIER_MIN_TILES[tier],
      turnCost: TIER_TURN_COST[tier],
    };
  });
}
