/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { Timestamp } from "firebase/firestore";

export type Caste = "black" | "red" | "white" | "green" | "blue";

export type UnitType = "ground" | "siege" | "air";

export type SpellType = "defense" | "offense" | "production" | "intel";

// Reveal scope for intel-type artifacts and spells. Used by both
// SpellDefinition.intelScope and ArtifactDefinition.intelDepth (the latter
// is a strict subset). "kingdom+supply" is Green's Root Whisper exclusive
// (returns the supply graph); "weak-face" is Red's Forge Sight exclusive.
export type IntelSpellScope =
  | "tile"
  | "ring"
  | "kingdom"
  | "kingdom+supply"
  | "weak-face";

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
  // Ignored for intel spells.
  baseStrength: number;
  description: string;
  // Tiered access: tier 1 is always castable; higher tiers gate by territory size.
  tier: SpellTier;
  // Minimum tiles held required to cast/arm this spell (0 for tier 1).
  minTilesRequired: number;
  // Turn cost to cast or arm. Tier 1 spells cost 5; higher tiers cost more.
  turnCost: number;
  // For type === "intel": which reveal scope the spy spell delivers.
  intelScope?: IntelSpellScope;
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

// One of the named air-unit "intel" passives. Only meaningful when set on an
// air-unit upgrade with optionIndex === 4. Each value names a specific
// caste-flavored scouting behavior, surfaced during the player's own attacks.
export type AirIntelPassive =
  | "white-hawks-eye"
  | "blue-sky-reader"
  | "black-crowfeast"
  | "red-forge-scouts"
  | "green-crow-network";

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
  // Air units have a 4th "Intel" option that delivers a passive scouting
  // benefit instead of a stat tweak.
  optionIndex: 1 | 2 | 3 | 4;
  // Set on the optionIndex-4 air-unit upgrades only; identifies which
  // caste-flavored intel passive this upgrade provides.
  intelPassive?: AirIntelPassive;
}

export interface CasteProfile {
  caste: Caste;
  tileCapacityMultiplier: number;
  unitTypeBonuses: Record<UnitType, number>;
  spellTypeBonuses: Record<SpellType, number>;
  // How strongly this caste benefits from clustering. Multiplied against the
  // raw supply contribution (sum of friendly-neighbor type weights × 5%) before
  // it stacks on top of base defense. Green/White lean concentrated; Blue/Black
  // are comfortable spread.
  supplyMultiplier: number;
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
  // True when this tile was placed via Far Expedition adjacent to an enemy.
  // Cleared the first time the tile gains a friendly neighbor (i.e. it's no
  // longer truly isolated). Used by the UI to flag at-risk forward-operating
  // tiles; combat math reads supply directly from neighbor state, not this
  // flag.
  isolatedSpawn?: boolean;
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
  // Pre-resolved additive offense multiplier from active intel effects (e.g.
  // Red Forge Sight = +0.10 against the targeted tile). Stacks
  // multiplicatively on attackPower after spell contribution.
  intelOffenseBonus?: number;
}

export interface CombatDefenderInput {
  caste: Caste;
  unitsOnTile: UnitStack;
  armedDefenseSpellId: string | null;
  magicLandCount: number;
  unitsAlive: number;
  activeUpgrades?: Record<string, string>;
  // Pre-resolved additive defense multiplier from active alert-vs-caster
  // intel effects (Black Vein of Truth = +0.20, Green Root Whisper = +0.10
  // against the specific attacker). Stacks multiplicatively on defensePower
  // after supply.
  intelDefenseBonus?: number;
}

export interface CombatTileInput {
  capacity: number;
  upgradeIds: string[];
  // Land types of defender-owned tiles adjacent to this tile (excludes
  // unrevealed/unassigned — those are vacant lots, not supply nodes). When
  // omitted (legacy/test callers), the supply system is skipped and defense
  // is unmodified. When present and empty, the tile is treated as isolated
  // and gets the -15% defense floor.
  friendlyNeighbors?: ReadonlyArray<{ landType: LandType }>;
}

// ──── v2: Artifacts (single-use, caste-agnostic, found on turn-spend) ────

export type ArtifactRarity = "common" | "rare" | "epic" | "legendary";

export type ArtifactType =
  | "offense"
  | "defense"
  | "production"
  | "utility"
  | "intel";

