/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { randomUUID } from "node:crypto";
import type { Firestore, Timestamp, Transaction } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  applyBaseRegen,
  applyFlyoverModifiers,
  attributeAttackerLosses,
  attributeDefenderLosses,
  baseUnitsTarget,
  computeTileCapacity,
  distributeUnitKills,
  magicMultiplier,
  makeSeededRng,
  realizedSpellMagnitude,
  resolveAttack,
  rollSpellEffectiveness,
} from "./combat";
import { ARTIFACTS_BY_ID, SPELLS_BY_ID } from "./content";
import {
  ARMAGEDDON_TILE_GATE,
  ARMAGEDDON_TURN_COST,
  SEAL_COUNT,
  computeArmageddonSuccessChanceFromMultiplier,
} from "./content/armageddon";
import { rollArtifact } from "./artifacts";
import { logCommunityEventInTx } from "./community";
import { markPactsBrokenInTx } from "./pacts";
import { resolveProphesiesForSealInTx } from "./prophecies";
import { buildIntelReportServer } from "./intel";
import {
  deleteIntelEffectsInTx,
  readAttackContextEffects,
  recordDefenseDisarmInTx,
  recordIntelEffectInTx,
  recordSiegeDebuffInTx,
} from "./intel-effects";
import {
  buildArmDefenseReport,
  buildAttackReport,
  buildBuildReport,
  buildCastSpellReport,
  buildDistributeReport,
  buildExploreReport,
  buildFlyoverReport,
  buildProduceReport,
  buildSiegeReport,
} from "./turn-report";
import { notifyConquest } from "./discord-game";
import { logger } from "@/lib/logger";
import { sanitizeText } from "@/lib/sanitize";
import {
  paginateFirestoreQuery,
  paginateInMemory,
  type PaginatedQueryResult,
} from "@/lib/firestore-pagination";
import {
  PRODUCTION_SPELL_DURATION_TURNS,
  applyWeeklyGrant,
  currentEligibilityWindow,
  effectiveUnitCap,
  isShieldActive,
  newPlayer,
  nextRolloverInstant,
  priorWeekRangeUtc,
  pruneExpiredProductionSpells,
  validateGeneralName,
  weekStartIsoForRollover,
} from "./turns";
import {
  UPGRADE_TURN_COST,
  getActiveUpgrades,
  validateApplyUpgrade,
  validateRemoveUpgrade,
} from "./upgrades";
import {
  DEFENSIVE_STANCE_LOCK_MS,
  LAST_STAND_COOLDOWN_MS,
  LAST_STAND_THREAT_WINDOW_MS,
  LAST_STAND_WINDOW_MS,
  MEDITATION_DURATION_MS,
  MEDITATION_MAX_ACTIVE_SLOTS,
  OATHBREAKER_ATTACK_PENALTY,
  OATHBREAKER_DURATION_MS,
  PEP_TALK_STAMINA_GAIN,
  REDISTRIBUTE_MAX_PER_DAY,
  SIEGE_ACTION_MAGNITUDE,
  SIEGE_DEBUFF_MAX_MAGNITUDE,
  type ArmageddonEventRecord,
  type ArtifactDefinition,
  type Caste,
  type CombatResult,
  type GameArtifact,
  type GameAttack,
  type GameHero,
  type GamePlayer,
  type GameTile,
  type GameWorldMeta,
  type HeroBattleAction,
  type IntelReport,
  type LandType,
  type MapTile,
  type SealRecord,
  type SpecialUnitInstance,
  type SpellDefinition,
  type TurnAction,
  type TurnReport,
  type UnitStack,
  type UnitType,
} from "./types";
import {
  CONVERSION_SUCCESS_CEILING,
  FARM_HERO_GLOBAL_RECRUIT_BONUS,
  FARM_HERO_GLOBAL_RECRUIT_CAP,
  FARM_SPECIAL_UNIT_ROLL,
  HERO_ATTACK_BONUS,
  HERO_DEFENSE_BONUS,
  MAGIC_HERO_SPELL_BOOST,
  MAGIC_HERO_VIRTUAL_LANDS,
  POST_CONVERT_STAMINA,
  SPARE_STAMINA_MULT,
  STAMINA_CONVERSION_THRESHOLD,
  conversionSuccessChance,
  specialtyArmageddonMult,
  specialtyAttackMult,
  specialtyCastingMult,
  specialtyDefenseMult,
  specialtyKingdomBuffMult,
  specialtyRecruitMult,
  specialtyTypeRecruitMult,
  staminaScale,
} from "./content/heroes";
import {
  SPECIAL_UNITS_BY_ID,
  pickSpecialUnitDef,
} from "./content/special-units/_index";
import {
  applyEngagement,
  applyStaminaRegen,
  maybeEmergeHero,
} from "./heroes";
import {
  computeZeroTurnDefenseBonus,
  isHeroMeditating,
  isTileInDefensiveStance,
  oathbreakerAttackPenalty,
} from "./zero-turn";
import { findActivePactsBetween } from "./pacts";
import {
  appendHeroEventInTx,
  heroEvent,
  markHeroDeceasedInTx,
  transferHeroOwnerInTx,
  upsertHeroInTx,
} from "./hero-registry";
import {
  type AxialCoord,
  axialFromTileId,
  neighborTileIds,
  neighbors as axialNeighbors,
  spawnCenterForPlayerIndex,
  spawnPlayerLands,
  tileIdFromAxial,
} from "./world-gen";
import {
  type FrontierSample,
  distanceToNearestOwned,
  hexCentroid,
  kingdomRadiusFromCentroid,
  ringCoords,
  riskScore,
} from "./exploration";

export const ATTACK_TURN_COST = 1;
export const SPELL_TURN_COST = 5;
export const BUILD_UNITS_TURN_COST = 5;
// Siege action: a deterministic infrastructure-degrading move. Costs 5
// turns, applies SIEGE_ACTION_MAGNITUDE (0.10) to the target's
// standing-defense floor, stacks up to SIEGE_DEBUFF_MAX_MAGNITUDE.
export const SIEGE_TURN_COST = 5;
// Recruit rate is per-land-type as of the May 2026 mechanics rework:
// food/magic tiles now recruit at half the military rate, since training
// soldiers is what military tiles are *for*. The gate that limited recruit
// to military-only was removed at the same time.
//
// `BUILD_UNITS_PER_TURN` is kept exported as the military baseline so any
// external consumer reading "the recruit rate" still sees a sensible value;
// internal cycle math uses `unitsPerTurnForLand(landType)`.
export const BUILD_UNITS_PER_TURN = 10;
export const BUILD_UNITS_PER_TURN_BY_LAND: Record<LandType, number> = {
  unrevealed: 0,
  unassigned: 0,
  military: 10,
  food: 5,
  magic: 5,
};
export function unitsPerTurnForLand(landType: LandType): number {
  return BUILD_UNITS_PER_TURN_BY_LAND[landType] ?? 0;
}

// ── Hero helpers ─────────────────────────────────────────────────────────
//
// Small, pure-ish helpers that fold the player's hero roster into the
// per-action effects (recruitment buff, virtual magic lands for Armageddon,
// stationed special-unit combat bonus). The full Heroes design lives in
// lib/game/heroes.ts (pure) and lib/game/content/heroes.ts (tuning).

/** Sum of farm-hero kingdom-wide recruitment bonus across the player's
 *  food tiles, capped at FARM_HERO_GLOBAL_RECRUIT_CAP. Each hero's
 *  contribution is stamina-scaled and specialty-weighted (the
 *  `kingdom-buff` specialty doubles it). Returns a fraction in
 *  [0, FARM_HERO_GLOBAL_RECRUIT_CAP]. */
function computeFarmHeroKingdomBuff(
  heroes: ReadonlyArray<GameHero>,
  ownerTurnsSpentTotal: number,
  now: Date = new Date()
): number {
  let total = 0;
  for (const hero of heroes) {
    if (hero.class !== "farm") continue;
    if (isHeroMeditating(hero, now)) continue;
    const regened = applyStaminaRegen(hero, ownerTurnsSpentTotal);
    total +=
      FARM_HERO_GLOBAL_RECRUIT_BONUS *
      staminaScale(regened) *
      specialtyKingdomBuffMult(regened);
  }
  return Math.min(FARM_HERO_GLOBAL_RECRUIT_CAP, total);
}

/** Sum of magic-hero "virtual magic lands" the player contributes to
 *  their own Armageddon `magicMultiplier` input. Each hero is stamina-
 *  scaled; the "armageddon" specialty doubles, "spellcasting" gives a
 *  small bump. Fractional — magicMultiplier handles the curve. */
function countMagicHeroVirtualLands(
  heroes: ReadonlyArray<GameHero>,
  ownerTurnsSpentTotal: number,
  now: Date = new Date()
): number {
  let total = 0;
  for (const hero of heroes) {
    if (hero.class !== "magic") continue;
    if (isHeroMeditating(hero, now)) continue;
    const regened = applyStaminaRegen(hero, ownerTurnsSpentTotal);
    total +=
      MAGIC_HERO_VIRTUAL_LANDS *
      staminaScale(regened) *
      specialtyArmageddonMult(regened);
  }
  return total;
}

/** Sum of stationed special-unit attack and defense bonuses for one
 *  specific tile. Reads `player.summonableSpecialUnits` (only entries
 *  with `stationedTileId === tileId` contribute). Defs resolved via
 *  SPECIAL_UNITS_BY_ID — entries pointing at an unknown defId are
 *  silently skipped (content was removed) rather than throwing. */
function computeStationedSpecialUnitBonuses(
  player: GamePlayer,
  tileId: string
): { attackBonus: number; defenseBonus: number } {
  let attackBonus = 0;
  let defenseBonus = 0;
  const stationed = player.summonableSpecialUnits ?? [];
  for (const instance of stationed) {
    if (instance.stationedTileId !== tileId) continue;
    const def = SPECIAL_UNITS_BY_ID.get(instance.defId);
    if (!def) continue;
    attackBonus += def.attackBonus;
    defenseBonus += def.defenseBonus;
  }
  return { attackBonus, defenseBonus };
}

/** Total hero attack bonus for an attacker source tile. Folds the
 *  military-hero multiplicative bonus (stamina + specialty) with the
 *  stationed special-unit attackBonus on the same tile. Returns a fraction
 *  (e.g. 0.25 = +25% attack). Both contributions are additive in the
 *  returned fraction; combat.ts applies (1 + bonus). */
function combinedHeroAttackBonus(
  player: GamePlayer,
  sourceTile: GameTile,
  targetTile: Pick<GameTile, "type">,
  now: Date = new Date()
): number {
  let bonus = 0;
  if (
    sourceTile.hero &&
    sourceTile.hero.class === "military" &&
    !isHeroMeditating(sourceTile.hero, now)
  ) {
    const h = applyStaminaRegen(sourceTile.hero, player.turnsSpentTotal);
    bonus +=
      HERO_ATTACK_BONUS *
      staminaScale(h) *
      specialtyAttackMult(h, targetTile.type);
  }
  // Special units summoned to the source tile add a small multiplicative
  // bump — total special-unit attack stat divided by 1000 keeps the
  // numbers in the same order of magnitude as the military-hero bonus
  // without piling unbounded combat power.
  const stationed = computeStationedSpecialUnitBonuses(player, sourceTile.tileId);
  bonus += stationed.attackBonus / 1000;
  return bonus;
}

/** Mirror of `combinedHeroAttackBonus` for the defender side. */
function combinedHeroDefenseBonus(
  defender: GamePlayer,
  targetTile: GameTile,
  sourceTile: Pick<GameTile, "type">,
  now: Date = new Date()
): number {
  let bonus = 0;
  if (
    targetTile.hero &&
    targetTile.hero.class === "military" &&
    !isHeroMeditating(targetTile.hero, now)
  ) {
    const h = applyStaminaRegen(targetTile.hero, defender.turnsSpentTotal);
    bonus +=
      HERO_DEFENSE_BONUS *
      staminaScale(h) *
      specialtyDefenseMult(h, sourceTile.type);
  }
  const stationed = computeStationedSpecialUnitBonuses(defender, targetTile.tileId);
  bonus += stationed.defenseBonus / 1000;
  return bonus;
}

/** Magic-hero spell-magnitude boost when casting `spell` from `sourceTile`.
 *  Returns a multiplier (1.0 = no change). Stamina-scaled, specialty-weighted. */
function magicHeroSpellMultiplier(
  casterTurnsSpentTotal: number,
  sourceTile: GameTile,
  spell: Pick<SpellDefinition, "type">,
  now: Date = new Date()
): number {
  if (!sourceTile.hero || sourceTile.hero.class !== "magic") return 1;
  if (isHeroMeditating(sourceTile.hero, now)) return 1;
  const h = applyStaminaRegen(sourceTile.hero, casterTurnsSpentTotal);
  return (
    1 +
    MAGIC_HERO_SPELL_BOOST * staminaScale(h) * specialtyCastingMult(h, spell)
  );
}
// Far expedition: 2× the normal explore cost. Lands a tile adjacent to a
// random enemy tile, marked isolatedSpawn so the supply system applies the
// -15% defense floor until the player grows neighbors around it.
export const FAR_EXPEDITION_TURN_COST = 2;

export class GamePlayerNotFoundError extends Error {
  constructor() {
    super("Game player not found");
    this.name = "GamePlayerNotFoundError";
  }
}
export class GamePlayerAlreadyExistsError extends Error {
  constructor() {
    super("Game player already exists");
    this.name = "GamePlayerAlreadyExistsError";
  }
}
export class GameTileNotFoundError extends Error {
  constructor() {
    super("Tile not found");
    this.name = "GameTileNotFoundError";
  }
}
export class GameTileNotOwnedError extends Error {
  constructor() {
    super("Tile not owned by player");
    this.name = "GameTileNotOwnedError";
  }
}
export class GameInvalidPhaseError extends Error {
  constructor(expected: string, actual: string) {
    super(`Invalid phase: expected ${expected}, got ${actual}`);
    this.name = "GameInvalidPhaseError";
  }
}
export class GameInsufficientTurnsError extends Error {
  constructor(required: number, have: number) {
    super(`Insufficient turns: need ${required}, have ${have}`);
    this.name = "GameInsufficientTurnsError";
  }
}
export class GameNoUnrevealedTilesError extends Error {
  constructor() {
    super("No unrevealed tiles remaining to explore");
    this.name = "GameNoUnrevealedTilesError";
  }
}
export class GameAlreadyRevealedError extends Error {
  constructor() {
    super("Tile is already revealed");
    this.name = "GameAlreadyRevealedError";
  }
}
export class GameTileUnrevealedError extends Error {
  constructor() {
    super("Tile must be revealed via explore before it can be distributed");
    this.name = "GameTileUnrevealedError";
  }
}
export class GameCasteAlreadySetError extends Error {
  constructor() {
    super("Caste already chosen and locked");
    this.name = "GameCasteAlreadySetError";
  }
}
export class GameCasteChangeUnavailableError extends Error {
  constructor(reason: string) {
    super(`Caste change unavailable: ${reason}`);
    this.name = "GameCasteChangeUnavailableError";
  }
}
export class GameInvalidLandTypeError extends Error {
  constructor(t: string) {
    super(`Invalid land type for distribute: ${t}`);
    this.name = "GameInvalidLandTypeError";
  }
}
export class GameInvalidCasteError extends Error {
  constructor(c: string) {
    super(`Invalid caste: ${c}`);
    this.name = "GameInvalidCasteError";
  }
}
export class GameShieldedError extends Error {
  constructor(side: "attacker" | "defender") {
    super(`Action blocked: ${side} is under the new-player shield wall`);
    this.name = "GameShieldedError";
  }
}
export class GameNotAdjacentError extends Error {
  constructor() {
    super("Source tile does not border the target tile");
    this.name = "GameNotAdjacentError";
  }
}
export class GameSelfAttackError extends Error {
  constructor() {
    super("Cannot attack a tile you own");
    this.name = "GameSelfAttackError";
  }
}
export class GameTileFullError extends Error {
  constructor(public availableSpace: number, public requested: number) {
    super(
      `Target tile has only ${availableSpace} units of available capacity; you sent ${requested}`
    );
    this.name = "GameTileFullError";
  }
}
export class GameInsufficientUnitsError extends Error {
  constructor() {
    super("Source tile does not have the requested units");
    this.name = "GameInsufficientUnitsError";
  }
}
export class GameInvalidSpellError extends Error {
  constructor(reason: string) {
    super(`Invalid spell: ${reason}`);
    this.name = "GameInvalidSpellError";
  }
}
export class GameUnitCapExceededError extends Error {
  constructor(public cap: number, public currentTotal: number) {
    super(
      `Cannot build more units; would exceed cap (${currentTotal}/${cap}). Develop more food lands.`
    );
    this.name = "GameUnitCapExceededError";
  }
}
export class GameTileTypeError extends Error {
  constructor(expected: string, got: string) {
    super(`Tile must be ${expected}, got ${got}`);
    this.name = "GameTileTypeError";
  }
}
export class GameFrontierExhaustedError extends Error {
  constructor() {
    super(
      "Could not find an unclaimed tile on the frontier. The world is unusually crowded near you."
    );
    this.name = "GameFrontierExhaustedError";
  }
}
export class GameArtifactNotFoundError extends Error {
  constructor() {
    super("Artifact not found");
    this.name = "GameArtifactNotFoundError";
  }
}
export class GameArtifactAlreadyUsedError extends Error {
  constructor() {
    super("Artifact has already been used");
    this.name = "GameArtifactAlreadyUsedError";
  }
}
export class GamePlayerBioTooLongError extends Error {
  constructor() {
    super("Bio cannot exceed 500 characters");
    this.name = "GamePlayerBioTooLongError";
  }
}
export class GameInscriptionTooLongError extends Error {
  constructor() {
    super("Inscription cannot exceed 120 characters");
    this.name = "GameInscriptionTooLongError";
  }
}
export class GameInvalidNameError extends Error {
  constructor(reason: string) {
    super(`Invalid general name: ${reason}`);
    this.name = "GameInvalidNameError";
  }
}
export class GameNameTakenError extends Error {
  constructor() {
    super("That general name is already in use");
    this.name = "GameNameTakenError";
  }
}
export class GameNoEnemyKingdomsError extends Error {
  constructor() {
    super(
      "No enemy kingdoms exist on the map. Far Expedition needs an enemy to land beside."
    );
    this.name = "GameNoEnemyKingdomsError";
  }
}

export class GameArmageddonInProgressError extends Error {
  constructor() {
    super(
      "Armageddon is upon us. The world is being remade — turn-spending actions are temporarily refused."
    );
    this.name = "GameArmageddonInProgressError";
  }
}

export class GameStaleSeasonError extends Error {
  constructor(playerSeason: number, worldSeason: number) {
    super(
      `Your record is from season ${playerSeason}, but the current season is ${worldSeason}. Claim your fresh spawn to continue.`
    );
    this.name = "GameStaleSeasonError";
  }
}

export class GameSealsExhaustedError extends Error {
  constructor() {
    super(
      "All seven Seals have been broken — Armageddon is already underway."
    );
    this.name = "GameSealsExhaustedError";
  }
}

/** Thrown when summon/unsummon references a special-unit instance the
 *  player doesn't have in their pool. */
export class GameSpecialUnitNotFoundError extends Error {
  constructor(instanceId: string) {
    super(`Special unit instance ${instanceId} not found in your pool.`);
    this.name = "GameSpecialUnitNotFoundError";
  }
}

/** Thrown when a special-unit summon targets a tile that already has the
 *  same instance stationed (idempotency guard) or is already stationed
 *  somewhere else (caller must unsummon first). */
export class GameSpecialUnitAlreadyStationedError extends Error {
  constructor() {
    super(
      "This special unit is already stationed. Unsummon it first to move it."
    );
    this.name = "GameSpecialUnitAlreadyStationedError";
  }
}

// Zero-turn gameplay errors -----------------------------------------------
export class GameDefensiveStanceBlockedError extends Error {
  constructor() {
    super(
      "This tile is in defensive stance and cannot attack until the stance lifts."
    );
    this.name = "GameDefensiveStanceBlockedError";
  }
}
export class GameDefensiveStanceLockedError extends Error {
  constructor() {
    super(
      "Defensive stance is still locked. You cannot exit stance until the cooldown elapses."
    );
    this.name = "GameDefensiveStanceLockedError";
  }
}
export class GameDefensiveStanceCapError extends Error {
  constructor(public cap: number) {
    super(`You can have at most ${cap} tile(s) in defensive stance.`);
    this.name = "GameDefensiveStanceCapError";
  }
}
export class GameMeditationSlotFullError extends Error {
  constructor() {
    super("You already have a hero in meditation.");
    this.name = "GameMeditationSlotFullError";
  }
}
export class GameHeroAlreadyMeditatingError extends Error {
  constructor() {
    super("That hero is already meditating.");
    this.name = "GameHeroAlreadyMeditatingError";
  }
}
export class GameHeroNotOwnedError extends Error {
  constructor() {
    super("That hero is not yours.");
    this.name = "GameHeroNotOwnedError";
  }
}
export class GameHeroNotFoundError extends Error {
  constructor() {
    super("Hero not found.");
    this.name = "GameHeroNotFoundError";
  }
}
export class GamePepTalkRequiresZeroTurnsError extends Error {
  constructor() {
    super("Pep talks are only available when you have 0 turns remaining.");
    this.name = "GamePepTalkRequiresZeroTurnsError";
  }
}
export class GameRedistributeRateLimitError extends Error {
  constructor(public retryAfterMs: number) {
    super("You've used your daily redistribution allowance.");
    this.name = "GameRedistributeRateLimitError";
  }
}
export class GameLastStandCooldownError extends Error {
  constructor(public retryAfterMs: number) {
    super("Last Stand is still on cooldown.");
    this.name = "GameLastStandCooldownError";
  }
}
export class GameLastStandRequiresZeroTurnsError extends Error {
  constructor() {
    super("Last Stand is only available when you have 0 turns remaining.");
    this.name = "GameLastStandRequiresZeroTurnsError";
  }
}
export class GameLastStandNoThreatError extends Error {
  constructor() {
    super("No inbound attack threat detected on that tile.");
    this.name = "GameLastStandNoThreatError";
  }
}

const COLLECTIONS = {
  PLAYERS: "game_players",
  TILES: "game_tiles",
  ATTACKS: "game_attacks",
  WORLD_META: "game_world_meta",
  ARTIFACTS: "game_artifacts",
  // Community feed: append-only event log of player actions (joins,
  // caste picks, attacks, milestones). Read by the dashboard's
  // CommunityPanel. Writes are Admin-SDK only.
  COMMUNITY_EVENTS: "game_community_events",
  // Community chat: free-form messages from authenticated players,
  // moderated by author or by an admin (delete-only).
  COMMUNITY_MESSAGES: "game_community_messages",
  // End-game / Armageddon hall-of-fame: one doc per past Armageddon
  // (doc id = seasonNumber). Persisted before the wipe so the record
  // survives even if the resolver crashes mid-batch.
  ARMAGEDDON_EVENTS: "game_armageddon_events",
  // Zero-turn gameplay: queued battle plans that execute at next weekly
  // grant. Owned by player; writes Admin-SDK only.
  ORDER_QUEUE: "game_order_queue",
} as const;

const WORLD_META_DOC = "singleton";

// Land types you can distribute a tile to. "unassigned" is allowed so the
// player can revert a tile back (and pay 1 turn for the privilege); they
// would then pay another turn to re-assign it. "unrevealed" stays
// non-distributable — a tile becomes unassigned via explore.
const VALID_DISTRIBUTABLE_TYPES = new Set<LandType>([
  "military",
  "food",
  "magic",
  "unassigned",
]);
const VALID_CASTES = new Set<Caste>(["black", "red", "white", "green", "blue"]);

function adminDbOrThrow() {
  const db = getAdminDb();
  if (!db) throw new Error("Firebase Admin not initialized");
  return db;
}

// ── End-game / Armageddon helpers ─────────────────────────────────────
// Coalesce a possibly-pre-Armageddon worldMeta doc to a full GameWorldMeta
// with safe defaults. Pre-Armageddon docs (and freshly-bootstrapped envs)
// don't have sealsBroken / armageddonState / seasonNumber set; treat
// season as 1 and state as "active" so legacy reads behave correctly.
function defaultedWorldMeta(raw: Partial<GameWorldMeta> | undefined): GameWorldMeta {
  return {
    playerCount: raw?.playerCount ?? 0,
    seasonNumber: raw?.seasonNumber ?? 1,
    sealsBroken: raw?.sealsBroken ?? 0,
    seals: raw?.seals ?? [],
    armageddonState: raw?.armageddonState ?? "active",
    armageddonStartedAt: raw?.armageddonStartedAt,
    armageddonResolvedAt: raw?.armageddonResolvedAt,
    lastSpawnAt: raw?.lastSpawnAt,
    updatedAt: raw?.updatedAt,
  };
}

/** Refuses turn-spending actions while the world is being remade. Also
 *  refuses stale player docs (left over from a prior season after a
 *  partial wipe — should be rare since the resolver deletes them, but
 *  defends against the edge case). Call this immediately after reading
 *  both the player doc and the worldMeta singleton inside a transaction. */
function assertGameActiveInTx(
  player: GamePlayer,
  worldMeta: GameWorldMeta
): void {
  if (worldMeta.armageddonState && worldMeta.armageddonState !== "active") {
    throw new GameArmageddonInProgressError();
  }
  const playerSeason = player.seasonNumber ?? 1;
  const worldSeason = worldMeta.seasonNumber ?? 1;
  if (playerSeason !== worldSeason) {
    throw new GameStaleSeasonError(playerSeason, worldSeason);
  }
}

/** Reads the world-meta singleton inside a transaction and returns a
 *  fully-defaulted GameWorldMeta. Mutators that need to update meta should
 *  hold the underlying doc reference; this helper just sources values. */
async function readWorldMetaInTx(
  tx: Transaction,
  db: Firestore
): Promise<{ meta: GameWorldMeta; ref: FirebaseFirestore.DocumentReference }> {
  const ref = db.collection(COLLECTIONS.WORLD_META).doc(WORLD_META_DOC);
  const snap = await tx.get(ref);
  const raw = snap.exists ? (snap.data() as Partial<GameWorldMeta>) : undefined;
  return { meta: defaultedWorldMeta(raw), ref };
}

/** Read-only world-meta fetch for dashboard / hall-of-fame surfacing.
 *  Returns the defaulted shape even when the doc doesn't exist yet. */
export async function getWorldMetaServer(): Promise<GameWorldMeta> {
  const db = adminDbOrThrow();
  const snap = await db
    .collection(COLLECTIONS.WORLD_META)
    .doc(WORLD_META_DOC)
    .get();
  const raw = snap.exists ? (snap.data() as Partial<GameWorldMeta>) : undefined;
  return defaultedWorldMeta(raw);
}

// Rolls (3% chance) for an artifact and stages a tx.set() to persist it if
// found. Returns both the rolled definition (for the report builder) and the
// persisted GameArtifact doc (for echoing back to the client so the inventory
// can be patched without a refetch).
//
// Each turn-spending action calls this exactly once per transaction. The
// seed includes turnsSpentTotal so consecutive turns roll independently;
// userId keeps players' streams uncorrelated.
function rollAndStageArtifact(
  tx: Transaction,
  db: Firestore,
  userId: string,
  turnsSpentTotalAfter: number,
  foundDuringAction: TurnAction,
  now: Date
): { definition: ArtifactDefinition; doc: GameArtifact } | null {
  const rng = makeSeededRng(`artifact:${userId}:${turnsSpentTotalAfter}`);
  const artifact = rollArtifact(rng);
  if (!artifact) return null;
  const artifactId = randomUUID();
  const artifactRef = db.collection(COLLECTIONS.ARTIFACTS).doc(artifactId);
  const doc: GameArtifact = {
    id: artifactId,
    ownerId: userId,
    definitionId: artifact.id,
    rarity: artifact.rarity,
    type: artifact.type,
    foundAtTurn: turnsSpentTotalAfter,
    foundDuringAction,
    used: false,
    createdAt: now,
    updatedAt: now,
  };
  tx.set(artifactRef, doc);
  return { definition: artifact, doc };
}

// Seeded RNG distinct from the artifact-roll RNG so the same line isn't
// always paired with the same drop. Each (player, turn, action) triplet maps
// to a deterministic narrative for replay-ability.
function makeNarrativeRng(
  userId: string,
  turnIndex: number,
  action: TurnAction
): () => number {
  return makeSeededRng(`narrative:${userId}:${turnIndex}:${action}`);
}

export async function getPlayerServer(
  userId: string
): Promise<GamePlayer | null> {
  const db = adminDbOrThrow();
  const snap = await db.collection(COLLECTIONS.PLAYERS).doc(userId).get();
  return snap.exists ? (snap.data() as GamePlayer) : null;
}

export async function getOwnedTilesServer(userId: string): Promise<GameTile[]> {
  const db = adminDbOrThrow();
  const snap = await db
    .collection(COLLECTIONS.TILES)
    .where("ownerId", "==", userId)
    .get();
  const playerSnap = await db.collection(COLLECTIONS.PLAYERS).doc(userId).get();
  const player = playerSnap.exists ? (playerSnap.data() as GamePlayer) : null;
  const tiles = snap.docs.map((d) => d.data() as GameTile);
  return applyLazyRegenBatch(tiles, player, new Date());
}

// In-memory + fire-and-forget Firestore writeback of BASE regen across a
// batch of tiles. Returns the regenerated tiles. Writes only fire for tiles
// where the BASE delta is non-zero (avoids write storms on read-heavy paths).
// The writes are not awaited — the caller's response uses the in-memory
// regen result; the next request reads the persisted values.
function applyLazyRegenBatch(
  tiles: GameTile[],
  player: GamePlayer | null,
  now: Date
): GameTile[] {
  const db = adminDbOrThrow();
  const out: GameTile[] = [];
  for (const t of tiles) {
    out.push(applyLazyRegen(t, player, now, db));
  }
  return out;
}

function applyLazyRegen(
  tile: GameTile,
  player: GamePlayer | null,
  now: Date,
  db: Firestore
): GameTile {
  if (!tile.ownerId) return tile;
  const currentBase = tile.baseUnits ?? { ground: 0, siege: 0, air: 0 };
  const target = baseUnitsTarget({
    landType: tile.type,
    caste: player?.caste ?? null,
    upgradeIds: tile.upgradeIds,
    intrinsicBuffs: tile.intrinsicBuffs,
    createdAt:
      tile.createdAt instanceof Date
        ? tile.createdAt
        : typeof (tile.createdAt as Timestamp | undefined)?.toDate === "function"
          ? (tile.createdAt as Timestamp).toDate()
          : undefined,
    activeUpgrades: player?.activeUpgrades ?? {},
    productionSpellsActive: player?.productionSpellsActive,
    now,
  });
  const baseRegenedAt =
    tile.baseRegenedAt instanceof Date
      ? tile.baseRegenedAt
      : typeof (tile.baseRegenedAt as Timestamp | undefined)?.toDate ===
          "function"
        ? (tile.baseRegenedAt as Timestamp).toDate()
        : tile.createdAt instanceof Date
          ? tile.createdAt
          : typeof (tile.createdAt as Timestamp | undefined)?.toDate ===
              "function"
            ? (tile.createdAt as Timestamp).toDate()
            : now;
  const result = applyBaseRegen({
    currentBase,
    target,
    landType: tile.type,
    baseRegenedAt,
    now,
  });
  if (result.deltaUnits <= 0) return tile;
  // Fire-and-forget Firestore writeback. Failures are logged inside the
  // surrounding logger; we don't await so the read path stays snappy.
  db.collection(COLLECTIONS.TILES)
    .doc(tile.tileId)
    .update({
      baseUnits: result.baseUnits,
      baseRegenedAt: result.baseRegenedAt,
    })
    .catch((e) => {
      logger.warn("applyLazyRegen writeback failed", {
        tileId: tile.tileId,
        error: e instanceof Error ? e.message : String(e),
      });
    });
  return {
    ...tile,
    baseUnits: result.baseUnits,
    baseRegenedAt: result.baseRegenedAt,
  };
}

// Lightweight tile fetch — uses Firestore's select() to only pull the fields
// the map/dashboard need. Same Firestore read cost (Firestore charges per
// doc, not per field), but ~60-70% smaller wire payload and JSON parse cost.
// For a 200-tile player this drops the response from ~200KB to ~70KB.
export async function getOwnedMapTilesServer(
  userId: string
): Promise<MapTile[]> {
  const db = adminDbOrThrow();
  const snap = await db
    .collection(COLLECTIONS.TILES)
    .where("ownerId", "==", userId)
    .select(
      "tileId",
      "q",
      "r",
      "type",
      "ownerId",
      "units",
      "baseUnits",
      "armedDefenseSpellId",
      "hero"
    )
    .get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      tileId: data.tileId,
      q: data.q,
      r: data.r,
      type: data.type,
      ownerId: data.ownerId ?? null,
      units: data.units,
      baseUnits: data.baseUnits ?? { ground: 0, siege: 0, air: 0 },
      armedDefenseSpellId: data.armedDefenseSpellId ?? null,
      ...(data.hero ? { hero: data.hero } : {}),
    } as MapTile;
  });
}

// Global map view. Returns every tile in the world with the lightweight
// MapTile projection. The whole world today is ~500 tiles (one batch); if it
// grows beyond a few thousand, callers should switch to
// `getMapTilesInBoundsServer` (viewport bounding-box).
export async function getAllMapTilesServer(): Promise<MapTile[]> {
  const db = adminDbOrThrow();
  const snap = await db
    .collection(COLLECTIONS.TILES)
    .select(
      "tileId",
      "q",
      "r",
      "type",
      "ownerId",
      "units",
      "baseUnits",
      "armedDefenseSpellId",
      "hero"
    )
    .get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      tileId: data.tileId,
      q: data.q,
      r: data.r,
      type: data.type,
      ownerId: data.ownerId ?? null,
      units: data.units,
      baseUnits: data.baseUnits ?? { ground: 0, siege: 0, air: 0 },
      armedDefenseSpellId: data.armedDefenseSpellId ?? null,
      ...(data.hero ? { hero: data.hero } : {}),
    } as MapTile;
  });
}

