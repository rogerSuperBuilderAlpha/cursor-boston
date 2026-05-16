/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { Timestamp } from "firebase/firestore";

export type Caste = "black" | "red" | "white" | "green" | "blue";

export type UnitType = "ground" | "siege" | "air";

export type SpellType =
  | "defense"
  | "offense"
  | "production"
  | "intel"
  // May 2026 sim feature additions. These spell kinds are cast standalone
  // (not bundled with attack) and resolve with a dice roll. See
  // lib/game/data-server.ts:castSpellServer for runtime semantics.
  //  - "siege"     → records a siege-debuff IntelEffect; magnitude is the
  //                  rolled fraction subtracted from the target tile's
  //                  standing-defense floor.
  //  - "disarm"    → records a defense-disarm IntelEffect; magnitude is
  //                  the rolled fraction (0..1) by which the next attack
  //                  nullifies the defender's armed defense spell.
  //  - "attrition" → applied immediately at cast: defender units on the
  //                  target tile are killed, distributed across types
  //                  proportionally to current composition.
  | "siege"
  | "disarm"
  | "attrition"
  // End-game tier. Caste-agnostic, single global spell. Cast via
  // castArmageddonServer (not castSpellServer); success rolls against a
  // success-chance derived from the caster's magic-optimization, and on
  // success breaks one of the 7 global Seals. When the 7th breaks, the
  // game enters resolution and resets. See lib/game/content/armageddon.ts.
  | "armageddon";

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
  /** Long-form flavor / lore. UI falls back to "No lore yet." when absent. */
  lore?: string;
  /** Path or URL to illustrative art. UI falls back to /logo.svg when absent.
   *  Convention: /game/units/<id>.png (e.g. "/game/units/white-ground-pikeman.png"). */
  imageUrl?: string;
}

export type SpellTier = 1 | 2 | 3 | 4 | 5;

