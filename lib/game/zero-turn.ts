/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Pure helpers for the zero-turn gameplay features (May 2026 sim
 * follow-up). Mechanics that give players meaningful agency at 0 turns:
 *
 *   - Hero pep talk / meditation
 *   - Tile redistribution
 *   - Defensive stance
 *   - Last Stand (rally)
 *   - Enforced pacts (Oathbreaker mark)
 *   - Prophecy stakes (turn bonus on resolution)
 *   - Queued orders
 *   - Battle Autopsy (speculative counterfactual)
 *
 * Server-side stitching (Firestore reads/writes, transactions) lives in
 * data-server.ts. This module is import-safe from both the server and the
 * pure-helper test suite.
 */

import type {
  CombatAttackerInput,
  CombatDefenderInput,
  CombatResult,
  CombatTileInput,
  GameHero,
  GamePlayer,
  GameTile,
  UnitStack,
} from "./types";
import {
  DEFENSIVE_STANCE_DEFENSE_BONUS,
  LAST_STAND_ADJACENT_PENALTY,
  LAST_STAND_DEFENSE_BONUS,
  LAST_STAND_COOLDOWN_MS,
  OATHBREAKER_ATTACK_PENALTY,
  REDISTRIBUTE_MAX_PER_DAY,
  REDISTRIBUTE_TRANSIT_LOSS,
} from "./types";

// ─────────────────────────────────────────────────────────────────────
// Time helpers
// ─────────────────────────────────────────────────────────────────────

