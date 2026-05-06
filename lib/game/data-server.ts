/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { randomUUID } from "node:crypto";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  computeTileCapacity,
  makeSeededRng,
  resolveAttack,
} from "./combat";
import { SPELLS_BY_ID } from "./content";
import { rollArtifact } from "./artifacts";
import { buildExploreReport } from "./turn-report";
import { notifyConquest } from "./discord-game";
import { logger } from "@/lib/logger";
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
  weekStartIsoForRollover,
} from "./turns";
import type {
  Caste,
  GameArtifact,
  GameAttack,
  GamePlayer,
  GameTile,
  LandType,
  TurnReport,
  UnitStack,
  UnitType,
} from "./types";
import {
  axialFromTileId,
  neighborTileIds,
  spawnCenterForPlayerIndex,
  spawnPlayerLands,
} from "./world-gen";

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

const COLLECTIONS = {
  PLAYERS: "game_players",
  TILES: "game_tiles",
  ATTACKS: "game_attacks",
  WORLD_META: "game_world_meta",
  ARTIFACTS: "game_artifacts",
} as const;

const WORLD_META_DOC = "singleton";

const VALID_DISTRIBUTABLE_TYPES = new Set<LandType>([
  "military",
  "food",
  "magic",
]);
const VALID_CASTES = new Set<Caste>(["black", "red", "white", "green", "blue"]);

function adminDbOrThrow() {
  const db = getAdminDb();
  if (!db) throw new Error("Firebase Admin not initialized");
  return db;
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

export async function getTileServer(tileId: string): Promise<GameTile | null> {
  const db = adminDbOrThrow();
  const snap = await db.collection(COLLECTIONS.TILES).doc(tileId).get();
  return snap.exists ? (snap.data() as GameTile) : null;
}

// Atomic spawn: claims 100 tiles for a brand-new player. Bumps a global
// player-count cursor so two parallel spawns get different centers.
export async function createPlayerWithSpawnServer(
  userId: string,
  now: Date = new Date()
): Promise<{ player: GamePlayer; tileIds: string[] }> {
  const db = adminDbOrThrow();
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

    const playerCount = (metaSnap.data()?.playerCount as number) ?? 0;
    const center = spawnCenterForPlayerIndex(playerCount);

    const seed = `spawn-${userId}-${playerCount}`;
    const spawn = spawnPlayerLands({
      center,
      claimedTileIds: new Set<string>(),
      rng: makeSeededRng(seed),
    });

    const player = newPlayer(userId, now);
    tx.set(playerRef, player);

    for (const tileId of spawn.tileIds) {
      const tileRef = db.collection(COLLECTIONS.TILES).doc(tileId);
      const { q, r } = axialFromTileId(tileId);
      tx.set(tileRef, {
        tileId,
        q,
        r,
        ownerId: userId,
        type: "unrevealed" as LandType,
        level: 0,
        units: { ground: 0, siege: 0, air: 0 },
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

    return { player, tileIds: spawn.tileIds };
  });
}

// Reveals one of the player's unrevealed tiles. Spends 1 turn. Auto-advances
// phase to `distribute` once all 100 are revealed.
export async function exploreNextTileServer(
  userId: string,
  now: Date = new Date()
): Promise<{ player: GamePlayer; tile: GameTile; report: TurnReport }> {
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

    // Seeded artifact + narrative rolls. Seed includes turnsSpentTotal so each
    // turn is independent; including userId keeps players' streams uncorrelated.
    const artifactRng = makeSeededRng(`artifact:${userId}:${turnsSpentTotal}`);
    const narrativeRng = makeSeededRng(`narrative:${userId}:${turnsSpentTotal}`);
    const artifact = rollArtifact(artifactRng);

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

    if (artifact) {
      const artifactId = randomUUID();
      const artifactRef = db.collection(COLLECTIONS.ARTIFACTS).doc(artifactId);
      const artifactDoc: GameArtifact = {
        id: artifactId,
        ownerId: userId,
        definitionId: artifact.id,
        rarity: artifact.rarity,
        type: artifact.type,
        foundAtTurn: turnsSpentTotal,
        foundDuringAction: "explore",
        used: false,
        createdAt: now,
        updatedAt: now,
      };
      tx.set(artifactRef, artifactDoc);
    }

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
      narrativeRng
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
    };
  });
}

export async function listArtifactsServer(
  userId: string
): Promise<GameArtifact[]> {
  const db = adminDbOrThrow();
  // Single-field where + in-memory sort: avoids needing the composite index
  // to be deployed before this code goes live. Inventories are small (player
  // turn budgets cap them well below 1k) so the sort is trivial.
  const snap = await db
    .collection(COLLECTIONS.ARTIFACTS)
    .where("ownerId", "==", userId)
    .limit(500)
    .get();
  const artifacts = snap.docs.map((d) => d.data() as GameArtifact);
  artifacts.sort((a, b) => b.foundAtTurn - a.foundAtTurn);
  return artifacts;
}

