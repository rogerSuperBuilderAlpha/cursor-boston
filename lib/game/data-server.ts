/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { randomUUID } from "node:crypto";
import type { Firestore, Transaction } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  computeTileCapacity,
  makeSeededRng,
  resolveAttack,
} from "./combat";
import { SPELLS_BY_ID } from "./content";
import { rollArtifact } from "./artifacts";
import {
  buildArmDefenseReport,
  buildAttackReport,
  buildBuildReport,
  buildDistributeReport,
  buildExploreReport,
  buildProduceReport,
} from "./turn-report";
import { notifyConquest } from "./discord-game";
import { logger } from "@/lib/logger";
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
import type {
  ArtifactDefinition,
  Caste,
  GameArtifact,
  GameAttack,
  GamePlayer,
  GameTile,
  LandType,
  MapTile,
  TurnAction,
  TurnReport,
  UnitStack,
  UnitType,
} from "./types";
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
export const BUILD_UNITS_PER_TURN = 10;

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

const COLLECTIONS = {
  PLAYERS: "game_players",
  TILES: "game_tiles",
  ATTACKS: "game_attacks",
  WORLD_META: "game_world_meta",
  ARTIFACTS: "game_artifacts",
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
  return snap.docs.map((d) => d.data() as GameTile);
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
    .select("tileId", "q", "r", "type", "ownerId", "units", "armedDefenseSpellId")
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
      armedDefenseSpellId: data.armedDefenseSpellId ?? null,
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
    .select("tileId", "q", "r", "type", "ownerId", "units", "armedDefenseSpellId")
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
      armedDefenseSpellId: data.armedDefenseSpellId ?? null,
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
    .select("tileId", "q", "r", "type", "ownerId", "units", "armedDefenseSpellId")
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
      armedDefenseSpellId: data.armedDefenseSpellId ?? null,
    } as MapTile);
  }
  return out;
}

export interface OwnerSummary {
  userId: string;
  displayName: string;
  caste: Caste | null;
  shielded: boolean;
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
      "turnsSpentTotal"
    )
    .get();
  return snap.docs.map((d) => {
    const data = d.data() as GamePlayer;
    return {
      userId: data.userId,
      displayName: data.displayName ?? "",
      caste: data.caste ?? null,
      shielded: isShieldActive(data, now),
    };
  });
}

export async function getTileServer(tileId: string): Promise<GameTile | null> {
  const db = adminDbOrThrow();
  const snap = await db.collection(COLLECTIONS.TILES).doc(tileId).get();
  return snap.exists ? (snap.data() as GameTile) : null;
}

// v2 — new players spawn with 25 already-revealed unassigned tiles, skipping
// the v1 "explore" phase entirely. Existing v1 player records aren't touched.
export const NEW_PLAYER_TILE_COUNT = 25;
const NEW_PLAYER_CONTIGUOUS = 20;
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
      // Skip the v1 "explore" phase entirely — new players land in
      // distribute with all their tiles already revealed.
      initialPhase: "distribute",
      tilesHeld: spawn.tileIds.length,
      tilesExplored: spawn.tileIds.length,
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
        type: "unassigned" as LandType,
        level: 0,
        units: { ground: 0, siege: 0, air: 0 },
        armedDefenseSpellId: null,
        neighborTileIds: neighborTileIds(q, r),
        upgradeIds: [],
        revealedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }

    tx.set(
      metaRef,
      { playerCount: playerCount + 1, lastSpawnAt: now, updatedAt: now },
      { merge: true }
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

    tx.update(tileRef, {
      type: "unassigned" as LandType,
      revealedAt: now,
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

    tx.update(tileRef, { type, updatedAt: now });
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
      tile: { ...tile, type, updatedAt: now },
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
  const db = adminDbOrThrow();
  const snap = await db
    .collection(COLLECTIONS.TILES)
    .where("ownerId", "==", userId)
    .where("type", "in", ["food", "magic", "military"])
    .get();
  const counts = { food: 0, magic: 0, military: 0 };
  for (const d of snap.docs) {
    const t = (d.data() as GameTile).type;
    if (t === "food" || t === "magic" || t === "military") counts[t] += 1;
  }
  return counts;
}

// Builds units of `unitType` on `tileId`. Tile must be military and owned by
// player. Costs BUILD_UNITS_TURN_COST and produces BUILD_UNITS_PER_TURN units.
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
  const counts = await getOwnedLandCounts(userId);

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
    if (tile.type !== "military") {
      throw new GameTileTypeError("military", tile.type);
    }
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
    if (player.stats.unitsAlive + BUILD_UNITS_PER_TURN > cap) {
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

    const newUnits: UnitStack = { ...tile.units, [unitType]: tile.units[unitType] + BUILD_UNITS_PER_TURN };
    tx.update(tileRef, { units: newUnits, updatedAt: now });
    tx.update(playerRef, {
      turnsRemaining: player.turnsRemaining - BUILD_UNITS_TURN_COST,
      turnsSpentTotal,
      stats: {
        ...player.stats,
        unitsAlive: player.stats.unitsAlive + BUILD_UNITS_PER_TURN,
      },
      updatedAt: now,
    });

    const report = buildBuildReport({
      turnIndex: turnsSpentTotal,
      cost: BUILD_UNITS_TURN_COST,
      tileId,
      unitType,
      unitsBuilt: BUILD_UNITS_PER_TURN,
      artifactFound: artifact,
      rng: makeNarrativeRng(userId, turnsSpentTotal, "build"),
    });

    return {
      player: {
        ...player,
        turnsRemaining: player.turnsRemaining - BUILD_UNITS_TURN_COST,
        turnsSpentTotal,
        stats: {
          ...player.stats,
          unitsAlive: player.stats.unitsAlive + BUILD_UNITS_PER_TURN,
        },
        updatedAt: now,
      },
      tile: { ...tile, units: newUnits, updatedAt: now },
      produced: BUILD_UNITS_PER_TURN,
      report,
      artifact: rolled?.doc ?? null,
    };
  });
}

