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
  AirIntelPassive,
  AttackOutcome,
  Caste,
  CombatAttackerInput,
  CombatDefenderInput,
  CombatResult,
  CombatTileInput,
  LandType,
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

function totalHpForStack(
  units: UnitStack,
  caste: Caste,
  activeUpgrades: Record<string, string> = {}
): number {
  const profile = getCasteProfile(caste);
  let total = 0;
  for (const t of UNIT_TYPES) {
    const def = getUnitForCasteAndType(caste, t);
    const stats = effectiveUnitStats(def, activeUpgrades);
    total += units[t] * stats.hp * profile.unitTypeBonuses[t];
  }
  return total;
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

  let outcome: AttackOutcome;
  if (finalAttack > finalDefense) outcome = "captured";
  else if (finalDefense > finalAttack) outcome = "repelled";
  else outcome = "stalemate";

  const attackerHp = totalHpForStack(deployed, attacker.caste, attackerUpgrades);
  const defenderHp = totalHpForStack(
    defender.unitsOnTile,
    defender.caste,
    defenderUpgrades
  );
  const attackerLossFrac = attackerHp > 0 ? finalDefense / attackerHp : 0;
  const defenderLossFrac = defenderHp > 0 ? finalAttack / defenderHp : 0;

  let attackerLosses = applyLossFraction(deployed, attackerLossFrac);
  let defenderLosses =
    outcome === "captured"
      ? { ...defender.unitsOnTile }
      : applyLossFraction(defender.unitsOnTile, defenderLossFrac);

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
    ...(airIntel ? { airIntel } : {}),
  };
}

function defenderSpellTier(spellId: string | null): SpellTier | null {
  if (!spellId) return null;
  const spell = SPELLS_BY_ID.get(spellId);
  return spell ? spell.tier : null;
}