// Sets or changes a tile's type (military / food / magic). Costs 1 turn,
// regardless of whether this is a first assignment or a re-assignment.
export async function distributeTileServer(
  userId: string,
  tileId: string,
  type: LandType,
  now: Date = new Date()
): Promise<{ player: GamePlayer; tile: GameTile }> {
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

    tx.update(tileRef, { type, updatedAt: now });
    tx.update(playerRef, {
      turnsRemaining: player.turnsRemaining - 1,
      turnsSpentTotal: player.turnsSpentTotal + 1,
      updatedAt: now,
    });

    return {
      player: {
        ...player,
        turnsRemaining: player.turnsRemaining - 1,
        turnsSpentTotal: player.turnsSpentTotal + 1,
        updatedAt: now,
      },
      tile: { ...tile, type, updatedAt: now },
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
): Promise<{ player: GamePlayer; tile: GameTile; produced: number }> {
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

    const newUnits: UnitStack = { ...tile.units, [unitType]: tile.units[unitType] + BUILD_UNITS_PER_TURN };
    tx.update(tileRef, { units: newUnits, updatedAt: now });
    tx.update(playerRef, {
      turnsRemaining: player.turnsRemaining - BUILD_UNITS_TURN_COST,
      turnsSpentTotal: player.turnsSpentTotal + BUILD_UNITS_TURN_COST,
      stats: {
        ...player.stats,
        unitsAlive: player.stats.unitsAlive + BUILD_UNITS_PER_TURN,
      },
      updatedAt: now,
    });

    return {
      player: {
        ...player,
        turnsRemaining: player.turnsRemaining - BUILD_UNITS_TURN_COST,
        turnsSpentTotal: player.turnsSpentTotal + BUILD_UNITS_TURN_COST,
        stats: {
          ...player.stats,
          unitsAlive: player.stats.unitsAlive + BUILD_UNITS_PER_TURN,
        },
        updatedAt: now,
      },
      tile: { ...tile, units: newUnits, updatedAt: now },
      produced: BUILD_UNITS_PER_TURN,
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
): Promise<{ player: GamePlayer; tile: GameTile }> {
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
    if (player.turnsRemaining < SPELL_TURN_COST) {
      throw new GameInsufficientTurnsError(
        SPELL_TURN_COST,
        player.turnsRemaining
      );
    }

    tx.update(tileRef, { armedDefenseSpellId: spellId, updatedAt: now });
    tx.update(playerRef, {
      turnsRemaining: player.turnsRemaining - SPELL_TURN_COST,
      turnsSpentTotal: player.turnsSpentTotal + SPELL_TURN_COST,
      updatedAt: now,
    });

    return {
      player: {
        ...player,
        turnsRemaining: player.turnsRemaining - SPELL_TURN_COST,
        turnsSpentTotal: player.turnsSpentTotal + SPELL_TURN_COST,
        updatedAt: now,
      },
      tile: { ...tile, armedDefenseSpellId: spellId, updatedAt: now },
    };
  });
}

// Casts a production spell. Lasts PRODUCTION_SPELL_DURATION_TURNS turns from
// the moment of casting (measured by turnsSpentTotal).
export async function castProductionSpellServer(
  userId: string,
  spellId: string,
  now: Date = new Date()
): Promise<GamePlayer> {
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
    if (player.turnsRemaining < SPELL_TURN_COST) {
      throw new GameInsufficientTurnsError(
        SPELL_TURN_COST,
        player.turnsRemaining
      );
    }

    const newTurnsSpentTotal = player.turnsSpentTotal + SPELL_TURN_COST;
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
        expiresAtTurn: newTurnsSpentTotal + PRODUCTION_SPELL_DURATION_TURNS,
      },
    ];

    tx.update(playerRef, {
      turnsRemaining: player.turnsRemaining - SPELL_TURN_COST,
      turnsSpentTotal: newTurnsSpentTotal,
      productionSpellsActive: newActive,
      updatedAt: now,
    });

    return {
      ...player,
      turnsRemaining: player.turnsRemaining - SPELL_TURN_COST,
      turnsSpentTotal: newTurnsSpentTotal,
      productionSpellsActive: newActive,
      updatedAt: now,
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

  const turnCost = ATTACK_TURN_COST + (args.offenseSpellId ? SPELL_TURN_COST : 0);

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
    if (attacker.turnsRemaining < turnCost) {
      throw new GameInsufficientTurnsError(
        turnCost,
        attacker.turnsRemaining
      );
    }
    if (!stackHasAtLeast(source.units, args.units)) {
      throw new GameInsufficientUnitsError();
    }

    const tileCapacity = computeTileCapacity(
      target.type,
      defender.caste,
      target.upgradeIds
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
      },
      {
        caste: defender.caste,
        unitsOnTile: target.units,
        armedDefenseSpellId: target.armedDefenseSpellId,
        magicLandCount: 0,
        unitsAlive: defender.stats.unitsAlive,
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

    return {
      attack,
      attackerPlayer: {
        ...attacker,
        turnsRemaining: attacker.turnsRemaining - turnCost,
        turnsSpentTotal: attacker.turnsSpentTotal + turnCost,
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
    };
  });

  // Fire-and-forget Discord notification on conquest. Wrapped in try/catch
  // inside notifyConquest itself; the caller never blocks on it.
  if (result.attack.outcome === "captured") {
    notifyConquest({ attack: result.attack });
  }

  return result;
}