// Hard cap on the number of tiles a viewport bbox query may return. Keeps a
// runaway zoomed-out fetch from accidentally pulling the whole world.
const VIEWPORT_TILE_LIMIT = 5000;

// Viewport-bounded version of getAllMapTilesServer. Single-field range query
// on `q` (no composite index needed) plus an in-memory `r` filter — Firestore
// only allows one inequality field per query in this style.
//
// At our hex spacing (~500 tiles per world today), the in-memory `r` filter
// scans the full q-band; for a roughly square world this is approximately
// the bbox area. For larger worlds add a composite index on (q ASC, r ASC)
// and switch to two-field range; at 500 tiles the simple form is fine.
export async function getMapTilesInBoundsServer(bounds: {
  qMin: number;
  qMax: number;
  rMin: number;
  rMax: number;
}): Promise<MapTile[]> {
  const db = adminDbOrThrow();
  const snap = await db
    .collection(COLLECTIONS.TILES)
    .where("q", ">=", bounds.qMin)
    .where("q", "<=", bounds.qMax)
    .select(
      "tileId",
      "q",
      "r",
      "type",
      "ownerId",
      "units",
      "baseUnits",
      "armedDefenseSpellId",
      "hero"
    )
    .limit(VIEWPORT_TILE_LIMIT + 1)
    .get();
  if (snap.size > VIEWPORT_TILE_LIMIT) {
    throw new Error(
      `getMapTilesInBoundsServer: bbox returned more than ${VIEWPORT_TILE_LIMIT} tiles; narrow the range`
    );
  }
  const out: MapTile[] = [];
  for (const d of snap.docs) {
    const data = d.data();
    if (typeof data.r !== "number") continue;
    if (data.r < bounds.rMin || data.r > bounds.rMax) continue;
    out.push({
      tileId: data.tileId,
      q: data.q,
      r: data.r,
      type: data.type,
      ownerId: data.ownerId ?? null,
      units: data.units,
      baseUnits: data.baseUnits ?? { ground: 0, siege: 0, air: 0 },
      armedDefenseSpellId: data.armedDefenseSpellId ?? null,
      ...(data.hero ? { hero: data.hero } : {}),
    } as MapTile);
  }
  return out;
}

export interface OwnerSummary {
  userId: string;
  displayName: string;
  caste: Caste | null;
  shielded: boolean;
  /** True when this player is a seeded NPC. Real humans have the field
   *  unset on their player doc; we surface explicit `false` for them so
   *  client-side filters can rely on the boolean. */
  isNpc: boolean;
}

// Personal map view: my tiles + the *enemy* tiles that share an edge with
// any of my tiles + owner summaries for those enemies. Designed to be the
// default fetch for /game/tiles, /game/spells, /game/recruit — the rest of
// the world isn't relevant to those pages.
//
// Read cost: 1 query (own tiles) + 1 batched docRef.getAll() for the
// border ring + 1 batched docRef.getAll() for owner summaries. For a
// 25-tile spawn cluster: ~25 + ~30 + ~5 = ~60 reads (vs ~500 for the
// full-world fetch). Scales with kingdom perimeter, not world size.
export interface MyMapView {
  myTiles: MapTile[];
  borderTiles: MapTile[];
  owners: OwnerSummary[];
}

export async function getMyMapServer(
  userId: string,
  now: Date = new Date()
): Promise<MyMapView> {
  const db = adminDbOrThrow();
  const myTiles = await getOwnedMapTilesServer(userId);
  if (myTiles.length === 0) {
    return { myTiles: [], borderTiles: [], owners: [] };
  }

  // Build the set of neighbor tile ids that are NOT mine.
  const myIds = new Set(myTiles.map((t) => t.tileId));
  const neighborIds = new Set<string>();
  for (const t of myTiles) {
    for (const id of neighborTileIds(t.q, t.r)) {
      if (!myIds.has(id)) neighborIds.add(id);
    }
  }

  // Batch-fetch the border ring. We could pre-filter to only-existent docs,
  // but db.getAll handles missing docs cheaply (returns non-existent
  // snapshots) so a single round-trip is fine.
  const borderTiles: MapTile[] = [];
  const enemyOwnerIds = new Set<string>();
  if (neighborIds.size > 0) {
    const refs = [...neighborIds].map((id) =>
      db.collection(COLLECTIONS.TILES).doc(id)
    );
    const snaps = await db.getAll(...refs);
    for (const s of snaps) {
      if (!s.exists) continue;
      const data = s.data()!;
      // Per spec: only enemy tiles. Skip unowned and self-owned border
      // tiles entirely. Unowned-but-revealed neighbors don't load —
      // there's no enemy presence there to display.
      if (!data.ownerId || data.ownerId === userId) continue;
      borderTiles.push({
        tileId: data.tileId,
        q: data.q,
        r: data.r,
        type: data.type,
        ownerId: data.ownerId,
        units: data.units,
        baseUnits: data.baseUnits ?? { ground: 0, siege: 0, air: 0 },
        armedDefenseSpellId: data.armedDefenseSpellId ?? null,
      });
      enemyOwnerIds.add(data.ownerId);
    }
  }

  // Owner summaries for the enemies on our border.
  const owners: OwnerSummary[] = [];
  if (enemyOwnerIds.size > 0) {
    const ownerRefs = [...enemyOwnerIds].map((uid) =>
      db.collection(COLLECTIONS.PLAYERS).doc(uid)
    );
    const ownerSnaps = await db.getAll(...ownerRefs);
    for (const s of ownerSnaps) {
      if (!s.exists) continue;
      const p = s.data() as GamePlayer;
      owners.push({
        userId: p.userId,
        displayName: p.displayName ?? "",
        caste: p.caste ?? null,
        shielded: isShieldActive(p, now),
        isNpc: (p as { isNpc?: boolean }).isNpc === true,
      });
    }
  }

  return { myTiles, borderTiles, owners };
}

// Owner-side metadata for the global map: name, caste, shield status. One
// record per player; the client joins it onto tiles by ownerId.
export async function getAllOwnerSummariesServer(
  now: Date = new Date()
): Promise<OwnerSummary[]> {
  const db = adminDbOrThrow();
  const snap = await db
    .collection(COLLECTIONS.PLAYERS)
    .select(
      "userId",
      "displayName",
      "caste",
      "shieldUntil",
      "shieldDropAtTurn",
      "turnsSpentTotal",
      "isNpc"
    )
    .get();
  return snap.docs.map((d) => {
    const data = d.data() as GamePlayer & { isNpc?: boolean };
    return {
      userId: data.userId,
      displayName: data.displayName ?? "",
      caste: data.caste ?? null,
      shielded: isShieldActive(data, now),
      isNpc: data.isNpc === true,
    };
  });
}

export async function getTileServer(tileId: string): Promise<GameTile | null> {
  const db = adminDbOrThrow();
  const snap = await db.collection(COLLECTIONS.TILES).doc(tileId).get();
  if (!snap.exists) return null;
  const tile = snap.data() as GameTile;
  if (!tile.ownerId) return tile;
  const playerSnap = await db
    .collection(COLLECTIONS.PLAYERS)
    .doc(tile.ownerId)
    .get();
  const player = playerSnap.exists ? (playerSnap.data() as GamePlayer) : null;
  return applyLazyRegen(tile, player, new Date(), db);
}

// v2 — new players spawn with 25 already-revealed unassigned tiles, skipping
// the v1 "explore" phase entirely. Existing v1 player records aren't touched.
// Total claimed tiles per spawn. Increased from 25 → 100 (May 2026) when
// the v1 "explore" phase was reinstated as the first step of the onboarding
// wizard. All 100 are claimed-but-unrevealed at spawn; the wizard drives the
// player through revealing them via setupExploreServer (1 turn each).
export const NEW_PLAYER_TILE_COUNT = 100;
const NEW_PLAYER_CONTIGUOUS = 80;
const NEW_PLAYER_EXCLAVES_MIN = 3;
const NEW_PLAYER_EXCLAVES_MAX = 5;

// Atomic spawn for a brand-new player. Bumps a global player-count cursor so
// parallel spawns land on different centers.
export async function createPlayerWithSpawnServer(
  userId: string,
  rawDisplayName: string,
  now: Date = new Date()
): Promise<{ player: GamePlayer; tileIds: string[] }> {
  const db = adminDbOrThrow();
  const cleanedName = (() => {
    try {
      return validateGeneralName(rawDisplayName);
    } catch (e) {
      throw new GameInvalidNameError(
        e instanceof Error ? e.message : String(e)
      );
    }
  })();
  // Pre-flight uniqueness check outside the txn (transactions can't run
  // queries). The set inside the txn still guards against same-user double
  // spawn via GamePlayerAlreadyExistsError; a same-name race between two
  // brand-new users in the same instant is vanishingly rare given the
  // 4-player population, so we accept the small TOCTOU window.
  const taken = await isGeneralNameTakenServer(cleanedName, userId);
  if (taken) throw new GameNameTakenError();

  const playerRef = db.collection(COLLECTIONS.PLAYERS).doc(userId);
  const metaRef = db
    .collection(COLLECTIONS.WORLD_META)
    .doc(WORLD_META_DOC);

  return db.runTransaction(async (tx) => {
    const [playerSnap, metaSnap] = await Promise.all([
      tx.get(playerRef),
      tx.get(metaRef),
    ]);
    if (playerSnap.exists) throw new GamePlayerAlreadyExistsError();

    const startingPlayerCount = (metaSnap.data()?.playerCount as number) ?? 0;
    // The hex-spiral can land on a coord that an existing kingdom (planted
    // under the old left-to-right grid) already occupies. Walk the spiral
    // forward until the candidate center tile itself is unclaimed; the
    // BFS in spawnPlayerLands handles small local conflicts beyond that.
    const SPAWN_INDEX_MAX_RETRIES = 32;
    let playerCount = startingPlayerCount;
    let center = spawnCenterForPlayerIndex(playerCount);
    for (let attempt = 0; attempt < SPAWN_INDEX_MAX_RETRIES; attempt++) {
      const candidateId = tileIdFromAxial(center.q, center.r);
      const candidateSnap = await tx.get(
        db.collection(COLLECTIONS.TILES).doc(candidateId)
      );
      if (!candidateSnap.exists) break;
      playerCount += 1;
      center = spawnCenterForPlayerIndex(playerCount);
    }

    const seed = `spawn-${userId}-${playerCount}`;
    const spawn = spawnPlayerLands({
      center,
      claimedTileIds: new Set<string>(),
      rng: makeSeededRng(seed),
      totalTiles: NEW_PLAYER_TILE_COUNT,
      contiguousTarget: NEW_PLAYER_CONTIGUOUS,
      exclavesMin: NEW_PLAYER_EXCLAVES_MIN,
      exclavesMax: NEW_PLAYER_EXCLAVES_MAX,
    });

    const player = newPlayer(userId, now, {
      // Spawn into v1 "explore" phase with all 100 tiles claimed but
      // unrevealed. The onboarding wizard drives the player through
      // revealing each tile via setupExploreServer (1 turn each); the
      // server auto-advances phase → "distribute" at tilesExplored >= 100.
      initialPhase: "explore",
      tilesHeld: spawn.tileIds.length,
      tilesExplored: 0,
      displayName: cleanedName,
    });
    tx.set(playerRef, {
      ...player,
      displayNameLower: cleanedName.toLowerCase(),
    });

    for (const tileId of spawn.tileIds) {
      const tileRef = db.collection(COLLECTIONS.TILES).doc(tileId);
      const { q, r } = axialFromTileId(tileId);
      tx.set(tileRef, {
        tileId,
        q,
        r,
        ownerId: userId,
        // Claimed but hidden under fog. Wizard step 1 reveals each via
        // setupExploreServer, which flips type → "unassigned" and stamps
        // revealedAt at the moment of reveal.
        type: "unrevealed" as LandType,
        level: 0,
        units: { ground: 0, siege: 0, air: 0 },
        // BASE garrison stays zero on unrevealed; exploreNextTileServer
        // seeds it the moment the tile flips to unassigned.
        baseUnits: { ground: 0, siege: 0, air: 0 },
        baseRegenedAt: now,
        intrinsicBuffs: [],
        armedDefenseSpellId: null,
        neighborTileIds: neighborTileIds(q, r),
        upgradeIds: [],
        createdAt: now,
        updatedAt: now,
      });
    }

    tx.set(
      metaRef,
      { playerCount: playerCount + 1, lastSpawnAt: now, updatedAt: now },
      { merge: true }
    );

    // Community feed: announce the new general so existing players see
    // who just joined. Caste is null at this point (set later via
    // chooseCasteServer); we still log a join entry for funnel-tracking.
    logCommunityEventInTx(
      tx,
      db,
      {
        kind: "player_join",
        actorUserId: userId,
        actorDisplayName: cleanedName,
        actorCaste: null,
      },
      now
    );

    return { player, tileIds: spawn.tileIds };
  });
}

// Reveals one of the player's unrevealed tiles. Spends 1 turn. Auto-advances
// phase to `distribute` once all 100 are revealed.
export async function exploreNextTileServer(
  userId: string,
  now: Date = new Date()
): Promise<{
  player: GamePlayer;
  tile: GameTile;
  report: TurnReport;
  artifact: GameArtifact | null;
}> {
  const db = adminDbOrThrow();

  // Firestore transactions can't query — so pick a candidate tile outside the
  // transaction and re-validate inside. Race: someone else (admin script) might
  // reveal it between read and txn — handled by the type-check inside.
  const unrevealedSnap = await db
    .collection(COLLECTIONS.TILES)
    .where("ownerId", "==", userId)
    .where("type", "==", "unrevealed")
    .limit(1)
    .get();

  if (unrevealedSnap.empty) throw new GameNoUnrevealedTilesError();
  const tileId = unrevealedSnap.docs[0].id;
  const tileRef = db.collection(COLLECTIONS.TILES).doc(tileId);
  const playerRef = db.collection(COLLECTIONS.PLAYERS).doc(userId);

  return db.runTransaction(async (tx) => {
    const [tileSnap, playerSnap] = await Promise.all([
      tx.get(tileRef),
      tx.get(playerRef),
    ]);
    if (!playerSnap.exists) throw new GamePlayerNotFoundError();
    if (!tileSnap.exists) throw new GameTileNotFoundError();

    const player = playerSnap.data() as GamePlayer;
    const tile = tileSnap.data() as GameTile;

    if (tile.ownerId !== userId) throw new GameTileNotOwnedError();
    if (tile.type !== "unrevealed") throw new GameAlreadyRevealedError();
    if (player.phase !== "explore") {
      throw new GameInvalidPhaseError("explore", player.phase);
    }
    if (player.turnsRemaining < 1) {
      throw new GameInsufficientTurnsError(1, player.turnsRemaining);
    }

    const tilesExplored = player.tilesExplored + 1;
    const phase = tilesExplored >= 100 ? "distribute" : player.phase;
    const turnsSpentTotal = player.turnsSpentTotal + 1;

    const rolled = rollAndStageArtifact(
      tx,
      db,
      userId,
      turnsSpentTotal,
      "explore",
      now
    );
    const artifact = rolled?.definition ?? null;

    // Seed BASE garrison the moment the tile flips out of unrevealed —
    // unassigned tiles get the LAND_TYPE_BASE seed scaled by caste, which
    // ensures every revealed tile has a real defensive floor.
    const exploreCreatedAt: Date | undefined =
      tile.createdAt instanceof Date
        ? tile.createdAt
        : typeof (tile.createdAt as Timestamp | undefined)?.toDate === "function"
          ? (tile.createdAt as Timestamp).toDate()
          : undefined;
    const initialBaseUnits = baseUnitsTarget({
      landType: "unassigned",
      caste: player.caste,
      upgradeIds: tile.upgradeIds,
      intrinsicBuffs: tile.intrinsicBuffs,
      createdAt: exploreCreatedAt,
      activeUpgrades: player.activeUpgrades ?? {},
      productionSpellsActive: player.productionSpellsActive,
      now,
    });

    tx.update(tileRef, {
      type: "unassigned" as LandType,
      revealedAt: now,
      baseUnits: initialBaseUnits,
      baseRegenedAt: now,
      updatedAt: now,
    });
    tx.update(playerRef, {
      tilesExplored,
      turnsRemaining: player.turnsRemaining - 1,
      turnsSpentTotal,
      phase,
      updatedAt: now,
    });

    const updatedTile: GameTile = {
      ...tile,
      type: "unassigned",
      baseUnits: initialBaseUnits,
      baseRegenedAt: now,
      revealedAt: now,
      updatedAt: now,
    };

    const report = buildExploreReport(
      turnsSpentTotal,
      updatedTile,
      artifact,
      makeNarrativeRng(userId, turnsSpentTotal, "explore")
    );

    return {
      player: {
        ...player,
        tilesExplored,
        turnsRemaining: player.turnsRemaining - 1,
        turnsSpentTotal,
        phase,
        updatedAt: now,
      },
      tile: updatedTile,
      report,
      artifact: rolled?.doc ?? null,
    };
  });
}

export async function listArtifactsServer(opts: {
  userId: string;
  limit: number;
  cursor: string | null;
}): Promise<PaginatedQueryResult<GameArtifact>> {
  const db = adminDbOrThrow();
  const artifacts = db.collection(COLLECTIONS.ARTIFACTS);
  // Composite index (ownerId ASC, foundAtTurn DESC) is declared in
  // config/firebase/firestore.indexes.json — required for this orderBy.
  const query = artifacts
    .where("ownerId", "==", opts.userId)
    .orderBy("foundAtTurn", "desc");
  return paginateFirestoreQuery({
    query,
    collection: artifacts,
    cursor: opts.cursor,
    limit: opts.limit,
    mapDoc: (d) => d.data() as GameArtifact,
  });
}

// Sets or changes a tile's type (military / food / magic). Costs 1 turn,
// regardless of whether this is a first assignment or a re-assignment.
export async function distributeTileServer(
  userId: string,
  tileId: string,
  type: LandType,
  now: Date = new Date()
): Promise<{
  player: GamePlayer;
  tile: GameTile;
  report: TurnReport;
  artifact: GameArtifact | null;
}> {
  if (!VALID_DISTRIBUTABLE_TYPES.has(type)) {
    throw new GameInvalidLandTypeError(type);
  }

  const db = adminDbOrThrow();
  const tileRef = db.collection(COLLECTIONS.TILES).doc(tileId);
  const playerRef = db.collection(COLLECTIONS.PLAYERS).doc(userId);

  return db.runTransaction(async (tx) => {
    const [tileSnap, playerSnap] = await Promise.all([
      tx.get(tileRef),
      tx.get(playerRef),
    ]);
    if (!playerSnap.exists) throw new GamePlayerNotFoundError();
    if (!tileSnap.exists) throw new GameTileNotFoundError();

    const player = playerSnap.data() as GamePlayer;
    const tile = tileSnap.data() as GameTile;

    if (tile.ownerId !== userId) throw new GameTileNotOwnedError();
    if (tile.type === "unrevealed") throw new GameTileUnrevealedError();
    if (player.phase !== "distribute" && player.phase !== "play") {
      throw new GameInvalidPhaseError("distribute|play", player.phase);
    }
    if (player.turnsRemaining < 1) {
      throw new GameInsufficientTurnsError(1, player.turnsRemaining);
    }

    const turnsSpentTotal = player.turnsSpentTotal + 1;
    const rolled = rollAndStageArtifact(
      tx,
      db,
      userId,
      turnsSpentTotal,
      "distribute",
      now
    );
    const artifact = rolled?.definition ?? null;

    // Re-seed BASE garrison toward the new land type's target. We don't
    // snap to the new target instantly; the existing baseUnits stay (the
    // militia don't disappear when you re-zone), but we update
    // baseRegenedAt so the next regen tick aims at the new type's target.
    // Exception: if the tile is being re-typed away from a developed
    // type back to unassigned, leave baseUnits alone and let lazy regen
    // decay it (a future enhancement; for now no decay).
    const createdAtDate: Date | undefined =
      tile.createdAt instanceof Date
        ? tile.createdAt
        : typeof (tile.createdAt as Timestamp | undefined)?.toDate === "function"
          ? (tile.createdAt as Timestamp).toDate()
          : undefined;
    const newBaseTarget = baseUnitsTarget({
      landType: type,
      caste: player.caste,
      upgradeIds: tile.upgradeIds,
      intrinsicBuffs: tile.intrinsicBuffs,
      createdAt: createdAtDate,
      activeUpgrades: player.activeUpgrades ?? {},
      productionSpellsActive: player.productionSpellsActive,
      now,
    });
    // If existing baseUnits is below the new target, jump to halfway —
    // distribute-as-promotion shouldn't be an instant-full-garrison cheat.
    const currentBase = tile.baseUnits ?? { ground: 0, siege: 0, air: 0 };
    const seededBase = {
      ground: Math.max(
        currentBase.ground,
        Math.floor((currentBase.ground + newBaseTarget.ground) / 2)
      ),
      siege: Math.max(
        currentBase.siege,
        Math.floor((currentBase.siege + newBaseTarget.siege) / 2)
      ),
      air: Math.max(
        currentBase.air,
        Math.floor((currentBase.air + newBaseTarget.air) / 2)
      ),
    };

    tx.update(tileRef, {
      type,
      baseUnits: seededBase,
      baseRegenedAt: now,
      updatedAt: now,
    });
    tx.update(playerRef, {
      turnsRemaining: player.turnsRemaining - 1,
      turnsSpentTotal,
      updatedAt: now,
    });

    const report = buildDistributeReport({
      turnIndex: turnsSpentTotal,
      tileId,
      newType: type,
      artifactFound: artifact,
      rng: makeNarrativeRng(userId, turnsSpentTotal, "distribute"),
    });

    return {
      player: {
        ...player,
        turnsRemaining: player.turnsRemaining - 1,
        turnsSpentTotal,
        updatedAt: now,
      },
      tile: {
        ...tile,
        type,
        baseUnits: seededBase,
        baseRegenedAt: now,
        updatedAt: now,
      },
      report,
      artifact: rolled?.doc ?? null,
    };
  });
}

// Bulk variant of distribute. Reads {player + N tile refs} in one batch via
// getAll, validates and computes new types in memory, accumulates artifact
// rolls + reports per step, then commits everything in one transaction.
//
// Stops cleanly with `stoppedEarly` if a step fails (out of turns, tile not
// owned, etc.) — earlier successful steps are retained. Cap at 100 tiles per
// call to keep us under Firestore's 500-ops-per-txn limit (worst case:
// 1 player update + 100 tile updates + 100 artifact writes = 201 ops).
export async function bulkDistributeTilesServer(
  userId: string,
  tileIds: ReadonlyArray<string>,
  type: LandType,
  now: Date = new Date()
): Promise<{
  player: GamePlayer;
  tiles: GameTile[];
  reports: TurnReport[];
  artifacts: GameArtifact[];
  stoppedEarly?: string;
}> {
  if (!VALID_DISTRIBUTABLE_TYPES.has(type)) {
    throw new GameInvalidLandTypeError(type);
  }
  if (tileIds.length === 0) {
    throw new Error("bulkDistributeTilesServer: tileIds must not be empty");
  }
  if (tileIds.length > 100) {
    throw new Error(
      `bulkDistributeTilesServer: at most 100 tiles per call (got ${tileIds.length})`
    );
  }

  const db = adminDbOrThrow();
  const playerRef = db.collection(COLLECTIONS.PLAYERS).doc(userId);
  const tileRefs = tileIds.map((id) =>
    db.collection(COLLECTIONS.TILES).doc(id)
  );

  return db.runTransaction(async (tx) => {
    // Single batched read of player + every tile.
    const snaps = await tx.getAll(playerRef, ...tileRefs);
    const playerSnap = snaps[0];
    const tileSnaps = snaps.slice(1);
    if (!playerSnap.exists) throw new GamePlayerNotFoundError();
    const player = playerSnap.data() as GamePlayer;

    if (player.phase !== "distribute" && player.phase !== "play") {
      throw new GameInvalidPhaseError("distribute|play", player.phase);
    }

    const reports: TurnReport[] = [];
    const updatedTiles: GameTile[] = [];
    const artifacts: GameArtifact[] = [];
    let turnsRemaining = player.turnsRemaining;
    let turnsSpentTotal = player.turnsSpentTotal;
    let stoppedEarly: string | undefined;

    for (let i = 0; i < tileIds.length; i++) {
      const tileSnap = tileSnaps[i];
      const tileId = tileIds[i];

      // First-step failures throw (caller's error mapper picks the HTTP status).
      // Subsequent failures stop the batch cleanly with stoppedEarly so the
      // earlier-succeeded steps still commit.
      const isFirst = i === 0;

      if (!tileSnap.exists) {
        if (isFirst) throw new GameTileNotFoundError();
        stoppedEarly = `tile ${tileId} not found`;
        break;
      }
      const tile = tileSnap.data() as GameTile;

      if (tile.ownerId !== userId) {
        if (isFirst) throw new GameTileNotOwnedError();
        stoppedEarly = `tile ${tileId} not owned`;
        break;
      }
      if (tile.type === "unrevealed") {
        if (isFirst) throw new GameTileUnrevealedError();
        stoppedEarly = `tile ${tileId} unrevealed`;
        break;
      }
      if (turnsRemaining < 1) {
        if (isFirst) {
          throw new GameInsufficientTurnsError(1, turnsRemaining);
        }
        stoppedEarly = `out of turns at step ${i}`;
        break;
      }

      // Skip no-op writes when the requested type matches current type. Still
      // costs no turns and rolls no artifact — pure silent skip. Keeps the
      // bulk caller from accidentally double-paying for the current state.
      if (tile.type === type) {
        // Append a no-op-ish report so the caller can see we visited.
        // Cost 0 — no turn spent.
        continue;
      }

      turnsRemaining -= 1;
      turnsSpentTotal += 1;

      const rolled = rollAndStageArtifact(
        tx,
        db,
        userId,
        turnsSpentTotal,
        "distribute",
        now
      );
      const artifact = rolled?.definition ?? null;
      if (rolled) artifacts.push(rolled.doc);

      tx.update(tileRefs[i], { type, updatedAt: now });
      const updatedTile: GameTile = { ...tile, type, updatedAt: now };
      updatedTiles.push(updatedTile);

      reports.push(
        buildDistributeReport({
          turnIndex: turnsSpentTotal,
          tileId,
          newType: type,
          artifactFound: artifact,
          rng: makeNarrativeRng(userId, turnsSpentTotal, "distribute"),
        })
      );
    }

    // Single player write at the end with the accumulated debits.
    if (
      turnsRemaining !== player.turnsRemaining ||
      turnsSpentTotal !== player.turnsSpentTotal
    ) {
      tx.update(playerRef, {
        turnsRemaining,
        turnsSpentTotal,
        updatedAt: now,
      });
    }

    const updatedPlayer: GamePlayer = {
      ...player,
      turnsRemaining,
      turnsSpentTotal,
      updatedAt: now,
    };

    return {
      player: updatedPlayer,
      tiles: updatedTiles,
      reports,
      artifacts,
      stoppedEarly,
    };
  });
}

// Threshold at which a player unlocks a one-time caste change. The first
// caste pick (chooseCasteServer) is treated as "experimental" — once the
// player reaches this many tiles held they can switch castes once more,
// and that second pick is permanent (casteChangesUsed flips to 1).
export const CASTE_CHANGE_TILES_THRESHOLD = 1000;

// One-time caste switch after the player has built up real territory. Same
// shape as chooseCasteServer (free of turn cost; Admin SDK only) but with a
// different precondition set: player must already be in `play` with a caste,
// must have hit the tilesHeld threshold, must not have switched before, and
// must be picking a different caste than they currently have.
//
// Increments `casteChangesUsed` to 1 — after this call, subsequent attempts
// throw `GameCasteChangeUnavailableError`.
export async function changeCasteServer(
  userId: string,
  newCaste: Caste,
  now: Date = new Date()
): Promise<GamePlayer> {
  if (!VALID_CASTES.has(newCaste)) throw new GameInvalidCasteError(newCaste);

  const db = adminDbOrThrow();
  const playerRef = db.collection(COLLECTIONS.PLAYERS).doc(userId);

  return db.runTransaction(async (tx) => {
    const playerSnap = await tx.get(playerRef);
    if (!playerSnap.exists) throw new GamePlayerNotFoundError();
    const player = playerSnap.data() as GamePlayer;

    if (player.phase !== "play") {
      throw new GameInvalidPhaseError("play", player.phase);
    }
    if (player.caste === null) {
      throw new GameCasteChangeUnavailableError(
        "no caste set — pick one first via /api/game/setup/caste"
      );
    }
    if (player.caste === newCaste) {
      throw new GameCasteChangeUnavailableError(
        `already playing as ${newCaste}`
      );
    }
    if (player.stats.tilesHeld < CASTE_CHANGE_TILES_THRESHOLD) {
      throw new GameCasteChangeUnavailableError(
        `requires tilesHeld >= ${CASTE_CHANGE_TILES_THRESHOLD} (have ${player.stats.tilesHeld})`
      );
    }
    if ((player.casteChangesUsed ?? 0) >= 1) {
      throw new GameCasteChangeUnavailableError(
        "caste change already used; further changes are not allowed"
      );
    }

    const updates = {
      caste: newCaste,
      casteLockedAt: now,
      casteChangesUsed: 1,
      updatedAt: now,
    };
    tx.update(playerRef, updates);
    logCommunityEventInTx(
      tx,
      db,
      {
        kind: "caste_change",
        actorUserId: userId,
        actorDisplayName: player.displayName,
        actorCaste: newCaste,
        fromCaste: player.caste,
        toCaste: newCaste,
      },
      now
    );
    return { ...player, ...updates };
  });
}

// Locks the player's caste and advances phase from `distribute` → `play`.
// Free of turn cost.
export async function chooseCasteServer(
  userId: string,
  caste: Caste,
  now: Date = new Date()
): Promise<GamePlayer> {
  if (!VALID_CASTES.has(caste)) throw new GameInvalidCasteError(caste);

  const db = adminDbOrThrow();
  const playerRef = db.collection(COLLECTIONS.PLAYERS).doc(userId);

  return db.runTransaction(async (tx) => {
    const playerSnap = await tx.get(playerRef);
    if (!playerSnap.exists) throw new GamePlayerNotFoundError();
    const player = playerSnap.data() as GamePlayer;

    if (player.caste !== null) throw new GameCasteAlreadySetError();
    if (player.phase !== "distribute" && player.phase !== "caste") {
      throw new GameInvalidPhaseError("distribute|caste", player.phase);
    }

    const updates = {
      caste,
      casteLockedAt: now,
      phase: "play" as const,
      updatedAt: now,
    };
    tx.update(playerRef, updates);
    logCommunityEventInTx(
      tx,
      db,
      {
        kind: "caste_pick",
        actorUserId: userId,
        actorDisplayName: player.displayName,
        actorCaste: caste,
      },
      now
    );
    return { ...player, ...updates };
  });
}

function sumStack(s: UnitStack): number {
  return s.ground + s.siege + s.air;
}

function addStack(a: UnitStack, b: UnitStack): UnitStack {
  return {
    ground: a.ground + b.ground,
    siege: a.siege + b.siege,
    air: a.air + b.air,
  };
}

function subtractStack(a: UnitStack, b: UnitStack): UnitStack {
  return {
    ground: Math.max(0, a.ground - b.ground),
    siege: Math.max(0, a.siege - b.siege),
    air: Math.max(0, a.air - b.air),
  };
}

function stackHasAtLeast(have: UnitStack, need: UnitStack): boolean {
  return (
    have.ground >= need.ground &&
    have.siege >= need.siege &&
    have.air >= need.air
  );
}

function isValidUnitStack(s: unknown): s is UnitStack {
  if (!s || typeof s !== "object") return false;
  const obj = s as Record<string, unknown>;
  return (
    typeof obj.ground === "number" &&
    typeof obj.siege === "number" &&
    typeof obj.air === "number" &&
    obj.ground >= 0 &&
    obj.siege >= 0 &&
    obj.air >= 0 &&
    Number.isInteger(obj.ground) &&
    Number.isInteger(obj.siege) &&
    Number.isInteger(obj.air)
  );
}

// Counts the player's tiles by land type. Done OUTSIDE the build/attack
// transactions because Firestore txns can't query — the count is at most one
// turn stale, which is acceptable for the cap check.
async function getOwnedLandCounts(
  userId: string
): Promise<Record<"food" | "magic" | "military", number>> {
  const summary = await getOwnedTileSummary(userId);
  return summary.counts;
}

/** Scans the player's owned military/food/magic tiles once and returns
 *  both the land-type counts and the list of heroes stationed on them.
 *  Used by callers that need to compute farm-hero kingdom buffs or
 *  magic-hero Armageddon contributions alongside the standard land counts.
 *  Single Firestore query — no extra cost over `getOwnedLandCounts`. */
async function getOwnedTileSummary(userId: string): Promise<{
  counts: Record<"food" | "magic" | "military", number>;
  heroes: GameHero[];
}> {
  const db = adminDbOrThrow();
  const snap = await db
    .collection(COLLECTIONS.TILES)
    .where("ownerId", "==", userId)
    .where("type", "in", ["food", "magic", "military"])
    .get();
  const counts = { food: 0, magic: 0, military: 0 };
  const heroes: GameHero[] = [];
  for (const d of snap.docs) {
    const tile = d.data() as GameTile;
    if (tile.type === "food" || tile.type === "magic" || tile.type === "military") {
      counts[tile.type] += 1;
    }
    if (tile.hero) heroes.push(tile.hero);
  }
  return { counts, heroes };
}

