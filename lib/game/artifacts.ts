/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { ArtifactDefinition, ArtifactRarity } from "./types";
import { ALL_ARTIFACTS, ARTIFACTS_BY_RARITY } from "./content/artifacts";

// On every turn-spend, the player has this chance of finding an artifact.
// Conservative starting value — tune in PR 7 once we have early data.
export const ARTIFACT_DROP_RATE = 0.03;

// Within a successful drop, what rarity is found. Heavy common skew so
// epics/legendaries feel like genuine events.
export const RARITY_WEIGHTS: Record<ArtifactRarity, number> = {
  common: 70,
  rare: 22,
  epic: 7,
  legendary: 1,
};

const TOTAL_WEIGHT = Object.values(RARITY_WEIGHTS).reduce((a, b) => a + b, 0);

function pickRarity(rng: () => number): ArtifactRarity {
  const roll = rng() * TOTAL_WEIGHT;
  let cumulative = 0;
  for (const rarity of ["common", "rare", "epic", "legendary"] as const) {
    cumulative += RARITY_WEIGHTS[rarity];
    if (roll < cumulative) return rarity;
  }
  return "common";
}

/**
 * Decide whether the player finds an artifact this turn, and if so which one.
 * `rng` should be a seeded PRNG (see `makeSeededRng`); pass a different seed
 * per turn so consecutive turns roll independently.
 *
 * Returns null if no drop happened.
 */
export function rollArtifact(rng: () => number): ArtifactDefinition | null {
  if (rng() >= ARTIFACT_DROP_RATE) return null;
  const rarity = pickRarity(rng);
  const pool = ARTIFACTS_BY_RARITY[rarity];
  if (pool.length === 0) {
    // No content registered for this rarity yet — fall back to any artifact
    // rather than swallowing the drop entirely.
    if (ALL_ARTIFACTS.length === 0) return null;
    return ALL_ARTIFACTS[Math.floor(rng() * ALL_ARTIFACTS.length)];
  }
  return pool[Math.floor(rng() * pool.length)];
}
