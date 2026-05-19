/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * The single caste-agnostic Armageddon spell. Listed in ALL_SPELLS so it
 * appears in the player's spell browser, but routed through its own
 * server entry-point (castArmageddonServer) — NOT castSpellServer — so
 * it doesn't inherit caste-match / adjacency validation.
 *
 * Tuning lives in lib/game/content/armageddon.ts (gate, turn cost, success
 * formula). This file only carries the catalog row.
 */

import type { SpellDefinition } from "../../types";
import {
  ARMAGEDDON_TILE_GATE,
  ARMAGEDDON_TURN_COST,
} from "../armageddon";

export const ARMAGEDDON_SPELL_ID = "armageddon";

export const ARMAGEDDON_SPELL: SpellDefinition = {
  id: ARMAGEDDON_SPELL_ID,
  caste: "neutral",
  type: "armageddon",
  name: "Armageddon",
  // baseStrength is ignored — Armageddon is binary (succeeds → 1 seal
  // breaks; fails → nothing happens). Success probability is derived from
  // magicMultiplier in computeArmageddonSuccessChance, not baseStrength.
  baseStrength: 0,
  description:
    "Strike the heavens. Risk 100 turns to break one of the seven Seals. " +
    "Low base chance — only a heavily magic-optimized kingdom approaches the cap. " +
    "When the seventh Seal breaks, the world ends and is remade.",
  tier: 5,
  minTilesRequired: ARMAGEDDON_TILE_GATE,
  turnCost: ARMAGEDDON_TURN_COST,
  lore:
    "Whoever sets the seventh Seal upon the altar names the age of the next world. " +
    "The risk is the point: cheap rituals are heard by no god worth hearing.",
};

/** Convenience list to mirror the other spell-content exports' shape. */
export const ARMAGEDDON_SPELLS: SpellDefinition[] = [ARMAGEDDON_SPELL];