// Builds units of `unitType` on `tileId`. Tile must be owned by the player
// and be a recruitable land type (military, food, or magic). Costs
// BUILD_UNITS_TURN_COST and produces unitsPerTurnForLand(tile.type) units —
// military trains 10/turn, food/magic 5/turn (May 2026 mechanics rework).
export async function buildUnitsServer(
  userId: string,
  tileId: string,
  unitType: UnitType,
  now: Date = new Date()
): Promise<{
  player: GamePlayer;
  tile: GameTile;
  produced: number;
  report: TurnReport;
  artifact: GameArtifact | null;
}> {
  const db = adminDbOrThrow();
  // Pre-txn read pulls both land counts and the player's hero roster in
  // one Firestore query (see `getOwnedTileSummary`). The farm-hero
  // kingdom buff is computed here so we never have to scan tiles inside
  // the txn (Firestore txns can't query).
  const summary = await getOwnedTileSummary(userId);
  const counts = summary.counts;

  const tileRef = db.collection(COLLECTIONS.TILES).doc(tileId);
  const playerRef = db.collection(COLLECTIONS.PLAYERS).doc(userId);

  return db.runTransaction(async (tx) => {
    const [tileSnap, playerSnap] = await Promise.all([
      tx.get(tileRef),
      tx.get(playerRef),
    ]);
    if (!playerSnap.exists) throw new GamePlayerNotFoundError();
    if (!tileSnap.exists) throw new GameTileNotFoundError();

    const player = playerSnap.data() as GamePlayer;
    const tile = tileSnap.data() as GameTile;

    if (tile.ownerId !== userId) throw new GameTileNotOwnedError();
    // Recruit gate is on the land type itself — unrevealed/unassigned
    // tiles have no base production. Heroes multiply the rate but can't
    // unlock a non-recruitable tile.
    const baseUnitsThisCycle = unitsPerTurnForLand(tile.type);
    if (baseUnitsThisCycle <= 0) {
      throw new GameTileTypeError("military", tile.type);
    }
    // Farm-hero kingdom buff + per-tile-type specialty multiplier. The
    // kingdom buff sums all farm heroes (capped); the specialty multiplier
    // fires only when THIS tile's farm hero matches the unit type being
    // recruited.
    const farmHeroBuff = computeFarmHeroKingdomBuff(
      summary.heroes,
      player.turnsSpentTotal
    );
    const tileFarmHero =
      tile.hero && tile.hero.class === "farm"
        ? applyStaminaRegen(tile.hero, player.turnsSpentTotal)
        : null;
    const tileTypeMult = tileFarmHero
      ? specialtyTypeRecruitMult(tileFarmHero, unitType)
      : 1;
    const unitsThisCycle = Math.max(
      1,
      Math.round(baseUnitsThisCycle * (1 + farmHeroBuff) * tileTypeMult)
    );
    if (player.phase !== "play") {
      throw new GameInvalidPhaseError("play", player.phase);
    }
    if (player.turnsRemaining < BUILD_UNITS_TURN_COST) {
      throw new GameInsufficientTurnsError(
        BUILD_UNITS_TURN_COST,
        player.turnsRemaining
      );
    }

    const cap = effectiveUnitCap(player, counts.food, counts.magic);
    if (player.stats.unitsAlive + unitsThisCycle > cap) {
      throw new GameUnitCapExceededError(cap, player.stats.unitsAlive);
    }

    const turnsSpentTotal = player.turnsSpentTotal + BUILD_UNITS_TURN_COST;
    const rolled = rollAndStageArtifact(
      tx,
      db,
      userId,
      turnsSpentTotal,
      "build",
      now
    );
    const artifact = rolled?.definition ?? null;

    const newUnits: UnitStack = { ...tile.units, [unitType]: tile.units[unitType] + unitsThisCycle };

    // Hero emergence (food tiles only). Rolls AFTER the recruit is locked
    // in; if a hero emerges, persist on the tile and bump player heroCount.
    let emergedHero: GameHero | null = null;
    if (tile.type === "food" && tile.hero == null && player.caste) {
      const emergeRng = makeSeededRng(`hero-emerge-build-${userId}-${turnsSpentTotal}`);
      emergedHero = maybeEmergeHero({
        class: "farm",
        tile,
        ownerId: userId,
        ownerCaste: player.caste,
        turnIndex: turnsSpentTotal,
        rng: emergeRng,
      });
    }

    // Special-unit roll: tile has a farm hero (regen-applied above) →
    // each recruit gets a chance to spawn a caste-themed named unit into
    // the player's summonable pool. Uses an independent rng so emergence
    // and special-unit rolls don't share entropy.
    let summonedSpecialUnit: SpecialUnitInstance | null = null;
    if (
      tileFarmHero &&
      player.caste &&
      pickSpecialUnitDef(player.caste, () => 0) !== null
    ) {
      const suRng = makeSeededRng(
        `hero-special-unit-${userId}-${tileId}-${turnsSpentTotal}`
      );
      const chance =
        FARM_SPECIAL_UNIT_ROLL * specialtyRecruitMult(tileFarmHero);
      if (suRng() < chance) {
        const def = pickSpecialUnitDef(player.caste, suRng);
        if (def) {
          summonedSpecialUnit = {
            instanceId: randomUUID(),
            defId: def.id,
            spawnedAtTurn: turnsSpentTotal,
          };
        }
      }
    }

    const heroOnTileNext = emergedHero ?? tile.hero ?? null;
    const tileUpdate: Partial<GameTile> & { updatedAt: Date } = {
      units: newUnits,
      updatedAt: now,
    };
    if (emergedHero) tileUpdate.hero = emergedHero;
    tx.update(tileRef, tileUpdate);

    const nextSummonableSpecialUnits = summonedSpecialUnit
      ? [...(player.summonableSpecialUnits ?? []), summonedSpecialUnit]
      : player.summonableSpecialUnits;
    const playerUpdate: Record<string, unknown> = {
      turnsRemaining: player.turnsRemaining - BUILD_UNITS_TURN_COST,
      turnsSpentTotal,
      stats: {
        ...player.stats,
        unitsAlive: player.stats.unitsAlive + unitsThisCycle,
      },
      updatedAt: now,
    };
    if (emergedHero) {
      playerUpdate.heroCount = (player.heroCount ?? 0) + 1;
    }
    if (nextSummonableSpecialUnits) {
      playerUpdate.summonableSpecialUnits = nextSummonableSpecialUnits;
    }
    tx.update(playerRef, playerUpdate);

    if (emergedHero) {
      logCommunityEventInTx(
        tx,
        db,
        {
          kind: "hero_emerged",
          actorUserId: userId,
          actorDisplayName: player.displayName,
          actorCaste: player.caste,
          tileId,
          heroId: emergedHero.id,
          heroName: emergedHero.name,
          heroClass: emergedHero.class,
          heroSpecialty: emergedHero.specialty,
        },
        now
      );
    }

    // v2 registry: dual-write the persistent record + an `emerged` event
    // on emergence, and a `recruited` / `special_unit_summoned` event on
    // the relevant tile's farm hero (regen-applied above as `tileFarmHero`).
    const playerSeasonNumber = player.seasonNumber ?? 1;
    if (emergedHero) {
      upsertHeroInTx({ tx, db, hero: emergedHero, seasonNumber: playerSeasonNumber, now });
      appendHeroEventInTx({
        tx,
        db,
        heroId: emergedHero.id,
        event: heroEvent.emerged(emergedHero, playerSeasonNumber),
        now,
      });
    }
    if (tileFarmHero) {
      appendHeroEventInTx({
        tx,
        db,
        heroId: tileFarmHero.id,
        event: heroEvent.recruited({
          tileId,
          ownerIdAtTime: userId,
          unitType,
          unitsBuilt: unitsThisCycle,
          seasonNumber: playerSeasonNumber,
        }),
        now,
      });
      if (summonedSpecialUnit) {
        appendHeroEventInTx({
          tx,
          db,
          heroId: tileFarmHero.id,
          event: heroEvent.specialUnitSummoned({
            tileId,
            ownerIdAtTime: userId,
            specialUnitDefId: summonedSpecialUnit.defId,
            seasonNumber: playerSeasonNumber,
          }),
          now,
        });
      }
    }

    const report = buildBuildReport({
      turnIndex: turnsSpentTotal,
      cost: BUILD_UNITS_TURN_COST,
      tileId,
      unitType,
      unitsBuilt: unitsThisCycle,
      artifactFound: artifact,
      rng: makeNarrativeRng(userId, turnsSpentTotal, "build"),
      heroEmerged: emergedHero,
      specialUnitSummoned: summonedSpecialUnit
        ? {
            instanceId: summonedSpecialUnit.instanceId,
            defId: summonedSpecialUnit.defId,
            name:
              SPECIAL_UNITS_BY_ID.get(summonedSpecialUnit.defId)?.name ??
              summonedSpecialUnit.defId,
          }
        : null,
    });

    return {
      player: {
        ...player,
        turnsRemaining: player.turnsRemaining - BUILD_UNITS_TURN_COST,
        turnsSpentTotal,
        stats: {
          ...player.stats,
          unitsAlive: player.stats.unitsAlive + unitsThisCycle,
        },
        heroCount: emergedHero
          ? (player.heroCount ?? 0) + 1
          : player.heroCount,
        summonableSpecialUnits: nextSummonableSpecialUnits,
        updatedAt: now,
      },
      tile: {
        ...tile,
        units: newUnits,
        hero: heroOnTileNext ?? undefined,
        updatedAt: now,
      },
      produced: unitsThisCycle,
      report,
      artifact: rolled?.doc ?? null,
    };
  });
}

export interface BulkBuildPlanEntry {
  tileId: string;
  unitType: UnitType;
  // Each cycle = BUILD_UNITS_TURN_COST turns + unitsPerTurnForLand(tile.type)
  // units. Military tiles produce 10/cycle, food/magic 5/cycle.
  cycles: number;
}

// Bulk build. Reads {player + 1 land-counts query + N tile refs} once, runs
// each plan entry's `cycles` build steps in memory (each step costs
// BUILD_UNITS_TURN_COST turns and adds unitsPerTurnForLand(tile.type) units),
// accumulates artifact rolls + reports, and writes everything in one
// transaction.
//
// Stops cleanly with stoppedEarly if a step would exceed the unit cap or
// the player runs out of turns mid-batch — earlier-succeeded steps still commit.
//
// Cap total cycles at 100 to stay under Firestore's 500-ops-per-txn limit
// (worst case: 1 player + N tiles + 100 artifact creates ≈ 101+N writes).
export async function bulkBuildUnitsServer(
  userId: string,
  plan: ReadonlyArray<BulkBuildPlanEntry>,
  now: Date = new Date()
): Promise<{
  player: GamePlayer;
  tiles: GameTile[];
  produced: number;
  reports: TurnReport[];
  artifacts: GameArtifact[];
  stoppedEarly?: string;
}> {
  if (plan.length === 0) {
    throw new Error("bulkBuildUnitsServer: plan must not be empty");
  }
  const totalCycles = plan.reduce((sum, p) => sum + Math.max(0, p.cycles), 0);
  if (totalCycles === 0) {
    throw new Error("bulkBuildUnitsServer: total cycles must be > 0");
  }
  if (totalCycles > 100) {
    throw new Error(
      `bulkBuildUnitsServer: at most 100 cycles per call (got ${totalCycles})`
    );
  }
  for (const p of plan) {
    if (p.unitType !== "ground" && p.unitType !== "siege" && p.unitType !== "air") {
      throw new Error(`bulkBuildUnitsServer: invalid unit type ${p.unitType}`);
    }
  }

  const db = adminDbOrThrow();
  // One owned-tiles query, pulled with hero data (used for the kingdom-wide
  // farm-hero recruit buff inside the loop).
  const summary = await getOwnedTileSummary(userId);
  const counts = summary.counts;
  const playerRef = db.collection(COLLECTIONS.PLAYERS).doc(userId);
  // Dedupe tile refs in case the plan visits the same tile twice (round-robin
  // over a small mil-tile pool will). We still issue one tx.update per tile
  // at the end; the dedupe keeps the read set tight.
  const uniqueTileIds = Array.from(new Set(plan.map((p) => p.tileId)));
  const tileRefs = uniqueTileIds.map((id) =>
    db.collection(COLLECTIONS.TILES).doc(id)
  );

  return db.runTransaction(async (tx) => {
    const snaps = await tx.getAll(playerRef, ...tileRefs);
    const playerSnap = snaps[0];
    const tileSnaps = snaps.slice(1);
    if (!playerSnap.exists) throw new GamePlayerNotFoundError();
    const player = playerSnap.data() as GamePlayer;

    if (player.phase !== "play") {
      throw new GameInvalidPhaseError("play", player.phase);
    }

    // In-memory tile state keyed by tileId. We mutate copies as we go and
    // commit them once at the end.
    const tilesById = new Map<string, GameTile>();
    for (let i = 0; i < uniqueTileIds.length; i++) {
      const id = uniqueTileIds[i];
      const snap = tileSnaps[i];
      if (!snap.exists) throw new GameTileNotFoundError();
      const tile = snap.data() as GameTile;
      if (tile.ownerId !== userId) throw new GameTileNotOwnedError();
      if (unitsPerTurnForLand(tile.type) <= 0) {
        // unrevealed/unassigned can't recruit. Reuse the existing tile-type
        // error shape for client compatibility.
        throw new GameTileTypeError("military", tile.type);
      }
      tilesById.set(id, tile);
    }

    const cap = effectiveUnitCap(player, counts.food, counts.magic);
    let unitsAlive = player.stats.unitsAlive;
    let turnsRemaining = player.turnsRemaining;
    let turnsSpentTotal = player.turnsSpentTotal;
    let heroCount = player.heroCount ?? 0;
    let summonableSpecialUnits: SpecialUnitInstance[] | undefined =
      player.summonableSpecialUnits;
    let stoppedEarly: string | undefined;

    const reports: TurnReport[] = [];
    const artifacts: GameArtifact[] = [];
    let stepIndex = 0;
    let producedTotal = 0;

    // Farm-hero kingdom buff is fixed for the whole bulk session — we
    // computed it from the pre-txn summary. (Re-computing per cycle would
    // mean a 2nd query inside the txn, which Firestore can't do.)
    const farmHeroBuff = computeFarmHeroKingdomBuff(
      summary.heroes,
      player.turnsSpentTotal
    );

    outer: for (const entry of plan) {
      for (let c = 0; c < entry.cycles; c++) {
        const isFirst = stepIndex === 0;
        const before = tilesById.get(entry.tileId)!;
        const baseUnitsThisCycle = unitsPerTurnForLand(before.type);
        const tileFarmHero =
          before.hero && before.hero.class === "farm"
            ? applyStaminaRegen(before.hero, turnsSpentTotal)
            : null;
        const tileTypeMult = tileFarmHero
          ? specialtyTypeRecruitMult(tileFarmHero, entry.unitType)
          : 1;
        const unitsThisCycle = Math.max(
          1,
          Math.round(baseUnitsThisCycle * (1 + farmHeroBuff) * tileTypeMult)
        );

        if (turnsRemaining < BUILD_UNITS_TURN_COST) {
          if (isFirst) {
            throw new GameInsufficientTurnsError(
              BUILD_UNITS_TURN_COST,
              turnsRemaining
            );
          }
          stoppedEarly = `out of turns at cycle ${stepIndex}`;
          break outer;
        }
        if (unitsAlive + unitsThisCycle > cap) {
          if (isFirst) {
            throw new GameUnitCapExceededError(cap, unitsAlive);
          }
          stoppedEarly = `unit cap reached at cycle ${stepIndex} (${unitsAlive}/${cap})`;
          break outer;
        }

        turnsRemaining -= BUILD_UNITS_TURN_COST;
        turnsSpentTotal += BUILD_UNITS_TURN_COST;
        unitsAlive += unitsThisCycle;
        producedTotal += unitsThisCycle;

        const rolled = rollAndStageArtifact(
          tx,
          db,
          userId,
          turnsSpentTotal,
          "build",
          now
        );
        const artifact = rolled?.definition ?? null;
        if (rolled) artifacts.push(rolled.doc);

        // Hero emergence on food tiles (only when the tile doesn't already
        // have one). Seed includes stepIndex so each cycle rolls fresh.
        let emergedHero: GameHero | null = null;
        if (before.type === "food" && before.hero == null && player.caste) {
          const emergeRng = makeSeededRng(
            `hero-emerge-bulkbuild-${userId}-${turnsSpentTotal}-${stepIndex}`
          );
          emergedHero = maybeEmergeHero({
            class: "farm",
            tile: before,
            ownerId: userId,
            ownerCaste: player.caste,
            turnIndex: turnsSpentTotal,
            rng: emergeRng,
          });
          if (emergedHero) {
            heroCount += 1;
            logCommunityEventInTx(
              tx,
              db,
              {
                kind: "hero_emerged",
                actorUserId: userId,
                actorDisplayName: player.displayName,
                actorCaste: player.caste,
                tileId: entry.tileId,
                heroId: emergedHero.id,
                heroName: emergedHero.name,
                heroClass: emergedHero.class,
                heroSpecialty: emergedHero.specialty,
              },
              now
            );
            // v2 registry: create persistent record + emergence event.
            const seasonNumberLocal = player.seasonNumber ?? 1;
            upsertHeroInTx({
              tx,
              db,
              hero: emergedHero,
              seasonNumber: seasonNumberLocal,
              now,
            });
            appendHeroEventInTx({
              tx,
              db,
              heroId: emergedHero.id,
              event: heroEvent.emerged(emergedHero, seasonNumberLocal),
              now,
            });
          }
        }

        // v2 registry: log a `recruited` event on the existing farm hero
        // on this tile (if any), so hero history reflects the recruit.
        if (tileFarmHero) {
          const seasonNumberLocal = player.seasonNumber ?? 1;
          appendHeroEventInTx({
            tx,
            db,
            heroId: tileFarmHero.id,
            event: heroEvent.recruited({
              tileId: entry.tileId,
              ownerIdAtTime: userId,
              unitType: entry.unitType,
              unitsBuilt: unitsThisCycle,
              seasonNumber: seasonNumberLocal,
            }),
            now,
          });
        }

        // Special-unit roll on a farm-hero tile.
        let summonedSpecialUnit: SpecialUnitInstance | null = null;
        if (tileFarmHero && player.caste) {
          const suRng = makeSeededRng(
            `hero-special-unit-bulkbuild-${userId}-${entry.tileId}-${turnsSpentTotal}-${stepIndex}`
          );
          const chance =
            FARM_SPECIAL_UNIT_ROLL * specialtyRecruitMult(tileFarmHero);
          if (suRng() < chance) {
            const def = pickSpecialUnitDef(player.caste, suRng);
            if (def) {
              summonedSpecialUnit = {
                instanceId: randomUUID(),
                defId: def.id,
                spawnedAtTurn: turnsSpentTotal,
              };
              summonableSpecialUnits = [
                ...(summonableSpecialUnits ?? []),
                summonedSpecialUnit,
              ];
              // v2 registry event for the farm hero.
              appendHeroEventInTx({
                tx,
                db,
                heroId: tileFarmHero.id,
                event: heroEvent.specialUnitSummoned({
                  tileId: entry.tileId,
                  ownerIdAtTime: userId,
                  specialUnitDefId: def.id,
                  seasonNumber: player.seasonNumber ?? 1,
                }),
                now,
              });
            }
          }
        }

        const after: GameTile = {
          ...before,
          units: {
            ...before.units,
            [entry.unitType]:
              before.units[entry.unitType] + unitsThisCycle,
          },
          hero: emergedHero ?? before.hero,
          updatedAt: now,
        };
        tilesById.set(entry.tileId, after);

        reports.push(
          buildBuildReport({
            turnIndex: turnsSpentTotal,
            cost: BUILD_UNITS_TURN_COST,
            tileId: entry.tileId,
            unitType: entry.unitType,
            unitsBuilt: unitsThisCycle,
            artifactFound: artifact,
            rng: makeNarrativeRng(userId, turnsSpentTotal, "build"),
            heroEmerged: emergedHero,
            specialUnitSummoned: summonedSpecialUnit
              ? {
                  instanceId: summonedSpecialUnit.instanceId,
                  defId: summonedSpecialUnit.defId,
                  name:
                    SPECIAL_UNITS_BY_ID.get(summonedSpecialUnit.defId)?.name ??
                    summonedSpecialUnit.defId,
                }
              : null,
          })
        );

        stepIndex++;
      }
    }

    // Stage tile writes once each (not per cycle). Each write may include
    // a fresh hero if emergence fired on that tile during the loop.
    for (const id of uniqueTileIds) {
      const after = tilesById.get(id)!;
      const ref = db.collection(COLLECTIONS.TILES).doc(id);
      const tileWrite: Record<string, unknown> = {
        units: after.units,
        updatedAt: now,
      };
      if (after.hero) tileWrite.hero = after.hero;
      tx.update(ref, tileWrite);
    }

    if (stepIndex > 0) {
      const playerUpdate: Record<string, unknown> = {
        turnsRemaining,
        turnsSpentTotal,
        stats: { ...player.stats, unitsAlive },
        updatedAt: now,
      };
      if (heroCount !== (player.heroCount ?? 0)) {
        playerUpdate.heroCount = heroCount;
      }
      if (summonableSpecialUnits !== player.summonableSpecialUnits) {
        playerUpdate.summonableSpecialUnits = summonableSpecialUnits;
      }
      tx.update(playerRef, playerUpdate);
    }

    const updatedPlayer: GamePlayer = {
      ...player,
      turnsRemaining,
      turnsSpentTotal,
      stats: { ...player.stats, unitsAlive },
      heroCount,
      summonableSpecialUnits,
      updatedAt: now,
    };
    const updatedTiles: GameTile[] = uniqueTileIds.map(
      (id) => tilesById.get(id)!
    );

    return {
      player: updatedPlayer,
      tiles: updatedTiles,
      produced: producedTotal,
      reports,
      artifacts,
      stoppedEarly,
    };
  });
}

// Pre-arms a defense spell on one of the player's tiles. Triggered (and
// consumed) when the tile is next attacked. Spell must match the player's caste.
export async function armDefenseSpellServer(
  userId: string,
  tileId: string,
  spellId: string,
  now: Date = new Date()
): Promise<{
  player: GamePlayer;
  tile: GameTile;
  report: TurnReport;
  artifact: GameArtifact | null;
}> {
  const db = adminDbOrThrow();
  const spell = SPELLS_BY_ID.get(spellId);
  if (!spell) throw new GameInvalidSpellError(`unknown spellId: ${spellId}`);
  if (spell.type !== "defense") {
    throw new GameInvalidSpellError(`spell ${spellId} is not a defense spell`);
  }

  const tileRef = db.collection(COLLECTIONS.TILES).doc(tileId);
  const playerRef = db.collection(COLLECTIONS.PLAYERS).doc(userId);

  return db.runTransaction(async (tx) => {
    const [tileSnap, playerSnap] = await Promise.all([
      tx.get(tileRef),
      tx.get(playerRef),
    ]);
    if (!playerSnap.exists) throw new GamePlayerNotFoundError();
    if (!tileSnap.exists) throw new GameTileNotFoundError();

    const player = playerSnap.data() as GamePlayer;
    const tile = tileSnap.data() as GameTile;

    if (tile.ownerId !== userId) throw new GameTileNotOwnedError();
    if (tile.type === "unrevealed") throw new GameTileUnrevealedError();
    if (player.phase !== "play") {
      throw new GameInvalidPhaseError("play", player.phase);
    }
    if (player.caste === null || spell.caste !== player.caste) {
      throw new GameInvalidSpellError(
        `spell ${spellId} requires caste ${spell.caste}`
      );
    }
    if (player.stats.tilesHeld < spell.minTilesRequired) {
      throw new GameInvalidSpellError(
        `spell ${spellId} requires ${spell.minTilesRequired} tiles held; you have ${player.stats.tilesHeld}`
      );
    }
    const cost = spell.turnCost;
    if (player.turnsRemaining < cost) {
      throw new GameInsufficientTurnsError(cost, player.turnsRemaining);
    }

    const turnsSpentTotal = player.turnsSpentTotal + cost;
    const rolled = rollAndStageArtifact(
      tx,
      db,
      userId,
      turnsSpentTotal,
      "spell-arm",
      now
    );
    const artifact = rolled?.definition ?? null;

    // Magic hero emergence on magic tiles when armed. Tile must not already
    // have a hero. Note: arming this spell counts as a "cast from this tile"
    // for emergence purposes; the hero's actual spell boost is applied when
    // the spell triggers in combat (defender side), not at arm time.
    let emergedHero: GameHero | null = null;
    if (tile.type === "magic" && tile.hero == null && player.caste) {
      const emergeRng = makeSeededRng(
        `hero-emerge-arm-${userId}-${turnsSpentTotal}`
      );
      emergedHero = maybeEmergeHero({
        class: "magic",
        tile,
        ownerId: userId,
        ownerCaste: player.caste,
        turnIndex: turnsSpentTotal,
        rng: emergeRng,
      });
    }

    const tileUpdate: Record<string, unknown> = {
      armedDefenseSpellId: spellId,
      updatedAt: now,
    };
    if (emergedHero) tileUpdate.hero = emergedHero;
    tx.update(tileRef, tileUpdate);

    const playerUpdate: Record<string, unknown> = {
      turnsRemaining: player.turnsRemaining - cost,
      turnsSpentTotal,
      updatedAt: now,
    };
    if (emergedHero) {
      playerUpdate.heroCount = (player.heroCount ?? 0) + 1;
    }
    tx.update(playerRef, playerUpdate);

    if (emergedHero) {
      logCommunityEventInTx(
        tx,
        db,
        {
          kind: "hero_emerged",
          actorUserId: userId,
          actorDisplayName: player.displayName,
          actorCaste: player.caste,
          tileId,
          heroId: emergedHero.id,
          heroName: emergedHero.name,
          heroClass: emergedHero.class,
          heroSpecialty: emergedHero.specialty,
        },
        now
      );
      // v2 registry: persist + emergence event.
      const seasonNumberLocal = player.seasonNumber ?? 1;
      upsertHeroInTx({
        tx,
        db,
        hero: emergedHero,
        seasonNumber: seasonNumberLocal,
        now,
      });
      appendHeroEventInTx({
        tx,
        db,
        heroId: emergedHero.id,
        event: heroEvent.emerged(emergedHero, seasonNumberLocal),
        now,
      });
    }

    const report = buildArmDefenseReport({
      turnIndex: turnsSpentTotal,
      cost,
      tileId,
      spellId,
      spellName: spell.name,
      artifactFound: artifact,
      rng: makeNarrativeRng(userId, turnsSpentTotal, "spell-arm"),
      heroEmerged: emergedHero,
    });

    return {
      player: {
        ...player,
        turnsRemaining: player.turnsRemaining - cost,
        turnsSpentTotal,
        heroCount: emergedHero
          ? (player.heroCount ?? 0) + 1
          : player.heroCount,
        updatedAt: now,
      },
      tile: {
        ...tile,
        armedDefenseSpellId: spellId,
        hero: emergedHero ?? tile.hero,
        updatedAt: now,
      },
      report,
      artifact: rolled?.doc ?? null,
    };
  });
}

/**
 * Casts an intel ("spy") spell. Spends the spell's turn cost and returns an
 * IntelReport scoped per the spell's intelScope. Black's Vein of Truth also
 * pays a blood cost: 1 air unit subtracted from the caster's unitsAlive.
 *
 * Detection side effects (Black/Green alerting the defender for a few turns)
 * are NOT yet wired — the intel snapshot is returned and the report flags
 * `detected: true`. Wiring the defender-side buff is a follow-up.
 */
export async function castIntelSpellServer(
  userId: string,
  spellId: string,
  targetTileId: string,
  now: Date = new Date()
): Promise<{
  player: GamePlayer;
  report: TurnReport;
  artifact: GameArtifact | null;
  intelReport: IntelReport;
  detected: boolean;
}> {
  const db = adminDbOrThrow();
  const spell = SPELLS_BY_ID.get(spellId);
  if (!spell) throw new GameInvalidSpellError(`unknown spellId: ${spellId}`);
  if (spell.type !== "intel") {
    throw new GameInvalidSpellError(`spell ${spellId} is not an intel spell`);
  }
  if (!spell.intelScope) {
    throw new GameInvalidSpellError(
      `intel spell ${spellId} has no scope configured`
    );
  }

  const playerRef = db.collection(COLLECTIONS.PLAYERS).doc(userId);
  const tileRef = db.collection(COLLECTIONS.TILES).doc(targetTileId);

  const txResult = await db.runTransaction(async (tx) => {
    const [playerSnap, tileSnap] = await Promise.all([
      tx.get(playerRef),
      tx.get(tileRef),
    ]);
    if (!playerSnap.exists) throw new GamePlayerNotFoundError();
    if (!tileSnap.exists) throw new GameTileNotFoundError();
    const player = playerSnap.data() as GamePlayer;
    const tile = tileSnap.data() as GameTile;

    if (player.phase !== "play") {
      throw new GameInvalidPhaseError("play", player.phase);
    }
    if (player.caste === null || spell.caste !== player.caste) {
      throw new GameInvalidSpellError(
        `spell ${spellId} requires caste ${spell.caste}`
      );
    }
    if (player.stats.tilesHeld < spell.minTilesRequired) {
      throw new GameInvalidSpellError(
        `spell ${spellId} requires ${spell.minTilesRequired} tiles held; you have ${player.stats.tilesHeld}`
      );
    }
    if (tile.ownerId === userId) {
      throw new GameSelfAttackError();
    }

    const cost = spell.turnCost;
    if (player.turnsRemaining < cost) {
      throw new GameInsufficientTurnsError(cost, player.turnsRemaining);
    }

    // Black's Vein of Truth: 1 air unit blood cost. We deduct from
    // stats.unitsAlive (kingdom-wide aggregate) since per-tile sourcing would
    // require an extra parameter. If the player has 0 units, the spell still
    // resolves — the cost just floors at 0 (lore: the blood is owed).
    const bloodCost = spellId === "black-intel-vein-of-truth-t2" ? 1 : 0;

    const turnsSpentTotal = player.turnsSpentTotal + cost;
    const rolled = rollAndStageArtifact(
      tx,
      db,
      userId,
      turnsSpentTotal,
      "spell-arm",
      now
    );
    const artifact = rolled?.definition ?? null;

    const updatedStats = {
      ...player.stats,
      unitsAlive: Math.max(0, player.stats.unitsAlive - bloodCost),
    };
    tx.update(playerRef, {
      turnsRemaining: player.turnsRemaining - cost,
      turnsSpentTotal,
      stats: updatedStats,
      updatedAt: now,
    });

    // Persist time-bounded intel effects produced by this cast. All three
    // expire 5 caster turns after cast (see INTEL_EFFECT_DURATION_CASTER_TURNS).
    if (spellId === "black-intel-vein-of-truth-t2" && tile.ownerId) {
      recordIntelEffectInTx({
        tx,
        db,
        kind: "alert-vs-caster",
        ownerId: tile.ownerId,
        casterId: userId,
        magnitude: 0.2,
        casterTurnsSpentTotalAtCast: turnsSpentTotal,
        now,
      });
    } else if (spellId === "green-intel-root-whisper-t2" && tile.ownerId) {
      recordIntelEffectInTx({
        tx,
        db,
        kind: "alert-vs-caster",
        ownerId: tile.ownerId,
        casterId: userId,
        magnitude: 0.1,
        casterTurnsSpentTotalAtCast: turnsSpentTotal,
        now,
      });
    } else if (spellId === "red-intel-forge-sight-t2") {
      recordIntelEffectInTx({
        tx,
        db,
        kind: "forge-sight-offense",
        ownerId: userId,
        casterId: userId,
        targetTileId,
        magnitude: 0.1,
        casterTurnsSpentTotalAtCast: turnsSpentTotal,
        now,
      });
    }

    return {
      player: {
        ...player,
        turnsRemaining: player.turnsRemaining - cost,
        turnsSpentTotal,
        stats: updatedStats,
        updatedAt: now,
      },
      cost,
      turnsSpentTotal,
      artifactDef: artifact,
      artifactDoc: rolled?.doc ?? null,
    };
  });

  const intelReport = await buildIntelReportServer({
    db,
    targetTileId,
    scope: spell.intelScope,
    source: "spell",
    sourceId: spell.id,
    capturedAtTurn: txResult.turnsSpentTotal,
    // spell.caste is widened to Caste | "neutral" for Armageddon, but intel
    // spells are caste-bound (validated inside the tx). Read the validated
    // caste off the returned player so the type narrows to a real Caste.
    attackerCaste: txResult.player.caste as Caste,
  });

  // Black & Green spies are detected by the defender; the alert is now
  // persisted and applied at attack time (see recordIntelEffectInTx above).
  const detected =
    spellId === "black-intel-vein-of-truth-t2" ||
    spellId === "green-intel-root-whisper-t2";

  const baseReport: TurnReport = {
    turnIndex: txResult.turnsSpentTotal,
    action: "spell-arm",
    cost: txResult.cost,
    summary: `Cast ${spell.name} on ${targetTileId}`,
    narrative: [
      `${spell.name}: ${spell.description}`,
      detected
        ? "The defender felt the touch of the spy. They will be on edge."
        : "The intel returns silently; nothing on the wind suggests you were noticed.",
    ],
    outcome: {
      spellId: spell.id,
      spellName: spell.name,
      targetTileId,
      detected,
      intelScope: spell.intelScope,
    },
  };
  const report = txResult.artifactDef
    ? {
        ...baseReport,
        narrative: [...baseReport.narrative, txResult.artifactDef.flavorOnFind],
        artifactFound: {
          definitionId: txResult.artifactDef.id,
          name: txResult.artifactDef.name,
          rarity: txResult.artifactDef.rarity,
          type: txResult.artifactDef.type,
        },
      }
    : baseReport;

  return {
    player: txResult.player,
    report,
    artifact: txResult.artifactDoc,
    intelReport,
    detected,
  };
}

