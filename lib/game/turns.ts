/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { magicMultiplier, unitCapFromFoodLands } from "./combat";
import { SPELLS_BY_ID, getCasteProfile } from "./content";
import type { ActiveProductionSpell, GamePlayer, Phase } from "./types";
import { PROPHECY_BONUS_TURNS_MAX } from "./types";

export const WEEKLY_TURN_GRANT = 100;
// Initial bucket granted at spawn. Larger than the weekly grant so a fresh
// general can clear setup (assign 25 lands, pick a caste) and still have a
// substantial pool for early recruiting / first attacks before the next
// Sunday rollover tops up the bucket.
export const STARTING_TURN_GRANT = 300;
export const SHIELD_DURATION_WEEKS = 3;
export const SHIELD_TURN_THRESHOLD = 300;
export const UNDERDOG_SIZE_RATIO = 0.5;
export const PRODUCTION_SPELL_DURATION_TURNS = 100;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function asDate(value: Date | { toDate: () => Date } | undefined | null): Date {
  if (!value) return new Date(0);
  if (value instanceof Date) return value;
  if (typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }
  return new Date(0);
}

// Returns the yyyy-mm-dd of the Sunday whose 05:00 UTC instant (= 00:00 EST)
// most recently passed at-or-before `now`. This is the canonical week-start key
// used to make weekly grants idempotent.
export function weekStartIsoForRollover(now: Date): string {
  const utcDay = now.getUTCDay();
  const utcHours = now.getUTCHours();
  let daysBack = utcDay;
  if (utcDay === 0 && utcHours < 5) daysBack = 7;
  const sunday = new Date(now.getTime());
  sunday.setUTCDate(sunday.getUTCDate() - daysBack);
  sunday.setUTCHours(5, 0, 0, 0);
  return sunday.toISOString().slice(0, 10);
}

// Returns the [start, end) window — in UTC milliseconds — covering the 7 days
// preceding the rollover at `weekStartIso`. PRs whose mergedAt falls in this
// window unlock the grant for that rollover.
export function priorWeekRangeUtc(weekStartIso: string): { start: Date; end: Date } {
  const end = new Date(`${weekStartIso}T05:00:00.000Z`);
  const start = new Date(end.getTime() - 7 * MS_PER_DAY);
  return { start, end };
}

// Returns the UTC instant of the NEXT rollover (Sunday 05:00 UTC = 00:00 EST)
// strictly after `now`. Used for the dashboard countdown.
export function nextRolloverInstant(now: Date = new Date()): Date {
  const next = new Date(now.getTime());
  // Days until next Sunday (1..7). If today is already Sunday but past 05:00 UTC,
  // the next rollover is 7 days later.
  const utcDay = next.getUTCDay();
  const utcHours = next.getUTCHours();
  const utcMinutes = next.getUTCMinutes();
  let daysAhead = (7 - utcDay) % 7;
  if (
    daysAhead === 0 &&
    (utcHours > 5 || (utcHours === 5 && utcMinutes > 0))
  ) {
    daysAhead = 7;
  }
  next.setUTCDate(next.getUTCDate() + daysAhead);
  next.setUTCHours(5, 0, 0, 0);
  return next;
}

// Returns the window of merged PRs that would unlock the NEXT rollover —
// i.e. the 7 days ending at the next Sunday-05:00-UTC instant.
export function currentEligibilityWindow(
  now: Date = new Date()
): { start: Date; end: Date } {
  const end = nextRolloverInstant(now);
  const start = new Date(end.getTime() - 7 * MS_PER_DAY);
  return { start, end };
}

export interface NewPlayerOptions {
  initialPhase?: Phase;
  tilesHeld?: number;
  tilesExplored?: number;
  displayName?: string;
}

// 3-32 chars; letters, digits, spaces, apostrophes, hyphens. No leading/trailing
// whitespace. Trimmed before storage. Returns the cleaned name on success.
export const GENERAL_NAME_MIN = 3;
export const GENERAL_NAME_MAX = 32;
const GENERAL_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 '\-]*[A-Za-z0-9]$/;

export function validateGeneralName(raw: string): string {
  if (typeof raw !== "string") {
    throw new Error("Name must be a string");
  }
  const trimmed = raw.trim();
  if (trimmed.length < GENERAL_NAME_MIN) {
    throw new Error(`Name must be at least ${GENERAL_NAME_MIN} characters`);
  }
  if (trimmed.length > GENERAL_NAME_MAX) {
    throw new Error(`Name must be at most ${GENERAL_NAME_MAX} characters`);
  }
  if (!GENERAL_NAME_PATTERN.test(trimmed)) {
    throw new Error(
      "Name may contain only letters, digits, spaces, apostrophes, and hyphens"
    );
  }
  return trimmed;
}