export interface SpellDefinition {
  id: string;
  // "neutral" is reserved for caste-agnostic spells (currently: Armageddon).
  // Caste-bound casting flows must check `spell.caste === player.caste`; the
  // Armageddon spell bypasses that check via its dedicated server entrypoint.
  caste: Caste | "neutral";
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
  /** Long-form flavor / lore. UI falls back to "No lore yet." when absent. */
  lore?: string;
  /** Path or URL to illustrative art. UI falls back to /logo.svg when absent.
   *  Convention: /game/spells/<id>.png (e.g. "/game/spells/white-offense-smite.png"). */
  imageUrl?: string;
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
  /** Long-form flavor / lore. UI falls back to "No lore yet." when absent. */
  lore?: string;
  /** Path or URL to illustrative art. UI falls back to /logo.svg when absent.
   *  Convention: /game/buildings/<id>.png (e.g. "/game/buildings/white-military.png"). */
  imageUrl?: string;
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
  /** Long-form flavor / lore. UI falls back to "No lore yet." when absent. */
  lore?: string;
  /** Path or URL to illustrative art. UI falls back to /logo.svg when absent.
   *  Convention: /game/upgrades/<id>.png (e.g. "/game/upgrades/white-ground-pikeman-upgrade-1.png"). */
  imageUrl?: string;
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
  /** Long-form flavor / lore. UI falls back to "No lore yet." when absent. */
  lore?: string;
  /** Path or URL to illustrative art. UI falls back to /logo.svg when absent.
   *  Convention: /game/castes/<caste>.png (e.g. "/game/castes/white.png"). */
  imageUrl?: string;
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
  // Number of times the player has changed castes after the initial pick.
  // The first caste pick (chooseCasteServer) does not increment this.
  // Players can change once after reaching `stats.tilesHeld >= 1000`; that
  // change increments to 1 and locks caste permanently. Optional on the
  // type so existing player docs parse without backfill (treated as 0).
  casteChangesUsed?: number;
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
  // ── End-game / Armageddon (optional for backward-compat with existing docs;
  // readers treat undefined as 0 / season 1). All three reset to zero when
  // the player respawns post-Armageddon. seasonNumber is stamped at spawn
  // time and checked against worldMeta.seasonNumber on every turn-spending
  // action so a stale doc from a prior season can't act in the new one.
  armageddonSealsBroken?: number;
  armageddonCastsAttempted?: number;
  seasonNumber?: number;
  // ── Heroes (optional for back-compat with existing docs).
  // `heroCount` is a denormalized counter for cheap "does the player have
  // any heroes" rendering decisions on the dashboard; the canonical roster
  // lives on the tile docs (`GameTile.hero`). Maintained by the server on
  // hero emerge / hero defect / hero death.
  heroCount?: number;
  // Caste-themed special units summoned by farm heroes. Entries without
  // `stationedTileId` live in the player's unsummoned pool; once stationed
  // via summonSpecialUnitServer, the entry carries the tile id and folds
  // into combat math at that tile.
  summonableSpecialUnits?: SpecialUnitInstance[];
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
  // Intrinsic garrison ("BASE"): militia that lives on the tile regardless of
  // recruitment. Composes with `units` (SUPER) in combat — defenders fight with
  // base+super, attackers can draw from base+super at the source. Regenerates
  // toward a per-tile target over wall-clock time (see baseRegenedAt).
  // Optional for legacy docs predating the v3 schema; readers coalesce to
  // {0,0,0} until the backfill stamps in real values.
  baseUnits?: UnitStack;
  // Wall-clock timestamp of the last applyBaseRegen tick. Lazy regen reads
  // (now - baseRegenedAt) and steps baseUnits toward its target. Optional for
  // legacy docs; coalesce to createdAt when missing.
  baseRegenedAt?: Timestamp | Date;
  // Tile-permanent buffs stamped by artifacts. Each entry can modify
  // baseUnits count or per-unit stats on this tile only. Expires when
  // expiresAt < now (null = permanent).
  intrinsicBuffs?: IntrinsicTileBuff[];
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
  // One hero per tile. Emerges probabilistically from class-specific
  // actions performed at this tile (military: won battle; farm: recruit;
  // magic: spell cast from here). Optional for back-compat — legacy tile
  // docs without the field parse as "no hero". See lib/game/heroes.ts.
  hero?: GameHero;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

// Stamped onto a tile by intrinsic-buff artifacts. baseUnitsTarget() folds
// these in. The shape is forward-compat: future artifacts can introduce new
// modifier types (e.g. defenseStatBonus) without breaking the schema.
export interface IntrinsicTileBuff {
  artifactId: string;
  appliedAt: Timestamp | Date;
  // Flat add to base unit counts. Stacks additively with other buffs.
  baseCountBonus?: Partial<UnitStack>;
  // Multiplicative bonus to per-unit defense stat on this tile. Stacks
  // multiplicatively with other buffs and with caste profile defense.
  defenseStatBonus?: number;
  // Multiplicative bonus to per-unit attack stat on this tile. Stacks
  // multiplicatively with other buffs and with caste profile attack.
  attackStatBonus?: number;
  // null / absent = permanent.
  expiresAt?: Timestamp | Date;
}

// =====================================================================
// Heroes (May 2026 sim feature)
// =====================================================================
//
// Heroes are tile-bound entities that emerge probabilistically from
// class-specific actions and modify the math of their parent subsystem.
// Three classes, each tied to a tile land type:
//   - "military"  → emerges on a won battle (attack capture OR defended
//                   repel). Attached to the captured/defended tile.
//                   Boosts attack from / defense on that tile. Moves to
//                   the new tile when the hero tile attacks and captures.
//   - "farm"      → emerges on recruitment on a food tile. Boosts
//                   recruitment kingdom-wide AND each recruit on the hero
//                   tile has a chance to spawn a caste-themed special unit.
//   - "magic"     → emerges on spell cast from a magic tile. Boosts spells
//                   cast from that tile AND contributes "virtual magic
//                   lands" toward the player's Armageddon success chance.
//
// One hero per tile maximum. Tuning lives in lib/game/content/heroes.ts.
// Stamina mechanics + kill/spare/convert flow live in lib/game/heroes.ts
// (pure) and lib/game/data-server.ts (server side-effects).
//
// Persistence: optional on GameTile / GamePlayer so existing docs parse
// without backfill — same back-compat pattern as `baseUnits`, `intrinsicBuffs`.
export type HeroClass = "military" | "farm" | "magic";

// Random sub-affinity rolled at emergence. Flat union across all classes
// so a single field can store it and renderers can switch on it. Each
// specialty maps loosely to an existing taxonomy:
//   military  → unit-type (ground/siege/air), garrison, raid, supply
//   farm      → per-unit-type recruit bonus, summoner (special-unit roll
//               chance), kingdom-buff (global recruit %)
//   magic     → SpellType analogues + armageddon (seal-break boost)
export type HeroSpecialty =
  // military
  | "ground"
  | "siege"
  | "air"
  | "garrison"
  | "raid"
  | "supply"
  // farm
  | "ground-recruit"
  | "siege-recruit"
  | "air-recruit"
  | "summoner"
  | "kingdom-buff"
  // magic
  | "spellcasting"
  | "armageddon"
  | "offense-spells"
  | "defense-spells"
  | "spying"
  | "production-spells";

export interface GameHero {
  // uuid — stable across re-renders and persistence.
  id: string;
  // Owner is decoupled from the tile owner (e.g. transiently between a
  // conversion roll succeeding and the tile-ownership write). Combat reads
  // hero.ownerId, not tile.ownerId, when deciding whether to apply the
  // attacker- or defender-side bonus.
  ownerId: string;
  // Current home tile. Mutates when a military hero moves on capture.
  tileId: string;
  class: HeroClass;
  specialty: HeroSpecialty;
  // Picked deterministically at emergence from the caste's name pool.
  name: string;
  // Caste at emergence. Survives later owner caste changes (lore: loyal
  // to their general, not the kingdom). Drives flavor copy and name pool.
  caste: Caste;
  // 0..staminaMax. Decreases on every engagement (attacker hero whose tile
  // attacks; defender hero whose tile is attacked — regardless of outcome).
  // Regenerates lazily based on `lastEngagedAtTurn` vs. owner's
  // turnsSpentTotal. Conversion is only available when stamina drops below
  // STAMINA_CONVERSION_THRESHOLD.
  stamina: number;
  staminaMax: number;
  // Owner's `turnsSpentTotal` at emergence — used for "X turns old" labels.
  emergedAtTurn: number;
  // Owner's `turnsSpentTotal` at last engagement (or emergence if never
  // engaged). Drives lazy regen at read time. Updated whenever stamina
  // changes (engagement, conversion, move-on-capture).
  lastEngagedAtTurn: number;
}

// Resolution choice when an attacker wins a battle against a hero tile.
// `kill` matches the legacy capture flow (tile flips, hero discarded).
// `spare` is wear-down only — tile stays with the defender, hero stamina
// is reduced (attacker still pays turn cost + casualties). `convert` is
// only valid when the hero's stamina is at/below STAMINA_CONVERSION_THRESHOLD;
// rolls for hero defection. On convert-failure, falls back to
// `heroActionOnConvertFail`.
export type HeroBattleAction = "kill" | "spare" | "convert";

// Caste-themed named units summoned by farm heroes. Defined as content
// in lib/game/content/special-units/<caste>.ts and registered via
// SPECIAL_UNITS_BY_CASTE. NOT heroes — no stamina, no conversion. Roll
// fires on recruitment at a farm-hero tile; the resulting instance enters
// the player's unsummoned pool and can be deployed to any owned tile via
// summonSpecialUnitServer. Contributors add new variants by appending to
// the appropriate caste file.
export interface SpecialUnitDef {
  // e.g. "white-knight-of-the-broken-lance"
  id: string;
  caste: Caste;
  name: string;
  description: string;
  // Flat add to the tile's attack power when the special unit is
  // stationed there and the tile attacks.
  attackBonus: number;
  // Flat add to the tile's defense power when the special unit is
  // stationed there and the tile is attacked.
  defenseBonus: number;
  // Optional thematic line shown on emergence + in the catalog UI.
  flavor?: string;
  imageUrl?: string;
}

export interface SpecialUnitInstance {
  // uuid for this specific summoned unit (an instance of SpecialUnitDef).
  instanceId: string;
  // Foreign key into SPECIAL_UNITS_BY_CASTE[player.caste].
  defId: string;
  // Owner's turnsSpentTotal at spawn — used for "X turns old" labels.
  spawnedAtTurn: number;
  // Set once the unit has been summoned to a tile. Combat reads the
  // attack/defense bonus from the def. Absent ⇒ unit is in the player's
  // unsummoned pool, awaiting `summonSpecialUnitServer`.
  stationedTileId?: string;
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
  // Garrison (BASE) counts, included so map tooltips and the threat list can
  // render correct totals. Optional for v2-snapshot back-compat — coalesce to
  // {0,0,0} when absent.
  baseUnits?: UnitStack;
  armedDefenseSpellId: string | null;
  // Hero on this tile, if any. Surfaced in the lightweight map projection so
  // the hex renderer can draw the hero badge without a full tile fetch. The
  // tile detail modal still loads the full GameTile (and its hero) for the
  // detailed Hero card. Optional for v2-snapshot back-compat.
  hero?: GameHero;
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
  // Land type of the source tile the attack is launching from. Drives the
  // tile-type attack multiplier (military ×1.20, food ×0.75) and the
  // magic-tile offense-spell amplifier. Optional for legacy/test callers
  // that haven't been updated; resolveAttack treats undefined as neutral.
  sourceLandType?: LandType;
  // Already-realized offense power from a pre-cast offense spell against
  // this target (kind = "pre-cast-offense-spell"). Flat addition to
  // attackPower; not re-amplified by source-tile magic mult (the spell was
  // cast and rolled already). Optional; legacy callers default to 0.
  preCastOffenseBonus?: number;
  // Pre-resolved additive offense multiplier from a military hero stationed
  // on the source tile (stamina-scaled and specialty-weighted by the server
  // before passing in). Stacks multiplicatively on attackPower at the same
  // numeric stage as `intelOffenseBonus`. Includes any stationed special-
  // unit attackBonus contribution rolled into the same channel. Optional;
  // legacy callers default to 0.
  heroAttackBonus?: number;
}

export interface CombatDefenderInput {
  caste: Caste;
  // Composite stack (BASE garrison + SUPER reinforcements) entering combat.
  // resolveAttack treats this as a single defender force; the server is
  // responsible for splitting losses back into the underlying pools.
  unitsOnTile: UnitStack;
  // BASE portion of `unitsOnTile`. Echoed onto CombatResult so the
  // BattleReport can render "X garrison + Y reinforcements" without
  // re-querying. Optional for legacy callers; absent ⇒ treat as 0
  // (whole stack rendered as reinforcements).
  baseUnitsOnTile?: UnitStack;
  armedDefenseSpellId: string | null;
  magicLandCount: number;
  unitsAlive: number;
  activeUpgrades?: Record<string, string>;
  // Pre-resolved additive defense multiplier from active alert-vs-caster
  // intel effects (Black Vein of Truth = +0.20, Green Root Whisper = +0.10
  // against the specific attacker). Stacks multiplicatively on defensePower
  // after supply.
  intelDefenseBonus?: number;
  // Fraction in [0, 1] by which the armed defense spell's contribution is
  // nullified ("defense-disarm" effect rolled by the attacker). 1 fully
  // dispels; 0.5 halves; 0 is a no-op. Optional; legacy callers default 0.
  defenseDisarmFraction?: number;
  // Pre-resolved additive defense multiplier from a military hero stationed
  // on the defended tile (stamina-scaled and specialty-weighted by the server
  // before passing in). Stacks multiplicatively on defensePower at the same
  // numeric stage as `intelDefenseBonus`. Also folds in any stationed
  // special-unit defenseBonus contribution. Optional; legacy callers default
  // to 0.
  heroDefenseBonus?: number;
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
  // Land type of the contested tile itself. Drives the defender-tile
  // defense multiplier (military/magic ×1.25), the standing-defense floor
  // (military 30%, magic 15% of attack power), and the magic-tile
  // defense-spell amplifier. Optional for legacy/test callers; resolveAttack
  // treats undefined as neutral.
  landType?: LandType;
  // Cumulative siege-debuff magnitude (0..SIEGE_DEBUFF_MAX_MAGNITUDE)
  // softening this tile's standing-defense floor. Caller is responsible
  // for clamping to the cap; resolveAttack does not re-clamp. Optional;
  // legacy callers default to 0.
  siegeDebuffMagnitude?: number;
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
  /** Long-form flavor / lore that stays visible on the artifact's catalog
   *  card. Different from `flavorOnFind` (one-time discovery copy). UI falls
   *  back to "No lore yet." when absent. */
  lore?: string;
  /** Path or URL to illustrative art. UI falls back to /logo.svg when absent.
   *  Convention: /game/artifacts/<id>.png (e.g. "/game/artifacts/rare-stormglass-ward.png"). */
  imageUrl?: string;
}

// Persisted, time-bounded combat effects produced by intel spells and
// pre-attack actions. Read by resolveAttack via the data-server attack handler.
//
// "alert-vs-caster" — the defender (ownerId) holds an alert against a
//   specific caster: when that caster attacks the owner, the defender gets a
//   `magnitude` defense bonus. Created by Black Vein of Truth (+0.20) and
//   Green Root Whisper (+0.10).
//
// "forge-sight-offense" — the attacker (ownerId) gets a `magnitude` offense
//   bonus when attacking a specific `targetTileId`. Created by Red Forge
//   Sight (+0.10). Stacks with the Red Forge Scouts air-upgrade bonus.
//
// "siege-debuff" — the attacker (ownerId) has softened the target tile's
//   standing-defense floor by `magnitude` (0..1 fraction). Stackable up to
//   SIEGE_DEBUFF_MAX_MAGNITUDE; combat reads the SUM of active effects.
//   TTL-only — not consumed by attack.
//
// "pre-cast-offense-spell" — the attacker (ownerId) pre-cast an offense
//   spell pointed at `targetTileId`; `magnitude` is the realized
//   spell-contribution power (already × magicMultiplier × caste bonus ×
//   dice). Single-use: combat consumes (deletes) on next attack.
//
// "defense-disarm" — the attacker (ownerId) disarmed the target tile's
//   armed defense spell by `magnitude` (0..1 fraction; 1 = fully nullified).
//   Single-use: combat consumes on next attack.
export type IntelEffectKind =
  | "alert-vs-caster"
  | "forge-sight-offense"
  | "siege-debuff"
  | "pre-cast-offense-spell"
  | "defense-disarm";

// Cap on stacked siege-debuff magnitude. Three siege actions × 0.10 each →
// 0.30, which fully neutralizes the military standing floor (0.30) and
// halves the magic floor (0.15) twice. Spell-cast siege adds on top up to
// the same cap.
export const SIEGE_DEBUFF_MAX_MAGNITUDE = 0.30;
// Per-action siege magnitude (deterministic; spell-cast siege uses dice).
export const SIEGE_ACTION_MAGNITUDE = 0.10;
// Kinds that are consumed (deleted) on the next attack against the target
// tile. Read once, deleted in-tx.
export const SINGLE_USE_INTEL_EFFECT_KINDS: ReadonlySet<IntelEffectKind> =
  new Set<IntelEffectKind>(["pre-cast-offense-spell", "defense-disarm"]);

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
  | "spell-cast"
  | "attack"
  | "siege"
  | "flyover";

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
  // Tile-type combat modifiers applied this resolution. 1.0 means neutral
  // (the legacy default when callers don't pass landType / sourceLandType).
  // Surfaced so the battle readout can show "Military source ×1.20" etc.
  sourceLandTypeMultiplier: number;
  targetLandTypeMultiplier: number;
  // Absolute defense power added by the standing-defense floor (military
  // 30% / magic 15% of attack power). 0 for food / unrevealed / unassigned.
  standingDefenseAdded: number;
  // True when the offense spell or defense spell was cast from / armed on a
  // magic tile and received the MAGIC_TILE_SPELL_MULT amplifier.
  magicTileOffenseSpellBonusApplied: boolean;
  magicTileDefenseSpellBonusApplied: boolean;
  // Pre-attack mods (May 2026 sim feature). 0 / false when no effect was
  // active; surfaced so the BattleReport can render Modifiers lines.
  siegeDebuffApplied: number;
  defenseDisarmApplied: number;
  preCastOffenseApplied: number;
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
  // BASE+SUPER combat additions ────────────────────────────────────────────
  // finalAttack / finalDefense (the post-RNG values used to determine
  // outcome). Surfaced so the loss-attribution helpers don't have to
  // re-derive them and so the UI can show the closeness of the fight.
  finalAttack: number;
  finalDefense: number;
  // Composite defender stack (BASE + SUPER) entering combat. Surfaced so the
  // BattleReport can render "Defender had X" without back-deriving from
  // post-attack tile state (which on capture is now the attacker's survivors,
  // not the defender's losses).
  defenderUnitsPreAttack: UnitStack;
  // BASE portion of defenderUnitsPreAttack. The remainder is SUPER. Lets the
  // BattleReport render "X garrison + Y reinforcements" without coupling to
  // the server's post-attack tile state. Absent if the caller didn't supply
  // baseUnitsOnTile in the defender input.
  defenderBasePreAttack: UnitStack;
  // |ratio - 1| where ratio = finalAttack / finalDefense. 0 = perfectly even,
  // 1 = 2× one side. Drives the "Decisive / Close / Pyrrhic" labels in the
  // BattleReport modal.
  decisiveness: number;
  // Human-readable tag for the loss curve that applied. One of:
  //   "decisive-capture" | "close-capture" | "stalemate" | "close-repel" | "decisive-repel"
  // The UI uses this for the outcome banner; combat math uses the same tag
  // internally to scale losses.
  lossCurveTag: LossCurveTag;
  // Fraction of the defender's pre-attack BASE that survives capture
  // (0..1). The server multiplies target.baseUnits by this on capture; the
  // new owner inherits a small garrison rather than starting at zero. 1 for
  // non-captured outcomes (BASE losses then come from the curve).
  captureBaseRetentionFactor: number;
}

