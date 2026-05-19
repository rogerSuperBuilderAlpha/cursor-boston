/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * End-game tuning. The Armageddon spell unlocks at ARMAGEDDON_TILE_GATE
 * tiles held; each cast burns ARMAGEDDON_TURN_COST turns whether it
 * succeeds or fails. Success breaks one of SEAL_COUNT global Seals; the
 * 7th seal ends the season and triggers a top-WINNER_COUNT weighted
 * lottery (tickets = tilesHeld × (1 + sealsBroken)).
 *
 * Success probability is BASE_SUCCESS × magicMultiplier(magicLandCount,
 * activeUpgrades), clamped to SUCCESS_HARD_CAP. The magic multiplier soft-
 * caps at ~3.75 in vanilla content, so realistic peak success is around
 * 18.75% — but magic-multiplier upgrades push the cap higher and let
 * heavy-investment kingdoms approach SUCCESS_HARD_CAP.
 */

// NOTE: This module is imported transitively by `lib/game/combat.ts` (via
// content/index → content/spells/armageddon → here). To avoid a circular
// import (which webpack surfaces as "Cannot access 'e' before init"),
// this file must NOT import from combat.ts or upgrades.ts. The math helpers
// below take an already-computed magicMultiplier value as input; callers
// compose them with `magicMultiplier(magicLandCount, activeUpgrades)`
// from combat.ts at the call site.

export const ARMAGEDDON_TILE_GATE = 10_000;
export const ARMAGEDDON_TURN_COST = 100;
export const BASE_SUCCESS = 0.05;
export const SUCCESS_HARD_CAP = 0.5;
export const SEAL_COUNT = 7;
export const WINNER_COUNT = 10;
/** Snapshot the top-N by tilesHeld into the hall-of-fame doc, regardless of
 *  whether they won the lottery. Lets returning players see whose kingdoms
 *  were largest in past seasons. */
export const TOP_BY_TILES_SNAPSHOT_COUNT = 50;

/** Pure: returns the success probability for an Armageddon cast given a
 *  precomputed magicMultiplier. Identical formula is rendered to the UI
 *  (so the player sees their odds) and rolled on the server (so the
 *  server is the source of truth). */
export function computeArmageddonSuccessChanceFromMultiplier(
  magicMultiplierValue: number
): number {
  const raw = BASE_SUCCESS * magicMultiplierValue;
  return Math.min(SUCCESS_HARD_CAP, raw);
}

/** Weighted ticket count for a single player at lottery draw time. */
export function computeLotteryTickets(
  tilesHeld: number,
  sealsBroken: number
): number {
  if (tilesHeld <= 0) return 0;
  return tilesHeld * (1 + Math.max(0, sealsBroken));
}