export interface BulkBuildPlanEntry {
  tileId: string;
  unitType: UnitType;
  cycles: number; // each cycle = BUILD_UNITS_TURN_COST turns + BUILD_UNITS_PER_TURN units
}

// Bulk build. Reads {player + 1 land-counts query + N military tile refs} once,
// runs each plan entry's `cycles` build steps in memory (each step costs
// BUILD_UNITS_TURN_COST turns and adds BUILD_UNITS_PER_TURN units), accumulates
// artifact rolls + reports, and writes everything in one transaction.
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
  // One owned-tiles query for the cap math, outside the txn.
  const counts = await getOwnedLandCounts(userId);
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
      if (tile.type !== "military") {
        throw new GameTileTypeError("military", tile.type);
      }
      tilesById.set(id, tile);
    }

    const cap = effectiveUnitCap(player, counts.food, counts.magic);
    let unitsAlive = player.stats.unitsAlive;
    let turnsRemaining = player.turnsRemaining;
    let turnsSpentTotal = player.turnsSpentTotal;
    let stoppedEarly: string | undefined;

    const reports: TurnReport[] = [];
    const artifacts: GameArtifact[] = [];
    let stepIndex = 0;
    let producedTotal = 0;

    outer: for (const entry of plan) {
      for (let c = 0; c < entry.cycles; c++) {
        const isFirst = stepIndex === 0;

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
        if (unitsAlive + BUILD_UNITS_PER_TURN > cap) {
          if (isFirst) {
            throw new GameUnitCapExceededError(cap, unitsAlive);
          }
          stoppedEarly = `unit cap reached at cycle ${stepIndex} (${unitsAlive}/${cap})`;
          break outer;
        }

        turnsRemaining -= BUILD_UNITS_TURN_COST;
        turnsSpentTotal += BUILD_UNITS_TURN_COST;
        unitsAlive += BUILD_UNITS_PER_TURN;
        producedTotal += BUILD_UNITS_PER_TURN;

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

        const before = tilesById.get(entry.tileId)!;
        const after: GameTile = {
          ...before,
          units: {
            ...before.units,
            [entry.unitType]:
              before.units[entry.unitType] + BUILD_UNITS_PER_TURN,
          },
          updatedAt: now,
        };
        tilesById.set(entry.tileId, after);

        reports.push(
          buildBuildReport({
            turnIndex: turnsSpentTotal,
            cost: BUILD_UNITS_TURN_COST,
            tileId: entry.tileId,
            unitType: entry.unitType,
            unitsBuilt: BUILD_UNITS_PER_TURN,
            artifactFound: artifact,
            rng: makeNarrativeRng(userId, turnsSpentTotal, "build"),
          })
        );

        stepIndex++;
      }
    }

    // Stage tile writes once each (not per cycle).
    for (const id of uniqueTileIds) {
      const after = tilesById.get(id)!;
      const ref = db.collection(COLLECTIONS.TILES).doc(id);
      tx.update(ref, { units: after.units, updatedAt: now });
    }

    if (stepIndex > 0) {
      tx.update(playerRef, {
        turnsRemaining,
        turnsSpentTotal,
        stats: { ...player.stats, unitsAlive },
        updatedAt: now,
      });
    }

    const updatedPlayer: GamePlayer = {
      ...player,
      turnsRemaining,
      turnsSpentTotal,
      stats: { ...player.stats, unitsAlive },
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

    tx.update(tileRef, { armedDefenseSpellId: spellId, updatedAt: now });
    tx.update(playerRef, {
      turnsRemaining: player.turnsRemaining - cost,
      turnsSpentTotal,
      updatedAt: now,
    });

    const report = buildArmDefenseReport({
      turnIndex: turnsSpentTotal,
      cost,
      tileId,
      spellId,
      spellName: spell.name,
      artifactFound: artifact,
      rng: makeNarrativeRng(userId, turnsSpentTotal, "spell-arm"),
    });

    return {
      player: {
        ...player,
        turnsRemaining: player.turnsRemaining - cost,
        turnsSpentTotal,
        updatedAt: now,
      },
      tile: { ...tile, armedDefenseSpellId: spellId, updatedAt: now },
      report,
      artifact: rolled?.doc ?? null,
    };
  });
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