export function newPlayer(
  userId: string,
  createdAt: Date = new Date(),
  options: NewPlayerOptions = {}
): GamePlayer {
  const shieldUntil = new Date(
    createdAt.getTime() + SHIELD_DURATION_WEEKS * 7 * MS_PER_DAY
  );
  return {
    userId,
    displayName: options.displayName ?? "",
    caste: null,
    turnsRemaining: STARTING_TURN_GRANT,
    turnsSpentTotal: 0,
    phase: options.initialPhase ?? "explore",
    tilesExplored: options.tilesExplored ?? 0,
    shieldUntil,
    shieldDropAtTurn: SHIELD_TURN_THRESHOLD,
    productionSpellsActive: [],
    stats: {
      attacksWon: 0,
      attacksLost: 0,
      tilesHeld: options.tilesHeld ?? 100,
      unitsAlive: 0,
    },
    createdAt,
    updatedAt: createdAt,
  };
}

export function canSpendTurns(player: GamePlayer, n: number): boolean {
  return n >= 0 && player.turnsRemaining >= n;
}

export function spendTurns(
  player: GamePlayer,
  n: number,
  now: Date = new Date()
): GamePlayer {
  if (n < 0) throw new Error("Cannot spend negative turns");
  if (player.turnsRemaining < n) {
    throw new Error(
      `Insufficient turns: have ${player.turnsRemaining}, need ${n}`
    );
  }
  return {
    ...player,
    turnsRemaining: player.turnsRemaining - n,
    turnsSpentTotal: player.turnsSpentTotal + n,
    updatedAt: now,
  };
}

// Shield wall: untargetable AND can't initiate attacks for the first 3 weeks
// after creation OR until 300 turns have been spent — whichever comes first.
// Once a general has spent 300 turns, they've engaged enough to be fair game,
// even if the calendar window hasn't elapsed; conversely, an inactive player
// stops being protected once the 3-week window closes.
export function isShieldActive(player: GamePlayer, now: Date = new Date()): boolean {
  const shieldUntilDate = asDate(player.shieldUntil);
  const stillInShieldPeriod = now < shieldUntilDate;
  const stillUnderTurnThreshold =
    player.turnsSpentTotal < player.shieldDropAtTurn;
  return stillInShieldPeriod && stillUnderTurnThreshold;
}

export function isUnderdog(
  attackerUnitsAlive: number,
  defenderUnitsAlive: number
): boolean {
  if (attackerUnitsAlive <= 0) return false;
  return defenderUnitsAlive < UNDERDOG_SIZE_RATIO * attackerUnitsAlive;
}

export function shouldGrantWeeklyTurns(
  player: GamePlayer,
  mergedThisWeek: boolean,
  weekStartIso: string
): boolean {
  if (!mergedThisWeek) return false;
  if (player.lastWeeklyGrantWeekStart === weekStartIso) return false;
  return true;
}

// Adds WEEKLY_TURN_GRANT on top of any unspent turns — banking is rewarded,
// not penalized. A player who hoarded 300 going into the rollover ends at 400.
// Zero-turn gameplay: consumes any pendingProphecyBonus (capped at
// PROPHECY_BONUS_TURNS_MAX) so a fulfilled prophecy stakes the prophet
// extra turns on their next grant. The pending counter is zeroed in the
// returned player; the caller is responsible for writing this back.
export function applyWeeklyGrant(
  player: GamePlayer,
  weekStartIso: string,
  now: Date = new Date()
): GamePlayer {
  const bonusRaw = player.pendingProphecyBonus ?? 0;
  const bonus = Math.min(PROPHECY_BONUS_TURNS_MAX, Math.max(0, bonusRaw));
  return {
    ...player,
    turnsRemaining: player.turnsRemaining + WEEKLY_TURN_GRANT + bonus,
    pendingProphecyBonus: 0,
    lastWeeklyGrantAt: now,
    lastWeeklyGrantWeekStart: weekStartIso,
    updatedAt: now,
  };
}

// Auto-advance phase based on observable state. Caller is the one updating
// tilesExplored / caste; this helper just decides what phase the player should
// be in given those.
export function nextPhase(player: GamePlayer): Phase {
  if (player.phase === "explore" && player.tilesExplored >= 100) {
    return "distribute";
  }
  if (player.phase === "caste" && player.caste !== null) {
    return "play";
  }
  return player.phase;
}

// Drops entries whose expiresAtTurn has lapsed at the given turnsSpentTotal.
// Pure helper used at spell-cast time to keep productionSpellsActive bounded.
export function pruneExpiredProductionSpells(
  active: ActiveProductionSpell[],
  turnsSpentTotal: number
): ActiveProductionSpell[] {
  return active.filter((a) => a.expiresAtTurn > turnsSpentTotal);
}

export function effectiveUnitCap(
  player: GamePlayer,
  foodLandCount: number,
  magicLandCount: number
): number {
  const baseCap = unitCapFromFoodLands(foodLandCount);
  if (!player.caste) return baseCap;
  const profile = getCasteProfile(player.caste);
  const mult = magicMultiplier(magicLandCount);
  let bonus = 0;
  for (const active of player.productionSpellsActive) {
    if (active.expiresAtTurn <= player.turnsSpentTotal) continue;
    const spell = SPELLS_BY_ID.get(active.spellId);
    if (!spell || spell.type !== "production") continue;
    bonus += spell.baseStrength * mult * profile.spellTypeBonuses.production;
  }
  return Math.round(baseCap + bonus);
}
