/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import {
  BUILDINGS_BY_ID,
  SPELLS_BY_ID,
  UPGRADES_BY_ID,
  getCasteProfile,
  getUnitForCasteAndType,
} from "./content";
import {
  buildingCapacityBonus,
  effectiveUnitStats,
  magicMultiplierBonusFromUpgrades,
} from "./upgrades";
import type {
  ActiveProductionSpell,
  AirIntelPassive,
  AttackOutcome,
  Caste,
  CombatAttackerInput,
  CombatDefenderInput,
  CombatResult,
  CombatTileInput,
  IntrinsicTileBuff,
  LandType,
  LossCurveTag,
  SpellTier,
  SpellType,
  UnitStack,
  UnitType,
} from "./types";

const UNIT_TYPES: readonly UnitType[] = ["ground", "siege", "air"] as const;

// Air > Ground > Siege > Air. RPS_BEATS[a] = the type that 'a' defeats.
const RPS_BEATS: Record<UnitType, UnitType> = {
  air: "ground",
  ground: "siege",
  siege: "air",
};

// RPS_LOSES_TO[a] = the type that beats 'a'.
const RPS_LOSES_TO: Record<UnitType, UnitType> = {
  air: "siege",
  ground: "air",
  siege: "ground",
};

const BASE_TILE_CAPACITY = 500;
const LAND_TYPE_CAPACITY_DELTA: Record<LandType, number> = {
  unrevealed: -BASE_TILE_CAPACITY,
  unassigned: -BASE_TILE_CAPACITY,
  military: 200,
  food: 0,
  magic: -100,
};

// Tile-type combat modifiers. Applied multiplicatively to attack/defense
// power before RNG. See game design docs (May 2026): military tiles are
// fortified, food tiles trade attack power for production, magic tiles
// turn into bastions for spellcraft and resilience.
//
// Source-tile attack multiplier: applied to the attacker's *total* attack
// power based on the launch tile's land type. A magic launch tile is
// neutral on attack (×1) but receives a separate spell-power bonus.
export const LAND_TYPE_ATTACK_MULT: Record<LandType, number> = {
  unrevealed: 1,
  unassigned: 1,
  military: 1.20,
  food: 0.75,
  magic: 1.0,
};

// Defender-tile defense multiplier: applied to the defender's total
// defense power based on the contested tile's land type. Military and
// magic tiles fortify themselves; food tiles do not.
export const LAND_TYPE_DEFENSE_MULT: Record<LandType, number> = {
  unrevealed: 1,
  unassigned: 1,
  military: 1.25,
  food: 1.0,
  magic: 1.25,
};

// Standing defense floor: a fraction of the incoming attack power that is
// added to defense even if the tile holds zero units. Lets military and
// magic tiles "garrison themselves" — an empty military tile still
// resists at 30% of attacker strength, an empty magic tile at 15%.
export const STANDING_DEFENSE_FRACTION: Record<LandType, number> = {
  unrevealed: 0,
  unassigned: 0,
  military: 0.30,
  food: 0,
  magic: 0.15,
};

// Magic-tile spell amplifier: spells cast from / armed on a magic tile
// have their contribution multiplied by this factor. Stacks
// multiplicatively on top of the existing magicMultiplier(magicLandCount).
export const MAGIC_TILE_SPELL_MULT = 1.25;

// ──── BASE + SUPER combat (May 2026) ─────────────────────────────────────
// Per-tile intrinsic garrison ("BASE") that fights regardless of recruitment.
// LAND_TYPE_BASE is the seed count by tile type; CASTE_BASE_PROFILE scales
// per-type counts by the owner's caste; intrinsic buffs / upgrades / active
// production spells / entrenchment all stack on top via baseUnitsTarget().
//
// Design intent: a fresh undefended military tile resists ~35 effective
// units; a food tile ~23; an unassigned frontier tile ~15. BASE-vs-BASE
// favors the defender (target-land mult, supply, intel) so SUPER recruitment
// is the offensive tipping point. See PLAN at
// /Users/ludwitt/.claude/plans/write-up-a-plan-federated-babbage.md.
export const LAND_TYPE_BASE: Record<LandType, UnitStack> = {
  unrevealed: { ground: 0, siege: 0, air: 0 },
  unassigned: { ground: 12, siege: 0, air: 3 },
  military: { ground: 22, siege: 8, air: 5 },
  food: { ground: 18, siege: 0, air: 5 },
  magic: { ground: 8, siege: 2, air: 15 },
};

// Caste flavor on BASE COUNTS. Per-unit STAT bonuses are handled by the
// existing `getCasteProfile(caste).unitTypeBonuses` chain in
// compositionPower, so we don't duplicate stat tuning here.
export const CASTE_BASE_PROFILE: Record<Caste, Record<UnitType, number>> = {
  red:   { ground: 1.25, siege: 1.10, air: 0.90 },
  white: { ground: 1.10, siege: 1.00, air: 1.00 },
  black: { ground: 1.00, siege: 0.90, air: 1.10 },
  green: { ground: 1.15, siege: 1.05, air: 1.05 },
  blue:  { ground: 0.95, siege: 1.00, air: 1.30 },
};

// BASE units are entrenched militia — harder to kill per unit than SUPER. In
// loss attribution we route incoming damage through SUPER first, then any
// overflow into BASE divided by this multiplier. So a 10-HP BASE force tanks
// damage like a 13-HP force from the attacker's perspective.
export const BASE_DURABILITY_MULT = 1.30;

// On capture, the new owner inherits this fraction of the prior owner's
// BASE as a residual garrison. The rest is killed / scattered during the
// occupation. The new owner's caste regens this back toward its own target.
export const BASE_CAPTURE_RETENTION = 0.25;

// Closeness band for stalemates. If |finalAttack/finalDefense - 1| is below
// this, the outcome is "stalemate" — both sides take partial losses, tile
// stays with defender. 0.08 ⇒ roughly 8% closeness window, expected to
// produce 8–15% stalemates on the historical force-ratio distribution.
export const STALEMATE_BAND = 0.08;

