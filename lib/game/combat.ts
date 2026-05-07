/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import {
  BUILDINGS_BY_ID,
  SPELLS_BY_ID,
  getCasteProfile,
  getUnitForCasteAndType,
} from "./content";
import {
  buildingCapacityBonus,
  effectiveUnitStats,
  magicMultiplierBonusFromUpgrades,
} from "./upgrades";
import type {
  AttackOutcome,
  Caste,
  CombatAttackerInput,
  CombatDefenderInput,
  CombatResult,
  CombatTileInput,
  LandType,
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

const UNDERDOG_SIZE_RATIO = 0.5;
const UNDERDOG_DEFENSE_BONUS = 0.25;
const RNG_LOWER = 0.9;
const RNG_RANGE = 0.2;

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
      rng: { attackerRoll: 0, defenderRoll: 0 },
      appliedSpells,
    };
  }

  const attackerUpgrades = attacker.activeUpgrades ?? {};
  const defenderUpgrades = defender.activeUpgrades ?? {};

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

  attackPower += spellContribution(
    attacker.offenseSpellId,
    "offense",
    attacker.caste,
    attacker.magicLandCount,
    attackerUpgrades
  );
  defensePower += spellContribution(
    defender.armedDefenseSpellId,
    "defense",
    defender.caste,
    defender.magicLandCount,
    defenderUpgrades
  );

  let underdogApplied = false;
  if (
    defenderTotalOnTile > 0 &&
    attacker.unitsAlive > 0 &&
    defender.unitsAlive < UNDERDOG_SIZE_RATIO * attacker.unitsAlive
  ) {
    defensePower *= 1 + UNDERDOG_DEFENSE_BONUS;
    underdogApplied = true;
  }

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

  return {
    outcome,
    unitsDeployed: deployed,
    unitsClampedFromCapacity: dropped,
    attackPower,
    defensePower,
    attackerLosses,
    defenderLosses,
    underdogApplied,
    rng: { attackerRoll, defenderRoll },
    appliedSpells,
  };
}