// Launches an attack. The pure resolveAttack from combat.ts decides the
// outcome; this function orchestrates the read/write transaction around it
// and persists the attack-log doc.
export async function attackTileServer(args: {
  attackerId: string;
  sourceTileId: string;
  targetTileId: string;
  units: UnitStack;
  offenseSpellId: string | null;
  now?: Date;
}): Promise<{
  attack: GameAttack;
  attackerPlayer: GamePlayer;
  defenderPlayer: GamePlayer;
  sourceTile: GameTile;
  targetTile: GameTile;
  report: TurnReport;
  artifact: GameArtifact | null;
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
    if (!stackHasAtLeast(source.units, args.units)) {
      throw new GameInsufficientUnitsError();
    }

    const defenderActiveUpgrades = defender.activeUpgrades ?? {};
    const attackerActiveUpgrades = attacker.activeUpgrades ?? {};
    const tileCapacity = computeTileCapacity(
      target.type,
      defender.caste,
      target.upgradeIds,
      defenderActiveUpgrades
    );
    const defenderTotalOnTile = sumStack(target.units);
    const availableSpace = Math.max(0, tileCapacity - defenderTotalOnTile);
    const sentTotal = sumStack(args.units);
    if (sentTotal > availableSpace) {
      throw new GameTileFullError(availableSpace, sentTotal);
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
    const result = resolveAttack(
      {
        caste: attacker.caste,
        units: args.units,
        offenseSpellId: args.offenseSpellId,
        magicLandCount: 0,
        unitsAlive: attacker.stats.unitsAlive,
        activeUpgrades: attackerActiveUpgrades,
      },
      {
        caste: defender.caste,
        unitsOnTile: target.units,
        armedDefenseSpellId: target.armedDefenseSpellId,
        magicLandCount: 0,
        unitsAlive: defender.stats.unitsAlive,
        activeUpgrades: defenderActiveUpgrades,
      },
      { capacity: tileCapacity, upgradeIds: target.upgradeIds },
      makeSeededRng(`attack-${attackId}`)
    );

    const survivors = subtractStack(result.unitsDeployed, result.attackerLosses);
    const sourceAfterDispatch = subtractStack(source.units, args.units);

    let updatedSourceUnits: UnitStack;
    let updatedTargetUnits: UnitStack;
    let updatedTargetOwner: string | null = target.ownerId;
    let updatedTargetType: LandType = target.type;
    let updatedTargetLevel: number = target.level;
    let updatedTargetUpgrades: string[] = target.upgradeIds;
    let captured = false;

    if (result.outcome === "captured") {
      captured = true;
      updatedSourceUnits = sourceAfterDispatch;
      updatedTargetUnits = survivors;
      updatedTargetOwner = args.attackerId;
      updatedTargetLevel = 0;
      updatedTargetUpgrades = [];
    } else {
      updatedSourceUnits = addStack(sourceAfterDispatch, survivors);
      updatedTargetUnits = subtractStack(target.units, result.defenderLosses);
    }

    const attackerLossesTotal = sumStack(result.attackerLosses);
    const defenderLossesTotal = sumStack(result.defenderLosses);

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

    tx.update(sourceRef, { units: updatedSourceUnits, updatedAt: now });
    tx.update(targetRef, {
      units: updatedTargetUnits,
      ownerId: updatedTargetOwner,
      type: updatedTargetType,
      level: updatedTargetLevel,
      upgradeIds: updatedTargetUpgrades,
      armedDefenseSpellId: null,
      lastAttackedAt: now,
      updatedAt: now,
    });

    const attackerStats = {
      ...attacker.stats,
      unitsAlive: Math.max(0, attacker.stats.unitsAlive - attackerLossesTotal),
      attacksWon: attacker.stats.attacksWon + (captured ? 1 : 0),
      tilesHeld: attacker.stats.tilesHeld + (captured ? 1 : 0),
    };
    const defenderStats = {
      ...defender.stats,
      unitsAlive: Math.max(0, defender.stats.unitsAlive - defenderLossesTotal),
      attacksLost: defender.stats.attacksLost + (captured ? 1 : 0),
      tilesHeld: Math.max(0, defender.stats.tilesHeld - (captured ? 1 : 0)),
    };

    tx.update(attackerRef, {
      turnsRemaining: attacker.turnsRemaining - turnCost,
      turnsSpentTotal: attacker.turnsSpentTotal + turnCost,
      stats: attackerStats,
      updatedAt: now,
    });
    tx.update(defenderRef, { stats: defenderStats, updatedAt: now });

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
      createdAt: now,
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
    });

    return {
      attack,
      attackerPlayer: {
        ...attacker,
        turnsRemaining: attacker.turnsRemaining - turnCost,
        turnsSpentTotal: attackerTurnsSpentTotal,
        stats: attackerStats,
        updatedAt: now,
      },
      defenderPlayer: { ...defender, stats: defenderStats, updatedAt: now },
      sourceTile: { ...source, units: updatedSourceUnits, updatedAt: now },
      targetTile: {
        ...target,
        units: updatedTargetUnits,
        ownerId: updatedTargetOwner,
        type: updatedTargetType,
        level: updatedTargetLevel,
        upgradeIds: updatedTargetUpgrades,
        armedDefenseSpellId: null,
        lastAttackedAt: now,
        updatedAt: now,
      },
      report,
      artifact: rolled?.doc ?? null,
    };
  });

  // Fire-and-forget Discord notification on conquest. Wrapped in try/catch
  // inside notifyConquest itself; the caller never blocks on it.
  if (result.attack.outcome === "captured") {
    notifyConquest({ attack: result.attack });
  }

  return result;
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