// Lazy regen rate per wall-clock hour. Tile heals toward its current
// baseUnitsTarget at this rate (split across unit types proportional to
// where BASE is most under-target). Food / magic / unassigned regenerate
// slowly; military tiles refill at a faster cadence.
export const LAND_TYPE_BASE_REGEN_PER_HOUR: Record<LandType, number> = {
  unrevealed: 0,
  unassigned: 0.5,
  military: 2,
  food: 1,
  magic: 1,
};

// Tile entrenchment ramp — long-held tiles develop fortifications, store
// rooms, and trained militia. Capped so a month-old kingdom doesn't become
// invulnerable.
export const ENTRENCHMENT_WEEKLY_BONUS = 0.05;
export const ENTRENCHMENT_MAX_BONUS = 0.25;

const UNDERDOG_SIZE_RATIO = 0.5;
const UNDERDOG_DEFENSE_BONUS = 0.25;
const RNG_LOWER = 0.9;
const RNG_RANGE = 0.2;

// Wider RNG band for pre-attack spell casts (siege-spell, disarm-spell,
// attrition-spell). A weak roll fizzles meaningfully; a strong roll lands
// solid effects. Midpoint = 1.0 (no scaling). Surfaced from this module so
// the sim panel can reproduce the expected midpoint.
export const SPELL_RNG_LOWER = 0.5;
export const SPELL_RNG_RANGE = 1.0;
export const SPELL_RNG_MIDPOINT = SPELL_RNG_LOWER + SPELL_RNG_RANGE / 2;

// Rolls a spell-effectiveness factor in [SPELL_RNG_LOWER, SPELL_RNG_LOWER+
// SPELL_RNG_RANGE]. Caller multiplies by baseStrength × magicMultiplier
// × casteSpellTypeBonus to get realized magnitude.
export function rollSpellEffectiveness(rng: () => number): number {
  return SPELL_RNG_LOWER + rng() * SPELL_RNG_RANGE;
}

/**
 * Realized magnitude for a standalone siege/disarm/attrition spell cast.
 * Pure: baseStrength × magicMultiplier(magicLands, upgrades) ×
 * casteSpellTypeBonus[spellType] × dice.
 *
 * Caller is responsible for any kind-specific clamping
 * (SIEGE_DEBUFF_MAX_MAGNITUDE for siege, [0,1] for disarm, defender-unit
 * count for attrition).
 */
export function realizedSpellMagnitude(args: {
  baseStrength: number;
  caste: Caste;
  spellType: SpellType;
  magicLandCount: number;
  activeUpgrades?: Record<string, string>;
  dice: number;
}): number {
  const profile = getCasteProfile(args.caste);
  const casteBonus = profile.spellTypeBonuses[args.spellType] ?? 1;
  const magicMult = magicMultiplier(args.magicLandCount, args.activeUpgrades);
  return args.baseStrength * magicMult * casteBonus * args.dice;
}

/**
 * Distribute a flat unit-kill count across a UnitStack proportional to its
 * current composition. Sum of returned losses equals min(killCount, total).
 * Used by attrition spells (and could be reused for similar AOE effects).
 *
 * Distribution method: per-type round-share with descending-remainder
 * tiebreaks, so a single big stack absorbs the bulk of losses naturally.
 */
export function distributeUnitKills(
  units: UnitStack,
  killCount: number
): UnitStack {
  const total = units.ground + units.siege + units.air;
  if (killCount <= 0 || total <= 0) {
    return { ground: 0, siege: 0, air: 0 };
  }
  const cap = Math.min(killCount, total);
  const raw: Record<UnitType, number> = {
    ground: (units.ground / total) * cap,
    siege: (units.siege / total) * cap,
    air: (units.air / total) * cap,
  };
  const floored: Record<UnitType, number> = {
    ground: Math.floor(raw.ground),
    siege: Math.floor(raw.siege),
    air: Math.floor(raw.air),
  };
  let assigned = floored.ground + floored.siege + floored.air;
  // Distribute remainder by largest-fractional-part first; ties broken
  // by larger absolute unit count (so the dominant type absorbs more).
  const targetTotal = Math.floor(cap);
  const order: UnitType[] = (["ground", "siege", "air"] as const)
    .slice()
    .sort((a, b) => {
      const fa = raw[a] - floored[a];
      const fb = raw[b] - floored[b];
      if (fa !== fb) return fb - fa;
      return units[b] - units[a];
    });
  let cursor = 0;
  while (assigned < targetTotal && cursor < order.length * 4) {
    const t = order[cursor % order.length];
    if (floored[t] < units[t]) {
      floored[t] += 1;
      assigned += 1;
    }
    cursor += 1;
  }
  return floored;
}

// Flyover post-processing: cap "captured" outcomes (the tile never changes
// hands during a raid) and double attacker losses (clamped to deployed —
// can't lose more units than were sent). Pure transform on a CombatResult;
// callers run resolveAttack first, then this. Lives in combat.ts so the
// rules sit alongside the math they modify.
export function applyFlyoverModifiers(combat: CombatResult): CombatResult {
  const cappedOutcome: AttackOutcome =
    combat.outcome === "captured" ? "repelled" : combat.outcome;
  const doubledLosses: UnitStack = {
    ground: Math.min(
      combat.unitsDeployed.ground,
      combat.attackerLosses.ground * 2
    ),
    siege: Math.min(
      combat.unitsDeployed.siege,
      combat.attackerLosses.siege * 2
    ),
    air: Math.min(combat.unitsDeployed.air, combat.attackerLosses.air * 2),
  };
  return {
    ...combat,
    outcome: cappedOutcome,
    attackerLosses: doubledLosses,
  };
}

// Supply: each friendly neighbor contributes 5% × type weight × caste mult,
// then clamped between the isolation floor and the cap.
const SUPPLY_PER_WEIGHT = 0.05;
const SUPPLY_ISOLATION_FLOOR = 0.85;
const SUPPLY_MAX = 1.5;
const SUPPLY_TYPE_WEIGHTS: Record<LandType, number> = {
  unrevealed: 0,
  unassigned: 0,
  military: 1.0,
  magic: 0.6,
  food: 0.3,
};