// Casts a production spell. Lasts PRODUCTION_SPELL_DURATION_TURNS turns from
// the moment of casting (measured by turnsSpentTotal).
export async function castProductionSpellServer(
  userId: string,
  spellId: string,
  now: Date = new Date()
): Promise<{
  player: GamePlayer;
  report: TurnReport;
  artifact: GameArtifact | null;
}> {
  const db = adminDbOrThrow();
  const spell = SPELLS_BY_ID.get(spellId);
  if (!spell) throw new GameInvalidSpellError(`unknown spellId: ${spellId}`);
  if (spell.type !== "production") {
    throw new GameInvalidSpellError(
      `spell ${spellId} is not a production spell`
    );
  }

  const playerRef = db.collection(COLLECTIONS.PLAYERS).doc(userId);

  return db.runTransaction(async (tx) => {
    const playerSnap = await tx.get(playerRef);
    if (!playerSnap.exists) throw new GamePlayerNotFoundError();
    const player = playerSnap.data() as GamePlayer;

    if (player.phase !== "play") {
      throw new GameInvalidPhaseError("play", player.phase);
    }
    if (player.caste === null || spell.caste !== player.caste) {
      throw new GameInvalidSpellError(
        `spell ${spellId} requires caste ${spell.caste}`
      );
    }
    if (player.stats.tilesHeld < spell.minTilesRequired) {
      throw new GameInvalidSpellError(
        `spell ${spellId} requires ${spell.minTilesRequired} tiles held; you have ${player.stats.tilesHeld}`
      );
    }
    const cost = spell.turnCost;
    if (player.turnsRemaining < cost) {
      throw new GameInsufficientTurnsError(cost, player.turnsRemaining);
    }

    const newTurnsSpentTotal = player.turnsSpentTotal + cost;
    const expiresAtTurn = newTurnsSpentTotal + PRODUCTION_SPELL_DURATION_TURNS;

    const rolled = rollAndStageArtifact(
      tx,
      db,
      userId,
      newTurnsSpentTotal,
      "spell-produce",
      now
    );
    const artifact = rolled?.definition ?? null;

    // Lazy sweep: drop entries whose expiresAtTurn already lapsed before
    // appending the fresh one. Keeps the array bounded — otherwise it grows
    // forever as the player casts production spells over time.
    const stillActive = pruneExpiredProductionSpells(
      player.productionSpellsActive,
      newTurnsSpentTotal
    );
    const newActive = [
      ...stillActive,
      {
        spellId,
        expiresAtTurn,
      },
    ];

    tx.update(playerRef, {
      turnsRemaining: player.turnsRemaining - cost,
      turnsSpentTotal: newTurnsSpentTotal,
      productionSpellsActive: newActive,
      updatedAt: now,
    });

      const report = buildProduceReport({
      turnIndex: newTurnsSpentTotal,
      cost,
      spellId,
      spellName: spell.name,
      expiresAtTurn,
      artifactFound: artifact,
      rng: makeNarrativeRng(userId, newTurnsSpentTotal, "spell-produce"),
    });

    return {
      player: {
        ...player,
        turnsRemaining: player.turnsRemaining - cost,
        turnsSpentTotal: newTurnsSpentTotal,
        productionSpellsActive: newActive,
        updatedAt: now,
      },
      report,
      artifact: rolled?.doc ?? null,
    };
  });
}

// =====================================================================
// Heroes — special-unit summoning
// =====================================================================

/**
 * Stations a caste-themed special unit (produced by a farm hero's
 * special-unit roll) onto one of the player's tiles. The unit's
 * attack/defense bonuses fold into combat math at the stationed tile
 * (see `computeStationedSpecialUnitBonuses`).
 *
 * Free of turn cost — special units are reward content, not actions —
 * but we still validate ownership of both the instance and the target
 * tile. Idempotent in the sense that calling with an already-stationed
 * instance throws GameSpecialUnitAlreadyStationedError; caller must
 * unsummon before moving.
 */
export async function summonSpecialUnitServer(args: {
  userId: string;
  instanceId: string;
  targetTileId: string;
  now?: Date;
}): Promise<{ player: GamePlayer; tileId: string }> {
  const now = args.now ?? new Date();
  const db = adminDbOrThrow();
  const playerRef = db.collection(COLLECTIONS.PLAYERS).doc(args.userId);
  const tileRef = db.collection(COLLECTIONS.TILES).doc(args.targetTileId);

  return db.runTransaction(async (tx) => {
    const [playerSnap, tileSnap] = await Promise.all([
      tx.get(playerRef),
      tx.get(tileRef),
    ]);
    if (!playerSnap.exists) throw new GamePlayerNotFoundError();
    if (!tileSnap.exists) throw new GameTileNotFoundError();
    const player = playerSnap.data() as GamePlayer;
    const tile = tileSnap.data() as GameTile;
    if (tile.ownerId !== args.userId) throw new GameTileNotOwnedError();
    if (player.phase !== "play") {
      throw new GameInvalidPhaseError("play", player.phase);
    }
    const pool = player.summonableSpecialUnits ?? [];
    const idx = pool.findIndex((u) => u.instanceId === args.instanceId);
    if (idx === -1) throw new GameSpecialUnitNotFoundError(args.instanceId);
    const instance = pool[idx];
    if (instance.stationedTileId) {
      throw new GameSpecialUnitAlreadyStationedError();
    }
    const next = [...pool];
    next[idx] = { ...instance, stationedTileId: args.targetTileId };
    tx.update(playerRef, {
      summonableSpecialUnits: next,
      updatedAt: now,
    });
    return {
      player: {
        ...player,
        summonableSpecialUnits: next,
        updatedAt: now,
      },
      tileId: args.targetTileId,
    };
  });
}

/**
 * Recalls a stationed special unit back into the player's pool. No turn
 * cost. Used by the dashboard's SummonableUnitsCard when the player
 * wants to redeploy a unit elsewhere.
 */
export async function unsummonSpecialUnitServer(args: {
  userId: string;
  instanceId: string;
  now?: Date;
}): Promise<{ player: GamePlayer }> {
  const now = args.now ?? new Date();
  const db = adminDbOrThrow();
  const playerRef = db.collection(COLLECTIONS.PLAYERS).doc(args.userId);

  return db.runTransaction(async (tx) => {
    const playerSnap = await tx.get(playerRef);
    if (!playerSnap.exists) throw new GamePlayerNotFoundError();
    const player = playerSnap.data() as GamePlayer;
    const pool = player.summonableSpecialUnits ?? [];
    const idx = pool.findIndex((u) => u.instanceId === args.instanceId);
    if (idx === -1) throw new GameSpecialUnitNotFoundError(args.instanceId);
    const instance = pool[idx];
    if (!instance.stationedTileId) {
      // No-op: already unsummoned.
      return { player };
    }
    const next = [...pool];
    next[idx] = { ...instance, stationedTileId: undefined };
    tx.update(playerRef, {
      summonableSpecialUnits: next,
      updatedAt: now,
    });
    return {
      player: {
        ...player,
        summonableSpecialUnits: next,
        updatedAt: now,
      },
    };
  });
}

// Launches an attack. The pure resolveAttack from combat.ts decides the
// outcome; this function orchestrates the read/write transaction around it
// and persists the attack-log doc.
//
// Heroes (May 2026): when the target tile holds a hero, the attacker may
// pass `heroAction` to choose what happens on a winning combat:
//   - "kill"    : capture the tile and discard the hero (default; matches
//                 legacy behavior for non-hero tiles).
//   - "spare"   : wear the hero down without taking the tile. Tile stays
//                 with defender; attacker still pays turn cost + casualties;
//                 hero stamina drops by SPARE_STAMINA_MULT× a normal
//                 engagement. Useful to grind the hero below
//                 STAMINA_CONVERSION_THRESHOLD before a convert attempt.
//   - "convert" : roll for the hero to defect. Only valid when stamina is
//                 already at/below STAMINA_CONVERSION_THRESHOLD. On success
//                 the tile transfers AND the hero changes owner. On failure
//                 the attacker falls back to `heroActionOnConvertFail`.
export async function attackTileServer(args: {
  attackerId: string;
  sourceTileId: string;
  targetTileId: string;
  units: UnitStack;
  offenseSpellId: string | null;
  // Heroes (May 2026). Ignored when the target tile has no hero. Default
  // is "kill" — preserves legacy semantics for non-hero tiles.
  heroAction?: HeroBattleAction;
  // Fallback when heroAction === "convert" and the roll fails. Defaults
  // to "kill" (legacy semantics: you won, you take the tile).
  heroActionOnConvertFail?: Exclude<HeroBattleAction, "convert">;
  // Optional ≤280-char attacker-authored taunt attached to the attack
  // record. Sanitized server-side. Empty/missing = no dispatch.
  dispatch?: string;
  now?: Date;
}): Promise<{
  attack: GameAttack;
  attackerPlayer: GamePlayer;
  defenderPlayer: GamePlayer;
  sourceTile: GameTile;
  targetTile: GameTile;
  report: TurnReport;
  // Full combat resolution result. Already feeds buildAttackReport; we surface
  // it on the response too so the client can render Forces / Losses /
  // Modifiers / Narrative without re-deriving from outcome alone.
  combat: CombatResult;
  artifact: GameArtifact | null;
  // Set when the attacker's air-unit intel passive triggered a post-attack
  // reveal. Currently produced for Blue Sky Reader (air > defender air → ring
  // intel) and Black Crowfeast (failed attack with air ≥ 5 → kingdom intel).
  intelReport?: IntelReport;
}> {
  const now = args.now ?? new Date();
  if (!isValidUnitStack(args.units)) {
    throw new Error("Invalid units stack: must be {ground, siege, air} non-negative integers");
  }
  if (sumStack(args.units) === 0) {
    throw new Error("Must send at least 1 unit");
  }

  let offenseSpell = null;
  if (args.offenseSpellId) {
    offenseSpell = SPELLS_BY_ID.get(args.offenseSpellId) ?? null;
    if (!offenseSpell || offenseSpell.type !== "offense") {
      throw new GameInvalidSpellError(
        `spellId ${args.offenseSpellId} is not a valid offense spell`
      );
    }
  }

  const turnCost =
    ATTACK_TURN_COST + (offenseSpell ? offenseSpell.turnCost : 0);

  const db = adminDbOrThrow();
  const attackerRef = db.collection(COLLECTIONS.PLAYERS).doc(args.attackerId);
  const sourceRef = db.collection(COLLECTIONS.TILES).doc(args.sourceTileId);
  const targetRef = db.collection(COLLECTIONS.TILES).doc(args.targetTileId);

  // Two-phase txn: outer reads target to get defenderId, inner runs the actual
  // transaction. Firestore txns require all reads before writes; we need the
  // defenderId to add their player doc to the read set.
  const targetPreSnap = await targetRef.get();
  if (!targetPreSnap.exists) throw new GameTileNotFoundError();
  const targetPre = targetPreSnap.data() as GameTile;
  if (!targetPre.ownerId) throw new GameSelfAttackError();
  if (targetPre.ownerId === args.attackerId) throw new GameSelfAttackError();
  const defenderId = targetPre.ownerId;
  const defenderRef = db.collection(COLLECTIONS.PLAYERS).doc(defenderId);
  const attackId = randomUUID();
  const attackRef = db.collection(COLLECTIONS.ATTACKS).doc(attackId);

  // Read attacker's current turn count out of the txn so we can filter
  // intel-effect expirations. Slightly stale by the time the txn runs but
  // adequate — effect expirations are coarse (5 caster turns).
  const attackerPreSnap = await attackerRef.get();
  if (!attackerPreSnap.exists) throw new GamePlayerNotFoundError();
  const attackerPre = attackerPreSnap.data() as GamePlayer;
  const intelContext = await readAttackContextEffects({
    db,
    attackerId: args.attackerId,
    attackerTurnsSpentTotal: attackerPre.turnsSpentTotal,
    defenderId,
    defenderTileId: args.targetTileId,
  });

  // Zero-turn gameplay: detect any active pact the attacker is about to
  // break. The attack still resolves, but with an Oathbreaker penalty on
  // attackPower AND the attacker gets the public mark for 7 days. The
  // lookup runs outside the txn (like markPactsBrokenInTx, which we'll
  // call later to actually stamp brokenAt).
  const pactsToBreak = await findActivePactsBetween({
    db,
    attackerId: args.attackerId,
    defenderId,
    now,
  });
  const willBreakPact = pactsToBreak.length > 0;
  // Also detect any already-active oathbreaker mark from a PRIOR breach.
  const priorOathbreakerPenalty = oathbreakerAttackPenalty(attackerPre, now);
  // Effective penalty for THIS attack: max of prior mark and breach-now.
  const oathbreakerPenaltyForThisAttack = Math.max(
    priorOathbreakerPenalty,
    willBreakPact ? OATHBREAKER_ATTACK_PENALTY : 0
  );

  if (offenseSpell) {
    // We can't validate caste-match yet without reading the player; deferred
    // into the transaction below.
  }

  const result = await db.runTransaction(async (tx) => {
    const [attackerSnap, defenderSnap, sourceSnap, targetSnap] =
      await Promise.all([
        tx.get(attackerRef),
        tx.get(defenderRef),
        tx.get(sourceRef),
        tx.get(targetRef),
      ]);
    if (!attackerSnap.exists) throw new GamePlayerNotFoundError();
    if (!defenderSnap.exists) throw new GamePlayerNotFoundError();
    if (!sourceSnap.exists) throw new GameTileNotFoundError();
    if (!targetSnap.exists) throw new GameTileNotFoundError();

    const attacker = attackerSnap.data() as GamePlayer;
    const defender = defenderSnap.data() as GamePlayer;
    const source = sourceSnap.data() as GameTile;
    const target = targetSnap.data() as GameTile;

    // Defender may have changed between the pre-read and the txn read; handle.
    if (target.ownerId !== defenderId) {
      throw new GameSelfAttackError();
    }

    if (attacker.phase !== "play") {
      throw new GameInvalidPhaseError("play", attacker.phase);
    }
    if (attacker.caste === null) {
      throw new GameInvalidPhaseError("play (caste required)", attacker.phase);
    }
    if (defender.caste === null) {
      throw new GameInvalidPhaseError(
        "defender must be in play",
        defender.phase
      );
    }
    if (isShieldActive(attacker, now)) {
      throw new GameShieldedError("attacker");
    }
    if (isShieldActive(defender, now)) {
      throw new GameShieldedError("defender");
    }
    if (source.ownerId !== args.attackerId) throw new GameTileNotOwnedError();
    if (target.ownerId === args.attackerId) throw new GameSelfAttackError();
    if (!source.neighborTileIds.includes(args.targetTileId)) {
      throw new GameNotAdjacentError();
    }
    // Zero-turn gameplay: a tile in defensive stance trades its offensive
    // option for the +25% defense bonus and cannot launch attacks until
    // the stance lifts (see toggleDefensiveStanceServer).
    if (isTileInDefensiveStance(source, now)) {
      throw new GameDefensiveStanceBlockedError();
    }
    if (offenseSpell && offenseSpell.caste !== attacker.caste) {
      throw new GameInvalidSpellError(
        `offense spell requires caste ${offenseSpell.caste}`
      );
    }
    if (
      offenseSpell &&
      attacker.stats.tilesHeld < offenseSpell.minTilesRequired
    ) {
      throw new GameInvalidSpellError(
        `offense spell ${offenseSpell.id} requires ${offenseSpell.minTilesRequired} tiles held`
      );
    }
    if (attacker.turnsRemaining < turnCost) {
      throw new GameInsufficientTurnsError(
        turnCost,
        attacker.turnsRemaining
      );
    }
    // BASE+SUPER: source's deployable pool is units (SUPER) + baseUnits (BASE).
    // We draw from SUPER first per type; any overflow conscripts from BASE.
    const sourceBase: UnitStack =
      source.baseUnits ?? { ground: 0, siege: 0, air: 0 };
    const targetBase: UnitStack =
      target.baseUnits ?? { ground: 0, siege: 0, air: 0 };
    const sourceDeployable = addStack(source.units, sourceBase);
    if (!stackHasAtLeast(sourceDeployable, args.units)) {
      throw new GameInsufficientUnitsError();
    }
    const superSent: UnitStack = {
      ground: Math.min(args.units.ground, source.units.ground),
      siege: Math.min(args.units.siege, source.units.siege),
      air: Math.min(args.units.air, source.units.air),
    };
    const baseSent: UnitStack = {
      ground: args.units.ground - superSent.ground,
      siege: args.units.siege - superSent.siege,
      air: args.units.air - superSent.air,
    };

    const defenderActiveUpgrades = defender.activeUpgrades ?? {};
    const attackerActiveUpgrades = attacker.activeUpgrades ?? {};
    const tileCapacity = computeTileCapacity(
      target.type,
      defender.caste,
      target.upgradeIds,
      defenderActiveUpgrades
    );
    // Capacity check is against SUPER on tile only — BASE is intrinsic and
    // doesn't compete for cap (food-cap math doesn't include militia).
    const defenderTotalOnTile = sumStack(target.units);
    const availableSpace = Math.max(0, tileCapacity - defenderTotalOnTile);
    const sentTotal = sumStack(args.units);
    if (sentTotal > availableSpace) {
      throw new GameTileFullError(availableSpace, sentTotal);
    }
    // Composite defender stack for combat — base+super fight together.
    const defenderComposite = addStack(target.units, targetBase);

    // Read the 6 neighbor tiles to compute supply. Hex coords are immutable,
    // so deriving IDs from (q, r) is canonical even if neighborTileIds drifts.
    const neighborIds = neighborTileIds(target.q, target.r);
    const neighborSnaps = await Promise.all(
      neighborIds.map((id) => tx.get(db.collection(COLLECTIONS.TILES).doc(id)))
    );
    const friendlyNeighbors: Array<{ landType: LandType }> = [];
    for (const snap of neighborSnaps) {
      if (!snap.exists) continue;
      const t = snap.data() as GameTile;
      if (t.ownerId !== defenderId) continue;
      if (t.type === "unrevealed" || t.type === "unassigned") continue;
      friendlyNeighbors.push({ landType: t.type });
    }

    // Compute defender food/magic land counts for spell scaling. We accept the
    // pre-txn `getOwnedLandCounts` cost only on the defender; the magic count
    // is what's needed by spellContribution inside resolveAttack. Use the
    // simple denormalized stats for v1 and accept slight staleness.
    // (PR 5 will add a denormalized landCounts to the player doc.)
    // Magic-land count for defender's defense-spell scaling: derive lazily
    // outside txn would race; instead we approximate using 0 for now and
    // require the caller (ourselves) to pass the count via the magicLandCount
    // arg. For the resolve, we'll use 0 to err on the conservative side.
    // Heroes (May 2026). Pre-resolve the additive attack/defense bonuses
    // from any military hero stationed on the source/target tile (plus
    // stationed special-unit contributions folded into the same channel).
    // Combat math applies (1 + bonus) at the same numeric stage as the
    // existing intel bonuses; see combat.ts:resolveAttack.
    const heroAttackBonus = combinedHeroAttackBonus(attacker, source, target, now);
    const heroDefenseBonus = combinedHeroDefenseBonus(defender, target, source, now);
    // Zero-turn gameplay: fold defensive-stance and Last Stand into the
    // defender's combat input. Adjacent-rally penalties (rally pulls
    // reserves from neighbors) are not applied here — they're picked up
    // by attacks against THOSE neighbors which read this tile's
    // activeLastStand. For the target tile itself the bonus is purely
    // additive.
    const zeroTurnDefenseBonus = computeZeroTurnDefenseBonus({
      tile: target,
      now,
    });

    const result = resolveAttack(
      {
        caste: attacker.caste,
        units: args.units,
        offenseSpellId: args.offenseSpellId,
        magicLandCount: 0,
        unitsAlive: attacker.stats.unitsAlive,
        activeUpgrades: attackerActiveUpgrades,
        intelOffenseBonus: intelContext.forgeSightOffenseBonus,
        sourceLandType: source.type,
        preCastOffenseBonus: intelContext.preCastOffenseBonus,
        heroAttackBonus,
        oathbreakerPenalty: oathbreakerPenaltyForThisAttack,
      },
      {
        caste: defender.caste,
        unitsOnTile: defenderComposite,
        baseUnitsOnTile: targetBase,
        armedDefenseSpellId: target.armedDefenseSpellId,
        magicLandCount: 0,
        unitsAlive: defender.stats.unitsAlive,
        activeUpgrades: defenderActiveUpgrades,
        intelDefenseBonus: intelContext.alertVsCasterDefenseBonus,
        defenseDisarmFraction: intelContext.defenseDisarmFraction,
        heroDefenseBonus,
        zeroTurnDefenseBonus,
      },
      {
        capacity: tileCapacity,
        upgradeIds: target.upgradeIds,
        friendlyNeighbors,
        landType: target.type,
        siegeDebuffMagnitude: intelContext.siegeDebuffMagnitude,
      },
      makeSeededRng(`attack-${attackId}`)
    );

    // Consume single-use effects (pre-cast offense, defense disarm) that
    // were folded into this resolution. Siege debuffs are TTL-only and
    // remain in the collection until they expire.
    if (intelContext.consumeEffectIds.length > 0) {
      deleteIntelEffectsInTx({
        tx,
        db,
        effectIds: intelContext.consumeEffectIds,
      });
    }

    // BASE+SUPER loss attribution. Split combat losses back into the
    // pools they came from so each tile's units / baseUnits stay coherent.
    const attackerLossSplit = attributeAttackerLosses({
      superSent,
      baseSent,
      totalLosses: result.attackerLosses,
    });
    const defenderLossSplit = attributeDefenderLosses({
      superBefore: target.units,
      baseBefore: targetBase,
      totalLosses: result.defenderLosses,
      outcome: result.outcome,
      captureBaseRetentionFactor: result.captureBaseRetentionFactor,
    });

    const superSurvivors: UnitStack = {
      ground: superSent.ground - attackerLossSplit.superLost.ground,
      siege: superSent.siege - attackerLossSplit.superLost.siege,
      air: superSent.air - attackerLossSplit.superLost.air,
    };
    const baseSurvivors: UnitStack = {
      ground: baseSent.ground - attackerLossSplit.baseLost.ground,
      siege: baseSent.siege - attackerLossSplit.baseLost.siege,
      air: baseSent.air - attackerLossSplit.baseLost.air,
    };

    const sourceUnitsAfterDispatch = subtractStack(source.units, superSent);
    const sourceBaseAfterDispatch = subtractStack(sourceBase, baseSent);

    let updatedSourceUnits: UnitStack;
    let updatedSourceBase: UnitStack;
    let updatedTargetUnits: UnitStack;
    let updatedTargetBase: UnitStack;
    let updatedTargetOwner: string | null = target.ownerId;
    let updatedTargetType: LandType = target.type;
    let updatedTargetLevel: number = target.level;
    let updatedTargetUpgrades: string[] = target.upgradeIds;
    let captured = false;

    // ── Hero action resolution (May 2026 Heroes feature) ─────────────────
    //
    // When the target tile has a hero and the combat outcome is "captured",
    // the attacker chooses: kill (legacy), spare (don't take tile), or
    // convert (defect roll). For "convert", we roll inside the txn; on
    // failure we fall back to heroActionOnConvertFail. The outcome decides
    // whether `captured` stays true.
    const targetHeroPreEngagement = target.hero ?? null;
    let heroAction: HeroBattleAction =
      targetHeroPreEngagement && result.outcome === "captured"
        ? args.heroAction ?? "kill"
        : "kill";
    // Apply lazy stamina regen to the defender's hero BEFORE engagement so
    // the conversion-threshold check uses the up-to-date value.
    const targetHeroRegened = targetHeroPreEngagement
      ? applyStaminaRegen(targetHeroPreEngagement, defender.turnsSpentTotal)
      : null;
    if (
      heroAction === "convert" &&
      targetHeroRegened &&
      targetHeroRegened.stamina > STAMINA_CONVERSION_THRESHOLD
    ) {
      throw new GameInvalidSpellError(
        `convert requires hero stamina ≤ ${STAMINA_CONVERSION_THRESHOLD} (current ${targetHeroRegened.stamina})`
      );
    }
    let convertSucceeded = false;
    if (heroAction === "convert" && targetHeroRegened) {
      const convertRng = makeSeededRng(`hero-convert-${attackId}`);
      const chance = conversionSuccessChance(targetHeroRegened);
      convertSucceeded = convertRng() < Math.min(CONVERSION_SUCCESS_CEILING, chance);
      if (!convertSucceeded) {
        // Fall back to the attacker's pre-declared backup choice. If they
        // didn't declare one, default to "kill" (legacy behavior).
        heroAction = args.heroActionOnConvertFail ?? "kill";
      }
    }

    // Engagement always burns hero stamina (won, lost, or stalemate — the
    // hero fought). Decrement target hero first; source hero gets decremented
    // below once we know whether it's about to move on capture.
    let nextTargetHero: GameHero | null = targetHeroRegened
      ? applyEngagement(
          targetHeroRegened,
          defender.turnsSpentTotal,
          heroAction === "spare" ? SPARE_STAMINA_MULT : 1
        )
      : null;

    // Spare ⇒ override the capture outcome: combat was won, but the attacker
    // chose to wear the hero down instead of taking the tile. Defender keeps
    // ownership; defender keeps post-curve base+super.
    const effectiveCaptured =
      result.outcome === "captured" && heroAction !== "spare";

    if (effectiveCaptured) {
      captured = true;
      // Source: sent units are gone (no return on capture).
      updatedSourceUnits = sourceUnitsAfterDispatch;
      updatedSourceBase = sourceBaseAfterDispatch;
      // Target: SUPER survivors occupy as new SUPER; BASE survivors fold
      // into the residual defender BASE that survived the capture.
      updatedTargetUnits = superSurvivors;
      updatedTargetBase = addStack(defenderLossSplit.newBase, baseSurvivors);
      updatedTargetOwner = args.attackerId;
      updatedTargetLevel = 0;
      updatedTargetUpgrades = [];
    } else {
      // Survivors return home; defender keeps post-curve base+super.
      updatedSourceUnits = addStack(sourceUnitsAfterDispatch, superSurvivors);
      updatedSourceBase = addStack(sourceBaseAfterDispatch, baseSurvivors);
      updatedTargetUnits = defenderLossSplit.newSuper;
      updatedTargetBase = defenderLossSplit.newBase;
    }

    // unitsAlive tracks SUPER only (food-cap-bound). BASE losses don't hit
    // the player-level stat.
    const attackerSuperLostTotal = sumStack(attackerLossSplit.superLost);
    const defenderSuperLostTotal = sumStack(defenderLossSplit.superLost);

    const attackerTurnsSpentTotal = attacker.turnsSpentTotal + turnCost;
    const rolled = rollAndStageArtifact(
      tx,
      db,
      args.attackerId,
      attackerTurnsSpentTotal,
      "attack",
      now
    );
    const artifact = rolled?.definition ?? null;

    // ── Hero post-resolution mutation ──────────────────────────────────
    //
    // Compute final source.hero and target.hero state given the chosen
    // hero action and whether a military hero on the source moves on
    // capture. Tracks counter deltas for attacker/defender heroCount so
    // the denormalized stat stays accurate.
    const sourceHeroRegened = source.hero
      ? applyStaminaRegen(source.hero, attacker.turnsSpentTotal)
      : null;
    // Source hero (if any) is always engaged when the attack proceeded.
    const sourceHeroEngaged = sourceHeroRegened
      ? applyEngagement(sourceHeroRegened, attackerTurnsSpentTotal, 1)
      : null;

    let nextSourceHero: GameHero | null = sourceHeroEngaged;
    let attackerHeroDelta = 0;
    let defenderHeroDelta = 0;
    let heroSlain: GameHero | null = null;
    let heroDefected: GameHero | null = null;

    if (captured) {
      // Defender lost the tile. Decide what happens to whatever hero was
      // on it before this attack: kill / convert success.
      if (heroAction === "convert" && convertSucceeded && nextTargetHero) {
        // Hero defects to the attacker. Stays on the tile (which has
        // changed owner). Refresh stamina partway so the attacker can use
        // them, but not at full.
        heroDefected = nextTargetHero;
        nextTargetHero = {
          ...nextTargetHero,
          ownerId: args.attackerId,
          tileId: target.tileId,
          stamina: POST_CONVERT_STAMINA,
          lastEngagedAtTurn: attackerTurnsSpentTotal,
        };
        attackerHeroDelta += 1;
        defenderHeroDelta -= 1;
      } else if (nextTargetHero) {
        // Kill outcome — discard the defender's hero.
        heroSlain = nextTargetHero;
        nextTargetHero = null;
        defenderHeroDelta -= 1;
      }
      // Military hero on source moves to the captured tile. If both a
      // defending hero converted AND an attacking hero is moving in, the
      // converted hero wins the tile slot (one hero per tile). The moving
      // hero is then left at the source — pragmatic choice: source-tile
      // military hero MOVES only when the target slot is empty.
      if (
        nextSourceHero &&
        nextSourceHero.class === "military" &&
        nextTargetHero == null
      ) {
        nextTargetHero = {
          ...nextSourceHero,
          tileId: target.tileId,
          lastEngagedAtTurn: attackerTurnsSpentTotal,
        };
        nextSourceHero = null;
      }
    }
    // For spare / repel / stalemate, nextTargetHero stays where it is
    // (already engagement-decremented above).

    // ── Hero emergence on win ──────────────────────────────────────────
    //
    // Military hero may emerge from a won battle. Only fires when the
    // relevant tile doesn't already have a hero (post-resolution).
    // Attacker side: capture + target tile is now empty of hero.
    // Defender side: outcome === "repelled" (true defense win) + target
    // tile still has no hero. Stalemates do not emerge.
    let attackerEmergedHero: GameHero | null = null;
    let defenderEmergedHero: GameHero | null = null;
    if (captured && nextTargetHero == null && attacker.caste) {
      const emergeRng = makeSeededRng(
        `hero-emerge-attack-${args.attackerId}-${attackId}`
      );
      attackerEmergedHero = maybeEmergeHero({
        class: "military",
        tile: { tileId: target.tileId, hero: undefined },
        ownerId: args.attackerId,
        ownerCaste: attacker.caste,
        turnIndex: attackerTurnsSpentTotal,
        rng: emergeRng,
      });
      if (attackerEmergedHero) {
        nextTargetHero = attackerEmergedHero;
        attackerHeroDelta += 1;
      }
    }
    if (
      !captured &&
      result.outcome === "repelled" &&
      nextTargetHero == null &&
      defender.caste
    ) {
      const emergeRng = makeSeededRng(
        `hero-emerge-defense-${defenderId}-${attackId}`
      );
      defenderEmergedHero = maybeEmergeHero({
        class: "military",
        tile: { tileId: target.tileId, hero: undefined },
        ownerId: defenderId,
        ownerCaste: defender.caste,
        turnIndex: defender.turnsSpentTotal,
        rng: emergeRng,
      });
      if (defenderEmergedHero) {
        nextTargetHero = defenderEmergedHero;
        defenderHeroDelta += 1;
      }
    }

    // ── Stage tile writes ──────────────────────────────────────────────
    //
    // Hero fields use undefined to omit (Firestore preserves on update);
    // when a hero is removed we pass `null` so the doc explicitly clears.
    const sourceWrite: Record<string, unknown> = {
      units: updatedSourceUnits,
      baseUnits: updatedSourceBase,
      updatedAt: now,
    };
    if (sourceHeroRegened && nextSourceHero == null) {
      // Source hero moved away or was otherwise removed.
      sourceWrite.hero = null;
    } else if (nextSourceHero && nextSourceHero !== source.hero) {
      sourceWrite.hero = nextSourceHero;
    }
    tx.update(sourceRef, sourceWrite);

    const targetWrite: Record<string, unknown> = {
      units: updatedTargetUnits,
      baseUnits: updatedTargetBase,
      baseRegenedAt: captured ? now : (target.baseRegenedAt ?? now),
      ownerId: updatedTargetOwner,
      type: updatedTargetType,
      level: updatedTargetLevel,
      upgradeIds: updatedTargetUpgrades,
      armedDefenseSpellId: null,
      lastAttackedAt: now,
      updatedAt: now,
    };
    if (nextTargetHero) {
      targetWrite.hero = nextTargetHero;
    } else if (target.hero) {
      // Tile had a hero before; explicitly clear it (kill OR moved away).
      targetWrite.hero = null;
    }
    // Zero-turn gameplay: Last Stand is single-use — consume on any inbound
    // attack, whether or not it was active at resolution time (clears the
    // window so the player has to declare again). Defensive stance clears
    // on capture (new owner doesn't inherit) and is preserved on repel.
    if (target.activeLastStand) {
      targetWrite.activeLastStand = null;
    }
    if (captured && target.defensiveStance) {
      targetWrite.defensiveStance = null;
    }
    tx.update(targetRef, targetWrite);

    // ── Stationed special-unit cleanup on tile capture ───────────────────
    //
    // Stationed special units on a captured tile vaporize (v1 design).
    // Filter the defender's pool and persist if any were removed.
    let nextDefenderSummonable: SpecialUnitInstance[] | undefined =
      defender.summonableSpecialUnits;
    if (captured && defender.summonableSpecialUnits) {
      const before = defender.summonableSpecialUnits;
      const after = before.filter(
        (u) => u.stationedTileId !== target.tileId
      );
      if (after.length !== before.length) {
        nextDefenderSummonable = after;
      }
    }

    const attackerStats = {
      ...attacker.stats,
      unitsAlive: Math.max(0, attacker.stats.unitsAlive - attackerSuperLostTotal),
      // "spare" still counts as a win for the attacker (they did win the
      // fight) but doesn't change tilesHeld.
      attacksWon:
        attacker.stats.attacksWon +
        (result.outcome === "captured" ? 1 : 0),
      tilesHeld: attacker.stats.tilesHeld + (captured ? 1 : 0),
    };
    const defenderStats = {
      ...defender.stats,
      unitsAlive: Math.max(0, defender.stats.unitsAlive - defenderSuperLostTotal),
      // Mirror: any "captured" combat result is a loss for the defender,
      // even if the attacker chose to spare the tile.
      attacksLost:
        defender.stats.attacksLost +
        (result.outcome === "captured" ? 1 : 0),
      tilesHeld: Math.max(0, defender.stats.tilesHeld - (captured ? 1 : 0)),
    };

    const attackerUpdate: Record<string, unknown> = {
      turnsRemaining: attacker.turnsRemaining - turnCost,
      turnsSpentTotal: attacker.turnsSpentTotal + turnCost,
      stats: attackerStats,
      updatedAt: now,
    };
    if (attackerHeroDelta !== 0) {
      attackerUpdate.heroCount = Math.max(
        0,
        (attacker.heroCount ?? 0) + attackerHeroDelta
      );
    }
    // Zero-turn gameplay: stamp the Oathbreaker mark when this attack
    // breaks one or more active pacts. The penalty already applied to
    // attackPower above; this write makes the mark visible on the public
    // profile + applies to subsequent attacks within the window. Use the
    // larger of any existing oathbreakerUntil and the new expiry so a
    // fresh breach during an existing window extends the punishment.
    if (willBreakPact) {
      const oathbreakerUntil = new Date(
        Math.max(
          attacker.oathbreakerUntil instanceof Date
            ? attacker.oathbreakerUntil.getTime()
            : 0,
          now.getTime() + OATHBREAKER_DURATION_MS
        )
      );
      attackerUpdate.oathbreakerUntil = oathbreakerUntil;
      attackerUpdate.oathbreakerLastPactId = pactsToBreak[0].id;
    }
    tx.update(attackerRef, attackerUpdate);

    const defenderUpdate: Record<string, unknown> = {
      stats: defenderStats,
      updatedAt: now,
    };
    if (defenderHeroDelta !== 0) {
      defenderUpdate.heroCount = Math.max(
        0,
        (defender.heroCount ?? 0) + defenderHeroDelta
      );
    }
    if (nextDefenderSummonable !== defender.summonableSpecialUnits) {
      defenderUpdate.summonableSpecialUnits = nextDefenderSummonable;
    }
    // Zero-turn gameplay: if the captured tile was in defensive stance,
    // decrement the defender's denormalized counter so the cap check
    // stays accurate.
    if (captured && isTileInDefensiveStance(target, now)) {
      defenderUpdate.activeDefensiveStanceCount = Math.max(
        0,
        (defender.activeDefensiveStanceCount ?? 0) - 1
      );
    }
    tx.update(defenderRef, defenderUpdate);

    // Community feed: announce the attack and any 1k-tile milestone
    // crossed by the attacker as a result of this capture.
    logCommunityEventInTx(
      tx,
      db,
      {
        kind: "attack",
        actorUserId: args.attackerId,
        actorDisplayName: attacker.displayName,
        actorCaste: attacker.caste,
        targetUserId: defenderId,
        targetDisplayName: defender.displayName,
        tileId: args.targetTileId,
        outcome: result.outcome,
      },
      now
    );

    // Phase 7: if the attacker has an active pact targeting this
    // defender, stamp it broken + post a `pact_broken` feed event.
    // The lookup runs outside any txn read, so this comes after all
    // other tx.get() calls on the attack path.
    await markPactsBrokenInTx({
      tx,
      db,
      attackerId: args.attackerId,
      attackerDisplayName: attacker.displayName,
      attackerCaste: attacker.caste,
      defenderId,
      defenderDisplayName: defender.displayName,
      now,
    });
    if (
      attacker.stats.tilesHeld < 1000 &&
      attackerStats.tilesHeld >= 1000
    ) {
      logCommunityEventInTx(
        tx,
        db,
        {
          kind: "milestone_1k_tiles",
          actorUserId: args.attackerId,
          actorDisplayName: attacker.displayName,
          actorCaste: attacker.caste,
        },
        now
      );
    }

    // Hero community events.
    const heroEmergedForFeed = attackerEmergedHero ?? defenderEmergedHero;
    if (heroEmergedForFeed) {
      const actor = attackerEmergedHero ? attacker : defender;
      const actorIdForFeed = attackerEmergedHero
        ? args.attackerId
        : defenderId;
      logCommunityEventInTx(
        tx,
        db,
        {
          kind: "hero_emerged",
          actorUserId: actorIdForFeed,
          actorDisplayName: actor.displayName,
          actorCaste: actor.caste,
          tileId: target.tileId,
          heroId: heroEmergedForFeed.id,
          heroName: heroEmergedForFeed.name,
          heroClass: heroEmergedForFeed.class,
          heroSpecialty: heroEmergedForFeed.specialty,
        },
        now
      );
    }
    if (heroDefected) {
      logCommunityEventInTx(
        tx,
        db,
        {
          kind: "hero_defected",
          actorUserId: args.attackerId,
          actorDisplayName: attacker.displayName,
          actorCaste: attacker.caste,
          tileId: target.tileId,
          heroId: heroDefected.id,
          heroName: heroDefected.name,
          heroClass: heroDefected.class,
          heroSpecialty: heroDefected.specialty,
          otherUserId: defenderId,
          otherDisplayName: defender.displayName,
          otherCaste: defender.caste,
        },
        now
      );
    }
    if (heroSlain) {
      logCommunityEventInTx(
        tx,
        db,
        {
          kind: "hero_slain",
          actorUserId: defenderId,
          actorDisplayName: defender.displayName,
          actorCaste: defender.caste,
          tileId: target.tileId,
          heroId: heroSlain.id,
          heroName: heroSlain.name,
          heroClass: heroSlain.class,
          heroSpecialty: heroSlain.specialty,
          otherUserId: args.attackerId,
          otherDisplayName: attacker.displayName,
          otherCaste: attacker.caste,
        },
        now
      );
    }

    // ── v2 hero registry dual-writes ─────────────────────────────────
    //
    // Mirror every hero state change into the persistent collection so
    // history survives the death of the inline `tile.hero` snapshot.
    // Ordering matters slightly: emergence writes (which create the doc)
    // before event writes (which require the doc to exist). The order
    // below also matches the chronological "what happened" sequence so
    // the events subcollection reads naturally.
    const attackerSeasonNumber = attacker.seasonNumber ?? 1;
    const defenderSeasonNumber = defender.seasonNumber ?? 1;

    // 1. Engagement events for any hero present pre-attack. The source
    //    hero engages when the attack proceeds (deployed > 0, which is
    //    guaranteed here since we're past the early-return). The target
    //    hero engages when its tile was attacked.
    if (sourceHeroRegened) {
      appendHeroEventInTx({
        tx,
        db,
        heroId: sourceHeroRegened.id,
        event: heroEvent.engagedAttacker({
          tileId: args.sourceTileId,
          ownerIdAtTime: args.attackerId,
          defenderId,
          targetTileId: args.targetTileId,
          outcome: result.outcome,
          seasonNumber: attackerSeasonNumber,
        }),
        now,
      });
    }
    if (targetHeroPreEngagement) {
      appendHeroEventInTx({
        tx,
        db,
        heroId: targetHeroPreEngagement.id,
        event: heroEvent.engagedDefender({
          tileId: target.tileId,
          ownerIdAtTime: defenderId,
          attackerId: args.attackerId,
          outcome: result.outcome,
          seasonNumber: defenderSeasonNumber,
        }),
        now,
      });
    }

    // 2. Resolution events: slain, defected, moved on capture.
    if (heroSlain) {
      markHeroDeceasedInTx({
        tx,
        db,
        heroId: heroSlain.id,
        deceasedTileId: target.tileId,
        now,
      });
      appendHeroEventInTx({
        tx,
        db,
        heroId: heroSlain.id,
        event: heroEvent.slain({
          tileId: target.tileId,
          ownerIdAtTime: defenderId,
          attackerId: args.attackerId,
          seasonNumber: defenderSeasonNumber,
        }),
        now,
      });
    }
    if (heroDefected && nextTargetHero) {
      transferHeroOwnerInTx({
        tx,
        db,
        heroId: heroDefected.id,
        newOwnerId: args.attackerId,
        newTileId: target.tileId,
        newStamina: nextTargetHero.stamina,
        now,
      });
      appendHeroEventInTx({
        tx,
        db,
        heroId: heroDefected.id,
        event: heroEvent.defected({
          tileId: target.tileId,
          fromOwnerId: defenderId,
          toOwnerId: args.attackerId,
          seasonNumber: defenderSeasonNumber,
        }),
        now,
      });
    }
    // Military hero moved on capture: source.hero was cleared and the
    // hero now occupies the captured tile under the attacker.
    const heroMovedOnCapture =
      captured &&
      nextTargetHero != null &&
      sourceHeroRegened != null &&
      nextSourceHero == null &&
      sourceHeroRegened.id === nextTargetHero.id;
    if (heroMovedOnCapture && nextTargetHero) {
      upsertHeroInTx({
        tx,
        db,
        hero: nextTargetHero,
        seasonNumber: attackerSeasonNumber,
        now,
      });
      appendHeroEventInTx({
        tx,
        db,
        heroId: nextTargetHero.id,
        event: heroEvent.movedOnCapture({
          tileId: target.tileId,
          fromTileId: args.sourceTileId,
          ownerIdAtTime: args.attackerId,
          seasonNumber: attackerSeasonNumber,
        }),
        now,
      });
    } else if (sourceHeroRegened && nextSourceHero) {
      // Source hero stayed but had stamina decremented — refresh registry.
      upsertHeroInTx({
        tx,
        db,
        hero: nextSourceHero,
        seasonNumber: attackerSeasonNumber,
        now,
      });
    }
    // Target hero stayed (spare or repel) — refresh registry stamina.
    if (
      targetHeroPreEngagement &&
      nextTargetHero &&
      !heroMovedOnCapture &&
      !heroDefected
    ) {
      upsertHeroInTx({
        tx,
        db,
        hero: nextTargetHero,
        seasonNumber: defenderSeasonNumber,
        now,
      });
    }

    // 3. Fresh emergences (military). Either an attacker emergence on
    //    capture OR a defender emergence on repel.
    if (attackerEmergedHero) {
      upsertHeroInTx({
        tx,
        db,
        hero: attackerEmergedHero,
        seasonNumber: attackerSeasonNumber,
        now,
      });
      appendHeroEventInTx({
        tx,
        db,
        heroId: attackerEmergedHero.id,
        event: heroEvent.emerged(attackerEmergedHero, attackerSeasonNumber),
        now,
      });
    }
    if (defenderEmergedHero) {
      upsertHeroInTx({
        tx,
        db,
        hero: defenderEmergedHero,
        seasonNumber: defenderSeasonNumber,
        now,
      });
      appendHeroEventInTx({
        tx,
        db,
        heroId: defenderEmergedHero.id,
        event: heroEvent.emerged(defenderEmergedHero, defenderSeasonNumber),
        now,
      });
    }

    const dispatch = args.dispatch
      ? sanitizeText(args.dispatch).slice(0, 280)
      : "";
    const attack: GameAttack = {
      id: attackId,
      attackerId: args.attackerId,
      defenderId,
      targetTileId: args.targetTileId,
      sourceTileIds: [args.sourceTileId],
      unitsSent: args.units,
      unitsLostAttacker: result.attackerLosses,
      unitsLostDefender: result.defenderLosses,
      offenseSpellId: args.offenseSpellId,
      defenseSpellId: target.armedDefenseSpellId,
      casteAttacker: attacker.caste,
      casteDefender: defender.caste,
      rngSeed: `attack-${attackId}`,
      outcome: result.outcome,
      turnsCost: turnCost,
      // Zero-turn gameplay: pre-attack defender composition snapshot for
      // the Battle Autopsy feature. Surfaced on /game/attacks/[attackId]
      // so the loser can run counterfactual "what would have flipped this"
      // simulations. The composite is BASE+SUPER; baseUnitsOnTargetPreAttack
      // splits the BASE portion for finer attribution.
      unitsOnTargetPreAttack: defenderComposite,
      baseUnitsOnTargetPreAttack: targetBase,
      createdAt: now,
      ...(dispatch ? { dispatch } : {}),
    };
    tx.set(attackRef, attack);

    const report = buildAttackReport({
      turnIndex: attackerTurnsSpentTotal,
      cost: turnCost,
      targetTileId: args.targetTileId,
      unitsSent: args.units,
      combat: result,
      artifactFound: artifact,
      rng: makeNarrativeRng(args.attackerId, attackerTurnsSpentTotal, "attack"),
      heroEmerged: heroEmergedForFeed,
      heroAction:
        targetHeroPreEngagement && result.outcome === "captured"
          ? heroAction
          : null,
      heroDefected: heroDefected
        ? {
            id: heroDefected.id,
            name: heroDefected.name,
            class: heroDefected.class,
            specialty: heroDefected.specialty,
          }
        : null,
      heroSlain: heroSlain
        ? {
            id: heroSlain.id,
            name: heroSlain.name,
            class: heroSlain.class,
            specialty: heroSlain.specialty,
          }
        : null,
    });

    return {
      attack,
      attackerPlayer: {
        ...attacker,
        turnsRemaining: attacker.turnsRemaining - turnCost,
        turnsSpentTotal: attackerTurnsSpentTotal,
        stats: attackerStats,
        heroCount: Math.max(0, (attacker.heroCount ?? 0) + attackerHeroDelta),
        updatedAt: now,
      },
      defenderPlayer: {
        ...defender,
        stats: defenderStats,
        heroCount: Math.max(0, (defender.heroCount ?? 0) + defenderHeroDelta),
        summonableSpecialUnits: nextDefenderSummonable,
        updatedAt: now,
      },
      sourceTile: {
        ...source,
        units: updatedSourceUnits,
        baseUnits: updatedSourceBase,
        hero: nextSourceHero ?? undefined,
        updatedAt: now,
      },
      targetTile: {
        ...target,
        units: updatedTargetUnits,
        baseUnits: updatedTargetBase,
        baseRegenedAt: captured ? now : (target.baseRegenedAt ?? now),
        ownerId: updatedTargetOwner,
        type: updatedTargetType,
        level: updatedTargetLevel,
        upgradeIds: updatedTargetUpgrades,
        armedDefenseSpellId: null,
        lastAttackedAt: now,
        hero: nextTargetHero ?? undefined,
        updatedAt: now,
      },
      report,
      // Full CombatResult so the client can render a structured battle
      // readout (RNG rolls, supply ×, applied spells, intel passive flags,
      // per-unit-type loss breakdowns). Already feeds buildAttackReport;
      // we just expose it on the response too.
      combat: result,
      artifact: rolled?.doc ?? null,
      // Snapshot for post-txn air-intel reveals.
      _airIntelContext: {
        airDeployed: result.unitsDeployed.air,
        defenderAirAtAttack: target.units.air,
        outcome: result.outcome,
        sourcePassive: result.airIntel?.sourcePassive ?? null,
        attackerTurnsSpentTotal,
      },
    };
  });

  // Build a post-attack intel report if a Blue/Black air-intel passive fired.
  // We do this OUTSIDE the txn — buildIntelReportServer runs its own reads,
  // and the data is informational so a tiny window of staleness is fine.
  let intelReport: IntelReport | undefined;
  const ctx = result._airIntelContext;
  if (ctx.sourcePassive === "blue-sky-reader" && ctx.airDeployed > ctx.defenderAirAtAttack) {
    intelReport = await buildIntelReportServer({
      db,
      targetTileId: args.targetTileId,
      scope: "ring",
      source: "passive",
      sourceId: "blue-sky-reader",
      capturedAtTurn: ctx.attackerTurnsSpentTotal,
    });
  } else if (
    ctx.sourcePassive === "black-crowfeast" &&
    ctx.outcome === "repelled" &&
    ctx.airDeployed >= 5
  ) {
    intelReport = await buildIntelReportServer({
      db,
      targetTileId: args.targetTileId,
      scope: "kingdom",
      source: "passive",
      sourceId: "black-crowfeast",
      capturedAtTurn: ctx.attackerTurnsSpentTotal,
    });
  }

  // Fire-and-forget Discord notification on conquest. Wrapped in try/catch
  // inside notifyConquest itself; the caller never blocks on it.
  if (result.attack.outcome === "captured") {
    notifyConquest({ attack: result.attack });
  }

  // Strip the internal-only context off the response.
  const { _airIntelContext: _, ...publicResult } = result;
  return { ...publicResult, ...(intelReport ? { intelReport } : {}) };
}