export async function getLeaderboardServer(opts: {
  limit: number;
  cursor: string | null;
}): Promise<PaginatedQueryResult<GamePlayer>> {
  const db = adminDbOrThrow();
  const players = db.collection(COLLECTIONS.PLAYERS);
  const query = players.orderBy("stats.tilesHeld", "desc");
  return paginateFirestoreQuery({
    query,
    collection: players,
    cursor: opts.cursor,
    limit: opts.limit,
    mapDoc: (d) => d.data() as GamePlayer,
  });
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

    const tile: GameTile = {
      tileId: sample.tileId,
      q: sample.tile.q,
      r: sample.tile.r,
      ownerId: userId,
      type: "unassigned",
      level: 0,
      units: { ground: 0, siege: 0, air: 0 },
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

      const tile: GameTile = {
        tileId: sample.tileId,
        q: sample.tile.q,
        r: sample.tile.r,
        ownerId: userId,
        type: "unassigned",
        level: 0,
        units: { ground: 0, siege: 0, air: 0 },
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
}): Promise<{ artifact: GameArtifact }> {
  const now = args.now ?? new Date();
  const db = adminDbOrThrow();
  const artifactRef = db.collection(COLLECTIONS.ARTIFACTS).doc(args.artifactId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(artifactRef);
    if (!snap.exists) throw new GameArtifactNotFoundError();
    const artifact = snap.data() as GameArtifact;
    if (artifact.ownerId !== args.userId) {
      throw new GameArtifactNotFoundError();
    }
    if (artifact.used) throw new GameArtifactAlreadyUsedError();

    // For now the only persisted effect is the used flag. PR 6d will branch
    // on artifact.type and apply offense/defense/production effects.
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
    return { artifact: updated };
  });
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