export function magicMultiplier(
  magicLandCount: number,
  activeUpgrades: Record<string, string> = {}
): number {
  const n = Math.max(0, Math.floor(magicLandCount));
  const upToFifty = Math.min(n, 50);
  const above = Math.max(0, n - 50);
  const base = 1 + 0.05 * upToFifty + 0.025 * above;
  return base + magicMultiplierBonusFromUpgrades(activeUpgrades);
}

export function unitCapFromFoodLands(foodLandCount: number): number {
  const n = Math.max(0, Math.floor(foodLandCount));
  const upToFifty = Math.min(n, 50);
  const above = Math.max(0, n - 50);
  return Math.round(5 * upToFifty + 2.5 * above);
}

// ──── BASE garrison helpers ──────────────────────────────────────────────

function toMs(t: Date | { toMillis?: () => number; seconds?: number } | undefined): number {
  if (!t) return 0;
  if (t instanceof Date) return t.getTime();
  const ts = t as { toMillis?: () => number; seconds?: number };
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (typeof ts.seconds === "number") return ts.seconds * 1000;
  return 0;
}

/**
 * Target BASE units for a tile under its current configuration. The result
 * is what BASE will regenerate toward; it does NOT mutate the tile. All
 * configurable levers feed in:
 *   - tile type (LAND_TYPE_BASE seed)
 *   - owner caste (CASTE_BASE_PROFILE per-type count multiplier)
 *   - per-tile intrinsicBuffs (artifact-stamped, with optional expiry)
 *   - tile age (entrenchment up to ENTRENCHMENT_MAX_BONUS)
 *   - active production spells (boost via casteSpellTypeBonus.production)
 *
 * Unowned tiles (caste=null) get the LAND_TYPE_BASE seed only — no caste
 * mults, no entrenchment, no spells. This makes frontier tiles harder than
 * developed tiles, but not free territory.
 */
export function baseUnitsTarget(args: {
  landType: LandType;
  caste: Caste | null;
  upgradeIds?: readonly string[];
  intrinsicBuffs?: ReadonlyArray<IntrinsicTileBuff>;
  createdAt?: Date | { toMillis?: () => number; seconds?: number };
  activeUpgrades?: Record<string, string>;
  productionSpellsActive?: ReadonlyArray<ActiveProductionSpell>;
  now?: Date;
}): UnitStack {
  const seed = LAND_TYPE_BASE[args.landType];
  if (!seed || seed.ground + seed.siege + seed.air === 0) {
    return { ground: 0, siege: 0, air: 0 };
  }

  // Caste flavor on counts. Unowned tiles get the bare seed.
  const casteMult = args.caste ? CASTE_BASE_PROFILE[args.caste] : null;

  // Entrenchment ramp from tile age. Caps at ENTRENCHMENT_MAX_BONUS after
  // ENTRENCHMENT_MAX_BONUS / ENTRENCHMENT_WEEKLY_BONUS weeks (currently
  // ~5 weeks). Unowned tiles skip entrenchment so freshly-revealed frontier
  // doesn't pretend to be ancient.
  let entrenchment = 0;
  if (args.caste && args.createdAt) {
    const now = (args.now ?? new Date()).getTime();
    const ageMs = Math.max(0, now - toMs(args.createdAt));
    const weeks = ageMs / (7 * 24 * 60 * 60 * 1000);
    entrenchment = Math.min(
      ENTRENCHMENT_MAX_BONUS,
      weeks * ENTRENCHMENT_WEEKLY_BONUS
    );
  }

  // Active intrinsic buffs — sum flat baseCountBonus across non-expired
  // entries. Stat bonuses on the buffs are applied at combat-time via
  // compositionPower, not here (this function only returns counts).
  const buffBonus: UnitStack = { ground: 0, siege: 0, air: 0 };
  if (args.intrinsicBuffs && args.intrinsicBuffs.length > 0) {
    const nowMs = (args.now ?? new Date()).getTime();
    for (const b of args.intrinsicBuffs) {
      if (b.expiresAt && toMs(b.expiresAt) <= nowMs) continue;
      if (!b.baseCountBonus) continue;
      buffBonus.ground += b.baseCountBonus.ground ?? 0;
      buffBonus.siege += b.baseCountBonus.siege ?? 0;
      buffBonus.air += b.baseCountBonus.air ?? 0;
    }
  }

  // Production-spell boost. Mirrors the cap formula's spell-bonus shape:
  // active production spells nudge BASE counts up by a fraction tied to the
  // caste's production-spell-type bonus. Implementation kept conservative —
  // a +5% per active spell, capped at +25%.
  let spellMult = 1;
  if (args.caste && args.productionSpellsActive && args.productionSpellsActive.length > 0) {
    const profile = getCasteProfile(args.caste);
    const productionBonus = profile.spellTypeBonuses.production ?? 1;
    // Count active spells (caller is expected to have filtered expired ones,
    // but defend against stale entries anyway).
    const activeCount = args.productionSpellsActive.length;
    spellMult = Math.min(1.25, 1 + 0.05 * activeCount * productionBonus);
  }

  // Per-tile building upgrades. The existing `buildingCapacityBonus` chain
  // doesn't tune base counts, so we just sum bonuses from buildings whose
  // definitions declare a baseUnitCountBonus when one is added in the
  // future. For now this is a no-op pass-through.
  // (left intentionally minimal; future BUILDINGS_BY_ID entries can add bonuses)

  const result: UnitStack = {
    ground: 0,
    siege: 0,
    air: 0,
  };
  for (const t of UNIT_TYPES) {
    const seedCount = seed[t];
    if (seedCount === 0 && buffBonus[t] === 0) {
      result[t] = 0;
      continue;
    }
    const casteFactor = casteMult ? casteMult[t] : 1;
    const raw =
      (seedCount * casteFactor + buffBonus[t]) *
      spellMult *
      (1 + entrenchment);
    result[t] = Math.max(0, Math.round(raw));
  }
  return result;
}