/**
 * Read-only projection of what `attackTileServer` would do if called with the
 * same arguments right now. Runs `resolveAttack` with a fixed-midpoint RNG so
 * the result is the deterministic "expected" outcome — no telescope-into-future
 * exploit is possible (the same seed string is used for every preview, so the
 * RNG draws are always the midpoint of [0.9, 1.1] = 1.0). No writes, no turn
 * deduction, no transaction. Same validation rules as the real attack except:
 *   - Player turn-cost not enforced (preview is free).
 *   - Insufficient units → returned as a soft hint via `combat.unitsDeployed`,
 *     which clamps to source.units in resolveAttack.
 *
 * Returns the projected CombatResult plus enough context for the sim panel to
 * render active prep effects and defender info.
 */
export async function attackPreviewServer(args: {
  attackerId: string;
  sourceTileId: string;
  targetTileId: string;
  units: UnitStack;
  offenseSpellId: string | null;
  now?: Date;
}): Promise<{
  combat: CombatResult;
  source: GameTile;
  target: GameTile;
  defender: {
    userId: string;
    displayName: string;
    caste: Caste | null;
    shielded: boolean;
  };
  effects: {
    forgeSightOffenseBonus: number;
    alertVsCasterDefenseBonus: number;
    siegeDebuffMagnitude: number;
    preCastOffenseBonus: number;
    defenseDisarmFraction: number;
  };
}> {
  const now = args.now ?? new Date();
  if (!isValidUnitStack(args.units)) {
    throw new Error("Invalid units stack: must be {ground, siege, air} non-negative integers");
  }

  let offenseSpell = null;
  if (args.offenseSpellId) {
    offenseSpell = SPELLS_BY_ID.get(args.offenseSpellId) ?? null;
    if (!offenseSpell || offenseSpell.type !== "offense") {
      throw new GameInvalidSpellError(
        `spellId ${args.offenseSpellId} is not a valid offense spell`
      );
    }
  }

  const db = adminDbOrThrow();
  const attackerRef = db.collection(COLLECTIONS.PLAYERS).doc(args.attackerId);
  const sourceRef = db.collection(COLLECTIONS.TILES).doc(args.sourceTileId);
  const targetRef = db.collection(COLLECTIONS.TILES).doc(args.targetTileId);

  const [attackerSnap, sourceSnap, targetSnap] = await Promise.all([
    attackerRef.get(),
    sourceRef.get(),
    targetRef.get(),
  ]);
  if (!attackerSnap.exists) throw new GamePlayerNotFoundError();
  if (!sourceSnap.exists) throw new GameTileNotFoundError();
  if (!targetSnap.exists) throw new GameTileNotFoundError();

  const attacker = attackerSnap.data() as GamePlayer;
  const source = sourceSnap.data() as GameTile;
  const target = targetSnap.data() as GameTile;

  if (attacker.phase !== "play") {
    throw new GameInvalidPhaseError("play", attacker.phase);
  }
  if (attacker.caste === null) {
    throw new GameInvalidPhaseError("play (caste required)", attacker.phase);
  }
  if (source.ownerId !== args.attackerId) throw new GameTileNotOwnedError();
  if (!target.ownerId) throw new GameSelfAttackError();
  if (target.ownerId === args.attackerId) throw new GameSelfAttackError();
  if (!source.neighborTileIds.includes(args.targetTileId)) {
    throw new GameNotAdjacentError();
  }
  if (offenseSpell && offenseSpell.caste !== attacker.caste) {
    throw new GameInvalidSpellError(
      `offense spell requires caste ${offenseSpell.caste}`
    );
  }
  if (
    offenseSpell &&
    attacker.stats.tilesHeld < offenseSpell.minTilesRequired
  ) {
    throw new GameInvalidSpellError(
      `offense spell ${offenseSpell.id} requires ${offenseSpell.minTilesRequired} tiles held`
    );
  }

  const defenderId = target.ownerId;
  const defenderSnap = await db
    .collection(COLLECTIONS.PLAYERS)
    .doc(defenderId)
    .get();
  if (!defenderSnap.exists) throw new GamePlayerNotFoundError();
  const defender = defenderSnap.data() as GamePlayer;
  if (defender.caste === null) {
    throw new GameInvalidPhaseError("defender must be in play", defender.phase);
  }
  if (isShieldActive(attacker, now)) throw new GameShieldedError("attacker");
  if (isShieldActive(defender, now)) throw new GameShieldedError("defender");

  const intelContext = await readAttackContextEffects({
    db,
    attackerId: args.attackerId,
    attackerTurnsSpentTotal: attacker.turnsSpentTotal,
    defenderId,
    defenderTileId: args.targetTileId,
  });

  const defenderActiveUpgrades = defender.activeUpgrades ?? {};
  const attackerActiveUpgrades = attacker.activeUpgrades ?? {};
  const tileCapacity = computeTileCapacity(
    target.type,
    defender.caste,
    target.upgradeIds,
    defenderActiveUpgrades
  );

  // Read the 6 neighbor tiles to compute supply (mirrors attackTileServer).
  const nIds = neighborTileIds(target.q, target.r);
  const neighborSnaps = await Promise.all(
    nIds.map((id) => db.collection(COLLECTIONS.TILES).doc(id).get())
  );
  const friendlyNeighbors: Array<{ landType: LandType }> = [];
  for (const snap of neighborSnaps) {
    if (!snap.exists) continue;
    const t = snap.data() as GameTile;
    if (t.ownerId !== defenderId) continue;
    if (t.type === "unrevealed" || t.type === "unassigned") continue;
    friendlyNeighbors.push({ landType: t.type });
  }

  // Fixed-midpoint RNG: every draw returns 0.5 → finalAttack/Defense both
  // get ×1.0 multipliers. Using a constant rather than makeSeededRng so the
  // result is identical across previews and players can't fish for outcomes.
  const midpointRng = (): number => 0.5;

  // Clamp requested units to source SUPER + BASE so the projection
  // reflects everything the player could deploy (the real attack call
  // drafts BASE into the send pool).
  const sourceBase: UnitStack =
    source.baseUnits ?? { ground: 0, siege: 0, air: 0 };
  const targetBase: UnitStack =
    target.baseUnits ?? { ground: 0, siege: 0, air: 0 };
  const sourceDeployable = addStack(source.units, sourceBase);
  const clampedUnits: UnitStack = {
    ground: Math.min(args.units.ground, sourceDeployable.ground),
    siege: Math.min(args.units.siege, sourceDeployable.siege),
    air: Math.min(args.units.air, sourceDeployable.air),
  };
  const defenderComposite = addStack(target.units, targetBase);

  const combat = resolveAttack(
    {
      caste: attacker.caste,
      units: clampedUnits,
      offenseSpellId: args.offenseSpellId,
      magicLandCount: 0,
      unitsAlive: attacker.stats.unitsAlive,
      activeUpgrades: attackerActiveUpgrades,
      intelOffenseBonus: intelContext.forgeSightOffenseBonus,
      sourceLandType: source.type,
      preCastOffenseBonus: intelContext.preCastOffenseBonus,
    },
    {
      caste: defender.caste,
      unitsOnTile: defenderComposite,
      baseUnitsOnTile: targetBase,
      armedDefenseSpellId: target.armedDefenseSpellId,
      magicLandCount: 0,
      unitsAlive: defender.stats.unitsAlive,
      activeUpgrades: defenderActiveUpgrades,
      intelDefenseBonus: intelContext.alertVsCasterDefenseBonus,
      defenseDisarmFraction: intelContext.defenseDisarmFraction,
    },
    {
      capacity: tileCapacity,
      upgradeIds: target.upgradeIds,
      friendlyNeighbors,
      landType: target.type,
      siegeDebuffMagnitude: intelContext.siegeDebuffMagnitude,
    },
    midpointRng
  );

  return {
    combat,
    source,
    target,
    defender: {
      userId: defenderId,
      displayName: defender.displayName,
      caste: defender.caste,
      shielded: isShieldActive(defender, now),
    },
    effects: {
      forgeSightOffenseBonus: intelContext.forgeSightOffenseBonus,
      alertVsCasterDefenseBonus: intelContext.alertVsCasterDefenseBonus,
      siegeDebuffMagnitude: intelContext.siegeDebuffMagnitude,
      preCastOffenseBonus: intelContext.preCastOffenseBonus,
      defenseDisarmFraction: intelContext.defenseDisarmFraction,
    },
  };
}

/**
 * Siege a target tile to soften its standing-defense floor. Costs
 * SIEGE_TURN_COST. Records a `siege-debuff` IntelEffect of
 * SIEGE_ACTION_MAGNITUDE that stacks with prior sieges (read-time clamp at
 * SIEGE_DEBUFF_MAX_MAGNITUDE). Source must be owned and adjacent to target.
 */
export async function siegeTileServer(args: {
  attackerId: string;
  sourceTileId: string;
  targetTileId: string;
  now?: Date;
}): Promise<{
  player: GamePlayer;
  report: TurnReport;
  siegeTotalMagnitude: number;
}> {
  const now = args.now ?? new Date();
  const db = adminDbOrThrow();
  const attackerRef = db.collection(COLLECTIONS.PLAYERS).doc(args.attackerId);
  const sourceRef = db.collection(COLLECTIONS.TILES).doc(args.sourceTileId);
  const targetRef = db.collection(COLLECTIONS.TILES).doc(args.targetTileId);

  // Pre-read target outside the txn to derive defenderId for shielded check.
  const targetPreSnap = await targetRef.get();
  if (!targetPreSnap.exists) throw new GameTileNotFoundError();
  const targetPre = targetPreSnap.data() as GameTile;
  if (!targetPre.ownerId) throw new GameSelfAttackError();
  if (targetPre.ownerId === args.attackerId) throw new GameSelfAttackError();
  const defenderId = targetPre.ownerId;
  const defenderRef = db.collection(COLLECTIONS.PLAYERS).doc(defenderId);

  // Read existing siege magnitude pre-tx so we can return the post-cast
  // total. Slight staleness is fine — same justification as
  // readAttackContextEffects.
  const attackerPreSnap = await attackerRef.get();
  if (!attackerPreSnap.exists) throw new GamePlayerNotFoundError();
  const attackerPre = attackerPreSnap.data() as GamePlayer;
  const intelContext = await readAttackContextEffects({
    db,
    attackerId: args.attackerId,
    attackerTurnsSpentTotal: attackerPre.turnsSpentTotal,
    defenderId,
    defenderTileId: args.targetTileId,
  });
  const projectedTotal = Math.min(
    SIEGE_DEBUFF_MAX_MAGNITUDE,
    intelContext.siegeDebuffMagnitude + SIEGE_ACTION_MAGNITUDE
  );

  return db.runTransaction(async (tx) => {
    const [attackerSnap, defenderSnap, sourceSnap, targetSnap] =
      await Promise.all([
        tx.get(attackerRef),
        tx.get(defenderRef),
        tx.get(sourceRef),
        tx.get(targetRef),
      ]);
    if (!attackerSnap.exists) throw new GamePlayerNotFoundError();
    if (!defenderSnap.exists) throw new GamePlayerNotFoundError();
    if (!sourceSnap.exists) throw new GameTileNotFoundError();
    if (!targetSnap.exists) throw new GameTileNotFoundError();

    const attacker = attackerSnap.data() as GamePlayer;
    const defender = defenderSnap.data() as GamePlayer;
    const source = sourceSnap.data() as GameTile;
    const target = targetSnap.data() as GameTile;

    if (target.ownerId !== defenderId) throw new GameSelfAttackError();
    if (attacker.phase !== "play") {
      throw new GameInvalidPhaseError("play", attacker.phase);
    }
    if (source.ownerId !== args.attackerId) throw new GameTileNotOwnedError();
    if (!source.neighborTileIds.includes(args.targetTileId)) {
      throw new GameNotAdjacentError();
    }
    if (isShieldActive(attacker, now)) throw new GameShieldedError("attacker");
    if (isShieldActive(defender, now)) throw new GameShieldedError("defender");
    if (attacker.turnsRemaining < SIEGE_TURN_COST) {
      throw new GameInsufficientTurnsError(
        SIEGE_TURN_COST,
        attacker.turnsRemaining
      );
    }

    const turnsSpentTotal = attacker.turnsSpentTotal + SIEGE_TURN_COST;

    recordSiegeDebuffInTx({
      tx,
      db,
      attackerId: args.attackerId,
      targetTileId: args.targetTileId,
      magnitude: SIEGE_ACTION_MAGNITUDE,
      attackerTurnsSpentTotal: turnsSpentTotal,
      now,
    });

    tx.update(attackerRef, {
      turnsRemaining: attacker.turnsRemaining - SIEGE_TURN_COST,
      turnsSpentTotal,
      updatedAt: now,
    });

    const report = buildSiegeReport({
      turnIndex: turnsSpentTotal,
      cost: SIEGE_TURN_COST,
      targetTileId: args.targetTileId,
      magnitudeApplied: SIEGE_ACTION_MAGNITUDE,
      totalMagnitudeAfter: projectedTotal,
      rng: makeNarrativeRng(args.attackerId, turnsSpentTotal, "siege"),
    });

    const updatedPlayer: GamePlayer = {
      ...attacker,
      turnsRemaining: attacker.turnsRemaining - SIEGE_TURN_COST,
      turnsSpentTotal,
      updatedAt: now,
    };

    return {
      player: updatedPlayer,
      report,
      siegeTotalMagnitude: projectedTotal,
    };
  });
}

/**
 * Air-only raid that attrits defenders without taking the tile. Reuses
 * resolveAttack for the math, then post-processes:
 *   - Forces outcome to "repelled" or "stalemate" (never "captured").
 *   - Doubles attacker losses, clamped to deployed.
 * Tile ownership is never transferred; defender unit losses are committed.
 * Costs ATTACK_TURN_COST (1 turn) — same as a regular attack. No
 * artifact-rolling or attack-record write — flyovers are softening moves,
 * not the main bout.
 */