export type LossCurveTag =
  | "decisive-capture"
  | "close-capture"
  | "stalemate"
  | "close-repel"
  | "decisive-repel";


// =====================================================================
// Community feed + chat
// =====================================================================

/** Events surfaced in the dashboard's CommunityPanel activity feed. */
export type CommunityEventKind =
  | "player_join"
  | "caste_pick"
  | "caste_change"
  | "attack"
  | "milestone_1k_tiles"
  // End-game / Armageddon lifecycle events. All denormalized at write-time
  // (actor name + caste captured into the event row) so the feed survives
  // the post-Armageddon player-doc wipe.
  | "seal_broken"
  | "armageddon_started"
  | "armageddon_completed"
  | "armageddon_winner"
  | "armageddon_cast_failed"
  // Heroes (May 2026). Public feed entries fire on emergence, defection
  // (conversion success), and death (kill choice or hero tile captured
  // with kill action). Each carries the hero's denormalized name + class
  // + specialty so the feed survives the hero record going away.
  | "hero_emerged"
  | "hero_defected"
  | "hero_slain";

/** Single entry in the `game_community_events` log. Denormalized so the
 *  feed renderer never needs to join against game_players. */
export interface CommunityEvent {
  id: string;
  kind: CommunityEventKind;
  createdAt: Timestamp | Date;
  /** Player who performed the action. */
  actorUserId: string;
  actorDisplayName: string;
  actorCaste: Caste | null;
  // Attack-specific fields
  targetUserId?: string;
  targetDisplayName?: string;
  tileId?: string;
  outcome?: AttackOutcome;
  // Caste-change-specific fields
  fromCaste?: Caste;
  toCaste?: Caste;
  // Armageddon-specific fields
  sealIndex?: number;            // seal_broken: which of the 7 (0..6)
  seasonNumber?: number;         // armageddon_started / completed / winner
  winnerRank?: number;           // armageddon_winner: 1..10
  tilesHeld?: number;            // armageddon_winner: tile count at draw
  sealsBroken?: number;          // armageddon_winner: personal seals broken
  tickets?: number;              // armageddon_winner: weighted ticket count
  // Hero-specific fields (hero_emerged / hero_defected / hero_slain).
  // Denormalized so the feed survives the hero leaving its tile.
  heroId?: string;
  heroName?: string;
  heroClass?: HeroClass;
  heroSpecialty?: HeroSpecialty;
  // hero_defected / hero_slain: the OTHER player involved.
  // For defect: original owner (whose hero was taken).
  // For slay: the killer (attacker who chose kill outcome).
  otherUserId?: string;
  otherDisplayName?: string;
  otherCaste?: Caste | null;
}