export async function getRecentAttacksServer(
  userId: string,
  side: "sent" | "received" | "all" = "all",
  limit = 50
): Promise<GameAttack[]> {
  const db = adminDbOrThrow();
  const queries: Promise<GameAttack[]>[] = [];
  if (side === "sent" || side === "all") {
    queries.push(
      db
        .collection(COLLECTIONS.ATTACKS)
        .where("attackerId", "==", userId)
        .orderBy("createdAt", "desc")
        .limit(limit)
        .get()
        .then((snap) => snap.docs.map((d) => d.data() as GameAttack))
    );
  }
  if (side === "received" || side === "all") {
    queries.push(
      db
        .collection(COLLECTIONS.ATTACKS)
        .where("defenderId", "==", userId)
        .orderBy("createdAt", "desc")
        .limit(limit)
        .get()
        .then((snap) => snap.docs.map((d) => d.data() as GameAttack))
    );
  }
  const results = (await Promise.all(queries)).flat();
  // Dedupe (sent+received can overlap if a player attacks themselves — should
  // never happen, but guard).
  const seen = new Set<string>();
  const out: GameAttack[] = [];
  for (const a of results) {
    if (a.id && seen.has(a.id)) continue;
    if (a.id) seen.add(a.id);
    out.push(a);
  }
  out.sort((a, b) => {
    const ta = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
    const tb = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
    return tb - ta;
  });
  return out.slice(0, limit);
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
  const windowStart = window.start.getTime();
  const windowEnd = window.end.getTime();

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
      const prsSnap = await db
        .collection("pullRequests")
        .where("userId", "==", player.userId)
        .where("state", "==", "merged")
        .get();
      const inWindow = prsSnap.docs.some((d) => {
        const data = d.data();
        const mergedAt = data.mergedAt;
        let t: number;
        if (
          mergedAt &&
          typeof (mergedAt as { toMillis?: () => number }).toMillis ===
            "function"
        ) {
          t = (mergedAt as { toMillis: () => number }).toMillis();
        } else if (mergedAt instanceof Date) {
          t = mergedAt.getTime();
        } else {
          return false;
        }
        return t >= windowStart && t < windowEnd;
      });

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

export async function getLeaderboardServer(
  limit = 50
): Promise<GamePlayer[]> {
  const db = adminDbOrThrow();
  const snap = await db
    .collection(COLLECTIONS.PLAYERS)
    .orderBy("stats.tilesHeld", "desc")
    .limit(Math.max(1, Math.min(100, limit)))
    .get();
  return snap.docs.map((d) => d.data() as GamePlayer);
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
  // Only query the pullRequests collection if we know who to filter by.
  // The collection is keyed off Firebase userId (set by the merge webhook).
  try {
    const prsSnap = await db
      .collection("pullRequests")
      .where("userId", "==", userId)
      .where("state", "==", "merged")
      .get();
    for (const d of prsSnap.docs) {
      const data = d.data();
      const mergedAt = data.mergedAt;
      let t: number | null = null;
      if (
        mergedAt &&
        typeof (mergedAt as { toDate?: () => Date }).toDate === "function"
      ) {
        t = (mergedAt as { toDate: () => Date }).toDate().getTime();
      } else if (mergedAt instanceof Date) {
        t = mergedAt.getTime();
      } else if (typeof mergedAt === "string") {
        const parsed = Date.parse(mergedAt);
        if (!Number.isNaN(parsed)) t = parsed;
      }
      if (t === null) continue;
      if (t >= window.start.getTime() && t < window.end.getTime()) {
        mergedPrCountThisWeek += 1;
      }
    }
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