// Reveal scope for intel-type artifacts and spells. "tile" is the target only;
// "ring" adds the 6 neighbor tiles; "kingdom" adds owner kingdom-wide stats.
export type IntelDepth = "tile" | "ring" | "kingdom";

export interface ArtifactDefinition {
  id: string;
  name: string;
  rarity: ArtifactRarity;
  type: ArtifactType;
  // Strength applied when the artifact is used. Larger than caste spell
  // baseStrength on average — these are supposed to be lucky breaks. Ignored
  // for intel-type artifacts.
  baseStrength: number;
  description: string;
  // One-line narrative when found and when used. Used by turn-report builders
  // to produce flavor text without needing a separate lookup.
  flavorOnFind: string;
  // For type === "intel": how deep the reveal goes when the artifact is spent
  // on a target tile. Ignored otherwise.
  intelDepth?: IntelDepth;
}

// Persisted, time-bounded combat effects produced by intel spells. Read by
// resolveAttack via the data-server attack handler.
//
// "alert-vs-caster" — the defender (ownerId) holds an alert against a
//   specific caster: when that caster attacks the owner, the defender gets a
//   `magnitude` defense bonus. Created by Black Vein of Truth (+0.20) and
//   Green Root Whisper (+0.10).
//
// "forge-sight-offense" — the attacker (ownerId) gets a `magnitude` offense
//   bonus when attacking a specific `targetTileId`. Created by Red Forge
//   Sight (+0.10). Stacks with the Red Forge Scouts air-upgrade bonus.
export type IntelEffectKind = "alert-vs-caster" | "forge-sight-offense";

export interface IntelEffect {
  id: string;
  kind: IntelEffectKind;
  // Player who holds the effect: defender for alerts, attacker for forge-sight.
  ownerId: string;
  // Player whose turn-clock the expiration is measured against. For alerts,
  // this is also the player against whom the effect applies.
  casterId: string;
  // For forge-sight: the tile the bonus applies to. Unset for alerts.
  targetTileId?: string;
  magnitude: number;
  // Effect expires when the casterId's turnsSpentTotal reaches this value.
  expiresAtCasterTurn: number;
  createdAt: Timestamp | Date;
}

// Snapshot returned to the player when an intel-type artifact or intel spell
// resolves. Optional fields are populated according to the reveal scope.
export interface IntelReport {
  targetTileId: string;
  targetOwnerId: string | null;
  // Player turn at which the intel was captured. Stale data after a few turns
  // is normal — the UI should label freshness off this.
  capturedAtTurn: number;
  source: "artifact" | "spell" | "passive";
  sourceId: string;
  scope: IntelSpellScope;
  target: {
    landType: LandType;
    units: UnitStack;
    armedDefenseSpellId: string | null;
    isolatedSpawn: boolean;
  };
  neighbors?: Array<{
    tileId: string;
    ownerId: string | null;
    landType: LandType;
    units: UnitStack;
  }>;
  kingdomDefender?: {
    tilesHeld: number;
    unitsAlive: number;
    activeProductionSpellIds: string[];
    artifactCount: number;
  };
  // Green Root Whisper exclusive: friendlies that contribute to supply.
  supply?: {
    friendlyNeighbors: Array<{ tileId: string; landType: LandType }>;
    supplyMultiplier: number;
  };
  // Red Forge Sight exclusive: which unit type the attacker should lead with.
  weakFace?: UnitType;
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
  // 1.0 if the supply system was not consulted (legacy callers); else the
  // multiplier that scaled defense before underdog stacking. 0.85 = isolated.
  supplyMultiplier: number;
  rng: { attackerRoll: number; defenderRoll: number };
  appliedSpells: { offenseId: string | null; defenseId: string | null };
  // Pre-commit intel produced by the attacker's air-unit intel passive (if
  // the upgrade is active and trigger conditions are met). Currently wired
  // for white-hawks-eye (defenseSpellTier) and red-forge-scouts (weakFace +
  // forgeScoutsBonusApplied). Other intel passives are content-only.
  airIntel?: {
    sourcePassive: AirIntelPassive;
    defenseSpellTier?: SpellTier;
    weakFace?: UnitType;
    forgeScoutsBonusApplied?: boolean;
  };
}