// =====================================================================
// End-game / Armageddon
// =====================================================================

/** State of the global game-world singleton (`game_world_meta/singleton`).
 *  All fields except `playerCount` are introduced by the Armageddon end-game.
 *  Fields are optional so existing docs (which predate Armageddon) parse —
 *  readers coalesce to safe defaults (sealsBroken=0, armageddonState="active",
 *  seasonNumber=1) when absent. */
export interface GameWorldMeta {
  /** Lifetime count of player spawns — drives the hex-spiral spawn index.
   *  Not reset by Armageddon (otherwise post-reset spawn centers would
   *  collide with pre-reset ghost tiles in the next world). */
  playerCount: number;
  /** Current season number, starting at 1. Incremented when an Armageddon
   *  fully resolves. Every player doc carries the seasonNumber it was
   *  spawned in; any mismatch on a turn-spending action errors out and
   *  prompts the player to claim a fresh spawn. */
  seasonNumber?: number;
  /** 0..7. Increments each time a player successfully casts Armageddon
   *  and breaks a Seal. At 7 the world enters resolution. */
  sealsBroken?: number;
  /** Per-seal audit. Length 7 always (or absent for pre-Armageddon docs).
   *  Each entry records who broke it and when. */
  seals?: SealRecord[];
  /** Lifecycle gate. "active" → casts allowed; "resolving" → 7th seal just
   *  broke, the wipe job is running, ALL turn-spending mutations refuse;
   *  flipped back to "active" by the resolver after the new season is
   *  staged. */
  armageddonState?: "active" | "resolving";
  /** Wall-clock instant the 7th seal broke. Used by the UI banner. */
  armageddonStartedAt?: Timestamp | Date;
  /** Wall-clock instant the most recent resolver bumped season + reset. */
  armageddonResolvedAt?: Timestamp | Date;
  lastSpawnAt?: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}