/**
 * Step the tile's BASE units toward its target. Returns the new baseUnits,
 * the updated baseRegenedAt timestamp, and the delta count so callers can
 * decide whether to write to Firestore. Caller is responsible for picking
 * regen rate from LAND_TYPE_BASE_REGEN_PER_HOUR.
 *
 * Regen distributes across unit types proportional to where BASE is most
 * under-target (so a tile that has air but no ground regenerates ground
 * first). Doesn't overshoot — clamps at target.
 */
export function applyBaseRegen(args: {
  currentBase: UnitStack;
  target: UnitStack;
  landType: LandType;
  baseRegenedAt: Date | { toMillis?: () => number; seconds?: number };
  now: Date;
}): { baseUnits: UnitStack; baseRegenedAt: Date; deltaUnits: number } {
  const rate = LAND_TYPE_BASE_REGEN_PER_HOUR[args.landType];
  const since = toMs(args.baseRegenedAt);
  const nowMs = args.now.getTime();
  const hours = Math.max(0, (nowMs - since) / (60 * 60 * 1000));
  if (rate <= 0 || hours <= 0) {
    return {
      baseUnits: { ...args.currentBase },
      baseRegenedAt: args.now,
      deltaUnits: 0,
    };
  }

  let toAdd = Math.floor(rate * hours);
  if (toAdd <= 0) {
    return {
      baseUnits: { ...args.currentBase },
      baseRegenedAt: args.now,
      deltaUnits: 0,
    };
  }

  // Compute per-type deficits. If everything is at target, no regen.
  const deficits: Record<UnitType, number> = {
    ground: Math.max(0, args.target.ground - args.currentBase.ground),
    siege: Math.max(0, args.target.siege - args.currentBase.siege),
    air: Math.max(0, args.target.air - args.currentBase.air),
  };
  const totalDeficit = deficits.ground + deficits.siege + deficits.air;
  if (totalDeficit === 0) {
    return {
      baseUnits: { ...args.currentBase },
      baseRegenedAt: args.now,
      deltaUnits: 0,
    };
  }
  toAdd = Math.min(toAdd, totalDeficit);

  // Distribute proportional to deficit; remainder goes to ground.
  const next: UnitStack = { ...args.currentBase };
  let addedSoFar = 0;
  for (const t of UNIT_TYPES) {
    if (deficits[t] === 0) continue;
    const share = Math.floor((deficits[t] / totalDeficit) * toAdd);
    const apply = Math.min(share, deficits[t]);
    next[t] += apply;
    addedSoFar += apply;
  }
  // Any rounding remainder — prioritize whichever type still has deficit.
  let remainder = toAdd - addedSoFar;
  if (remainder > 0) {
    for (const t of UNIT_TYPES) {
      if (remainder === 0) break;
      const stillDeficit = args.target[t] - next[t];
      if (stillDeficit <= 0) continue;
      const apply = Math.min(remainder, stillDeficit);
      next[t] += apply;
      remainder -= apply;
    }
  }

  return {
    baseUnits: next,
    baseRegenedAt: args.now,
    deltaUnits: toAdd,
  };
}

/**
 * Split incoming defender losses across SUPER (recruited) and BASE
 * (intrinsic). SUPER absorbs damage first — it's the deployed army taking
 * the front-line role. BASE only bleeds when SUPER is exhausted; its
 * effective HP is multiplied by BASE_DURABILITY_MULT because militia
 * defending entrenched positions takes less damage per unit.
 *
 * On capture, the standard curve does its work, but BASE additionally
 * survives at BASE_CAPTURE_RETENTION (default 25%) — the new owner inherits
 * a residual garrison that regenerates back up under their caste profile.
 */
export function attributeDefenderLosses(args: {
  superBefore: UnitStack;
  baseBefore: UnitStack;
  totalLosses: UnitStack;
  outcome: AttackOutcome;
  captureBaseRetentionFactor: number;
}): {
  superLost: UnitStack;
  baseLost: UnitStack;
  newSuper: UnitStack;
  newBase: UnitStack;
} {
  const superLost: UnitStack = { ground: 0, siege: 0, air: 0 };
  const baseLost: UnitStack = { ground: 0, siege: 0, air: 0 };

  for (const t of UNIT_TYPES) {
    const dmg = args.totalLosses[t];
    if (dmg <= 0) continue;
    const superAvail = args.superBefore[t];
    const fromSuper = Math.min(dmg, superAvail);
    superLost[t] = fromSuper;
    const overflow = dmg - fromSuper;
    if (overflow > 0) {
      // Overflow takes from BASE, but durability soaks part of it.
      const reducedOverflow = overflow / BASE_DURABILITY_MULT;
      baseLost[t] = Math.min(args.baseBefore[t], Math.round(reducedOverflow));
    }
  }

  const newSuper: UnitStack = {
    ground: Math.max(0, args.superBefore.ground - superLost.ground),
    siege: Math.max(0, args.superBefore.siege - superLost.siege),
    air: Math.max(0, args.superBefore.air - superLost.air),
  };
  let newBase: UnitStack = {
    ground: Math.max(0, args.baseBefore.ground - baseLost.ground),
    siege: Math.max(0, args.baseBefore.siege - baseLost.siege),
    air: Math.max(0, args.baseBefore.air - baseLost.air),
  };

  if (args.outcome === "captured") {
    // On capture, SUPER is wiped entirely (overrides the curve — losing the
    // tile means the deployed army is destroyed or captured), and BASE is
    // cut to the retention factor. The new owner inherits the residual.
    const wipedSuper: UnitStack = {
      ground: args.superBefore.ground,
      siege: args.superBefore.siege,
      air: args.superBefore.air,
    };
    const retention = Math.max(0, Math.min(1, args.captureBaseRetentionFactor));
    const retainedBase: UnitStack = {
      ground: Math.floor(args.baseBefore.ground * retention),
      siege: Math.floor(args.baseBefore.siege * retention),
      air: Math.floor(args.baseBefore.air * retention),
    };
    return {
      superLost: wipedSuper,
      baseLost: {
        ground: args.baseBefore.ground - retainedBase.ground,
        siege: args.baseBefore.siege - retainedBase.siege,
        air: args.baseBefore.air - retainedBase.air,
      },
      newSuper: { ground: 0, siege: 0, air: 0 },
      newBase: retainedBase,
    };
  }

  return { superLost, baseLost, newSuper, newBase };
}