export async function flyoverTileServer(args: {
  attackerId: string;
  sourceTileId: string;
  targetTileId: string;
  units: UnitStack;
  now?: Date;
}): Promise<{
  attackerPlayer: GamePlayer;
  sourceTile: GameTile;
  targetTile: GameTile;
  report: TurnReport;
  combat: CombatResult;
}> {
  const now = args.now ?? new Date();
  if (!isValidUnitStack(args.units)) {
    throw new Error("Invalid units stack: must be {ground, siege, air} non-negative integers");
  }
  if (sumStack(args.units) === 0) {
    throw new Error("Must send at least 1 unit");
  }
  if (args.units.ground !== 0 || args.units.siege !== 0) {
    throw new Error("Flyover requires air units only (ground=0, siege=0)");
  }

  const turnCost = ATTACK_TURN_COST;
  const db = adminDbOrThrow();
  const attackerRef = db.collection(COLLECTIONS.PLAYERS).doc(args.attackerId);
  const sourceRef = db.collection(COLLECTIONS.TILES).doc(args.sourceTileId);
  const targetRef = db.collection(COLLECTIONS.TILES).doc(args.targetTileId);

  const targetPreSnap = await targetRef.get();
  if (!targetPreSnap.exists) throw new GameTileNotFoundError();
  const targetPre = targetPreSnap.data() as GameTile;
  if (!targetPre.ownerId) throw new GameSelfAttackError();
  if (targetPre.ownerId === args.attackerId) throw new GameSelfAttackError();
  const defenderId = targetPre.ownerId;
  const defenderRef = db.collection(COLLECTIONS.PLAYERS).doc(defenderId);

  const attackerPreSnap = await attackerRef.get();
  if (!attackerPreSnap.exists) throw new GamePlayerNotFoundError();
  const attackerPre = attackerPreSnap.data() as GamePlayer;
  const intelContext = await readAttackContextEffects({
    db,
    attackerId: args.attackerId,
    attackerTurnsSpentTotal: attackerPre.turnsSpentTotal,
    defenderId,
    defenderTileId: args.targetTileId,
  });

  return db.runTransaction(async (tx) => {
    const [attackerSnap, defenderSnap, sourceSnap, targetSnap] =
      await Promise.all([
        tx.get(attackerRef),
        tx.get(defenderRef),
        tx.get(sourceRef),
        tx.get(targetRef),
      ]);
    if (!attackerSnap.exists) throw new GamePlayerNotFoundError();
    if (!defenderSnap.exists) throw new GamePlayerNotFoundError();
    if (!sourceSnap.exists) throw new GameTileNotFoundError();
    if (!targetSnap.exists) throw new GameTileNotFoundError();

    const attacker = attackerSnap.data() as GamePlayer;
    const defender = defenderSnap.data() as GamePlayer;
    const source = sourceSnap.data() as GameTile;
    const target = targetSnap.data() as GameTile;

    if (target.ownerId !== defenderId) throw new GameSelfAttackError();
    if (attacker.phase !== "play") {
      throw new GameInvalidPhaseError("play", attacker.phase);
    }
    if (attacker.caste === null) {
      throw new GameInvalidPhaseError("play (caste required)", attacker.phase);
    }
    if (defender.caste === null) {
      throw new GameInvalidPhaseError(
        "defender must be in play",
        defender.phase
      );
    }
    if (isShieldActive(attacker, now)) throw new GameShieldedError("attacker");
    if (isShieldActive(defender, now)) throw new GameShieldedError("defender");
    if (source.ownerId !== args.attackerId) throw new GameTileNotOwnedError();
    if (!source.neighborTileIds.includes(args.targetTileId)) {
      throw new GameNotAdjacentError();
    }
    if (attacker.turnsRemaining < turnCost) {
      throw new GameInsufficientTurnsError(
        turnCost,
        attacker.turnsRemaining
      );
    }
    // BASE+SUPER: same draft semantics as attackTileServer.
    const sourceBase: UnitStack =
      source.baseUnits ?? { ground: 0, siege: 0, air: 0 };
    const targetBase: UnitStack =
      target.baseUnits ?? { ground: 0, siege: 0, air: 0 };
    const sourceDeployable = addStack(source.units, sourceBase);
    if (!stackHasAtLeast(sourceDeployable, args.units)) {
      throw new GameInsufficientUnitsError();
    }
    const superSent: UnitStack = {
      ground: Math.min(args.units.ground, source.units.ground),
      siege: Math.min(args.units.siege, source.units.siege),
      air: Math.min(args.units.air, source.units.air),
    };
    const baseSent: UnitStack = {
      ground: args.units.ground - superSent.ground,
      siege: args.units.siege - superSent.siege,
      air: args.units.air - superSent.air,
    };

    const defenderActiveUpgrades = defender.activeUpgrades ?? {};
    const attackerActiveUpgrades = attacker.activeUpgrades ?? {};
    const tileCapacity = computeTileCapacity(
      target.type,
      defender.caste,
      target.upgradeIds,
      defenderActiveUpgrades
    );

    // Read neighbors for supply (mirrors attackTileServer).
    const nIds = neighborTileIds(target.q, target.r);
    const neighborSnaps = await Promise.all(
      nIds.map((id) => tx.get(db.collection(COLLECTIONS.TILES).doc(id)))
    );
    const friendlyNeighbors: Array<{ landType: LandType }> = [];
    for (const snap of neighborSnaps) {
      if (!snap.exists) continue;
      const t = snap.data() as GameTile;
      if (t.ownerId !== defenderId) continue;
      if (t.type === "unrevealed" || t.type === "unassigned") continue;
      friendlyNeighbors.push({ landType: t.type });
    }

    const defenderComposite = addStack(target.units, targetBase);
    const flyoverId = randomUUID();
    const baseCombat = resolveAttack(
      {
        caste: attacker.caste,
        units: args.units,
        offenseSpellId: null,
        magicLandCount: 0,
        unitsAlive: attacker.stats.unitsAlive,
        activeUpgrades: attackerActiveUpgrades,
        intelOffenseBonus: intelContext.forgeSightOffenseBonus,
        sourceLandType: source.type,
      },
      {
        caste: defender.caste,
        unitsOnTile: defenderComposite,
        baseUnitsOnTile: targetBase,
        armedDefenseSpellId: target.armedDefenseSpellId,
        magicLandCount: 0,
        unitsAlive: defender.stats.unitsAlive,
        activeUpgrades: defenderActiveUpgrades,
        intelDefenseBonus: intelContext.alertVsCasterDefenseBonus,
      },
      {
        capacity: tileCapacity,
        upgradeIds: target.upgradeIds,
        friendlyNeighbors,
        landType: target.type,
        siegeDebuffMagnitude: intelContext.siegeDebuffMagnitude,
      },
      makeSeededRng(`flyover-${flyoverId}`)
    );

    // Flyover post-processing: capture is impossible (tile never changes
    // hands in a raid) + attacker losses doubled. Logic lives in
    // applyFlyoverModifiers so it's covered by combat tests.
    const combat = applyFlyoverModifiers(baseCombat);

    // BASE+SUPER loss attribution (no capture branch — flyover always repels).
    const attackerLossSplit = attributeAttackerLosses({
      superSent,
      baseSent,
      totalLosses: combat.attackerLosses,
    });
    const defenderLossSplit = attributeDefenderLosses({
      superBefore: target.units,
      baseBefore: targetBase,
      totalLosses: combat.defenderLosses,
      outcome: combat.outcome,
      captureBaseRetentionFactor: combat.captureBaseRetentionFactor,
    });

    const superSurvivors: UnitStack = {
      ground: superSent.ground - attackerLossSplit.superLost.ground,
      siege: superSent.siege - attackerLossSplit.superLost.siege,
      air: superSent.air - attackerLossSplit.superLost.air,
    };
    const baseSurvivors: UnitStack = {
      ground: baseSent.ground - attackerLossSplit.baseLost.ground,
      siege: baseSent.siege - attackerLossSplit.baseLost.siege,
      air: baseSent.air - attackerLossSplit.baseLost.air,
    };
    const updatedSourceUnits = addStack(
      subtractStack(source.units, superSent),
      superSurvivors
    );
    const updatedSourceBase = addStack(
      subtractStack(sourceBase, baseSent),
      baseSurvivors
    );
    const updatedTargetUnits = defenderLossSplit.newSuper;
    const updatedTargetBase = defenderLossSplit.newBase;

    const attackerSuperLostTotal = sumStack(attackerLossSplit.superLost);
    const defenderSuperLostTotal = sumStack(defenderLossSplit.superLost);

    const turnsSpentTotal = attacker.turnsSpentTotal + turnCost;

    tx.update(sourceRef, {
      units: updatedSourceUnits,
      baseUnits: updatedSourceBase,
      updatedAt: now,
    });
    tx.update(targetRef, {
      units: updatedTargetUnits,
      baseUnits: updatedTargetBase,
      lastAttackedAt: now,
      updatedAt: now,
    });

    const attackerStats = {
      ...attacker.stats,
      unitsAlive: Math.max(0, attacker.stats.unitsAlive - attackerSuperLostTotal),
    };
    const defenderStats = {
      ...defender.stats,
      unitsAlive: Math.max(0, defender.stats.unitsAlive - defenderSuperLostTotal),
    };

    tx.update(attackerRef, {
      turnsRemaining: attacker.turnsRemaining - turnCost,
      turnsSpentTotal,
      stats: attackerStats,
      updatedAt: now,
    });
    tx.update(defenderRef, { stats: defenderStats, updatedAt: now });

    const report = buildFlyoverReport({
      turnIndex: turnsSpentTotal,
      cost: turnCost,
      targetTileId: args.targetTileId,
      unitsSent: args.units,
      combat,
      artifactFound: null,
      rng: makeNarrativeRng(args.attackerId, turnsSpentTotal, "flyover"),
    });

    return {
      attackerPlayer: {
        ...attacker,
        turnsRemaining: attacker.turnsRemaining - turnCost,
        turnsSpentTotal,
        stats: attackerStats,
        updatedAt: now,
      },
      sourceTile: {
        ...source,
        units: updatedSourceUnits,
        baseUnits: updatedSourceBase,
        updatedAt: now,
      },
      targetTile: {
        ...target,
        units: updatedTargetUnits,
        baseUnits: updatedTargetBase,
        lastAttackedAt: now,
        updatedAt: now,
      },
      report,
      combat,
    };
  });
}

/**
 * Standalone spell-cast against a target tile. Dispatches on
 * `spell.type ∈ {"siege", "disarm", "attrition"}`. Rolls dice once
 * (rollSpellEffectiveness, band 0.5–1.5), computes realized magnitude
 * via `realizedSpellMagnitude`, and either persists an IntelEffect
 * (siege, disarm) or commits unit kills (attrition).
 *
 * Costs `spell.turnCost` (5 for tier 1). Validates ownership + adjacency
 * + non-shield + caste-match + tier tile-min + turn budget.
 */
export async function castSpellServer(args: {
  attackerId: string;
  spellId: string;
  sourceTileId: string;
  targetTileId: string;
  now?: Date;
}): Promise<{
  player: GamePlayer;
  report: TurnReport;
  // Kind-specific outcome — only one populated based on spell.type.
  siege?: { magnitudeApplied: number; totalMagnitudeAfter: number };
  disarm?: { fractionApplied: number };
  attrition?: { unitsKilled: UnitStack; targetTile: GameTile };
}> {
  const now = args.now ?? new Date();
  const spell = SPELLS_BY_ID.get(args.spellId);
  if (!spell) throw new GameInvalidSpellError(`unknown spellId ${args.spellId}`);
  if (
    spell.type !== "siege" &&
    spell.type !== "disarm" &&
    spell.type !== "attrition"
  ) {
    throw new GameInvalidSpellError(
      `spellId ${args.spellId} (type=${spell.type}) is not a cast-able pre-attack spell`
    );
  }

  const db = adminDbOrThrow();
  const attackerRef = db.collection(COLLECTIONS.PLAYERS).doc(args.attackerId);
  const sourceRef = db.collection(COLLECTIONS.TILES).doc(args.sourceTileId);
  const targetRef = db.collection(COLLECTIONS.TILES).doc(args.targetTileId);

  const targetPreSnap = await targetRef.get();
  if (!targetPreSnap.exists) throw new GameTileNotFoundError();
  const targetPre = targetPreSnap.data() as GameTile;
  if (!targetPre.ownerId) throw new GameSelfAttackError();
  if (targetPre.ownerId === args.attackerId) throw new GameSelfAttackError();
  const defenderId = targetPre.ownerId;
  const defenderRef = db.collection(COLLECTIONS.PLAYERS).doc(defenderId);

  // Pre-read attacker for owned-land counts (drives the magicMultiplier in
  // the realized-magnitude formula). Same staleness trade-off as the
  // attack server uses for intel-effects.
  const attackerLandCounts = await getOwnedLandCounts(args.attackerId);

  // Pre-read for siege total projection (so we can return the post-cast
  // total without a follow-up query).
  const attackerPreSnap = await attackerRef.get();
  if (!attackerPreSnap.exists) throw new GamePlayerNotFoundError();
  const attackerPre = attackerPreSnap.data() as GamePlayer;
  const intelContext = await readAttackContextEffects({
    db,
    attackerId: args.attackerId,
    attackerTurnsSpentTotal: attackerPre.turnsSpentTotal,
    defenderId,
    defenderTileId: args.targetTileId,
  });

  return db.runTransaction(async (tx) => {
    const [attackerSnap, defenderSnap, sourceSnap, targetSnap] =
      await Promise.all([
        tx.get(attackerRef),
        tx.get(defenderRef),
        tx.get(sourceRef),
        tx.get(targetRef),
      ]);
    if (!attackerSnap.exists) throw new GamePlayerNotFoundError();
    if (!defenderSnap.exists) throw new GamePlayerNotFoundError();
    if (!sourceSnap.exists) throw new GameTileNotFoundError();
    if (!targetSnap.exists) throw new GameTileNotFoundError();

    const attacker = attackerSnap.data() as GamePlayer;
    const defender = defenderSnap.data() as GamePlayer;
    const source = sourceSnap.data() as GameTile;
    const target = targetSnap.data() as GameTile;

    if (target.ownerId !== defenderId) throw new GameSelfAttackError();
    if (attacker.phase !== "play") {
      throw new GameInvalidPhaseError("play", attacker.phase);
    }
    if (attacker.caste === null) {
      throw new GameInvalidPhaseError("play (caste required)", attacker.phase);
    }
    if (spell.caste !== attacker.caste) {
      throw new GameInvalidSpellError(
        `spell ${spell.id} requires caste ${spell.caste}`
      );
    }
    if (attacker.stats.tilesHeld < spell.minTilesRequired) {
      throw new GameInvalidSpellError(
        `spell ${spell.id} requires ${spell.minTilesRequired} tiles held; you have ${attacker.stats.tilesHeld}`
      );
    }
    if (source.ownerId !== args.attackerId) throw new GameTileNotOwnedError();
    if (!source.neighborTileIds.includes(args.targetTileId)) {
      throw new GameNotAdjacentError();
    }
    if (isShieldActive(attacker, now)) throw new GameShieldedError("attacker");
    if (isShieldActive(defender, now)) throw new GameShieldedError("defender");
    if (attacker.turnsRemaining < spell.turnCost) {
      throw new GameInsufficientTurnsError(
        spell.turnCost,
        attacker.turnsRemaining
      );
    }

    // Roll dice + compute realized magnitude. Seed includes the cast time
    // so re-cast on the same target rolls fresh; players cannot fish.
    const castId = randomUUID();
    const rng = makeSeededRng(`cast-${castId}`);
    const dice = rollSpellEffectiveness(rng);
    // Magic-hero spell boost: if a magic hero is stationed on the source
    // tile, multiply realized magnitude by a stamina+specialty-weighted
    // factor. Stacks on top of the existing magicMultiplier / caste bonus.
    const magicHeroSpellMult = magicHeroSpellMultiplier(
      attacker.turnsSpentTotal,
      source,
      spell
    );
    const rawMagnitude =
      realizedSpellMagnitude({
        baseStrength: spell.baseStrength,
        caste: attacker.caste,
        spellType: spell.type,
        magicLandCount: attackerLandCounts.magic,
        activeUpgrades: attacker.activeUpgrades ?? {},
        dice,
      }) * magicHeroSpellMult;

    const turnsSpentTotal = attacker.turnsSpentTotal + spell.turnCost;
    let kindPayload: {
      siege?: { magnitudeApplied: number; totalMagnitudeAfter: number };
      disarm?: { fractionApplied: number };
      attrition?: { unitsKilled: UnitStack; targetTile: GameTile };
    } = {};

    if (spell.type === "siege") {
      const magnitudeApplied = Math.max(
        0,
        Math.min(SIEGE_DEBUFF_MAX_MAGNITUDE, rawMagnitude)
      );
      recordSiegeDebuffInTx({
        tx,
        db,
        attackerId: args.attackerId,
        targetTileId: args.targetTileId,
        magnitude: magnitudeApplied,
        attackerTurnsSpentTotal: turnsSpentTotal,
        now,
      });
      const totalMagnitudeAfter = Math.min(
        SIEGE_DEBUFF_MAX_MAGNITUDE,
        intelContext.siegeDebuffMagnitude + magnitudeApplied
      );
      kindPayload = {
        siege: { magnitudeApplied, totalMagnitudeAfter },
      };
    } else if (spell.type === "disarm") {
      const fractionApplied = Math.max(0, Math.min(1, rawMagnitude));
      recordDefenseDisarmInTx({
        tx,
        db,
        attackerId: args.attackerId,
        targetTileId: args.targetTileId,
        disarmFraction: fractionApplied,
        attackerTurnsSpentTotal: turnsSpentTotal,
        now,
      });
      kindPayload = { disarm: { fractionApplied } };
    } else {
      // attrition: kill units immediately, distributed across types.
      const unitsKilled = distributeUnitKills(
        target.units,
        Math.max(0, Math.round(rawMagnitude))
      );
      const newUnits: UnitStack = {
        ground: Math.max(0, target.units.ground - unitsKilled.ground),
        siege: Math.max(0, target.units.siege - unitsKilled.siege),
        air: Math.max(0, target.units.air - unitsKilled.air),
      };
      const totalKilled =
        unitsKilled.ground + unitsKilled.siege + unitsKilled.air;
      tx.update(targetRef, {
        units: newUnits,
        lastAttackedAt: now,
        updatedAt: now,
      });
      // Decrement defender's denormalized unitsAlive too so kingdom-wide
      // displays stay consistent.
      const defenderStats = {
        ...defender.stats,
        unitsAlive: Math.max(0, defender.stats.unitsAlive - totalKilled),
      };
      tx.update(defenderRef, { stats: defenderStats, updatedAt: now });
      kindPayload = {
        attrition: {
          unitsKilled,
          targetTile: {
            ...target,
            units: newUnits,
            lastAttackedAt: now,
            updatedAt: now,
          },
        },
      };
    }

    // Magic hero emergence (source tile must be magic + heroless +
    // attacker has a caste). Persists on the source tile and bumps the
    // attacker's heroCount.
    let emergedHero: GameHero | null = null;
    if (source.type === "magic" && source.hero == null && attacker.caste) {
      const emergeRng = makeSeededRng(
        `hero-emerge-cast-${args.attackerId}-${turnsSpentTotal}`
      );
      emergedHero = maybeEmergeHero({
        class: "magic",
        tile: source,
        ownerId: args.attackerId,
        ownerCaste: attacker.caste,
        turnIndex: turnsSpentTotal,
        rng: emergeRng,
      });
      if (emergedHero) {
        tx.update(sourceRef, { hero: emergedHero, updatedAt: now });
        logCommunityEventInTx(
          tx,
          db,
          {
            kind: "hero_emerged",
            actorUserId: args.attackerId,
            actorDisplayName: attacker.displayName,
            actorCaste: attacker.caste,
            tileId: args.sourceTileId,
            heroId: emergedHero.id,
            heroName: emergedHero.name,
            heroClass: emergedHero.class,
            heroSpecialty: emergedHero.specialty,
          },
          now
        );
      }
    }

    // v2 registry: emergence + spell_cast event for the source magic hero
    // (either the freshly emerged one OR a pre-existing one).
    const castSeasonNumber = attacker.seasonNumber ?? 1;
    const magicHeroOnSource =
      emergedHero ??
      (source.hero && source.hero.class === "magic" ? source.hero : null);
    if (emergedHero) {
      upsertHeroInTx({
        tx,
        db,
        hero: emergedHero,
        seasonNumber: castSeasonNumber,
        now,
      });
      appendHeroEventInTx({
        tx,
        db,
        heroId: emergedHero.id,
        event: heroEvent.emerged(emergedHero, castSeasonNumber),
        now,
      });
    }
    if (magicHeroOnSource) {
      appendHeroEventInTx({
        tx,
        db,
        heroId: magicHeroOnSource.id,
        event: heroEvent.spellCast({
          tileId: args.sourceTileId,
          ownerIdAtTime: args.attackerId,
          spellId: spell.id,
          targetTileId: args.targetTileId,
          seasonNumber: castSeasonNumber,
        }),
        now,
      });
    }

    const attackerUpdate: Record<string, unknown> = {
      turnsRemaining: attacker.turnsRemaining - spell.turnCost,
      turnsSpentTotal,
      updatedAt: now,
    };
    if (emergedHero) {
      attackerUpdate.heroCount = (attacker.heroCount ?? 0) + 1;
    }
    tx.update(attackerRef, attackerUpdate);

    // Re-narrow spell.type for buildCastSpellReport — the TS flow analysis
    // doesn't see through the early throw when traversing through the
    // closure boundary.
    const spellType: "siege" | "disarm" | "attrition" =
      spell.type === "siege" || spell.type === "disarm" ? spell.type : "attrition";
    const report = buildCastSpellReport({
      turnIndex: turnsSpentTotal,
      cost: spell.turnCost,
      spellId: spell.id,
      spellName: spell.name,
      spellType,
      targetTileId: args.targetTileId,
      siege: kindPayload.siege,
      disarm: kindPayload.disarm,
      attrition: kindPayload.attrition
        ? { unitsKilled: kindPayload.attrition.unitsKilled }
        : undefined,
      rng: makeNarrativeRng(args.attackerId, turnsSpentTotal, "spell-cast"),
      heroEmerged: emergedHero,
    });

    const updatedPlayer: GamePlayer = {
      ...attacker,
      turnsRemaining: attacker.turnsRemaining - spell.turnCost,
      turnsSpentTotal,
      heroCount: emergedHero ? (attacker.heroCount ?? 0) + 1 : attacker.heroCount,
      updatedAt: now,
    };

    return {
      player: updatedPlayer,
      report,
      ...kindPayload,
    };
  });
}

export async function getRecentAttacksServer(opts: {
  userId: string;
  side: "sent" | "received" | "all";
  limit: number;
  cursor: string | null;
}): Promise<PaginatedQueryResult<GameAttack>> {
  const db = adminDbOrThrow();
  const attacks = db.collection(COLLECTIONS.ATTACKS);

  if (opts.side === "sent" || opts.side === "received") {
    // Composite indexes (attackerId/defenderId ASC + createdAt DESC) are
    // declared in config/firebase/firestore.indexes.json.
    const field = opts.side === "sent" ? "attackerId" : "defenderId";
    const query = attacks
      .where(field, "==", opts.userId)
      .orderBy("createdAt", "desc");
    return paginateFirestoreQuery({
      query,
      collection: attacks,
      cursor: opts.cursor,
      limit: opts.limit,
      mapDoc: (d) => d.data() as GameAttack,
    });
  }

  // side="all" merges sent + received in memory because Firestore can't OR
  // across two single-field equalities. Capped at 500 per side; for full
  // history use side="sent" or side="received" with cursor pagination.
  const SIDE_FETCH_CAP = 500;
  const [sentSnap, receivedSnap] = await Promise.all([
    attacks.where("attackerId", "==", opts.userId).limit(SIDE_FETCH_CAP).get(),
    attacks.where("defenderId", "==", opts.userId).limit(SIDE_FETCH_CAP).get(),
  ]);
  const seen = new Set<string>();
  const merged: GameAttack[] = [];
  for (const doc of [...sentSnap.docs, ...receivedSnap.docs]) {
    const a = doc.data() as GameAttack;
    if (a.id && seen.has(a.id)) continue;
    if (a.id) seen.add(a.id);
    merged.push(a);
  }
  merged.sort((a, b) => {
    const ta = toDate(a.createdAt).getTime();
    const tb = toDate(b.createdAt).getTime();
    return tb - ta;
  });
  return paginateInMemory(merged, opts.cursor, opts.limit);
}

// Coerce Firestore Timestamps / Dates / null into a Date. Avoids the previous
// bug where `instanceof Date` failed against admin-SDK Timestamps and the
// sort silently fell back to all-zeros (= unstable order).
function toDate(value: Date | { toDate?: () => Date } | undefined | null): Date {
  if (!value) return new Date(0);
  if (value instanceof Date) return value;
  if (typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }
  return new Date(0);
}

// Admin testing helper. Places `count` units of `unitType` directly on `tileId`,
// bypassing turn/cap checks. Used to bootstrap PR 3 attack testing before unit
// production is fully wired in PR 5.
export async function adminGrantUnitsServer(args: {
  ownerId: string;
  tileId: string;
  unitType: UnitType;
  count: number;
  now?: Date;
}): Promise<{ player: GamePlayer; tile: GameTile }> {
  const now = args.now ?? new Date();
  if (args.count < 0 || !Number.isInteger(args.count)) {
    throw new Error("count must be a non-negative integer");
  }

  const db = adminDbOrThrow();
  const tileRef = db.collection(COLLECTIONS.TILES).doc(args.tileId);
  const playerRef = db.collection(COLLECTIONS.PLAYERS).doc(args.ownerId);

  return db.runTransaction(async (tx) => {
    const [tileSnap, playerSnap] = await Promise.all([
      tx.get(tileRef),
      tx.get(playerRef),
    ]);
    if (!playerSnap.exists) throw new GamePlayerNotFoundError();
    if (!tileSnap.exists) throw new GameTileNotFoundError();

    const player = playerSnap.data() as GamePlayer;
    const tile = tileSnap.data() as GameTile;
    if (tile.ownerId !== args.ownerId) throw new GameTileNotOwnedError();

    const newUnits = {
      ...tile.units,
      [args.unitType]: tile.units[args.unitType] + args.count,
    };
    tx.update(tileRef, { units: newUnits, updatedAt: now });
    tx.update(playerRef, {
      stats: {
        ...player.stats,
        unitsAlive: player.stats.unitsAlive + args.count,
      },
      updatedAt: now,
    });

    return {
      player: {
        ...player,
        stats: {
          ...player.stats,
          unitsAlive: player.stats.unitsAlive + args.count,
        },
        updatedAt: now,
      },
      tile: { ...tile, units: newUnits, updatedAt: now },
    };
  });
}

export interface WeeklyRolloverSummary {
  weekStartIso: string;
  scanned: number;
  granted: number;
  skippedAlreadyGranted: number;
  skippedNoPrs: number;
  errors: Array<{ userId: string; error: string }>;
}

// Iterates every game_player and grants 100 turns to anyone who merged a PR
// during the prior 7-day window (Sunday 05:00 UTC → Sunday 05:00 UTC). Idempotent
// per (player × weekStartIso): re-running the same weekStart is a no-op.
export async function runWeeklyRolloverServer(
  weekStartIso?: string,
  now: Date = new Date()
): Promise<WeeklyRolloverSummary> {
  const db = adminDbOrThrow();
  const wkStart = weekStartIso ?? weekStartIsoForRollover(now);
  const window = priorWeekRangeUtc(wkStart);
  const playersSnap = await db.collection(COLLECTIONS.PLAYERS).get();
  const summary: WeeklyRolloverSummary = {
    weekStartIso: wkStart,
    scanned: playersSnap.size,
    granted: 0,
    skippedAlreadyGranted: 0,
    skippedNoPrs: 0,
    errors: [],
  };

  for (const playerDoc of playersSnap.docs) {
    const player = playerDoc.data() as GamePlayer;
    if (player.lastWeeklyGrantWeekStart === wkStart) {
      summary.skippedAlreadyGranted += 1;
      continue;
    }
    try {
      // Range-filter on mergedAt so we only read PRs that could possibly count
      // for the current weekly window. Without this filter we'd read every
      // merged PR in the user's lifetime — a runaway cost that grows with
      // player tenure. Index: (userId, state, mergedAt) in firestore.indexes.json.
      // .limit(1) because presence-in-window is all we need.
      const prsSnap = await db
        .collection("pullRequests")
        .where("userId", "==", player.userId)
        .where("state", "==", "merged")
        .where("mergedAt", ">=", window.start)
        .where("mergedAt", "<", window.end)
        .limit(1)
        .get();
      const inWindow = !prsSnap.empty;

      if (!inWindow) {
        summary.skippedNoPrs += 1;
        continue;
      }

      const playerRef = db.collection(COLLECTIONS.PLAYERS).doc(player.userId);
      const granted = await db.runTransaction(async (tx) => {
        const fresh = await tx.get(playerRef);
        if (!fresh.exists) return false;
        const freshData = fresh.data() as GamePlayer;
        if (freshData.lastWeeklyGrantWeekStart === wkStart) return false;
        const updated = applyWeeklyGrant(freshData, wkStart, now);
        tx.update(playerRef, {
          turnsRemaining: updated.turnsRemaining,
          // Zero-turn gameplay: consume any pending prophecy bonus on grant.
          pendingProphecyBonus: 0,
          lastWeeklyGrantAt: updated.lastWeeklyGrantAt,
          lastWeeklyGrantWeekStart: updated.lastWeeklyGrantWeekStart,
          updatedAt: updated.updatedAt,
        });
        return true;
      });
      if (granted) summary.granted += 1;
      else summary.skippedAlreadyGranted += 1;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      summary.errors.push({ userId: player.userId, error: message });
      logger.warn("Weekly rollover error for player", {
        userId: player.userId,
        weekStartIso: wkStart,
        error: message,
      });
    }
  }

  logger.info("Weekly rollover complete", {
    weekStartIso: wkStart,
    scanned: summary.scanned,
    granted: summary.granted,
    skippedAlreadyGranted: summary.skippedAlreadyGranted,
    skippedNoPrs: summary.skippedNoPrs,
    errorCount: summary.errors.length,
  });
  return summary;
}

// Case-insensitive uniqueness check. Excludes `excludeUserId` so a player
// can re-save their own current name (no-op rename).
export async function isGeneralNameTakenServer(
  name: string,
  excludeUserId?: string
): Promise<boolean> {
  const db = adminDbOrThrow();
  const trimmed = name.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  // Firestore can't do case-insensitive equality, so we store a derived field
  // on write. Falls back to scanning — N is small (4 today, hundreds at peak).
  // If the player count grows beyond a few thousand, denormalize to a
  // game_player_names collection keyed by lowercased name.
  const snap = await db
    .collection(COLLECTIONS.PLAYERS)
    .where("displayNameLower", "==", lower)
    .limit(1)
    .get();
  if (snap.empty) return false;
  const doc = snap.docs[0];
  if (excludeUserId && doc.id === excludeUserId) return false;
  return true;
}

export async function setGeneralNameServer(
  userId: string,
  rawName: string,
  now: Date = new Date()
): Promise<GamePlayer> {
  const db = adminDbOrThrow();
  const cleaned = (() => {
    try {
      return validateGeneralName(rawName);
    } catch (e) {
      throw new GameInvalidNameError(
        e instanceof Error ? e.message : String(e)
      );
    }
  })();
  const taken = await isGeneralNameTakenServer(cleaned, userId);
  if (taken) throw new GameNameTakenError();
  const playerRef = db.collection(COLLECTIONS.PLAYERS).doc(userId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(playerRef);
    if (!snap.exists) throw new GamePlayerNotFoundError();
    tx.update(playerRef, {
      displayName: cleaned,
      displayNameLower: cleaned.toLowerCase(),
      updatedAt: now,
    });
    return { ...(snap.data() as GamePlayer), displayName: cleaned, updatedAt: now };
  });
}

const MAX_BIO_LENGTH = 500;
const MAX_INSCRIPTION_LENGTH = 120;

/**
 * Sets the owner-authored inscription on a tile. Cosmetic — surfaces
 * via intel scans / attack outcomes. Owner-only write. Empty string
 * clears the inscription.
 */
export async function setTileInscriptionServer(
  userId: string,
  tileId: string,
  rawInscription: string,
  now: Date = new Date()
): Promise<GameTile> {
  const cleaned = sanitizeText(rawInscription);
  if (cleaned.length > MAX_INSCRIPTION_LENGTH) {
    throw new GameInscriptionTooLongError();
  }
  const db = adminDbOrThrow();
  const tileRef = db.collection(COLLECTIONS.TILES).doc(tileId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(tileRef);
    if (!snap.exists) throw new GameTileNotFoundError();
    const tile = snap.data() as GameTile;
    if (tile.ownerId !== userId) throw new GameTileNotOwnedError();
    tx.update(tileRef, {
      inscription: cleaned,
      inscriptionUpdatedAt: now,
      updatedAt: now,
    });
    return {
      ...tile,
      inscription: cleaned,
      inscriptionUpdatedAt: now,
      updatedAt: now,
    };
  });
}

/**
 * Updates the player's free-form public bio shown on the profile page.
 * No turn cost; rate-limited at the route layer. Passing an empty
 * string clears the bio. Sanitizes via sanitizeText() before write so
 * control chars / stray tabs don't leak into Firestore.
 */
export async function setPlayerBioServer(
  userId: string,
  rawBio: string,
  now: Date = new Date()
): Promise<GamePlayer> {
  const cleaned = sanitizeText(rawBio);
  if (cleaned.length > MAX_BIO_LENGTH) {
    throw new GamePlayerBioTooLongError();
  }
  const db = adminDbOrThrow();
  const playerRef = db.collection(COLLECTIONS.PLAYERS).doc(userId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(playerRef);
    if (!snap.exists) throw new GamePlayerNotFoundError();
    tx.update(playerRef, {
      bio: cleaned,
      bioUpdatedAt: now,
      updatedAt: now,
    });
    return {
      ...(snap.data() as GamePlayer),
      bio: cleaned,
      bioUpdatedAt: now,
      updatedAt: now,
    };
  });
}

/**
 * Public read for /game/players/[playerId]. Returns the player doc as-
 * is — the page renders only the public-safe fields, and `game_players`
 * is already world-readable for the leaderboard, so there's no extra
 * secret to filter out. Returns null if the player doesn't exist.
 */
export async function getPublicPlayerProfileServer(
  userId: string
): Promise<GamePlayer | null> {
  const db = adminDbOrThrow();
  const snap = await db.collection(COLLECTIONS.PLAYERS).doc(userId).get();
  if (!snap.exists) return null;
  return snap.data() as GamePlayer;
}

export async function getLeaderboardServer(opts: {
  limit: number;
  cursor: string | null;
  audience?: "all" | "npc" | "real";
}): Promise<PaginatedQueryResult<GamePlayer>> {
  const db = adminDbOrThrow();
  const players = db.collection(COLLECTIONS.PLAYERS);
  const baseQuery = players.orderBy("stats.tilesHeld", "desc");
  const audience = opts.audience ?? "all";

  if (audience === "all") {
    return paginateFirestoreQuery({
      query: baseQuery,
      collection: players,
      cursor: opts.cursor,
      limit: opts.limit,
      mapDoc: (d) => d.data() as GamePlayer,
    });
  }

  // Real players don't store `isNpc` at all, so a Firestore where(==false)
  // would miss them. Overfetch + filter in memory — players collection is
  // small (≲ a few hundred docs) and this avoids needing a composite index
  // on (isNpc, stats.tilesHeld).
  const overFetch = opts.limit * 4 + 1;
  let q = baseQuery.limit(overFetch);
  if (opts.cursor) {
    const cursorDoc = await players.doc(opts.cursor).get();
    if (cursorDoc.exists) q = q.startAfter(cursorDoc);
  }
  const snap = await q.get();
  const matches = snap.docs.filter((d) => {
    const isNpc = (d.data() as { isNpc?: boolean }).isNpc === true;
    return audience === "npc" ? isNpc : !isNpc;
  });
  const sliced = matches.slice(0, opts.limit);
  const items = sliced.map((d) => d.data() as GamePlayer);
  const hasMore = matches.length > opts.limit || snap.size === overFetch;
  const nextCursor =
    hasMore && sliced.length > 0 ? sliced[sliced.length - 1].id : null;
  return { items, nextCursor, hasMore };
}

// Admin-only testing helper. Kept as a manual override even after the cron
// rollover ships in PR 4 — useful for backfills and manual testing.
export async function adminGrantTurnsServer(
  userId: string,
  weekStartIso?: string,
  now: Date = new Date()
): Promise<GamePlayer> {
  const db = adminDbOrThrow();
  const playerRef = db.collection(COLLECTIONS.PLAYERS).doc(userId);
  const wkStart = weekStartIso ?? weekStartIsoForRollover(now);

  return db.runTransaction(async (tx) => {
    const playerSnap = await tx.get(playerRef);
    if (!playerSnap.exists) throw new GamePlayerNotFoundError();
    const player = playerSnap.data() as GamePlayer;
    const granted = applyWeeklyGrant(player, wkStart, now);
    tx.update(playerRef, {
      turnsRemaining: granted.turnsRemaining,
      // Zero-turn gameplay: consume any pending prophecy bonus on grant.
      pendingProphecyBonus: 0,
      lastWeeklyGrantAt: granted.lastWeeklyGrantAt,
      lastWeeklyGrantWeekStart: granted.lastWeeklyGrantWeekStart,
      updatedAt: granted.updatedAt,
    });
    return granted;
  });
}