/** One of the 7 Seals. Unbroken seals have only `index` and `broken=false`.
 *  Broken seals carry the casting player's identity (denormalized so the UI
 *  doesn't need to join against the player doc — which may be wiped). */
export interface SealRecord {
  index: number;       // 0..6
  broken: boolean;
  brokenBy?: {
    userId: string;
    displayName: string;
    caste: Caste;
  };
  brokenAt?: Timestamp | Date;
}

/** One ranked winner of an Armageddon lottery draw. */
export interface ArmageddonWinner {
  rank: number;             // 1..10
  userId: string;
  displayName: string;
  caste: Caste;
  tilesHeld: number;        // at moment of draw
  sealsBroken: number;      // personally broken this season
  tickets: number;          // weighted lottery tickets = tilesHeld × (1 + sealsBroken)
}

/** A single Armageddon's hall-of-fame record. One doc per past Armageddon
 *  in `game_armageddon_events`, doc id = seasonNumber. Persisted before
 *  the world wipe so the historical record survives even if the wipe
 *  crashes mid-batch. */
export interface ArmageddonEventRecord {
  seasonNumber: number;
  triggeredAt: Timestamp | Date;
  /** Player who broke the 7th seal. */
  triggeredBy: {
    userId: string;
    displayName: string;
    caste: Caste;
  };
  /** Full audit trail of all 7 seals from this season. */
  seals: SealRecord[];
  /** Number of players with > 0 tickets at draw time. */
  totalParticipants: number;
  /** Sum of all tickets at draw time. */
  totalTickets: number;
  /** Top-10 weighted-draw winners, in rank order. May be < 10 if fewer
   *  participants had tickets. */
  winners: ArmageddonWinner[];
  /** Snapshot of top-50-by-tilesHeld at draw time, for posterity. May
   *  overlap with winners (the same player can appear in both). */
  topByTilesSnapshot: Array<{
    rank: number;       // 1..50
    userId: string;
    displayName: string;
    caste: Caste;
    tilesHeld: number;
    sealsBroken: number;
  }>;
}

/** Single message in the `game_community_messages` collection. */
export interface CommunityMessage {
  id: string;
  userId: string;
  displayName: string;
  caste: Caste | null;
  body: string;
  createdAt: Timestamp | Date;
  /** Set when the message has been soft-deleted (by the author or an
   *  admin). The chat renderer hides deleted messages by default. */
  deletedAt?: Timestamp | Date;
  /** True when the deletion was performed by an admin. */
  deletedByAdmin?: boolean;
}