/**
 * Split attacker losses across the SUPER and BASE units that were
 * conscripted into the attack. Apportions per-type proportional to what
 * was sent from each pool, so an attack drawing 80% from SUPER and 20%
 * from BASE distributes losses similarly.
 */
export function attributeAttackerLosses(args: {
  superSent: UnitStack;
  baseSent: UnitStack;
  totalLosses: UnitStack;
}): {
  superLost: UnitStack;
  baseLost: UnitStack;
} {
  const superLost: UnitStack = { ground: 0, siege: 0, air: 0 };
  const baseLost: UnitStack = { ground: 0, siege: 0, air: 0 };
  for (const t of UNIT_TYPES) {
    const lostT = args.totalLosses[t];
    if (lostT <= 0) continue;
    const superSentT = args.superSent[t];
    const baseSentT = args.baseSent[t];
    const totalSentT = superSentT + baseSentT;
    if (totalSentT === 0) continue;
    // Proportional split. Round SUPER first so any rounding error goes to
    // BASE (which is more elastic since it regenerates).
    const fromSuper = Math.min(
      superSentT,
      Math.round(lostT * (superSentT / totalSentT))
    );
    const fromBase = Math.min(baseSentT, lostT - fromSuper);
    superLost[t] = fromSuper;
    baseLost[t] = fromBase;
  }
  return { superLost, baseLost };
}

// Helper for callers that have a UnitStack and need to know whether it's
// empty — handy because pieces of code outside combat.ts will start needing
// to sum SUPER+BASE.
export function addStacks(a: UnitStack, b: UnitStack): UnitStack {
  return {
    ground: a.ground + b.ground,
    siege: a.siege + b.siege,
    air: a.air + b.air,
  };
}

export function computeTileCapacity(
  landType: LandType,
  caste: Caste | null,
  upgradeIds: readonly string[] = [],
  activeUpgrades: Record<string, string> = {}
): number {
  if (landType === "unrevealed" || landType === "unassigned") return 0;
  let cap = BASE_TILE_CAPACITY + LAND_TYPE_CAPACITY_DELTA[landType];
  const casteMult = caste ? getCasteProfile(caste).tileCapacityMultiplier : 1;
  cap = cap * casteMult;
  // Per-tile building entries (upgradeIds from the tile doc) — kept for v1
  // compatibility but currently empty in practice.
  for (const upgradeId of upgradeIds) {
    const b = BUILDINGS_BY_ID.get(upgradeId);
    if (b?.capacityBonus) cap += b.capacityBonus;
  }
  // Per-player building (the land type IS the building). Capacity bonus comes
  // entirely from the player's active upgrade for that building.
  if (caste && (landType === "military" || landType === "food" || landType === "magic")) {
    const buildingId = `${caste}-${landType}`;
    const b = BUILDINGS_BY_ID.get(buildingId);
    if (b) cap += buildingCapacityBonus(b, activeUpgrades);
  }
  return Math.max(0, Math.round(cap));
}