// Looks up the player's GitHub login (from the shared `users` collection) and
// counts merged PRs in the eligibility window for the upcoming rollover.
// This is read-only and used by the dashboard to show:
//  - whether the player has a GitHub account connected at all
//  - how many PRs they've already merged this week (towards next 100 turns)
//  - the UTC instant of the next rollover
export async function getPlayerEligibilityServer(
  userId: string,
  now: Date = new Date()
): Promise<{
  githubLogin: string | null;
  mergedPrCountThisWeek: number;
  nextRolloverIso: string;
  windowStartIso: string;
}> {
  const db = adminDbOrThrow();

  // Read the user doc to get the github login. The game never writes to this
  // collection — read-only.
  const userSnap = await db.collection("users").doc(userId).get();
  const userData = userSnap.exists ? (userSnap.data() ?? {}) : {};
  const githubLogin =
    typeof (userData as { github?: { login?: string } }).github?.login === "string"
      ? ((userData as { github: { login: string } }).github.login as string)
      : null;

  const window = currentEligibilityWindow(now);
  const next = nextRolloverInstant(now);

  let mergedPrCountThisWeek = 0;
  // Range-filter on mergedAt so we only read PRs in the current window —
  // bounded to ≤7 days regardless of player tenure. Index:
  // (userId, state, mergedAt) in firestore.indexes.json.
  try {
    const prsSnap = await db
      .collection("pullRequests")
      .where("userId", "==", userId)
      .where("state", "==", "merged")
      .where("mergedAt", ">=", window.start)
      .where("mergedAt", "<", window.end)
      .get();
    mergedPrCountThisWeek = prsSnap.size;
  } catch (err) {
    logger.warn("getPlayerEligibilityServer: pullRequests query failed", {
      userId,
      err: err instanceof Error ? err.message : String(err),
    });
  }

  return {
    githubLogin,
    mergedPrCountThisWeek,
    nextRolloverIso: next.toISOString(),
    windowStartIso: window.start.toISOString(),
  };
}

// Maximum hex rings to scan when looking for an unclaimed frontier tile.
// At our spacing this is roomy. If still nothing, refund the turn.
const FRONTIER_MAX_RINGS = 12;

// After this many tiles ever claimed via explore (v1 setup + v2 frontier
// combined), the candidate picker switches from "ring-walk outward from the
// owned-centroid" (which tightly globs new claims onto existing territory)
// to a Monte Carlo sampler whose radius grows with each additional explore.
// Pre-threshold keeps the random-then-glob feel of the early game; past it,
// drops scatter further afield until they eventually reach other kingdoms.
const EXPLORE_MONTE_CARLO_THRESHOLD = 150;
// Random samples to try before falling back to a deterministic ring walk.
const MONTE_CARLO_MAX_SAMPLES = 24;

// Look up the owner of each of `coord`'s 6 neighbors and count those owned
// by anyone other than `userId`. One batched getAll.
async function countHostileNeighbors(
  db: Firestore,
  coord: AxialCoord,
  userId: string
): Promise<number> {
  const ns = axialNeighbors(coord.q, coord.r);
  const refs = ns.map((n) =>
    db.collection(COLLECTIONS.TILES).doc(tileIdFromAxial(n.q, n.r))
  );
  const snaps = await db.getAll(...refs);
  let hostileCount = 0;
  for (const ns of snaps) {
    if (!ns.exists) continue;
    const data = ns.data();
    if (data && data.ownerId && data.ownerId !== userId) hostileCount++;
  }
  return hostileCount;
}

async function buildFrontierSample(
  db: Firestore,
  userId: string,
  coord: AxialCoord,
  ownedTileIds: ReadonlyArray<string>
): Promise<FrontierSample> {
  const tileId = tileIdFromAxial(coord.q, coord.r);
  const hostileCount = await countHostileNeighbors(db, coord, userId);
  const distance = distanceToNearestOwned(coord, [...ownedTileIds]);
  const distanceFinite = Number.isFinite(distance) ? distance : 0;
  return {
    tile: coord,
    tileId,
    distanceToCore: distanceFinite,
    hostileNeighbors: hostileCount,
    riskScore: riskScore({
      hostileNeighbors: hostileCount,
      distanceToCore: distanceFinite,
    }),
  };
}

/**
 * Pick an unclaimed tile coord and return a FrontierSample describing it
 * (distance, hostile-neighbor count, risk).
 *
 * Two-phase behavior:
 *   - tilesExplored < EXPLORE_MONTE_CARLO_THRESHOLD: walk hex rings outward
 *     from the owned-centroid (existing behavior). Drops cluster onto the
 *     player's territory, naturally globbing into a contiguous kingdom.
 *   - tilesExplored >= EXPLORE_MONTE_CARLO_THRESHOLD: Monte Carlo sample
 *     within a radius that grows by +1 per explore past the threshold,
 *     anchored on the centroid. Drops scatter outward and eventually reach
 *     other kingdoms. Falls back to a ring walk over the same radius if too
 *     many random picks collide with claimed tiles.
 *
 * The pre-fetch happens outside the transaction; the caller re-validates the
 * pick is still unclaimed inside the transaction.
 */
async function pickFrontierCandidate(
  db: Firestore,
  userId: string,
  ownedTileIds: ReadonlyArray<string>,
  tilesHeld: number,
  tilesExplored: number,
  rng: () => number
): Promise<FrontierSample | null> {
  const center = hexCentroid([...ownedTileIds]);

  if (tilesExplored < EXPLORE_MONTE_CARLO_THRESHOLD) {
    const minRing = Math.max(1, 1 + Math.floor(tilesHeld / 40));
    return await pickByRingWalk(
      db,
      userId,
      ownedTileIds,
      center,
      minRing,
      FRONTIER_MAX_RINGS,
      rng
    );
  }

  const kingdomRadius = kingdomRadiusFromCentroid(center, ownedTileIds);
  const extra = tilesExplored - EXPLORE_MONTE_CARLO_THRESHOLD;
  // +1 keeps us at least one ring outside the current blob even at threshold.
  const maxRadius = kingdomRadius + extra + 1;

  for (let i = 0; i < MONTE_CARLO_MAX_SAMPLES; i++) {
    const r = 1 + Math.floor(rng() * maxRadius);
    const ring = ringCoords(center, r);
    if (ring.length === 0) continue;
    const c = ring[Math.floor(rng() * ring.length)];
    const tileId = tileIdFromAxial(c.q, c.r);
    const snap = await db.collection(COLLECTIONS.TILES).doc(tileId).get();
    if (!snap.exists) {
      return await buildFrontierSample(db, userId, c, ownedTileIds);
    }
  }

  // Fallback: deterministic ring walk over the same radius range. Ensures we
  // return *something* if random samples all happened to hit claimed tiles.
  return await pickByRingWalk(
    db,
    userId,
    ownedTileIds,
    center,
    1,
    maxRadius,
    rng
  );
}

async function pickByRingWalk(
  db: Firestore,
  userId: string,
  ownedTileIds: ReadonlyArray<string>,
  center: AxialCoord,
  minRing: number,
  maxRing: number,
  rng: () => number
): Promise<FrontierSample | null> {
  for (let r = minRing; r <= maxRing; r++) {
    const coords = ringCoords(center, r);
    for (let i = coords.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [coords[i], coords[j]] = [coords[j], coords[i]];
    }
    if (coords.length === 0) continue;

    const refs = coords.map((c) =>
      db.collection(COLLECTIONS.TILES).doc(tileIdFromAxial(c.q, c.r))
    );
    const snaps = await db.getAll(...refs);

    for (let i = 0; i < snaps.length; i++) {
      if (snaps[i].exists) continue;
      return await buildFrontierSample(
        db,
        userId,
        coords[i],
        ownedTileIds
      );
    }
  }
  return null;
}

/**
 * Play-phase generative explore. Spends 1 turn to claim a brand-new tile
 * adjacent to (or near) the player's territory. The further out the player
 * pushes, the more likely the tile spawns next to enemy territory.
 */
export async function frontierExploreServer(
  userId: string,
  now: Date = new Date()
): Promise<{
  player: GamePlayer;
  tile: GameTile;
  report: TurnReport;
  frontier: FrontierSample;
  artifact: GameArtifact | null;
}> {
  const db = adminDbOrThrow();

  // Pre-fetch outside txn: player's owned tiles for centroid + tilesHeld.
  const ownedSnap = await db
    .collection(COLLECTIONS.TILES)
    .where("ownerId", "==", userId)
    .get();
  const ownedTileIds = ownedSnap.docs.map((d) => d.id);

  // Seeded RNG for candidate picking; includes turn count so identical state
  // doesn't always pick the same direction.
  const playerSnapPre = await db
    .collection(COLLECTIONS.PLAYERS)
    .doc(userId)
    .get();
  if (!playerSnapPre.exists) throw new GamePlayerNotFoundError();
  const playerPre = playerSnapPre.data() as GamePlayer;
  const candidateRng = makeSeededRng(
    `frontier:${userId}:${playerPre.turnsSpentTotal}`
  );

  const sample = await pickFrontierCandidate(
    db,
    userId,
    ownedTileIds,
    playerPre.stats.tilesHeld,
    playerPre.tilesExplored,
    candidateRng
  );
  if (sample === null) throw new GameFrontierExhaustedError();

  const tileRef = db.collection(COLLECTIONS.TILES).doc(sample.tileId);
  const playerRef = db.collection(COLLECTIONS.PLAYERS).doc(userId);

  return db.runTransaction(async (tx) => {
    const [tileSnap, playerSnap] = await Promise.all([
      tx.get(tileRef),
      tx.get(playerRef),
    ]);
    if (!playerSnap.exists) throw new GamePlayerNotFoundError();

    const player = playerSnap.data() as GamePlayer;
    if (player.phase !== "play") {
      throw new GameInvalidPhaseError("play", player.phase);
    }
    if (player.turnsRemaining < 1) {
      throw new GameInsufficientTurnsError(1, player.turnsRemaining);
    }
    // Race: the candidate may have been claimed since we picked it.
    if (tileSnap.exists) {
      throw new GameFrontierExhaustedError();
    }

    const turnsSpentTotal = player.turnsSpentTotal + 1;
    const tilesExplored = player.tilesExplored + 1;
    const rolled = rollAndStageArtifact(
      tx,
      db,
      userId,
      turnsSpentTotal,
      "explore",
      now
    );
    const artifact = rolled?.definition ?? null;

    const initialBaseUnits = baseUnitsTarget({
      landType: "unassigned",
      caste: player.caste,
      upgradeIds: [],
      createdAt: now,
      activeUpgrades: player.activeUpgrades ?? {},
      productionSpellsActive: player.productionSpellsActive,
      now,
    });
    const tile: GameTile = {
      tileId: sample.tileId,
      q: sample.tile.q,
      r: sample.tile.r,
      ownerId: userId,
      type: "unassigned",
      level: 0,
      units: { ground: 0, siege: 0, air: 0 },
      baseUnits: initialBaseUnits,
      baseRegenedAt: now,
      intrinsicBuffs: [],
      armedDefenseSpellId: null,
      neighborTileIds: neighborTileIds(sample.tile.q, sample.tile.r),
      upgradeIds: [],
      revealedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    tx.set(tileRef, tile);

    const updatedStats = {
      ...player.stats,
      tilesHeld: player.stats.tilesHeld + 1,
    };
    tx.update(playerRef, {
      turnsRemaining: player.turnsRemaining - 1,
      turnsSpentTotal,
      tilesExplored,
      stats: updatedStats,
      updatedAt: now,
    });

    const report = buildExploreReport(
      turnsSpentTotal,
      tile,
      artifact,
      makeNarrativeRng(userId, turnsSpentTotal, "explore")
    );
    // Append a small line surfacing the frontier risk so the player sees the
    // strategic context inline with the prose.
    const riskLine =
      sample.hostileNeighbors > 0
        ? `Risk ${sample.riskScore}/100 — ${sample.hostileNeighbors} hostile neighbor${sample.hostileNeighbors === 1 ? "" : "s"} (distance from your core: ${sample.distanceToCore} hex${sample.distanceToCore === 1 ? "" : "es"}).`
        : `Risk ${sample.riskScore}/100 — quiet frontier (distance from your core: ${sample.distanceToCore} hex${sample.distanceToCore === 1 ? "" : "es"}).`;
    const reportWithRisk: TurnReport = {
      ...report,
      narrative: [...report.narrative, riskLine],
      outcome: { ...report.outcome, frontier: sample },
    };

    return {
      player: {
        ...player,
        turnsRemaining: player.turnsRemaining - 1,
        turnsSpentTotal,
        tilesExplored,
        stats: updatedStats,
        updatedAt: now,
      },
      tile,
      report: reportWithRisk,
      frontier: sample,
      artifact: rolled?.doc ?? null,
    };
  });
}

// Maximum enemy tiles sampled when picking a Far Expedition target. Higher =
// more variety but more reads; 250 is plenty for current game scale.
const FAR_EXPEDITION_ENEMY_SAMPLE_CAP = 250;
// We try up to this many enemy candidates before giving up. Each candidate has
// 6 potential drop coords, so 8 candidates ≈ 48 unclaimed-checks worst case.
const FAR_EXPEDITION_MAX_TRIES = 8;

/**
 * Far Expedition: spend 2 turns to plant a tile adjacent to a random enemy
 * tile, weighted toward enemies closer to the caster's centroid. The new tile
 * lands with `isolatedSpawn: true` and (because it has no friendly neighbors
 * yet) takes the -15% supply floor until the player builds tiles around it.
 *
 * Always available as a strategic choice — not gated on the normal frontier
 * being exhausted. Throws GameNoEnemyKingdomsError if no enemy tiles exist
 * (e.g. early game with one player).
 */
export async function farExpeditionExploreServer(
  userId: string,
  now: Date = new Date()
): Promise<{
  player: GamePlayer;
  tile: GameTile;
  report: TurnReport;
  artifact: GameArtifact | null;
  targetEnemyTileId: string;
  // Enemy tile this expedition landed beside. Returned so the client can
  // patch its local map cache and the threat-box reflects the new bordering
  // general without a full reload.
  enemyTile: GameTile | null;
}> {
  const db = adminDbOrThrow();

  const playerSnapPre = await db
    .collection(COLLECTIONS.PLAYERS)
    .doc(userId)
    .get();
  if (!playerSnapPre.exists) throw new GamePlayerNotFoundError();
  const playerPre = playerSnapPre.data() as GamePlayer;
  if (playerPre.phase !== "play") {
    throw new GameInvalidPhaseError("play", playerPre.phase);
  }
  if (playerPre.turnsRemaining < FAR_EXPEDITION_TURN_COST) {
    throw new GameInsufficientTurnsError(
      FAR_EXPEDITION_TURN_COST,
      playerPre.turnsRemaining
    );
  }

  const ownedSnap = await db
    .collection(COLLECTIONS.TILES)
    .where("ownerId", "==", userId)
    .get();
  const ownedTileIds = ownedSnap.docs.map((d) => d.id);
  const center = hexCentroid([...ownedTileIds]);

  // Find enemy kingdoms via a player-list query rather than a tile-level
  // inequality scan. `where("ownerId", "!=", userId)` previously failed
  // sporadically depending on Firestore index state; a player query +
  // per-player tile fetch is fully indexed via single-field equality.
  const playersSnap = await db
    .collection(COLLECTIONS.PLAYERS)
    .where("phase", "==", "play")
    .get();
  const enemyPlayerIds: string[] = [];
  const enemyWeights: number[] = [];
  for (const d of playersSnap.docs) {
    const p = d.data() as GamePlayer;
    if (p.userId === userId) continue;
    if (!p.userId) continue;
    if (p.stats.tilesHeld <= 0) continue;
    enemyPlayerIds.push(p.userId);
    // Weight by tilesHeld so populous kingdoms are more likely raid targets.
    enemyWeights.push(p.stats.tilesHeld);
  }
  if (enemyPlayerIds.length === 0) throw new GameNoEnemyKingdomsError();

  const rngEnemyPick = makeSeededRng(
    `far-expedition-enemy-pick:${userId}:${playerPre.turnsSpentTotal}`
  );
  function pickEnemy(): string | null {
    const total = enemyWeights.reduce((s, w) => s + w, 0);
    if (total <= 0) return null;
    let pick = rngEnemyPick() * total;
    for (let i = 0; i < enemyPlayerIds.length; i++) {
      pick -= enemyWeights[i];
      if (pick <= 0) {
        const id = enemyPlayerIds[i];
        // Don't re-pick this enemy on the next call.
        enemyWeights[i] = 0;
        return id;
      }
    }
    return null;
  }

  // Pull tiles from up to a few enemy kingdoms in priority order. Each
  // kingdom contributes up to FAR_EXPEDITION_ENEMY_SAMPLE_CAP / 2 tiles so
  // we always have variety. The weighting + cap together preserve "closer
  // enemies favored, but distant raids possible" without the !=
  // inequality query.
  const enemies: Array<{ q: number; r: number; id: string }> = [];
  const enemyTileById = new Map<string, GameTile>();
  const PER_KINGDOM_TILE_CAP = Math.ceil(FAR_EXPEDITION_ENEMY_SAMPLE_CAP / 2);
  const KINGDOMS_TO_SAMPLE = Math.min(3, enemyPlayerIds.length);
  for (let k = 0; k < KINGDOMS_TO_SAMPLE; k++) {
    const enemyId = pickEnemy();
    if (!enemyId) break;
    const tilesSnap = await db
      .collection(COLLECTIONS.TILES)
      .where("ownerId", "==", enemyId)
      .limit(PER_KINGDOM_TILE_CAP)
      .get();
    for (const doc of tilesSnap.docs) {
      const t = doc.data() as GameTile;
      enemies.push({ q: t.q, r: t.r, id: t.tileId });
      enemyTileById.set(t.tileId, t);
      if (enemies.length >= FAR_EXPEDITION_ENEMY_SAMPLE_CAP) break;
    }
    if (enemies.length >= FAR_EXPEDITION_ENEMY_SAMPLE_CAP) break;
  }
  if (enemies.length === 0) throw new GameNoEnemyKingdomsError();

  const rng = makeSeededRng(
    `far-expedition:${userId}:${playerPre.turnsSpentTotal}`
  );

  // Weight enemies by inverse hex distance from the caster's centroid (closer
  // = more likely, but the long tail still admits distant raids). Build a
  // cumulative weights array for O(log n) sampling, then walk it for retries
  // by zeroing out the picked entry.
  const weights = enemies.map((e) => 1 / (1 + Math.abs(e.q - center.q) + Math.abs(e.r - center.r)));
  let unclaimedCoord: AxialCoord | null = null;
  let pickedEnemyId: string | null = null;

  for (let attempt = 0; attempt < FAR_EXPEDITION_MAX_TRIES; attempt++) {
    const totalWeight = weights.reduce((s, w) => s + w, 0);
    if (totalWeight <= 0) break;
    let pick = rng() * totalWeight;
    let idx = 0;
    for (let i = 0; i < weights.length; i++) {
      pick -= weights[i];
      if (pick <= 0) {
        idx = i;
        break;
      }
    }
    const enemy = enemies[idx];
    weights[idx] = 0; // don't re-pick this enemy
    if (!enemy) break;

    const candidateCoords = axialNeighbors(enemy.q, enemy.r);
    for (let i = candidateCoords.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [candidateCoords[i], candidateCoords[j]] = [
        candidateCoords[j],
        candidateCoords[i],
      ];
    }
    const refs = candidateCoords.map((c) =>
      db.collection(COLLECTIONS.TILES).doc(tileIdFromAxial(c.q, c.r))
    );
    const snaps = await db.getAll(...refs);
    for (let i = 0; i < snaps.length; i++) {
      if (snaps[i].exists) continue;
      unclaimedCoord = candidateCoords[i];
      pickedEnemyId = enemy.id;
      break;
    }
    if (unclaimedCoord) break;
  }

  if (!unclaimedCoord || !pickedEnemyId) {
    throw new GameFrontierExhaustedError();
  }

  const tileId = tileIdFromAxial(unclaimedCoord.q, unclaimedCoord.r);
  const tileRef = db.collection(COLLECTIONS.TILES).doc(tileId);
  const playerRef = db.collection(COLLECTIONS.PLAYERS).doc(userId);
  const targetEnemyTileId = pickedEnemyId;
  const dropCoord = unclaimedCoord;

  return db.runTransaction(async (tx) => {
    const [tileSnap, playerSnap] = await Promise.all([
      tx.get(tileRef),
      tx.get(playerRef),
    ]);
    if (!playerSnap.exists) throw new GamePlayerNotFoundError();

    const player = playerSnap.data() as GamePlayer;
    if (player.phase !== "play") {
      throw new GameInvalidPhaseError("play", player.phase);
    }
    if (player.turnsRemaining < FAR_EXPEDITION_TURN_COST) {
      throw new GameInsufficientTurnsError(
        FAR_EXPEDITION_TURN_COST,
        player.turnsRemaining
      );
    }
    // Race: another player may have claimed this coord since the pre-fetch.
    if (tileSnap.exists) {
      throw new GameFrontierExhaustedError();
    }

    const turnsSpentTotal = player.turnsSpentTotal + FAR_EXPEDITION_TURN_COST;
    const tilesExplored = player.tilesExplored + 1;
    const rolled = rollAndStageArtifact(
      tx,
      db,
      userId,
      turnsSpentTotal,
      "explore",
      now
    );
    const artifact = rolled?.definition ?? null;

    const initialBaseUnits = baseUnitsTarget({
      landType: "unassigned",
      caste: player.caste,
      upgradeIds: [],
      createdAt: now,
      activeUpgrades: player.activeUpgrades ?? {},
      productionSpellsActive: player.productionSpellsActive,
      now,
    });
    const tile: GameTile = {
      tileId,
      q: dropCoord.q,
      r: dropCoord.r,
      ownerId: userId,
      type: "unassigned",
      level: 0,
      units: { ground: 0, siege: 0, air: 0 },
      baseUnits: initialBaseUnits,
      baseRegenedAt: now,
      intrinsicBuffs: [],
      armedDefenseSpellId: null,
      neighborTileIds: neighborTileIds(dropCoord.q, dropCoord.r),
      upgradeIds: [],
      isolatedSpawn: true,
      revealedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    tx.set(tileRef, tile);

    const updatedStats = {
      ...player.stats,
      tilesHeld: player.stats.tilesHeld + 1,
    };
    tx.update(playerRef, {
      turnsRemaining: player.turnsRemaining - FAR_EXPEDITION_TURN_COST,
      turnsSpentTotal,
      tilesExplored,
      stats: updatedStats,
      updatedAt: now,
    });

    const baseReport = buildExploreReport(
      turnsSpentTotal,
      tile,
      artifact,
      makeSeededRng(`far-narr:${userId}:${turnsSpentTotal}`)
    );
    const report: TurnReport = {
      ...baseReport,
      action: "explore",
      cost: FAR_EXPEDITION_TURN_COST,
      summary: `Far Expedition — landed at ${tileId} beside enemy ${targetEnemyTileId}`,
      narrative: [
        ...baseReport.narrative,
        `Forward base planted next to enemy tile ${targetEnemyTileId}. The tile is isolated — supply runs at the −15% floor until friendly neighbors arrive.`,
      ],
      outcome: {
        ...baseReport.outcome,
        farExpedition: true,
        targetEnemyTileId,
        isolated: true,
      },
    };

    return {
      player: {
        ...player,
        turnsRemaining: player.turnsRemaining - FAR_EXPEDITION_TURN_COST,
        turnsSpentTotal,
        tilesExplored,
        stats: updatedStats,
        updatedAt: now,
      },
      tile,
      report,
      artifact: rolled?.doc ?? null,
      targetEnemyTileId,
      enemyTile: enemyTileById.get(targetEnemyTileId) ?? null,
    };
  });
}

// Walk hex rings outward from `center`, batched-getAll each ring, accumulate
// unclaimed coords. Stops when we hit `target` unclaimed coords or `maxRing`.
async function collectUnclaimedByRingWalk(
  db: Firestore,
  center: AxialCoord,
  minRing: number,
  maxRing: number,
  target: number,
  rng: () => number
): Promise<AxialCoord[]> {
  const out: AxialCoord[] = [];
  for (let r = minRing; r <= maxRing && out.length < target; r++) {
    const coords = ringCoords(center, r);
    for (let i = coords.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [coords[i], coords[j]] = [coords[j], coords[i]];
    }
    if (coords.length === 0) continue;
    const refs = coords.map((c) =>
      db.collection(COLLECTIONS.TILES).doc(tileIdFromAxial(c.q, c.r))
    );
    const snaps = await db.getAll(...refs);
    for (let i = 0; i < snaps.length; i++) {
      if (!snaps[i].exists) out.push(coords[i]);
      if (out.length >= target) break;
    }
  }
  return out;
}

// Random sample distinct (ring, slot) coords within `maxRadius` of `center`,
// batch-getAll each batch, accumulate unclaimed coords. Stops at `target`
// unclaimed coords or `maxSamples` random tries (whichever first).
async function collectUnclaimedByMonteCarlo(
  db: Firestore,
  center: AxialCoord,
  maxRadius: number,
  target: number,
  maxSamples: number,
  rng: () => number
): Promise<AxialCoord[]> {
  if (maxRadius <= 0) return [];
  const out: AxialCoord[] = [];
  const seen = new Set<string>();
  // Sample in small batches so we can stop early without over-fetching.
  const BATCH_SIZE = 8;
  let samplesUsed = 0;
  while (out.length < target && samplesUsed < maxSamples) {
    const batch: AxialCoord[] = [];
    while (batch.length < BATCH_SIZE && samplesUsed < maxSamples) {
      samplesUsed++;
      const r = 1 + Math.floor(rng() * maxRadius);
      const ring = ringCoords(center, r);
      if (ring.length === 0) continue;
      const c = ring[Math.floor(rng() * ring.length)];
      const id = tileIdFromAxial(c.q, c.r);
      if (seen.has(id)) continue;
      seen.add(id);
      batch.push(c);
    }
    if (batch.length === 0) break;
    const refs = batch.map((c) =>
      db.collection(COLLECTIONS.TILES).doc(tileIdFromAxial(c.q, c.r))
    );
    const snaps = await db.getAll(...refs);
    for (let i = 0; i < snaps.length; i++) {
      if (!snaps[i].exists) out.push(batch[i]);
      if (out.length >= target) break;
    }
  }
  return out;
}

// Pre-fetches up to `count` unclaimed frontier coords + their hostile-neighbor
// counts via batched getAlls, then claims all of them in ONE transaction.
// Each step inside the txn rolls its own artifact (seeded by per-step turn
// index) and emits a TurnReport.
//
// Algorithm:
//   1. Outside txn: collect unclaimed coords. Pre-threshold uses a centroid
//      ring walk (existing behavior); post-threshold uses Monte Carlo within
//      a radius that grows with `tilesExplored`, falling back to a ring walk
//      over the same radius if the random tries don't fill the batch.
//   2. Outside txn: one batched getAll for the unique union of all picked
//      coords' neighbors, to compute hostile-neighbor counts (presentation).
//   3. Inside txn: re-read the picked candidates; for each that's still
//      unclaimed, run a step (turn debit, artifact roll, tile create, report).
//      Skip + record stoppedEarly if too many were claimed by another player.
//   4. One tx.update on the player at the end with accumulated turn debit.
//
// Caps batch at 50 to stay well under the 500-ops-per-txn limit and keep the
// pre-fetch tractable in dense worlds.
async function pickFrontierCandidatesBulk(
  db: Firestore,
  userId: string,
  ownedTileIds: ReadonlyArray<string>,
  tilesHeld: number,
  tilesExplored: number,
  count: number,
  rng: () => number
): Promise<FrontierSample[]> {
  const center = hexCentroid([...ownedTileIds]);
  const overscan = Math.max(5, Math.ceil(count * 1.5));
  const useMonteCarlo = tilesExplored >= EXPLORE_MONTE_CARLO_THRESHOLD;

  let unclaimed: AxialCoord[] = [];

  if (!useMonteCarlo) {
    const minRing = Math.max(1, 1 + Math.floor(tilesHeld / 40));
    unclaimed = await collectUnclaimedByRingWalk(
      db,
      center,
      minRing,
      FRONTIER_MAX_RINGS,
      overscan,
      rng
    );
  } else {
    const kingdomRadius = kingdomRadiusFromCentroid(center, ownedTileIds);
    const extra = tilesExplored - EXPLORE_MONTE_CARLO_THRESHOLD;
    const maxRadius = kingdomRadius + extra + 1;
    unclaimed = await collectUnclaimedByMonteCarlo(
      db,
      center,
      maxRadius,
      overscan,
      // Sample budget: enough to fill the batch with comfortable misses.
      Math.max(MONTE_CARLO_MAX_SAMPLES, overscan * 4),
      rng
    );
    if (unclaimed.length < count) {
      // Fill any remaining slots from a deterministic ring walk over the
      // same radius range so a sparse-RNG run still returns a usable batch.
      const fallback = await collectUnclaimedByRingWalk(
        db,
        center,
        1,
        maxRadius,
        overscan - unclaimed.length,
        rng
      );
      const seen = new Set(
        unclaimed.map((c) => tileIdFromAxial(c.q, c.r))
      );
      for (const c of fallback) {
        const id = tileIdFromAxial(c.q, c.r);
        if (!seen.has(id)) {
          unclaimed.push(c);
          seen.add(id);
        }
      }
    }
  }

  if (unclaimed.length === 0) return [];
  const picked = unclaimed.slice(0, count);
  const pickedTileIdSet = new Set(
    picked.map((c) => tileIdFromAxial(c.q, c.r))
  );

  // Collect the union of all neighbor tileIds (deduped, excluding picked
  // candidates themselves so we don't waste a read on a coord we already
  // know is unclaimed). One batched getAll.
  const neighborIds = new Set<string>();
  for (const c of picked) {
    for (const n of axialNeighbors(c.q, c.r)) {
      const id = tileIdFromAxial(n.q, n.r);
      if (!pickedTileIdSet.has(id)) neighborIds.add(id);
    }
  }
  const neighborOwnerById = new Map<string, string>();
  if (neighborIds.size > 0) {
    const neighborRefs = Array.from(neighborIds).map((id) =>
      db.collection(COLLECTIONS.TILES).doc(id)
    );
    const neighborSnaps = await db.getAll(...neighborRefs);
    for (const ns of neighborSnaps) {
      if (!ns.exists) continue;
      const data = ns.data();
      if (data && typeof data.ownerId === "string") {
        neighborOwnerById.set(ns.id, data.ownerId as string);
      }
    }
  }

  return picked.map((c) => {
    const tileId = tileIdFromAxial(c.q, c.r);
    let hostileCount = 0;
    for (const n of axialNeighbors(c.q, c.r)) {
      const owner = neighborOwnerById.get(tileIdFromAxial(n.q, n.r));
      if (owner && owner !== userId) hostileCount++;
    }
    const distance = distanceToNearestOwned(c, [...ownedTileIds]);
    const distanceFinite = Number.isFinite(distance) ? distance : 0;
    return {
      tile: c,
      tileId,
      distanceToCore: distanceFinite,
      hostileNeighbors: hostileCount,
      riskScore: riskScore({
        hostileNeighbors: hostileCount,
        distanceToCore: distanceFinite,
      }),
    };
  });
}

export async function bulkFrontierExploreServer(
  userId: string,
  count: number,
  now: Date = new Date()
): Promise<{
  player: GamePlayer;
  tiles: GameTile[];
  reports: TurnReport[];
  frontiers: FrontierSample[];
  artifacts: GameArtifact[];
  stoppedEarly?: string;
}> {
  if (count <= 0) {
    throw new Error("bulkFrontierExploreServer: count must be > 0");
  }
  if (count > 50) {
    throw new Error(
      `bulkFrontierExploreServer: at most 50 tiles per call (got ${count})`
    );
  }
  const db = adminDbOrThrow();

  // Outside-txn reads: player doc + owned tiles for centroid.
  const ownedSnap = await db
    .collection(COLLECTIONS.TILES)
    .where("ownerId", "==", userId)
    .get();
  const ownedTileIds = ownedSnap.docs.map((d) => d.id);

  const playerSnapPre = await db
    .collection(COLLECTIONS.PLAYERS)
    .doc(userId)
    .get();
  if (!playerSnapPre.exists) throw new GamePlayerNotFoundError();
  const playerPre = playerSnapPre.data() as GamePlayer;

  const candidateRng = makeSeededRng(
    `frontier-bulk:${userId}:${playerPre.turnsSpentTotal}`
  );

  const samples = await pickFrontierCandidatesBulk(
    db,
    userId,
    ownedTileIds,
    playerPre.stats.tilesHeld,
    playerPre.tilesExplored,
    count,
    candidateRng
  );
  if (samples.length === 0) throw new GameFrontierExhaustedError();

  const playerRef = db.collection(COLLECTIONS.PLAYERS).doc(userId);
  const candidateRefs = samples.map((s) =>
    db.collection(COLLECTIONS.TILES).doc(s.tileId)
  );

  return db.runTransaction(async (tx) => {
    const snaps = await tx.getAll(playerRef, ...candidateRefs);
    const playerSnap = snaps[0];
    const candidateSnaps = snaps.slice(1);
    if (!playerSnap.exists) throw new GamePlayerNotFoundError();
    const player = playerSnap.data() as GamePlayer;
    if (player.phase !== "play") {
      throw new GameInvalidPhaseError("play", player.phase);
    }

    let turnsRemaining = player.turnsRemaining;
    let turnsSpentTotal = player.turnsSpentTotal;
    let tilesExplored = player.tilesExplored;
    let tilesHeld = player.stats.tilesHeld;
    const reports: TurnReport[] = [];
    const tilesCreated: GameTile[] = [];
    const frontiers: FrontierSample[] = [];
    const artifacts: GameArtifact[] = [];
    let stoppedEarly: string | undefined;

    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i];
      const candidateSnap = candidateSnaps[i];
      const isFirst = reports.length === 0;

      // Race: another player might have claimed this coord between our
      // pre-fetch and this txn. Skip and continue; surface a partial result
      // if the entire batch races.
      if (candidateSnap.exists) {
        if (isFirst) {
          // Don't throw — we may still have other candidates to claim.
          continue;
        }
        continue;
      }
      if (turnsRemaining < 1) {
        if (isFirst) {
          throw new GameInsufficientTurnsError(1, turnsRemaining);
        }
        stoppedEarly = `out of turns at step ${reports.length}`;
        break;
      }

      turnsRemaining -= 1;
      turnsSpentTotal += 1;
      tilesExplored += 1;
      tilesHeld += 1;

      const rolled = rollAndStageArtifact(
        tx,
        db,
        userId,
        turnsSpentTotal,
        "explore",
        now
      );
      const artifact = rolled?.definition ?? null;
      if (rolled) artifacts.push(rolled.doc);

      const initialBaseUnits = baseUnitsTarget({
        landType: "unassigned",
        caste: player.caste,
        upgradeIds: [],
        createdAt: now,
        activeUpgrades: player.activeUpgrades ?? {},
        productionSpellsActive: player.productionSpellsActive,
        now,
      });
      const tile: GameTile = {
        tileId: sample.tileId,
        q: sample.tile.q,
        r: sample.tile.r,
        ownerId: userId,
        type: "unassigned",
        level: 0,
        units: { ground: 0, siege: 0, air: 0 },
        baseUnits: initialBaseUnits,
        baseRegenedAt: now,
        intrinsicBuffs: [],
        armedDefenseSpellId: null,
        neighborTileIds: neighborTileIds(sample.tile.q, sample.tile.r),
        upgradeIds: [],
        revealedAt: now,
        createdAt: now,
        updatedAt: now,
      };
      tx.set(candidateRefs[i], tile);
      tilesCreated.push(tile);
      frontiers.push(sample);

      const baseReport = buildExploreReport(
        turnsSpentTotal,
        tile,
        artifact,
        makeNarrativeRng(userId, turnsSpentTotal, "explore")
      );
      const riskLine =
        sample.hostileNeighbors > 0
          ? `Risk ${sample.riskScore}/100 — ${sample.hostileNeighbors} hostile neighbor${sample.hostileNeighbors === 1 ? "" : "s"} (distance from your core: ${sample.distanceToCore} hex${sample.distanceToCore === 1 ? "" : "es"}).`
          : `Risk ${sample.riskScore}/100 — quiet frontier (distance from your core: ${sample.distanceToCore} hex${sample.distanceToCore === 1 ? "" : "es"}).`;
      reports.push({
        ...baseReport,
        narrative: [...baseReport.narrative, riskLine],
        outcome: { ...baseReport.outcome, frontier: sample },
      });
    }

    if (reports.length === 0) {
      // All candidates were claimed by other players between pre-fetch and
      // txn. Surface a clean error rather than a silent partial-of-zero.
      throw new GameFrontierExhaustedError();
    }

    const claimedFromBatch = candidateSnaps.filter((s) => s.exists).length;
    if (claimedFromBatch > 0 && !stoppedEarly) {
      stoppedEarly = `${claimedFromBatch} candidate${claimedFromBatch === 1 ? "" : "s"} claimed by other players`;
    }

    tx.update(playerRef, {
      turnsRemaining,
      turnsSpentTotal,
      tilesExplored,
      stats: { ...player.stats, tilesHeld },
      updatedAt: now,
    });

    return {
      player: {
        ...player,
        turnsRemaining,
        turnsSpentTotal,
        tilesExplored,
        stats: { ...player.stats, tilesHeld },
        updatedAt: now,
      },
      tiles: tilesCreated,
      reports,
      frontiers,
      artifacts,
      stoppedEarly,
    };
  });
}

