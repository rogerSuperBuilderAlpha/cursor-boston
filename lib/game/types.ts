/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { Timestamp } from "firebase/firestore";

export type Caste = "black" | "red" | "white" | "green" | "blue";

export type UnitType = "ground" | "siege" | "air";

export type SpellType = "defense" | "offense" | "production";

export type LandType = "unrevealed" | "unassigned" | "military" | "food" | "magic";

export type Phase = "explore" | "distribute" | "caste" | "play";

export type AttackOutcome = "captured" | "repelled" | "stalemate";

export interface UnitDefinition {
  id: string;
  caste: Caste;
  type: UnitType;
  name: string;
  attack: number;
  defense: number;
  hp: number;
  description: string;
}

export interface SpellDefinition {
  id: string;
  caste: Caste;
  type: SpellType;
  name: string;
  // Flat power applied to attacker (offense) or defender (defense) combat totals,
  // or to the unit-cap / magic-multiplier for production. Multiplied at runtime by
  // (caster's magic-land soft-cap) × (caster's caste spellTypeBonus).
  baseStrength: number;
  description: string;
}

export interface BuildingDefinition {
  id: string;
  caste: Caste | "neutral";
  name: string;
  description: string;
  capacityBonus?: number;
  unitTypeAffinity?: { type: UnitType; multiplier: number };
}

export interface CasteProfile {
  caste: Caste;
  tileCapacityMultiplier: number;
  unitTypeBonuses: Record<UnitType, number>;
  spellTypeBonuses: Record<SpellType, number>;
}

export interface UnitStack {
  ground: number;
  siege: number;
  air: number;
}

export interface ActiveProductionSpell {
  spellId: string;
  expiresAtTurn: number;
}

export interface PlayerStats {
  attacksWon: number;
  attacksLost: number;
  tilesHeld: number;
  unitsAlive: number;
}

export interface GamePlayer {
  userId: string;
  caste: Caste | null;
  casteLockedAt?: Timestamp | Date;
  turnsRemaining: number;
  turnsSpentTotal: number;
  phase: Phase;
  tilesExplored: number;
  shieldUntil: Timestamp | Date;
  shieldDropAtTurn: number;
  lastWeeklyGrantAt?: Timestamp | Date;
  // ISO date (yyyy-mm-dd) of the Sunday whose grant produced the current
  // turnsRemaining bucket. Used to make rollover idempotent.
  lastWeeklyGrantWeekStart?: string;
  productionSpellsActive: ActiveProductionSpell[];
  stats: PlayerStats;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

export interface GameTile {
  tileId: string;
  q: number;
  r: number;
  ownerId: string | null;
  type: LandType;
  level: number;
  units: UnitStack;
  armedDefenseSpellId: string | null;
  neighborTileIds: string[];
  upgradeIds: string[];
  lastAttackedAt?: Timestamp | Date;
  revealedAt?: Timestamp | Date;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

export interface GameAttack {
  id?: string;
  attackerId: string;
  defenderId: string;
  targetTileId: string;
  sourceTileIds: string[];
  unitsSent: UnitStack;
  unitsLostAttacker: UnitStack;
  unitsLostDefender: UnitStack;
  offenseSpellId: string | null;
  defenseSpellId: string | null;
  casteAttacker: Caste;
  casteDefender: Caste;
  rngSeed: string;
  outcome: AttackOutcome;
  turnsCost: number;
  createdAt: Timestamp | Date;
}

export interface CombatAttackerInput {
  caste: Caste;
  units: UnitStack;
  offenseSpellId: string | null;
  magicLandCount: number;
  unitsAlive: number;
}

export interface CombatDefenderInput {
  caste: Caste;
  unitsOnTile: UnitStack;
  armedDefenseSpellId: string | null;
  magicLandCount: number;
  unitsAlive: number;
}

export interface CombatTileInput {
  capacity: number;
  upgradeIds: string[];
}

export interface CombatResult {
  outcome: AttackOutcome;
  unitsDeployed: UnitStack;
  unitsClampedFromCapacity: number;
  attackPower: number;
  defensePower: number;
  attackerLosses: UnitStack;
  defenderLosses: UnitStack;
  underdogApplied: boolean;
  rng: { attackerRoll: number; defenderRoll: number };
  appliedSpells: { offenseId: string | null; defenseId: string | null };
}
