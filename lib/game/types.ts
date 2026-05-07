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

export type SpellTier = 1 | 2 | 3 | 4 | 5;

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
  // Tiered access: tier 1 is always castable; higher tiers gate by territory size.
  tier: SpellTier;
  // Minimum tiles held required to cast/arm this spell (0 for tier 1).
  minTilesRequired: number;
  // Turn cost to cast or arm. Tier 1 spells cost 5; higher tiers cost more.
  turnCost: number;
}

export interface BuildingDefinition {
  id: string;
  caste: Caste | "neutral";
  // Which land type this building represents. The land type IS the building —
  // a "military" tile is the per-caste military building.
  landType: LandType;
  name: string;
  description: string;
  capacityBonus?: number;
  unitTypeAffinity?: { type: UnitType; multiplier: number };
}

// ──── v2: Unit & building upgrades ────

export type UpgradeTargetKind = "unit" | "building";

export interface UpgradeEffects {
  // Flat deltas applied on top of the base unit/building.
  attackDelta?: number;
  defenseDelta?: number;
  hpDelta?: number;
  capacityBonusDelta?: number;
  // Multiplicative magic-multiplier bonus for the player when this building
  // upgrade is active on any tile they own (rare; e.g. magic-tower upgrades).
  magicMultiplierDelta?: number;
}

export interface UpgradeDefinition {
  id: string;
  caste: Caste;
  targetKind: UpgradeTargetKind;
  // Unit id (e.g. "white-ground-pikeman") or building id ("white-military").
  targetId: string;
  name: string;
  description: string;
  effects: UpgradeEffects;
  // 1..3 — purely informational; used by UI to label the three options as
  // Offensive / Defensive / Utility, but not enforced by content rules.
  optionIndex: 1 | 2 | 3;
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
  // The name the player picked for their general. Empty string for legacy
  // players who spawned before names were required — the dashboard forces
  // them through the picker on next visit.
  displayName: string;
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
  // Map from upgrade target id (unit id or building id) → active upgrade id.
  // Only one upgrade per target is active at a time. Optional on the type so
  // legacy player docs without the field still parse; readers must coalesce
  // to {} via getActiveUpgrades(player) before use.
  activeUpgrades?: Record<string, string>;
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

// Lightweight projection of GameTile for map-fetch payloads. Strips
// neighborTileIds (~6 strings × N tiles), upgradeIds, level, and timestamps
// — fields the dashboard/hex-map/recruit/spells pages don't use. Tile detail
// page still fetches the full GameTile via /api/game/tile/[tileId].
export interface MapTile {
  tileId: string;
  q: number;
  r: number;
  type: LandType;
  ownerId: string | null;
  units: UnitStack;
  armedDefenseSpellId: string | null;
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
  // Player's active upgrades (target id → upgrade id). Optional for legacy
  // call sites; resolveAttack coalesces to {} if absent.
  activeUpgrades?: Record<string, string>;
}

export interface CombatDefenderInput {
  caste: Caste;
  unitsOnTile: UnitStack;
  armedDefenseSpellId: string | null;
  magicLandCount: number;
  unitsAlive: number;
  activeUpgrades?: Record<string, string>;
}

export interface CombatTileInput {
  capacity: number;
  upgradeIds: string[];
}

// ──── v2: Artifacts (single-use, caste-agnostic, found on turn-spend) ────

export type ArtifactRarity = "common" | "rare" | "epic" | "legendary";

export type ArtifactType = "offense" | "defense" | "production" | "utility";

export interface ArtifactDefinition {
  id: string;
  name: string;
  rarity: ArtifactRarity;
  type: ArtifactType;
  // Strength applied when the artifact is used. Larger than caste spell
  // baseStrength on average — these are supposed to be lucky breaks.
  baseStrength: number;
  description: string;
  // One-line narrative when found and when used. Used by turn-report builders
  // to produce flavor text without needing a separate lookup.
  flavorOnFind: string;
}

export interface GameArtifact {
  id: string; // instance id (uuid)
  ownerId: string;
  definitionId: string;
  rarity: ArtifactRarity;
  type: ArtifactType;
  foundAtTurn: number;
  foundDuringAction: string; // "explore" | "build" | "spell-arm" | etc.
  used: boolean;
  usedAtTurn?: number;
  usedOnTileId?: string;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

// ──── v2: Turn reports ────

export type TurnAction =
  | "explore"
  | "build"
  | "distribute"
  | "spell-arm"
  | "spell-produce"
  | "attack";

export interface TurnReport {
  // The player.turnsSpentTotal at the time this report was generated.
  turnIndex: number;
  action: TurnAction;
  // How many turns this single report represents (1 for most actions; up to
  // 6 for an attack that included an offense spell).
  cost: number;
  // One-line headline for the action.
  summary: string;
  // 1–4 lines of prose narrative.
  narrative: string[];
  // Structured outcome payload — interpreted by UI as needed.
  outcome: Record<string, unknown>;
  // Set when the player rolled an artifact this turn.
  artifactFound?: {
    definitionId: string;
    name: string;
    rarity: ArtifactRarity;
    type: ArtifactType;
  };
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