function toMillis(value: Date | { toMillis?: () => number } | undefined): number | null {
  if (!value) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof (value as { toMillis?: () => number }).toMillis === "function") {
    return (value as { toMillis: () => number }).toMillis();
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────
// Hero meditation
// ─────────────────────────────────────────────────────────────────────

/** True when the hero is currently on sabbatical (meditating). Meditating
 *  heroes don't contribute attack/defense bonuses to combat and don't
 *  engage on their tile's battles. */
export function isHeroMeditating(hero: GameHero | null | undefined, now: Date): boolean {
  if (!hero || !hero.meditatingUntil) return false;
  const ms = toMillis(hero.meditatingUntil);
  if (ms === null) return false;
  return ms > now.getTime();
}

/** Count of the player's heroes currently meditating. Drives the slot
 *  cap check in meditateHeroServer. Reads tiles owned by the player and
 *  inspects their hero snapshot. */
export function countMeditatingHeroes(
  ownedTilesWithHero: ReadonlyArray<Pick<GameTile, "hero">>,
  now: Date
): number {
  let count = 0;
  for (const tile of ownedTilesWithHero) {
    if (isHeroMeditating(tile.hero, now)) count += 1;
  }
  return count;
}

// ─────────────────────────────────────────────────────────────────────
// Oathbreaker
// ─────────────────────────────────────────────────────────────────────

/** Resolved attack penalty fraction for the attacker when their
 *  Oathbreaker mark is still active. Returns 0 when no mark or expired. */
export function oathbreakerAttackPenalty(player: GamePlayer, now: Date): number {
  if (!player.oathbreakerUntil) return 0;
  const ms = toMillis(player.oathbreakerUntil);
  if (ms === null || ms <= now.getTime()) return 0;
  return OATHBREAKER_ATTACK_PENALTY;
}

// ─────────────────────────────────────────────────────────────────────
// Defensive stance + Last Stand
// ─────────────────────────────────────────────────────────────────────

/** Cap on tiles that can be in defensive stance simultaneously. Scales
 *  with empire size; tiny empires get 1 to keep the feature usable. */
export function maxDefensiveStanceTiles(player: GamePlayer): number {
  const held = player.stats?.tilesHeld ?? 0;
  return Math.max(1, Math.floor(held / 100));
}

/** True when the tile's defensive-stance toggle is currently active. */
export function isTileInDefensiveStance(
  tile: Pick<GameTile, "defensiveStance">,
  now: Date
): boolean {
  if (!tile.defensiveStance || !tile.defensiveStance.active) return false;
  const since = toMillis(tile.defensiveStance.since);
  return since !== null && since <= now.getTime();
}

/** True when the player can still toggle defensive stance OFF on this
 *  tile (the 6h lock has elapsed). */
export function canExitDefensiveStance(
  tile: Pick<GameTile, "defensiveStance">,
  now: Date
): boolean {
  if (!tile.defensiveStance) return true;
  const locked = toMillis(tile.defensiveStance.lockedUntil);
  return locked === null || locked <= now.getTime();
}

/** True when the tile has an armed Last Stand effect that's still within
 *  its window (and so will apply to the next inbound attack). */
export function hasActiveLastStand(
  tile: Pick<GameTile, "activeLastStand">,
  now: Date
): boolean {
  if (!tile.activeLastStand) return false;
  const expires = toMillis(tile.activeLastStand.expiresAt);
  return expires !== null && expires > now.getTime();
}

/** True when the player can declare another Last Stand (their cooldown
 *  has elapsed). */
export function canDeclareLastStand(player: GamePlayer, now: Date): boolean {
  if (!player.lastStandUsedAt) return true;
  const used = toMillis(player.lastStandUsedAt);
  if (used === null) return true;
  return now.getTime() - used >= LAST_STAND_COOLDOWN_MS;
}

/** Cooldown remaining before the player can declare another Last Stand.
 *  Returns 0 when the player can declare. */
export function lastStandCooldownRemainingMs(
  player: GamePlayer,
  now: Date
): number {
  if (!player.lastStandUsedAt) return 0;
  const used = toMillis(player.lastStandUsedAt);
  if (used === null) return 0;
  const remaining = LAST_STAND_COOLDOWN_MS - (now.getTime() - used);
  return Math.max(0, remaining);
}

/** Aggregate zero-turn defense bonus for a tile being attacked. Folds
 *  defensive stance (additive on the tile itself) + last stand (additive
 *  on the declared tile) into the single `zeroTurnDefenseBonus` channel
 *  consumed by combat.ts. Adjacency-based last-stand adjacent-penalties
 *  are passed in via `adjacentRallyPenaltyActive`. */
export function computeZeroTurnDefenseBonus(args: {
  tile: Pick<GameTile, "defensiveStance" | "activeLastStand">;
  adjacentRallyPenaltyActive?: boolean;
  now: Date;
}): number {
  let bonus = 0;
  if (isTileInDefensiveStance(args.tile, args.now)) {
    bonus += DEFENSIVE_STANCE_DEFENSE_BONUS;
  }
  if (hasActiveLastStand(args.tile, args.now)) {
    bonus += LAST_STAND_DEFENSE_BONUS;
  }
  if (args.adjacentRallyPenaltyActive) {
    // Rally on a neighbor pulls reserves from this tile.
    bonus -= LAST_STAND_ADJACENT_PENALTY;
  }
  return bonus;
}

// ─────────────────────────────────────────────────────────────────────
// Tile redistribution
// ─────────────────────────────────────────────────────────────────────

/** Applies the transit loss haircut to a moved stack. Returns the stack
 *  that actually arrives. */
export function applyRedistributionLoss(moved: UnitStack): UnitStack {
  const factor = 1 - REDISTRIBUTE_TRANSIT_LOSS;
  return {
    ground: Math.floor(moved.ground * factor),
    siege: Math.floor(moved.siege * factor),
    air: Math.floor(moved.air * factor),
  };
}

/** Prunes `recentRedistributions` to entries within the last 24h and
 *  returns how many remain. Used both for the daily-cap check and for
 *  the "X remaining today" display. */
export function countRecentRedistributions(
  recent: ReadonlyArray<Date | { toMillis?: () => number }> | undefined,
  now: Date
): number {
  if (!recent || recent.length === 0) return 0;
  const cutoff = now.getTime() - 24 * 60 * 60 * 1000;
  let count = 0;
  for (const entry of recent) {
    const ms = toMillis(entry);
    if (ms !== null && ms >= cutoff) count += 1;
  }
  return count;
}

export function redistributionsRemainingToday(
  recent: ReadonlyArray<Date | { toMillis?: () => number }> | undefined,
  now: Date
): number {
  return Math.max(0, REDISTRIBUTE_MAX_PER_DAY - countRecentRedistributions(recent, now));
}

// ─────────────────────────────────────────────────────────────────────
// Battle autopsy speculation
// ─────────────────────────────────────────────────────────────────────

/**
 * Drive a what-if combat resolution using the same inputs as the
 * original attack, but with perturbations to the attacker stack. Returns
 * the alternative outcome and a one-line headline.
 *
 * Callers supply a `resolveAttackFn` (typically the production
 * `resolveAttack` from combat.ts) so this helper stays pure and
 * dependency-free for tests.
 *
 * The perturbation channels mirror the actionable levers a player could
 * have invested in: more units of a type, an additional offense spell
 * source, a different unit composition.
 */
export interface AutopsyPerturbation {
  /** Friendly label for the UI, e.g. "+50 siege" or "+1 offense spell". */
  label: string;
  /** Delta added to attacker units before re-resolution. */
  unitsDelta?: Partial<UnitStack>;
  /** Override the offense spell id (e.g. swap in a stronger spell). */
  offenseSpellIdOverride?: string | null;
  /** Multiplicative bump to attacker.heroAttackBonus channel. Adds to
   *  the existing bonus. */
  heroAttackBonusDelta?: number;
}

export interface AutopsyOutcome {
  label: string;
  /** The CombatResult from the speculative resolution. */
  result: CombatResult;
  /** True when the speculative resolution flipped the outcome relative
   *  to the original (capture ↔ repel). */
  outcomeFlipped: boolean;
  /** Headline summary suitable for UI rendering. */
  summary: string;
}

export interface RunAutopsyArgs {
  /** The recorded attack — must include `unitsOnTargetPreAttack`. */
  attacker: CombatAttackerInput;
  defender: CombatDefenderInput;
  tile: CombatTileInput;
  rngSeed: string;
  originalOutcome: CombatResult["outcome"];
  perturbations: ReadonlyArray<AutopsyPerturbation>;
  resolveAttackFn: (
    a: CombatAttackerInput,
    d: CombatDefenderInput,
    t: CombatTileInput,
    rng: () => number
  ) => CombatResult;
  /** Deterministic RNG factory. Mirrors the production `seededRng`
   *  behavior so the speculative run matches the original seed. */
  rngFactory: (seed: string) => () => number;
}

/** Adds two unit stacks (one may be partial). */
function addStack(a: UnitStack, delta: Partial<UnitStack>): UnitStack {
  return {
    ground: a.ground + (delta.ground ?? 0),
    siege: a.siege + (delta.siege ?? 0),
    air: a.air + (delta.air ?? 0),
  };
}

export function runAutopsy(args: RunAutopsyArgs): AutopsyOutcome[] {
  const outcomes: AutopsyOutcome[] = [];
  for (const p of args.perturbations) {
    const perturbedAttacker: CombatAttackerInput = {
      ...args.attacker,
      units: p.unitsDelta
        ? addStack(args.attacker.units, p.unitsDelta)
        : args.attacker.units,
      offenseSpellId:
        p.offenseSpellIdOverride !== undefined
          ? p.offenseSpellIdOverride
          : args.attacker.offenseSpellId,
      heroAttackBonus:
        (args.attacker.heroAttackBonus ?? 0) + (p.heroAttackBonusDelta ?? 0),
    };
    // Re-run with the SAME RNG seed so we measure the effect of the
    // composition change, not RNG noise.
    const rng = args.rngFactory(args.rngSeed);
    const result = args.resolveAttackFn(perturbedAttacker, args.defender, args.tile, rng);
    const outcomeFlipped = result.outcome !== args.originalOutcome;
    const summary = outcomeFlipped
      ? `${p.label} would have flipped the outcome to ${result.outcome}`
      : `${p.label} would not have changed the outcome (${result.outcome})`;
    outcomes.push({ label: p.label, result, outcomeFlipped, summary });
  }
  return outcomes;
}

/** Standard suite of perturbations to surface in the autopsy UI when
 *  the attacker lost. Each is a small, plausible "what if I had brought
 *  more of X". Calibrated against typical mid-tier compositions. */
export function defaultLossPerturbations(
  unitsSent: UnitStack
): AutopsyPerturbation[] {
  const small = (n: number) => Math.max(25, Math.floor(n * 0.25));
  return [
    { label: `+${small(unitsSent.ground)} ground`, unitsDelta: { ground: small(unitsSent.ground) } },
    { label: `+${small(unitsSent.siege)} siege`, unitsDelta: { siege: small(unitsSent.siege) } },
    { label: `+${small(unitsSent.air)} air`, unitsDelta: { air: small(unitsSent.air) } },
  ];
}