/**
 * Spend an unused artifact. v2 PR 6c: the artifact is marked used and a
 * report is returned. Actual gameplay effects (attack/defense bonuses,
 * production-cap boosts) are deferred to PR 6d — this slice exists so
 * players can see their inventory drain and the "Use" button does
 * something coherent. Cost is 0 turns; the artifact itself is the cost.
 */
export async function spendArtifactServer(args: {
  userId: string;
  artifactId: string;
  targetTileId?: string | null;
  now?: Date;
}): Promise<{ artifact: GameArtifact; intelReport?: IntelReport }> {
  const now = args.now ?? new Date();
  const db = adminDbOrThrow();
  const artifactRef = db.collection(COLLECTIONS.ARTIFACTS).doc(args.artifactId);

  // First mark the artifact used in a transaction so the inventory state is
  // consistent. Intel artifacts then run a follow-up read pass to build the
  // report; the report doesn't need transactional consistency with the
  // artifact-used flag (it's a snapshot of public state at "now").
  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(artifactRef);
    if (!snap.exists) throw new GameArtifactNotFoundError();
    const artifact = snap.data() as GameArtifact;
    if (artifact.ownerId !== args.userId) {
      throw new GameArtifactNotFoundError();
    }
    if (artifact.used) throw new GameArtifactAlreadyUsedError();

    const def = ARTIFACTS_BY_ID.get(artifact.definitionId) ?? null;
    if (def?.type === "intel" && !args.targetTileId) {
      throw new GameInvalidSpellError(
        "Intel artifacts must be spent on a target tile"
      );
    }

    const updated: GameArtifact = {
      ...artifact,
      used: true,
      usedAtTurn: artifact.foundAtTurn,
      usedOnTileId: args.targetTileId ?? undefined,
      updatedAt: now,
    };
    tx.update(artifactRef, {
      used: true,
      usedAtTurn: artifact.foundAtTurn,
      ...(args.targetTileId ? { usedOnTileId: args.targetTileId } : {}),
      updatedAt: now,
    });
    return { artifact: updated, definition: def };
  });

  if (result.definition?.type !== "intel" || !args.targetTileId) {
    return { artifact: result.artifact };
  }

  // Read player to source capturedAtTurn from turnsSpentTotal.
  const playerSnap = await db
    .collection(COLLECTIONS.PLAYERS)
    .doc(args.userId)
    .get();
  const player = playerSnap.exists ? (playerSnap.data() as GamePlayer) : null;
  const capturedAtTurn = player?.turnsSpentTotal ?? 0;

  const intelReport = await buildIntelReportServer({
    db,
    targetTileId: args.targetTileId,
    scope: result.definition.intelDepth ?? "tile",
    source: "artifact",
    sourceId: result.definition.id,
    capturedAtTurn,
  });
  return { artifact: result.artifact, intelReport };
}

// ──── v2: Unit & building upgrades ────

export async function applyUpgradeServer(args: {
  userId: string;
  targetId: string;
  upgradeId: string;
  now?: Date;
}): Promise<{ player: GamePlayer }> {
  const now = args.now ?? new Date();
  const db = adminDbOrThrow();
  const playerRef = db.collection(COLLECTIONS.PLAYERS).doc(args.userId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(playerRef);
    if (!snap.exists) throw new GamePlayerNotFoundError();
    const player = snap.data() as GamePlayer;

    if (player.phase !== "play") {
      throw new GameInvalidPhaseError("play", player.phase);
    }
    // Throws on any validation failure (caste mismatch, target unknown,
    // already-active conflict).
    validateApplyUpgrade({
      player,
      targetId: args.targetId,
      upgradeId: args.upgradeId,
    });
    if (player.turnsRemaining < UPGRADE_TURN_COST) {
      throw new GameInsufficientTurnsError(
        UPGRADE_TURN_COST,
        player.turnsRemaining
      );
    }

    const turnsSpentTotal = player.turnsSpentTotal + UPGRADE_TURN_COST;
    const active = { ...getActiveUpgrades(player), [args.targetId]: args.upgradeId };

    tx.update(playerRef, {
      activeUpgrades: active,
      turnsRemaining: player.turnsRemaining - UPGRADE_TURN_COST,
      turnsSpentTotal,
      updatedAt: now,
    });

    return {
      player: {
        ...player,
        activeUpgrades: active,
        turnsRemaining: player.turnsRemaining - UPGRADE_TURN_COST,
        turnsSpentTotal,
        updatedAt: now,
      },
    };
  });
}

export async function removeUpgradeServer(args: {
  userId: string;
  targetId: string;
  now?: Date;
}): Promise<{ player: GamePlayer }> {
  const now = args.now ?? new Date();
  const db = adminDbOrThrow();
  const playerRef = db.collection(COLLECTIONS.PLAYERS).doc(args.userId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(playerRef);
    if (!snap.exists) throw new GamePlayerNotFoundError();
    const player = snap.data() as GamePlayer;

    if (player.phase !== "play") {
      throw new GameInvalidPhaseError("play", player.phase);
    }
    validateRemoveUpgrade({ player, targetId: args.targetId });
    if (player.turnsRemaining < UPGRADE_TURN_COST) {
      throw new GameInsufficientTurnsError(
        UPGRADE_TURN_COST,
        player.turnsRemaining
      );
    }

    const turnsSpentTotal = player.turnsSpentTotal + UPGRADE_TURN_COST;
    const active = { ...getActiveUpgrades(player) };
    delete active[args.targetId];

    tx.update(playerRef, {
      activeUpgrades: active,
      turnsRemaining: player.turnsRemaining - UPGRADE_TURN_COST,
      turnsSpentTotal,
      updatedAt: now,
    });

    return {
      player: {
        ...player,
        activeUpgrades: active,
        turnsRemaining: player.turnsRemaining - UPGRADE_TURN_COST,
        turnsSpentTotal,
        updatedAt: now,
      },
    };
  });
}

// =====================================================================
// End-game / Armageddon
// =====================================================================

/**
 * Casts the universal end-game Armageddon spell. Costs ARMAGEDDON_TURN_COST
 * turns regardless of outcome (the spell is a deliberate gamble). On a
 * successful roll, breaks one of the 7 global Seals; when the 7th breaks,
 * the worldMeta state flips to "resolving" and the caller should fire the
 * resolveArmageddon orchestrator outside this transaction.
 *
 * Concurrency: two casts racing on seal #7 serialize on the worldMeta
 * singleton — Firestore aborts and retries the loser, which then re-reads
 * sealsBroken === SEAL_COUNT and short-circuits with GameSealsExhaustedError.
 * The losing player's turns were already deducted by their own retry; this
 * is by design — the spell is high-risk by construction.
 */
export async function castArmageddonServer(args: {
  userId: string;
  now?: Date;
}): Promise<{
  success: boolean;
  successChance: number;
  sealsBroken: number;       // after this cast
  seasonNumber: number;
  player: GamePlayer;
  shouldTriggerResolve: boolean;
}> {
  const now = args.now ?? new Date();
  const db = adminDbOrThrow();
  const playerRef = db.collection(COLLECTIONS.PLAYERS).doc(args.userId);

  // Pre-tx land-count read (mirrors castSpellServer). Magic-land count is
  // the primary input to the success formula; a few ms of staleness is fine.
  // Pull heroes from the same query so magic-hero virtual lands fold in.
  const armaSummary = await getOwnedTileSummary(args.userId);
  const landCounts = armaSummary.counts;

  return db.runTransaction(async (tx) => {
    const [playerSnap, worldMetaResult] = await Promise.all([
      tx.get(playerRef),
      readWorldMetaInTx(tx, db),
    ]);
    if (!playerSnap.exists) throw new GamePlayerNotFoundError();
    const player = playerSnap.data() as GamePlayer;
    const worldMeta = worldMetaResult.meta;

    assertGameActiveInTx(player, worldMeta);

    if (player.phase !== "play") {
      throw new GameInvalidPhaseError("play", player.phase);
    }
    if (player.caste === null) {
      throw new GameInvalidPhaseError("play (caste required)", player.phase);
    }
    if (player.stats.tilesHeld < ARMAGEDDON_TILE_GATE) {
      throw new GameInvalidSpellError(
        `Armageddon requires ${ARMAGEDDON_TILE_GATE} tiles held; you have ${player.stats.tilesHeld}`
      );
    }
    if (player.turnsRemaining < ARMAGEDDON_TURN_COST) {
      throw new GameInsufficientTurnsError(
        ARMAGEDDON_TURN_COST,
        player.turnsRemaining
      );
    }
    const sealsBrokenBefore = worldMeta.sealsBroken ?? 0;
    if (sealsBrokenBefore >= SEAL_COUNT) {
      throw new GameSealsExhaustedError();
    }

    // Success roll. Seed includes a fresh cast id so replays are independent
    // and no two casts share a deterministic outcome.
    const castId = randomUUID();
    const rng = makeSeededRng(`armageddon-${castId}`);
    // Magic-hero contribution (May 2026 Heroes feature): each magic hero
    // counts as MAGIC_HERO_VIRTUAL_LANDS magic lands (stamina-scaled; the
    // "armageddon" specialty doubles). Fed straight into magicMultiplier
    // alongside real magic-land count. Reuses the existing soft-cap curve.
    const virtualMagicLands = countMagicHeroVirtualLands(
      armaSummary.heroes,
      player.turnsSpentTotal
    );
    const mm = magicMultiplier(
      landCounts.magic + virtualMagicLands,
      player.activeUpgrades ?? {}
    );
    const successChance = computeArmageddonSuccessChanceFromMultiplier(mm);
    const success = rng() < successChance;

    // Turns + cast counter deduct regardless of success (high-risk gamble).
    const turnsSpentTotal = player.turnsSpentTotal + ARMAGEDDON_TURN_COST;
    const armageddonCastsAttempted =
      (player.armageddonCastsAttempted ?? 0) + 1;
    let armageddonSealsBroken = player.armageddonSealsBroken ?? 0;

    const seasonNumber = worldMeta.seasonNumber ?? 1;
    let sealsBrokenAfter = sealsBrokenBefore;
    let shouldTriggerResolve = false;

    if (success) {
      const sealIndex = sealsBrokenBefore;
      // Build the canonical 7-slot seals array, defaulting any missing
      // entries to unbroken. The Armageddon flow always writes back a full
      // length-7 array so readers don't need null-checks.
      const seals: SealRecord[] = Array.from({ length: SEAL_COUNT }, (_, i) => {
        const existing = worldMeta.seals?.[i];
        if (existing) return existing;
        return { index: i, broken: false };
      });
      seals[sealIndex] = {
        index: sealIndex,
        broken: true,
        brokenBy: {
          userId: player.userId,
          displayName: player.displayName,
          caste: player.caste,
        },
        brokenAt: now,
      };
      sealsBrokenAfter = sealsBrokenBefore + 1;
      armageddonSealsBroken += 1;

      const metaPatch: Partial<GameWorldMeta> = {
        sealsBroken: sealsBrokenAfter,
        seals,
        seasonNumber, // re-stamp for backfill on legacy docs
        updatedAt: now,
      };
      if (sealsBrokenAfter >= SEAL_COUNT) {
        metaPatch.armageddonState = "resolving";
        metaPatch.armageddonStartedAt = now;
        shouldTriggerResolve = true;
      }
      tx.set(worldMetaResult.ref, metaPatch, { merge: true });

      logCommunityEventInTx(
        tx,
        db,
        {
          kind: "seal_broken",
          actorUserId: player.userId,
          actorDisplayName: player.displayName,
          actorCaste: player.caste,
          sealIndex,
          seasonNumber,
        },
        now
      );

      // Phase 7: resolve any prophecies targeting this seal — stamp
      // them fulfilled, increment authors' prophecyFulfilledCount, and
      // post `prophecy_fulfilled` feed events.
      if (player.caste) {
        await resolveProphesiesForSealInTx({
          tx,
          db,
          // Prophecies are filed against 1-indexed seal numbers; the
          // internal sealIndex is 0-indexed.
          brokenSealNumber: sealIndex + 1,
          brokenBy: {
            userId: player.userId,
            displayName: player.displayName,
            caste: player.caste,
          },
          now,
        });
      }
      if (shouldTriggerResolve) {
        logCommunityEventInTx(
          tx,
          db,
          {
            kind: "armageddon_started",
            actorUserId: player.userId,
            actorDisplayName: player.displayName,
            actorCaste: player.caste,
            seasonNumber,
          },
          now
        );
      }
    }
    // (Failure-event logging is skipped to keep the community feed signal-
    // to-noise high; a failed cast is a private experience for the caster.)

    tx.update(playerRef, {
      turnsRemaining: player.turnsRemaining - ARMAGEDDON_TURN_COST,
      turnsSpentTotal,
      armageddonCastsAttempted,
      armageddonSealsBroken,
      seasonNumber, // backfill in case the doc predated the field
      updatedAt: now,
    });

    const updatedPlayer: GamePlayer = {
      ...player,
      turnsRemaining: player.turnsRemaining - ARMAGEDDON_TURN_COST,
      turnsSpentTotal,
      armageddonCastsAttempted,
      armageddonSealsBroken,
      seasonNumber,
      updatedAt: now,
    };

    return {
      success,
      successChance,
      sealsBroken: sealsBrokenAfter,
      seasonNumber,
      player: updatedPlayer,
      shouldTriggerResolve,
    };
  });
}

/** Lists the most-recent N past Armageddons (hall-of-fame). Doc ID is the
 *  season number, so ordering by ID descending is the canonical order.
 *  No composite index required. */
export async function listArmageddonHistoryServer(
  limit: number = 50
): Promise<ArmageddonEventRecord[]> {
  const db = adminDbOrThrow();
  const snap = await db
    .collection(COLLECTIONS.ARMAGEDDON_EVENTS)
    .orderBy("seasonNumber", "desc")
    .limit(Math.max(1, Math.min(200, limit)))
    .get();
  return snap.docs.map((d) => d.data() as ArmageddonEventRecord);
}

// =====================================================================
// Zero-turn gameplay: new server actions
// =====================================================================
//
// These functions are the entrypoints for the May 2026 zero-turn
// gameplay features. Each enforces its own gating (rate limits, caps,
// cooldowns, 0-turn predicates) so the actions complement rather than
// replace the turn economy.

/**
 * Grants PEP_TALK_STAMINA_GAIN stamina to one of the caller's heroes.
 *
 * Gating:
 *   - Caller must currently have turnsRemaining === 0 (consolation
 *     mechanic; doesn't trivialize stamina for active players).
 *   - Per-day rate limit is enforced at the API route layer (3/day).
 *
 * The target hero is identified by its `tileId` — pep talks always go
 * to "the hero on this tile." This avoids needing a separate heroId
 * lookup index when the hero registry has the canonical id but the
 * tile snapshot is what combat reads.
 */
export async function pepTalkHeroServer(args: {
  callerUserId: string;
  tileId: string;
  now?: Date;
}): Promise<GameTile> {
  const now = args.now ?? new Date();
  const db = adminDbOrThrow();
  const playerRef = db.collection(COLLECTIONS.PLAYERS).doc(args.callerUserId);
  const tileRef = db.collection(COLLECTIONS.TILES).doc(args.tileId);
  return db.runTransaction(async (tx) => {
    const [playerSnap, tileSnap] = await Promise.all([
      tx.get(playerRef),
      tx.get(tileRef),
    ]);
    if (!playerSnap.exists) throw new GamePlayerNotFoundError();
    if (!tileSnap.exists) throw new GameTileNotFoundError();
    const player = playerSnap.data() as GamePlayer;
    const tile = tileSnap.data() as GameTile;
    if (player.turnsRemaining > 0) {
      throw new GamePepTalkRequiresZeroTurnsError();
    }
    if (tile.ownerId !== args.callerUserId) throw new GameTileNotOwnedError();
    if (!tile.hero) throw new GameHeroNotFoundError();
    if (tile.hero.ownerId !== args.callerUserId) {
      throw new GameHeroNotOwnedError();
    }
    const updatedHero: GameHero = {
      ...tile.hero,
      stamina: Math.min(
        tile.hero.staminaMax,
        tile.hero.stamina + PEP_TALK_STAMINA_GAIN
      ),
      lastEngagedAtTurn: player.turnsSpentTotal,
    };
    tx.update(tileRef, { hero: updatedHero, updatedAt: now });
    // Mirror the stamina onto the persistent registry doc so the All
    // Heroes browse view stays accurate.
    tx.update(
      db.collection("game_heroes").doc(updatedHero.id),
      { stamina: updatedHero.stamina, updatedAt: now }
    );
    return { ...tile, hero: updatedHero, updatedAt: now };
  });
}

/**
 * Puts one of the caller's heroes into meditation for
 * MEDITATION_DURATION_MS. Stamina is set to staminaMax immediately and
 * the hero is marked off-duty — combat and engagement skip them until
 * the timer expires.
 *
 * Gating:
 *   - The hero must be owned by the caller and on a tile.
 *   - The hero must not already be meditating.
 *   - The caller can have at most MEDITATION_MAX_ACTIVE_SLOTS heroes
 *     meditating at once (default 1).
 */
export async function meditateHeroServer(args: {
  callerUserId: string;
  tileId: string;
  now?: Date;
}): Promise<GameTile> {
  const now = args.now ?? new Date();
  const db = adminDbOrThrow();
  const playerRef = db.collection(COLLECTIONS.PLAYERS).doc(args.callerUserId);
  const tileRef = db.collection(COLLECTIONS.TILES).doc(args.tileId);
  // Count the player's currently-meditating heroes via a non-tx query
  // (Firestore can't `where` inside a tx). Slight race: a second concurrent
  // call could double-spend the slot. Acceptable for the cap of 1 — worst
  // case the player ends up with 2 meditating, the cap reasserts after.
  const ownedSnap = await db
    .collection(COLLECTIONS.TILES)
    .where("ownerId", "==", args.callerUserId)
    .get();
  let meditating = 0;
  for (const doc of ownedSnap.docs) {
    const t = doc.data() as GameTile;
    if (t.hero && t.hero.meditatingUntil) {
      const until =
        t.hero.meditatingUntil instanceof Date
          ? t.hero.meditatingUntil
          : (t.hero.meditatingUntil as { toDate: () => Date }).toDate?.() ??
            null;
      if (until && until.getTime() > now.getTime()) meditating += 1;
    }
  }
  if (meditating >= MEDITATION_MAX_ACTIVE_SLOTS) {
    throw new GameMeditationSlotFullError();
  }
  return db.runTransaction(async (tx) => {
    const [playerSnap, tileSnap] = await Promise.all([
      tx.get(playerRef),
      tx.get(tileRef),
    ]);
    if (!playerSnap.exists) throw new GamePlayerNotFoundError();
    if (!tileSnap.exists) throw new GameTileNotFoundError();
    const tile = tileSnap.data() as GameTile;
    if (tile.ownerId !== args.callerUserId) throw new GameTileNotOwnedError();
    if (!tile.hero) throw new GameHeroNotFoundError();
    if (tile.hero.ownerId !== args.callerUserId) {
      throw new GameHeroNotOwnedError();
    }
    if (tile.hero.meditatingUntil) {
      const until =
        tile.hero.meditatingUntil instanceof Date
          ? tile.hero.meditatingUntil
          : null;
      if (until && until.getTime() > now.getTime()) {
        throw new GameHeroAlreadyMeditatingError();
      }
    }
    const meditatingUntil = new Date(now.getTime() + MEDITATION_DURATION_MS);
    const updatedHero: GameHero = {
      ...tile.hero,
      stamina: tile.hero.staminaMax,
      meditatingUntil,
      lastEngagedAtTurn: (playerSnap.data() as GamePlayer).turnsSpentTotal,
    };
    tx.update(tileRef, { hero: updatedHero, updatedAt: now });
    tx.update(
      db.collection("game_heroes").doc(updatedHero.id),
      {
        stamina: updatedHero.stamina,
        meditatingUntil,
        updatedAt: now,
      }
    );
    return { ...tile, hero: updatedHero, updatedAt: now };
  });
}

/**
 * Moves units between two adjacent tiles the caller owns. Applies the
 * REDISTRIBUTE_TRANSIT_LOSS haircut to the moved stack. Capped at
 * REDISTRIBUTE_MAX_PER_DAY per player per rolling 24h window.
 */
export async function redistributeUnitsServer(args: {
  callerUserId: string;
  sourceTileId: string;
  destTileId: string;
  units: UnitStack;
  now?: Date;
}): Promise<{ source: GameTile; dest: GameTile }> {
  const now = args.now ?? new Date();
  const db = adminDbOrThrow();
  const playerRef = db.collection(COLLECTIONS.PLAYERS).doc(args.callerUserId);
  const sourceRef = db.collection(COLLECTIONS.TILES).doc(args.sourceTileId);
  const destRef = db.collection(COLLECTIONS.TILES).doc(args.destTileId);
  return db.runTransaction(async (tx) => {
    const [playerSnap, sourceSnap, destSnap] = await Promise.all([
      tx.get(playerRef),
      tx.get(sourceRef),
      tx.get(destRef),
    ]);
    if (!playerSnap.exists) throw new GamePlayerNotFoundError();
    if (!sourceSnap.exists) throw new GameTileNotFoundError();
    if (!destSnap.exists) throw new GameTileNotFoundError();
    const player = playerSnap.data() as GamePlayer;
    const source = sourceSnap.data() as GameTile;
    const dest = destSnap.data() as GameTile;
    if (source.ownerId !== args.callerUserId) {
      throw new GameTileNotOwnedError();
    }
    if (dest.ownerId !== args.callerUserId) {
      throw new GameTileNotOwnedError();
    }
    if (!source.neighborTileIds.includes(args.destTileId)) {
      throw new GameNotAdjacentError();
    }
    if (!stackHasAtLeast(source.units, args.units)) {
      throw new GameInsufficientUnitsError();
    }
    // Pruned rolling-24h counter from the player's recentRedistributions.
    const recent = (player.recentRedistributions ?? []).filter((entry) => {
      const ms =
        entry instanceof Date
          ? entry.getTime()
          : ((entry as { toMillis?: () => number }).toMillis?.() ?? 0);
      return now.getTime() - ms < 24 * 60 * 60 * 1000;
    });
    if (recent.length >= REDISTRIBUTE_MAX_PER_DAY) {
      // Find the oldest entry to compute retryAfter.
      const oldest = recent[0];
      const oldestMs =
        oldest instanceof Date
          ? oldest.getTime()
          : ((oldest as { toMillis?: () => number }).toMillis?.() ?? 0);
      const retryAfter = 24 * 60 * 60 * 1000 - (now.getTime() - oldestMs);
      throw new GameRedistributeRateLimitError(Math.max(0, retryAfter));
    }
    // Apply the transit-loss haircut.
    const arrived = {
      ground: Math.floor(
        args.units.ground * (1 - 0.08) // REDISTRIBUTE_TRANSIT_LOSS
      ),
      siege: Math.floor(args.units.siege * (1 - 0.08)),
      air: Math.floor(args.units.air * (1 - 0.08)),
    };
    const newSourceUnits: UnitStack = {
      ground: source.units.ground - args.units.ground,
      siege: source.units.siege - args.units.siege,
      air: source.units.air - args.units.air,
    };
    const newDestUnits: UnitStack = {
      ground: dest.units.ground + arrived.ground,
      siege: dest.units.siege + arrived.siege,
      air: dest.units.air + arrived.air,
    };
    // Cap check on destination: SUPER stack can't exceed tile capacity.
    const destCapacity = computeTileCapacity(
      dest.type,
      player.caste,
      dest.upgradeIds,
      player.activeUpgrades ?? {}
    );
    if (sumStack(newDestUnits) > destCapacity) {
      throw new GameTileFullError(
        Math.max(0, destCapacity - sumStack(dest.units)),
        sumStack(arrived)
      );
    }
    const nextRecent = [...recent, now];
    tx.update(sourceRef, { units: newSourceUnits, updatedAt: now });
    tx.update(destRef, { units: newDestUnits, updatedAt: now });
    tx.update(playerRef, {
      recentRedistributions: nextRecent,
      updatedAt: now,
    });
    return {
      source: { ...source, units: newSourceUnits, updatedAt: now },
      dest: { ...dest, units: newDestUnits, updatedAt: now },
    };
  });
}

/**
 * Toggles defensive stance on/off on an owned tile.
 *
 * Toggling ON:
 *   - Tile must be owned by caller.
 *   - Tile must not already be in stance.
 *   - Caller's activeDefensiveStanceCount must be below the cap
 *     (max(1, floor(tilesHeld / 100))).
 *
 * Toggling OFF:
 *   - Only allowed if `defensiveStance.lockedUntil <= now` (the 6h
 *     cooldown has elapsed). Prevents pre-attack flicker.
 */
export async function toggleDefensiveStanceServer(args: {
  callerUserId: string;
  tileId: string;
  desiredActive: boolean;
  now?: Date;
}): Promise<GameTile> {
  const now = args.now ?? new Date();
  const db = adminDbOrThrow();
  const playerRef = db.collection(COLLECTIONS.PLAYERS).doc(args.callerUserId);
  const tileRef = db.collection(COLLECTIONS.TILES).doc(args.tileId);
  return db.runTransaction(async (tx) => {
    const [playerSnap, tileSnap] = await Promise.all([
      tx.get(playerRef),
      tx.get(tileRef),
    ]);
    if (!playerSnap.exists) throw new GamePlayerNotFoundError();
    if (!tileSnap.exists) throw new GameTileNotFoundError();
    const player = playerSnap.data() as GamePlayer;
    const tile = tileSnap.data() as GameTile;
    if (tile.ownerId !== args.callerUserId) throw new GameTileNotOwnedError();

    const currentlyActive = isTileInDefensiveStance(tile, now);
    if (args.desiredActive && currentlyActive) {
      // No-op: already on.
      return tile;
    }
    if (!args.desiredActive && !currentlyActive) {
      // No-op: already off.
      return tile;
    }
    if (args.desiredActive) {
      // Check the cap based on the denormalized counter.
      const cap = Math.max(1, Math.floor((player.stats?.tilesHeld ?? 0) / 100));
      const active = player.activeDefensiveStanceCount ?? 0;
      if (active >= cap) {
        throw new GameDefensiveStanceCapError(cap);
      }
      const stance = {
        active: true,
        since: now,
        lockedUntil: new Date(now.getTime() + DEFENSIVE_STANCE_LOCK_MS),
      };
      tx.update(tileRef, { defensiveStance: stance, updatedAt: now });
      tx.update(playerRef, {
        activeDefensiveStanceCount: active + 1,
        updatedAt: now,
      });
      return { ...tile, defensiveStance: stance, updatedAt: now };
    }
    // Toggle OFF: must wait for lockedUntil.
    if (tile.defensiveStance) {
      const lockedMs =
        tile.defensiveStance.lockedUntil instanceof Date
          ? tile.defensiveStance.lockedUntil.getTime()
          : 0;
      if (lockedMs > now.getTime()) {
        throw new GameDefensiveStanceLockedError();
      }
    }
    tx.update(tileRef, { defensiveStance: null, updatedAt: now });
    tx.update(playerRef, {
      activeDefensiveStanceCount: Math.max(
        0,
        (player.activeDefensiveStanceCount ?? 0) - 1
      ),
      updatedAt: now,
    });
    return { ...tile, defensiveStance: null as never, updatedAt: now };
  });
}

/**
 * Declares Last Stand on an owned tile. Requires:
 *   - turnsRemaining === 0
 *   - Inbound attack threat within LAST_STAND_THREAT_WINDOW_MS (the tile
 *     has been attacked recently OR a neighbor enemy tile has had a
 *     burst of activity — we use lastAttackedAt as a simple signal)
 *   - LAST_STAND_COOLDOWN_MS has elapsed since the last declare
 *
 * On success, stamps `activeLastStand` on the tile (consumed by the next
 * inbound attack — see attackTileServer) and `lastStandUsedAt` on the
 * player (cooldown clock).
 */
export async function declareLastStandServer(args: {
  callerUserId: string;
  tileId: string;
  now?: Date;
}): Promise<GameTile> {
  const now = args.now ?? new Date();
  const db = adminDbOrThrow();
  const playerRef = db.collection(COLLECTIONS.PLAYERS).doc(args.callerUserId);
  const tileRef = db.collection(COLLECTIONS.TILES).doc(args.tileId);
  return db.runTransaction(async (tx) => {
    const [playerSnap, tileSnap] = await Promise.all([
      tx.get(playerRef),
      tx.get(tileRef),
    ]);
    if (!playerSnap.exists) throw new GamePlayerNotFoundError();
    if (!tileSnap.exists) throw new GameTileNotFoundError();
    const player = playerSnap.data() as GamePlayer;
    const tile = tileSnap.data() as GameTile;
    if (tile.ownerId !== args.callerUserId) throw new GameTileNotOwnedError();
    if (player.turnsRemaining > 0) {
      throw new GameLastStandRequiresZeroTurnsError();
    }
    // Cooldown check.
    if (player.lastStandUsedAt) {
      const used =
        player.lastStandUsedAt instanceof Date
          ? player.lastStandUsedAt.getTime()
          : 0;
      const elapsed = now.getTime() - used;
      if (elapsed < LAST_STAND_COOLDOWN_MS) {
        throw new GameLastStandCooldownError(
          LAST_STAND_COOLDOWN_MS - elapsed
        );
      }
    }
    // Threat check: tile has been attacked within the threat window.
    const lastAttackedMs =
      tile.lastAttackedAt instanceof Date
        ? tile.lastAttackedAt.getTime()
        : 0;
    if (now.getTime() - lastAttackedMs > LAST_STAND_THREAT_WINDOW_MS) {
      throw new GameLastStandNoThreatError();
    }
    const activeLastStand = {
      declaredAt: now,
      expiresAt: new Date(now.getTime() + LAST_STAND_WINDOW_MS),
    };
    tx.update(tileRef, { activeLastStand, updatedAt: now });
    tx.update(playerRef, { lastStandUsedAt: now, updatedAt: now });
    return { ...tile, activeLastStand, updatedAt: now };
  });
}