// Deterministic seeded PRNG (mulberry32, FNV-1a-seeded). Same seed → same sequence.
export function makeSeededRng(seed: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return function rng(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sumStack(s: UnitStack): number {
  return s.ground + s.siege + s.air;
}

function emptyStack(): UnitStack {
  return { ground: 0, siege: 0, air: 0 };
}

function clampStackToCapacity(
  stack: UnitStack,
  maxTotal: number
): { clamped: UnitStack; dropped: number } {
  const total = sumStack(stack);
  if (total <= maxTotal) return { clamped: { ...stack }, dropped: 0 };
  if (maxTotal <= 0) return { clamped: emptyStack(), dropped: total };
  const factor = maxTotal / total;
  const clamped: UnitStack = {
    ground: Math.floor(stack.ground * factor),
    siege: Math.floor(stack.siege * factor),
    air: Math.floor(stack.air * factor),
  };
  return { clamped, dropped: total - sumStack(clamped) };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (n >= 1) return 1;
  return n;
}

function applyLossFraction(units: UnitStack, fraction: number): UnitStack {
  const f = Math.min(1, Math.max(0, fraction));
  return {
    ground: Math.min(units.ground, Math.floor(units.ground * f)),
    siege: Math.min(units.siege, Math.floor(units.siege * f)),
    air: Math.min(units.air, Math.floor(units.air * f)),
  };
}

// One-sided power computation. mode = "attack" pulls each unit's `attack` stat;
// "defense" pulls `defense`. RPS multipliers are computed from the *opposing*
// stack's composition.
function compositionPower(
  ownUnits: UnitStack,
  ownCaste: Caste,
  opposingUnits: UnitStack,
  mode: "attack" | "defense",
  activeUpgrades: Record<string, string> = {}
): number {
  const profile = getCasteProfile(ownCaste);
  const opposingTotal = sumStack(opposingUnits);
  let total = 0;
  for (const t of UNIT_TYPES) {
    if (ownUnits[t] === 0) continue;
    const def = getUnitForCasteAndType(ownCaste, t);
    const stats = effectiveUnitStats(def, activeUpgrades);
    const stat = mode === "attack" ? stats.attack : stats.defense;
    let rpsMult = 1;
    if (opposingTotal > 0) {
      const beatenShare = opposingUnits[RPS_BEATS[t]] / opposingTotal;
      const beatsShare = opposingUnits[RPS_LOSES_TO[t]] / opposingTotal;
      rpsMult = 1 + 0.5 * beatenShare - 0.25 * beatsShare;
      if (rpsMult < 0.5) rpsMult = 0.5;
    }
    total += ownUnits[t] * stat * profile.unitTypeBonuses[t] * rpsMult;
  }
  return total;
}

// Forge Scouts (Red air-intel passive): +5% offense when attacker air ≥
// defender air. Stacks multiplicatively with offense spell contribution.
const FORGE_SCOUTS_BONUS = 0.05;

// Defender's heaviest unit type → attacker's best counter under the
// air→ground→siege→air rock-paper-scissors. Mirrors lib/game/intel.ts.
const RPS_COUNTERS: Record<UnitType, UnitType> = {
  ground: "air",
  siege: "ground",
  air: "siege",
};

function findActiveAirIntelPassive(
  attackerCaste: Caste,
  attackerUpgrades: Record<string, string>
): AirIntelPassive | null {
  const airTargetId = `${attackerCaste}-air-`;
  for (const [targetId, upgradeId] of Object.entries(attackerUpgrades)) {
    if (!targetId.startsWith(airTargetId)) continue;
    const def = UPGRADES_BY_ID.get(upgradeId);
    if (def?.intelPassive) return def.intelPassive;
  }
  return null;
}

function pickWeakFaceFromUnits(units: UnitStack): UnitType | undefined {
  let max = 0;
  let dominant: UnitType | undefined;
  for (const t of UNIT_TYPES) {
    if (units[t] > max) {
      max = units[t];
      dominant = t;
    }
  }
  return dominant ? RPS_COUNTERS[dominant] : undefined;
}

// Defensive supply multiplier from friendly neighbors. Empty array → -15% floor.
// Caste profile decides how aggressively neighbor weight stacks: Green 1.5×,
// Blue 0.75×, etc.
export function computeSupplyMultiplier(
  caste: Caste,
  friendlyNeighbors: ReadonlyArray<{ landType: LandType }>
): number {
  if (friendlyNeighbors.length === 0) return SUPPLY_ISOLATION_FLOOR;
  let typeWeight = 0;
  for (const n of friendlyNeighbors) {
    typeWeight += SUPPLY_TYPE_WEIGHTS[n.landType] ?? 0;
  }
  const rawSupply = SUPPLY_PER_WEIGHT * typeWeight;
  const casteBonus = getCasteProfile(caste).supplyMultiplier;
  const supplyMult = 1.0 + rawSupply * casteBonus;
  return Math.min(SUPPLY_MAX, Math.max(SUPPLY_ISOLATION_FLOOR, supplyMult));
}

function spellContribution(
  spellId: string | null,
  expectedType: "offense" | "defense",
  casterCaste: Caste,
  casterMagicLands: number,
  casterActiveUpgrades: Record<string, string> = {}
): number {
  if (!spellId) return 0;
  const spell = SPELLS_BY_ID.get(spellId);
  if (!spell || spell.type !== expectedType) return 0;
  const profile = getCasteProfile(casterCaste);
  const casteBonus = profile.spellTypeBonuses[expectedType];
  return (
    spell.baseStrength *
    magicMultiplier(casterMagicLands, casterActiveUpgrades) *
    casteBonus
  );
}

export function resolveAttack(
  attacker: CombatAttackerInput,
  defender: CombatDefenderInput,
  tile: CombatTileInput,
  rng: () => number
): CombatResult {
  const defenderTotalOnTile = sumStack(defender.unitsOnTile);
  const availableSpace = Math.max(0, tile.capacity - defenderTotalOnTile);
  const { clamped: deployed, dropped } = clampStackToCapacity(
    attacker.units,
    availableSpace
  );

  const appliedSpells = {
    offenseId: attacker.offenseSpellId,
    defenseId: defender.armedDefenseSpellId,
  };

  if (sumStack(deployed) === 0) {
    return {
      outcome: "repelled",
      unitsDeployed: deployed,
      unitsClampedFromCapacity: dropped,
      attackPower: 0,
      defensePower: 0,
      attackerLosses: emptyStack(),
      defenderLosses: emptyStack(),
      underdogApplied: false,
      supplyMultiplier: 1,
      sourceLandTypeMultiplier: 1,
      targetLandTypeMultiplier: 1,
      standingDefenseAdded: 0,
      magicTileOffenseSpellBonusApplied: false,
      magicTileDefenseSpellBonusApplied: false,
      siegeDebuffApplied: 0,
      defenseDisarmApplied: 0,
      preCastOffenseApplied: 0,
      rng: { attackerRoll: 0, defenderRoll: 0 },
      appliedSpells,
      // BASE+SUPER fields — trivial repel, no force engaged.
      finalAttack: 0,
      finalDefense: 0,
      defenderUnitsPreAttack: { ...defender.unitsOnTile },
      defenderBasePreAttack:
        defender.baseUnitsOnTile ?? { ground: 0, siege: 0, air: 0 },
      decisiveness: 1,
      lossCurveTag: "decisive-repel",
      captureBaseRetentionFactor: 1,
    };
  }

  const attackerUpgrades = attacker.activeUpgrades ?? {};
  const defenderUpgrades = defender.activeUpgrades ?? {};

  const airIntelPassive = findActiveAirIntelPassive(
    attacker.caste,
    attackerUpgrades
  );

  let attackPower = compositionPower(
    deployed,
    attacker.caste,
    defender.unitsOnTile,
    "attack",
    attackerUpgrades
  );
  let defensePower = compositionPower(
    defender.unitsOnTile,
    defender.caste,
    deployed,
    "defense",
    defenderUpgrades
  );

  // Offense spell contribution. If the source tile is a magic tile, scale
  // the spell by MAGIC_TILE_SPELL_MULT — magic tiles are bastions for
  // spellcraft. Stacks multiplicatively with magicMultiplier(magicLandCount).
  const offenseSpellRaw = spellContribution(
    attacker.offenseSpellId,
    "offense",
    attacker.caste,
    attacker.magicLandCount,
    attackerUpgrades
  );
  const magicOffenseBonusApplied =
    offenseSpellRaw > 0 && attacker.sourceLandType === "magic";
  attackPower +=
    magicOffenseBonusApplied
      ? offenseSpellRaw * MAGIC_TILE_SPELL_MULT
      : offenseSpellRaw;

  // Red Forge Scouts: +5% offense when attacker air ≥ defender air.
  let forgeScoutsBonusApplied = false;
  if (
    airIntelPassive === "red-forge-scouts" &&
    deployed.air >= defender.unitsOnTile.air
  ) {
    attackPower *= 1 + FORGE_SCOUTS_BONUS;
    forgeScoutsBonusApplied = true;
  }

  // Active intel effects (Red Forge Sight spell adds an offense bonus
  // pre-resolved by the caller and passed in as a number).
  if (attacker.intelOffenseBonus && attacker.intelOffenseBonus > 0) {
    attackPower *= 1 + attacker.intelOffenseBonus;
  }

  // Hero attack bonus (May 2026 Heroes feature). Pre-resolved by the
  // server: stamina-scaled, specialty-weighted, and includes any stationed
  // special-unit attackBonus contribution rolled into the same channel.
  // Stacks multiplicatively at the same stage as `intelOffenseBonus`.
  if (attacker.heroAttackBonus && attacker.heroAttackBonus > 0) {
    attackPower *= 1 + attacker.heroAttackBonus;
  }

  // Oathbreaker penalty (zero-turn gameplay: enforced pacts). Applied
  // multiplicatively as a reduction. Pre-resolved by the server: a value
  // > 0 means the attacker has an active oathbreaker mark from breaking
  // a pact within the OATHBREAKER_DURATION_MS window.
  if (attacker.oathbreakerPenalty && attacker.oathbreakerPenalty > 0) {
    attackPower *= 1 - Math.min(1, attacker.oathbreakerPenalty);
  }

  // Source-tile attack multiplier (military ×1.20, food ×0.75). Applied
  // after spell + intel offense bonuses so the multiplier scales the full
  // realized attack value the way a player would expect ("my army is
  // marching from a fortress" / "from a hayfield").
  const sourceLandType = attacker.sourceLandType;
  const sourceLandTypeMult =
    sourceLandType !== undefined ? LAND_TYPE_ATTACK_MULT[sourceLandType] : 1;
  attackPower *= sourceLandTypeMult;

  // Pre-cast offense bonus (May 2026 sim feature). Added flat AFTER the
  // source-tile mult — the spell was cast and rolled at its own moment from
  // its own tile, so it shouldn't be re-amplified by THIS attack's source.
  const preCastOffenseApplied = Math.max(0, attacker.preCastOffenseBonus ?? 0);
  attackPower += preCastOffenseApplied;

  // Defense spell contribution, with the same magic-tile amplifier as
  // offense — armed on a magic tile, the warding doubles down. Then apply
  // any active disarm (a fraction in [0,1] zeroes out the contribution
  // proportionally; 1 fully nullifies).
  const defenseSpellRawUnreduced = spellContribution(
    defender.armedDefenseSpellId,
    "defense",
    defender.caste,
    defender.magicLandCount,
    defenderUpgrades
  );
  const disarmFraction = clamp01(defender.defenseDisarmFraction ?? 0);
  const defenseDisarmApplied = defenseSpellRawUnreduced > 0 ? disarmFraction : 0;
  const defenseSpellRaw = defenseSpellRawUnreduced * (1 - disarmFraction);
  const magicDefenseBonusApplied =
    defenseSpellRaw > 0 && tile.landType === "magic";
  defensePower +=
    magicDefenseBonusApplied
      ? defenseSpellRaw * MAGIC_TILE_SPELL_MULT
      : defenseSpellRaw;

  // Supply: scale defense by how cohesive the defender's territory is around
  // this tile. Skipped when callers don't supply neighbor info (legacy/tests).
  let supplyMult = 1;
  if (tile.friendlyNeighbors !== undefined) {
    supplyMult = computeSupplyMultiplier(defender.caste, tile.friendlyNeighbors);
    defensePower *= supplyMult;
  }

  // Alert-vs-caster intel effects (Black Vein of Truth, Green Root Whisper).
  if (defender.intelDefenseBonus && defender.intelDefenseBonus > 0) {
    defensePower *= 1 + defender.intelDefenseBonus;
  }

  // Hero defense bonus (May 2026 Heroes feature). Same stage as
  // `intelDefenseBonus`; pre-resolved by the server with stamina + specialty
  // weighting and stationed special-unit defenseBonus folded in.
  if (defender.heroDefenseBonus && defender.heroDefenseBonus > 0) {
    defensePower *= 1 + defender.heroDefenseBonus;
  }

  // Zero-turn defense bonus (defensive stance + last stand, minus any
  // adjacent-rally penalty). Pre-resolved by the server. A positive value
  // is a bonus; a negative value (e.g. rally pulling reserves) is a
  // penalty. Applied multiplicatively at the same stage as the hero
  // defense bonus.
  if (defender.zeroTurnDefenseBonus && defender.zeroTurnDefenseBonus !== 0) {
    const multiplier = Math.max(0, 1 + defender.zeroTurnDefenseBonus);
    defensePower *= multiplier;
  }

  let underdogApplied = false;
  if (
    defenderTotalOnTile > 0 &&
    attacker.unitsAlive > 0 &&
    defender.unitsAlive < UNDERDOG_SIZE_RATIO * attacker.unitsAlive
  ) {
    defensePower *= 1 + UNDERDOG_DEFENSE_BONUS;
    underdogApplied = true;
  }

  // Defender-tile defense multiplier (military/magic ×1.25). Applied last
  // among the multiplicative scalers so it stacks predictably on top of
  // supply, intel alerts, and underdog.
  const targetLandType = tile.landType;
  const targetLandTypeMult =
    targetLandType !== undefined ? LAND_TYPE_DEFENSE_MULT[targetLandType] : 1;
  defensePower *= targetLandTypeMult;

  // Standing defense floor: a land-type-dependent fraction of the
  // (already-modified) attack power that adds to defense even when the
  // tile holds no units. Lets military and magic tiles "garrison
  // themselves." Computed AFTER the source-tile attack multiplier so the
  // floor scales with the realized incoming threat.
  //
  // Pre-attack siege debuffs subtract from the fraction (clamped at 0).
  // Caller is expected to clamp the cumulative siege magnitude to
  // SIEGE_DEBUFF_MAX_MAGNITUDE before passing it in.
  const baseStandingFraction =
    targetLandType !== undefined
      ? STANDING_DEFENSE_FRACTION[targetLandType]
      : 0;
  const siegeDebuffApplied = Math.max(0, tile.siegeDebuffMagnitude ?? 0);
  const standingDefenseFraction = Math.max(
    0,
    baseStandingFraction - siegeDebuffApplied
  );
  const standingDefenseAdded = attackPower * standingDefenseFraction;
  defensePower += standingDefenseAdded;

  const attackerRoll = RNG_LOWER + rng() * RNG_RANGE;
  const defenderRoll = RNG_LOWER + rng() * RNG_RANGE;
  const finalAttack = attackPower * attackerRoll;
  const finalDefense = defensePower * defenderRoll;

  // Closeness band: when finalAttack and finalDefense are within
  // ±STALEMATE_BAND of each other, the engagement is a stalemate — both
  // sides bleed, tile stays with defender. Replaces the dead `===` branch
  // that never fired with floats + RNG.
  const ratio = finalDefense > 0 ? finalAttack / finalDefense : Infinity;
  const closeness = Math.abs(ratio - 1);
  let outcome: AttackOutcome;
  if (closeness < STALEMATE_BAND) {
    outcome = "stalemate";
  } else if (ratio > 1) {
    outcome = "captured";
  } else {
    outcome = "repelled";
  }

  // Decisiveness in log2 of ratio — symmetric scale where ±1 is a 2× edge,
  // ±2 is a 4× edge. Drives the loss curves below and the BattleReport
  // "Decisive / Close / Pyrrhic" label.
  const d = ratio === 0 ? -Infinity : ratio === Infinity ? Infinity : Math.log2(ratio);

  // Decisiveness-keyed loss fractions. Replaces the symmetric
  // `lossFrac = opposingPower / ownHp` which produced near-total wipes on
  // any imbalance. The curves smooth toward "decisive winner loses ~5–15%,
  // decisive loser loses 90–95%; close fights split losses more evenly."
  let attackerLossFrac: number;
  let defenderLossFrac: number;
  let lossCurveTag: LossCurveTag;
  if (outcome === "stalemate") {
    attackerLossFrac = 0.5;
    defenderLossFrac = 0.4;
    lossCurveTag = "stalemate";
  } else if (outcome === "captured") {
    // d > 0. Saturated forms keep the high-end clamps reasonable.
    attackerLossFrac = clamp01(0.5 - 0.2 * d);
    defenderLossFrac = clamp01(0.65 + 0.15 * d);
    lossCurveTag = d >= 1 ? "decisive-capture" : "close-capture";
  } else {
    // outcome === "repelled". d < 0; flip sign to compute magnitudes.
    const magnitude = -d;
    attackerLossFrac = clamp01(0.6 + 0.2 * magnitude);
    defenderLossFrac = clamp01(0.3 - 0.15 * magnitude);
    lossCurveTag = magnitude >= 1 ? "decisive-repel" : "close-repel";
  }
  // Floor non-zero losses so a "close" outcome doesn't collapse to zero
  // through rounding.
  if (outcome === "captured" && attackerLossFrac < 0.05) attackerLossFrac = 0.05;
  if (outcome === "repelled" && defenderLossFrac > 0 && defenderLossFrac < 0.05)
    defenderLossFrac = 0.05;

  const attackerLosses = applyLossFraction(deployed, attackerLossFrac);
  const defenderLosses = applyLossFraction(
    defender.unitsOnTile,
    defenderLossFrac
  );
  // Note: the prior "capture wipes all defenders" override is intentionally
  // gone. Loss attribution + SUPER-wipe semantics are now a server concern
  // (see attributeDefenderLosses); this function returns the raw
  // curve-based losses for the composite stack.

  let airIntel: CombatResult["airIntel"];
  if (airIntelPassive) {
    airIntel = { sourcePassive: airIntelPassive };
    if (airIntelPassive === "white-hawks-eye" && deployed.air >= 1) {
      const tier = defenderSpellTier(defender.armedDefenseSpellId);
      if (tier !== null) airIntel.defenseSpellTier = tier;
    }
    if (airIntelPassive === "red-forge-scouts") {
      airIntel.forgeScoutsBonusApplied = forgeScoutsBonusApplied;
      if (deployed.air >= defender.unitsOnTile.air) {
        const wf = pickWeakFaceFromUnits(defender.unitsOnTile);
        if (wf) airIntel.weakFace = wf;
      }
    }
    // blue-sky-reader, black-crowfeast, green-crow-network: their reveals
    // need state outside the combat function (neighbor tile data, recruit
    // queue, kingdom-wide visibility) — surfaced by the attack server when
    // it stitches the post-resolve report.
  }

  // Surface the closeness for the BattleReport "Decisive / Close / Pyrrhic"
  // label. BASE retention only kicks in on capture; otherwise leave at 1
  // (the curve-based defender losses do the work for non-captures).
  const decisiveness = closeness;
  const captureBaseRetentionFactor =
    outcome === "captured" ? BASE_CAPTURE_RETENTION : 1;

  return {
    outcome,
    unitsDeployed: deployed,
    unitsClampedFromCapacity: dropped,
    attackPower,
    defensePower,
    attackerLosses,
    defenderLosses,
    underdogApplied,
    supplyMultiplier: supplyMult,
    sourceLandTypeMultiplier: sourceLandTypeMult,
    targetLandTypeMultiplier: targetLandTypeMult,
    standingDefenseAdded,
    magicTileOffenseSpellBonusApplied: magicOffenseBonusApplied,
    magicTileDefenseSpellBonusApplied: magicDefenseBonusApplied,
    siegeDebuffApplied,
    defenseDisarmApplied,
    preCastOffenseApplied,
    rng: { attackerRoll, defenderRoll },
    appliedSpells,
    finalAttack,
    finalDefense,
    defenderUnitsPreAttack: { ...defender.unitsOnTile },
    defenderBasePreAttack:
      defender.baseUnitsOnTile ?? { ground: 0, siege: 0, air: 0 },
    decisiveness,
    lossCurveTag,
    captureBaseRetentionFactor,
    ...(airIntel ? { airIntel } : {}),
  };
}

function defenderSpellTier(spellId: string | null): SpellTier | null {
  if (!spellId) return null;
  const spell = SPELLS_BY_ID.get(spellId);
  return spell ? spell.tier : null;
}
