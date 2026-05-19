/**
 * @jest-environment node
 *
 * Wave 14 — remaining data-server branches: world meta defaults, spawn edge
 * cases, cast/production spell catalog, bulk multi-tile build, explore with
 * active production buffs, tile lazy-regen timestamps, attack combinations,
 * admin grant errors, artifacts pagination cursor, profile + leaderboard.
 */
jest.mock("@/lib/firebase-admin", () => ({ getAdminDb: jest.fn() }));

const mockPaginate = jest.fn();

jest.mock("@/lib/firestore-pagination", () => {
  const actual = jest.requireActual<typeof import("@/lib/firestore-pagination")>(
    "@/lib/firestore-pagination",
  );
  return {
    ...actual,
    paginateFirestoreQuery: (...args: unknown[]) => mockPaginate(...args),
  };
});

jest.mock("@/lib/game/turn-report", () => ({
  buildAttackReport: jest.fn(() => ({ kind: "attack" })),
  buildBuildReport: jest.fn(() => ({ kind: "build" })),
  buildCastSpellReport: jest.fn(() => ({ kind: "cast" })),
  buildExploreReport: jest.fn(() => ({ kind: "explore" })),
  buildProduceReport: jest.fn(() => ({ kind: "produce" })),
}));
jest.mock("@/lib/game/artifacts", () => ({ rollArtifact: jest.fn(() => null) }));
jest.mock("@/lib/game/community", () => ({ logCommunityEventInTx: jest.fn() }));
jest.mock("@/lib/game/intel-effects", () => ({
  readAttackContextEffects: jest.fn().mockResolvedValue({
    forgeSightOffenseBonus: 0,
    alertVsCasterDefenseBonus: 0,
    siegeDebuffMagnitude: 0,
    preCastOffenseBonus: 0,
    defenseDisarmFraction: 0,
    consumeEffectIds: [],
  }),
  deleteIntelEffectsInTx: jest.fn(),
  recordDefenseDisarmInTx: jest.fn(),
  recordSiegeDebuffInTx: jest.fn(),
}));
jest.mock("@/lib/game/discord-game", () => ({ notifyConquest: jest.fn() }));
jest.mock("@/lib/game/pacts", () => ({
  findActivePactsBetween: jest.fn().mockResolvedValue([]),
  markPactsBrokenInTx: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/lib/game/prophecies", () => ({
  resolveProphesiesForSealInTx: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/lib/game/hero-registry", () => ({
  appendHeroEventInTx: jest.fn(),
  upsertHeroInTx: jest.fn(),
  markHeroDeceasedInTx: jest.fn(),
  transferHeroOwnerInTx: jest.fn(),
  heroEvent: {
    engagedAttacker: jest.fn(() => ({})),
    engagedDefender: jest.fn(() => ({})),
    slain: jest.fn(() => ({})),
    defected: jest.fn(() => ({})),
    movedOnCapture: jest.fn(() => ({})),
    emerged: jest.fn(() => ({})),
    spellCast: jest.fn(() => ({})),
    recruited: jest.fn(() => ({})),
    specialUnitSummoned: jest.fn(() => ({})),
  },
}));
jest.mock("@/lib/game/heroes", () => {
  const actual = jest.requireActual<typeof import("@/lib/game/heroes")>("@/lib/game/heroes");
  return { ...actual, maybeEmergeHero: jest.fn(() => null) };
});
jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), logError: jest.fn() },
}));

import * as crypto from "crypto";
import { getAdminDb } from "@/lib/firebase-admin";
import { SPELLS_BY_ID } from "@/lib/game/content";
import {
  adminGrantUnitsServer,
  attackTileServer,
  bulkBuildUnitsServer,
  castProductionSpellServer,
  castSpellServer,
  createPlayerWithSpawnServer,
  exploreNextTileServer,
  GameInsufficientTurnsError,
  GameInvalidNameError,
  GameInvalidSpellError,
  GameNameTakenError,
  GameNotAdjacentError,
  GamePlayerAlreadyExistsError,
  GamePlayerNotFoundError,
  GameSelfAttackError,
  GameShieldedError,
  GameTileNotFoundError,
  GameTileNotOwnedError,
  GameUnitCapExceededError,
  getLeaderboardServer,
  getPublicPlayerProfileServer,
  getTileServer,
  getWorldMetaServer,
  isGeneralNameTakenServer,
  listArtifactsServer,
  NEW_PLAYER_TILE_COUNT,
} from "@/lib/game/data-server";
import { findActivePactsBetween } from "@/lib/game/pacts";
import { recordDefenseDisarmInTx, recordSiegeDebuffInTx } from "@/lib/game/intel-effects";
import type { Caste, SpellDefinition } from "@/lib/game/types";
import {
  makeChain,
  makeDoc,
  makeDocRef,
  makeFakeDb,
  makeQuerySnap,
  tsLike,
} from "@/__tests__/_helpers/firebase-admin-mock";
import {
  BASE_ATTACKER,
  BASE_DEFENDER,
  BASE_PLAYER,
  BASE_TILE,
  buildBulkMutationDb,
  buildCombatMutationDb,
  buildGameMutationDb,
  makeAdjacentCombatTiles,
} from "@/__tests__/_helpers/game-mutation-db";

const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockFindPacts = findActivePactsBetween as jest.MockedFunction<
  typeof findActivePactsBetween
>;

const CAST_SPELLS = [...SPELLS_BY_ID.values()].filter(
  (s): s is SpellDefinition & { type: "siege" | "disarm" | "attrition" } =>
    s.type === "siege" || s.type === "disarm" || s.type === "attrition",
);

const PRODUCTION_SPELLS = [...SPELLS_BY_ID.values()].filter(
  (s): s is SpellDefinition & { type: "production" } => s.type === "production",
);

function foodLandDocs(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `food-${i}`,
    data: {
      ...BASE_TILE,
      tileId: `food-${i}`,
      type: "food" as const,
      units: { ground: 0, air: 0, siege: 0 },
    },
  }));
}

function buildWorldMetaDb(worldMeta: Record<string, unknown> | undefined) {
  const worldChain = makeChain({});
  (worldChain as { doc: jest.Mock }).doc = jest.fn(() =>
    makeDocRef("singleton", {
      snap: worldMeta === undefined ? makeDoc("singleton", undefined) : makeDoc("singleton", worldMeta),
    }),
  );
  return makeFakeDb({ collections: { game_world_meta: worldChain } }).db;
}

function buildGetTileDb(opts: {
  tile: Record<string, unknown>;
  player?: Record<string, unknown> | null;
}) {
  const tileSnap = makeDoc("t1", opts.tile);
  const tileRef = makeDocRef("t1", {
    get: jest.fn().mockResolvedValue(tileSnap),
    update: jest.fn().mockResolvedValue(undefined),
  });
  const playersCollection = {
    doc: jest.fn(() =>
      makeDocRef("u1", {
        get: jest.fn().mockResolvedValue(
          opts.player === null
            ? makeDoc("u1", undefined)
            : makeDoc("u1", opts.player ?? { userId: "u1", caste: "red" }),
        ),
      }),
    ),
  };
  return {
    collection: jest.fn((name: string) => {
      if (name === "game_tiles") return { doc: jest.fn(() => tileRef) };
      if (name === "game_players") return playersCollection;
      throw new Error(`unexpected collection: ${name}`);
    }),
    tileRef,
  };
}

function createPlayerDb(opts: {
  nameTaken?: boolean;
  playerExists?: boolean;
  occupiedCenter?: boolean;
  playerCount?: number;
}) {
  const userId = "spawn-w14";
  const playerRef = { id: userId, __player: true as const };
  const metaRef = { id: "singleton", __meta: true as const };
  const tileGets = new Map<string, boolean>();
  if (opts.occupiedCenter) tileGets.set("0_0", true);

  const nameTakenChain = makeChain({
    docs: opts.nameTaken ? [makeDoc("other", { displayNameLower: "taken" })] : [],
  });

  const tx = {
    get: jest.fn(
      (ref: { id?: string; __player?: boolean; __meta?: boolean; __tile?: boolean }) => {
        if (ref.__player) {
          return Promise.resolve({
            exists: !!opts.playerExists,
            id: userId,
            data: () => (opts.playerExists ? { userId } : undefined),
          });
        }
        if (ref.__meta) {
          return Promise.resolve({
            exists: true,
            id: "singleton",
            data: () => ({ playerCount: opts.playerCount ?? 0 }),
          });
        }
        if (ref.__tile && ref.id) {
          return Promise.resolve({
            exists: tileGets.get(ref.id) ?? false,
            id: ref.id,
            data: () => (tileGets.get(ref.id) ? { tileId: ref.id } : undefined),
          });
        }
        return Promise.resolve({ exists: false, id: "", data: () => undefined });
      },
    ),
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const cachedTileRefs = new Map<string, { id: string; __tile: true }>();
  const db = {
    collection: jest.fn((name: string) => {
      if (name === "game_players") {
        return { doc: jest.fn(() => playerRef), where: jest.fn(() => nameTakenChain) };
      }
      if (name === "game_tiles") {
        return {
          doc: jest.fn((tid: string) => {
            if (!cachedTileRefs.has(tid)) cachedTileRefs.set(tid, { __tile: true, id: tid });
            return cachedTileRefs.get(tid)!;
          }),
        };
      }
      if (name === "game_world_meta") return { doc: jest.fn(() => metaRef) };
      return { doc: jest.fn(), where: jest.fn() };
    }),
    runTransaction: jest.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
  };

  return { db, tx, userId };
}

function exploreDb(opts: {
  player?: Record<string, unknown>;
  tile?: Record<string, unknown>;
}) {
  return buildGameMutationDb({
    player: {
      exists: true,
      data: {
        ...BASE_PLAYER,
        phase: "explore",
        turnsRemaining: 5,
        tilesExplored: 10,
        caste: "red",
        ...opts.player,
      },
    },
    tile: {
      exists: true,
      data: { ...BASE_TILE, type: "unrevealed", ...opts.tile },
    },
    unrevealedDocs: [{ id: "t1", data: { ...BASE_TILE, type: "unrevealed" } }],
  });
}

function combatDbForCaste(caste: Caste) {
  const tiles = makeAdjacentCombatTiles();
  return buildCombatMutationDb({
    attacker: { ...BASE_ATTACKER, caste, userId: "u1" },
    defender: { ...BASE_DEFENDER, caste: caste === "red" ? "blue" : "red" },
    source: tiles.source,
    target: tiles.target,
    sourceTileId: tiles.sourceTileId,
    targetTileId: tiles.targetTileId,
    ownedTileDocs: [{ id: tiles.sourceTileId, data: tiles.source }],
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPaginate.mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
  mockFindPacts.mockResolvedValue([]);
});

describe("getWorldMetaServer (wave 14)", () => {
  it("preserves armageddon timestamp fields from a partial doc", async () => {
    const started = new Date("2026-04-01T00:00:00.000Z");
    const resolved = new Date("2026-05-01T00:00:00.000Z");
    mockGetAdminDb.mockReturnValue(
      buildWorldMetaDb({
        playerCount: 7,
        armageddonState: "resolved",
        armageddonStartedAt: started,
        armageddonResolvedAt: resolved,
        lastSpawnAt: started,
      }),
    );
    const out = await getWorldMetaServer();
    expect(out.armageddonStartedAt).toEqual(started);
    expect(out.armageddonResolvedAt).toEqual(resolved);
    expect(out.lastSpawnAt).toEqual(started);
    expect(out.armageddonState).toBe("resolved");
  });

  it("defaults seasonNumber and sealsBroken when omitted", async () => {
    mockGetAdminDb.mockReturnValue(buildWorldMetaDb({ playerCount: 1 }));
    const out = await getWorldMetaServer();
    expect(out.seasonNumber).toBe(1);
    expect(out.sealsBroken).toBe(0);
    expect(out.seals).toEqual([]);
  });

  it("throws when Firebase Admin is unavailable", async () => {
    mockGetAdminDb.mockReturnValue(null as never);
    await expect(getWorldMetaServer()).rejects.toThrow("Firebase Admin not initialized");
  });
});

describe("createPlayerWithSpawnServer (wave 14)", () => {
  it("returns explore-phase player with NEW_PLAYER_TILE_COUNT tiles", async () => {
    const { db, userId } = createPlayerDb({});
    mockGetAdminDb.mockReturnValue(db);
    const { player, tileIds } = await createPlayerWithSpawnServer(userId, "WaveGeneral");
    expect(tileIds).toHaveLength(NEW_PLAYER_TILE_COUNT);
    expect(player.phase).toBe("explore");
    expect(player.tilesExplored).toBe(0);
    expect(player.displayName).toBe("WaveGeneral");
  });

  it("increments world meta playerCount on spawn", async () => {
    const { db, tx, userId } = createPlayerDb({ playerCount: 3 });
    mockGetAdminDb.mockReturnValue(db);
    await createPlayerWithSpawnServer(userId, "Counter");
    expect(tx.set).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ playerCount: 4 }),
      expect.objectContaining({ merge: true }),
    );
  });

  it("throws GamePlayerAlreadyExistsError for duplicate user id", async () => {
    const { db } = createPlayerDb({ playerExists: true });
    mockGetAdminDb.mockReturnValue(db);
    await expect(createPlayerWithSpawnServer("spawn-w14", "Dup")).rejects.toBeInstanceOf(
      GamePlayerAlreadyExistsError,
    );
  });

  it("throws GameNameTakenError when pre-flight name check fails", async () => {
    const { db } = createPlayerDb({ nameTaken: true });
    mockGetAdminDb.mockReturnValue(db);
    await expect(createPlayerWithSpawnServer("spawn-w14", "Taken")).rejects.toBeInstanceOf(
      GameNameTakenError,
    );
  });

  it("throws GameInvalidNameError for whitespace-only names", async () => {
    const { db } = createPlayerDb({});
    mockGetAdminDb.mockReturnValue(db);
    await expect(createPlayerWithSpawnServer("spawn-w14", "  ")).rejects.toBeInstanceOf(
      GameInvalidNameError,
    );
  });
});

describe("isGeneralNameTakenServer (wave 14)", () => {
  it("returns true when another player owns the lowercase name", async () => {
    const playersChain = makeChain({
      docs: [makeDoc("rival", { displayNameLower: "duke" })],
    });
    mockGetAdminDb.mockReturnValue(
      makeFakeDb({ collections: { game_players: playersChain } }).db,
    );
    await expect(isGeneralNameTakenServer("Duke")).resolves.toBe(true);
  });

  it("trims surrounding whitespace before querying", async () => {
    const playersChain = makeChain({ docs: [] });
    playersChain.where = jest.fn().mockReturnValue(playersChain);
    mockGetAdminDb.mockReturnValue(
      makeFakeDb({ collections: { game_players: playersChain } }).db,
    );
    await isGeneralNameTakenServer("  Fresh  ");
    expect(playersChain.where).toHaveBeenCalledWith("displayNameLower", "==", "fresh");
  });
});

describe("adminGrantUnitsServer errors (wave 14)", () => {
  it("rejects negative counts", async () => {
    mockGetAdminDb.mockReturnValue(makeFakeDb().db);
    await expect(
      adminGrantUnitsServer({ ownerId: "u1", tileId: "t1", unitType: "ground", count: -1 }),
    ).rejects.toThrow("count must be a non-negative integer");
  });

  it("rejects non-integer counts", async () => {
    mockGetAdminDb.mockReturnValue(makeFakeDb().db);
    await expect(
      adminGrantUnitsServer({ ownerId: "u1", tileId: "t1", unitType: "air", count: 1.5 }),
    ).rejects.toThrow("count must be a non-negative integer");
  });

  it("throws GamePlayerNotFoundError when owner is missing", async () => {
    const { db } = buildGameMutationDb({
      player: { exists: false },
      tile: { exists: true, data: BASE_TILE },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      adminGrantUnitsServer({ ownerId: "u1", tileId: "t1", unitType: "siege", count: 1 }),
    ).rejects.toBeInstanceOf(GamePlayerNotFoundError);
  });

  it("throws GameTileNotFoundError when tile is missing", async () => {
    const { db } = buildGameMutationDb({
      player: { exists: true, data: BASE_PLAYER },
      tile: { exists: false },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      adminGrantUnitsServer({ ownerId: "u1", tileId: "t1", unitType: "ground", count: 1 }),
    ).rejects.toBeInstanceOf(GameTileNotFoundError);
  });

  it("throws GameTileNotOwnedError when tile belongs to another player", async () => {
    const { db } = buildGameMutationDb({
      player: { exists: true, data: BASE_PLAYER },
      tile: { exists: true, data: { ...BASE_TILE, ownerId: "u-other" } },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      adminGrantUnitsServer({ ownerId: "u1", tileId: "t1", unitType: "ground", count: 1 }),
    ).rejects.toBeInstanceOf(GameTileNotOwnedError);
  });
});

describe("listArtifactsServer (wave 14)", () => {
  it("forwards cursor and limit to paginateFirestoreQuery", async () => {
    mockGetAdminDb.mockReturnValue(
      makeFakeDb({ collections: { game_artifacts: makeChain({}) } }).db,
    );
    await listArtifactsServer({ userId: "u1", limit: 25, cursor: "art-cursor" });
    expect(mockPaginate).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 25, cursor: "art-cursor" }),
    );
  });

  it("scopes the query to the requesting owner", async () => {
    const artifactsChain = makeChain({});
    artifactsChain.where = jest.fn().mockReturnValue(artifactsChain);
    artifactsChain.orderBy = jest.fn().mockReturnValue(artifactsChain);
    mockGetAdminDb.mockReturnValue(
      makeFakeDb({ collections: { game_artifacts: artifactsChain } }).db,
    );
    await listArtifactsServer({ userId: "owner-42", limit: 5, cursor: null });
    expect(artifactsChain.where).toHaveBeenCalledWith("ownerId", "==", "owner-42");
    expect(artifactsChain.orderBy).toHaveBeenCalledWith("foundAtTurn", "desc");
  });
});

describe("getPublicPlayerProfileServer (wave 14)", () => {
  it("returns null for a missing player doc", async () => {
    const playersChain = makeChain({});
    (playersChain as { doc: jest.Mock }).doc = jest.fn(() =>
      makeDocRef("ghost", { snap: makeDoc("ghost", undefined) }),
    );
    mockGetAdminDb.mockReturnValue(
      makeFakeDb({ collections: { game_players: playersChain } }).db,
    );
    await expect(getPublicPlayerProfileServer("ghost")).resolves.toBeNull();
  });

  it("returns the stored player record when present", async () => {
    const profile = { userId: "u1", displayName: "Public Gen", bio: "hello" };
    (makeChain({}) as { doc: jest.Mock }).doc = jest.fn(() =>
      makeDocRef("u1", { snap: makeDoc("u1", profile) }),
    );
    const playersChain = makeChain({});
    (playersChain as { doc: jest.Mock }).doc = jest.fn(() =>
      makeDocRef("u1", { snap: makeDoc("u1", profile) }),
    );
    mockGetAdminDb.mockReturnValue(
      makeFakeDb({ collections: { game_players: playersChain } }).db,
    );
    await expect(getPublicPlayerProfileServer("u1")).resolves.toEqual(profile);
  });
});

describe("getLeaderboardServer sort and audience (wave 14)", () => {
  it("orders by stats.tilesHeld desc for audience=all via pagination helper", async () => {
    const playersChain = makeChain({});
    playersChain.orderBy = jest.fn().mockReturnValue(playersChain);
    mockGetAdminDb.mockReturnValue(
      makeFakeDb({ collections: { game_players: playersChain } }).db,
    );
    await getLeaderboardServer({ limit: 20, cursor: "c1", audience: "all" });
    expect(playersChain.orderBy).toHaveBeenCalledWith("stats.tilesHeld", "desc");
    expect(mockPaginate).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 20, cursor: "c1" }),
    );
  });

  it("filters to NPCs when audience=npc", async () => {
    const docs = [
      makeDoc("npc-1", { userId: "npc-1", isNpc: true, stats: { tilesHeld: 50 } }),
      makeDoc("u1", { userId: "u1", stats: { tilesHeld: 100 } }),
    ];
    const playersChain = makeChain({});
    playersChain.orderBy = jest.fn().mockReturnValue(playersChain);
    playersChain.limit = jest.fn().mockReturnValue(playersChain);
    playersChain.get = jest.fn().mockResolvedValue(makeQuerySnap(docs));
    mockGetAdminDb.mockReturnValue(
      makeFakeDb({ collections: { game_players: playersChain } }).db,
    );
    const page = await getLeaderboardServer({ limit: 10, cursor: null, audience: "npc" });
    expect(page.items).toHaveLength(1);
    expect(page.items[0].userId).toBe("npc-1");
  });

  it("uses startAfter when a cursor doc exists for filtered audiences", async () => {
    const cursorPlayer = makeDoc("u5", { stats: { tilesHeld: 40 } });
    const playersChain = makeChain({});
    playersChain.orderBy = jest.fn().mockReturnValue(playersChain);
    playersChain.limit = jest.fn().mockReturnValue(playersChain);
    playersChain.doc = jest.fn(() =>
      makeDocRef("u5", { get: jest.fn().mockResolvedValue(cursorPlayer) }),
    );
    const chained = { ...playersChain, startAfter: jest.fn().mockReturnValue(playersChain) };
    playersChain.limit.mockReturnValue(chained);
    playersChain.get = jest.fn().mockResolvedValue(makeQuerySnap([]));
    mockGetAdminDb.mockReturnValue(
      makeFakeDb({ collections: { game_players: playersChain } }).db,
    );
    await getLeaderboardServer({ limit: 5, cursor: "u5", audience: "real" });
    expect(chained.startAfter).toHaveBeenCalledWith(cursorPlayer);
  });

  it("sets hasMore when the over-fetch window is full", async () => {
    const docs = Array.from({ length: 9 }, (_, i) =>
      makeDoc(`u${i}`, { stats: { tilesHeld: 100 - i } }),
    );
    const playersChain = makeChain({});
    playersChain.orderBy = jest.fn().mockReturnValue(playersChain);
    playersChain.limit = jest.fn().mockReturnValue(playersChain);
    playersChain.get = jest.fn().mockResolvedValue(makeQuerySnap(docs));
    mockGetAdminDb.mockReturnValue(
      makeFakeDb({ collections: { game_players: playersChain } }).db,
    );
    const page = await getLeaderboardServer({ limit: 2, cursor: null, audience: "real" });
    expect(page.items).toHaveLength(2);
    expect(page.hasMore).toBe(true);
  });
});

describe("getTileServer lazy regen (wave 14)", () => {
  it("returns unowned tiles without loading the owner player", async () => {
    const db = buildGetTileDb({
      tile: { ...BASE_TILE, ownerId: null, tileId: "t1", q: 0, r: 0 },
    });
    mockGetAdminDb.mockReturnValue(db);
    const out = await getTileServer("t1");
    expect(out?.ownerId).toBeNull();
    expect(db.collection).toHaveBeenCalledTimes(1);
  });

  it("applies lazy regen using Timestamp.toDate on baseRegenedAt", async () => {
    const old = new Date("2020-01-01T00:00:00.000Z");
    const db = buildGetTileDb({
      tile: {
        tileId: "t1",
        q: 0,
        r: 0,
        type: "military",
        ownerId: "u1",
        units: { ground: 0, air: 0, siege: 0 },
        baseUnits: { ground: 0, siege: 0, air: 0 },
        baseRegenedAt: tsLike(old.toISOString()),
        upgradeIds: [],
        intrinsicBuffs: [],
      },
      player: {
        userId: "u1",
        caste: "red",
        activeUpgrades: {},
        productionSpellsActive: [],
      },
    });
    mockGetAdminDb.mockReturnValue(db);
    const out = await getTileServer("t1");
    expect(out?.baseUnits?.ground).toBeGreaterThan(0);
    expect(db.tileRef.update).toHaveBeenCalled();
  });

  it("uses productionSpellsActive when computing regen targets", async () => {
    const old = new Date("2020-01-01T00:00:00.000Z");
    const withSpell = buildGetTileDb({
      tile: {
        tileId: "t1",
        q: 0,
        r: 0,
        type: "military",
        ownerId: "u1",
        units: { ground: 0, air: 0, siege: 0 },
        baseUnits: { ground: 0, siege: 0, air: 0 },
        baseRegenedAt: old,
        upgradeIds: [],
        intrinsicBuffs: [],
      },
      player: {
        userId: "u1",
        caste: "red",
        turnsSpentTotal: 10,
        activeUpgrades: {},
        productionSpellsActive: [
          { spellId: "red-production-forge-boon", expiresAtTurn: 999 },
        ],
      },
    });
    const withoutSpell = buildGetTileDb({
      tile: {
        tileId: "t1",
        q: 0,
        r: 0,
        type: "military",
        ownerId: "u1",
        units: { ground: 0, air: 0, siege: 0 },
        baseUnits: { ground: 0, siege: 0, air: 0 },
        baseRegenedAt: old,
        upgradeIds: [],
        intrinsicBuffs: [],
      },
      player: {
        userId: "u1",
        caste: "red",
        turnsSpentTotal: 10,
        activeUpgrades: {},
        productionSpellsActive: [],
      },
    });
    mockGetAdminDb.mockReturnValue(withSpell);
    const boosted = await getTileServer("t1");
    mockGetAdminDb.mockReturnValue(withoutSpell);
    const plain = await getTileServer("t1");
    expect(boosted!.baseUnits!.ground).toBeGreaterThanOrEqual(plain!.baseUnits!.ground);
  });

  it("falls back to createdAt Timestamp when baseRegenedAt is absent", async () => {
    const created = new Date("2019-06-01T00:00:00.000Z");
    const db = buildGetTileDb({
      tile: {
        tileId: "t1",
        q: 0,
        r: 0,
        type: "food",
        ownerId: "u1",
        units: { ground: 0, air: 0, siege: 0 },
        baseUnits: { ground: 0, siege: 0, air: 0 },
        createdAt: tsLike(created.toISOString()),
        upgradeIds: [],
        intrinsicBuffs: [],
      },
      player: { userId: "u1", caste: "white", activeUpgrades: {}, productionSpellsActive: [] },
    });
    mockGetAdminDb.mockReturnValue(db);
    const out = await getTileServer("t1");
    expect(out?.baseUnits).toBeDefined();
  });
});

describe("exploreNextTileServer with productionSpellsActive (wave 14)", () => {
  it("seeds higher baseUnits when a production spell is active", async () => {
    const { db: dbPlain } = exploreDb({
      player: { productionSpellsActive: [], turnsSpentTotal: 5 },
    });
    mockGetAdminDb.mockReturnValue(dbPlain);
    const plain = await exploreNextTileServer("u1");

    const { db: dbBoosted } = exploreDb({
      player: {
        productionSpellsActive: [
          { spellId: "red-production-forge-boon", expiresAtTurn: 999 },
        ],
        turnsSpentTotal: 5,
      },
    });
    mockGetAdminDb.mockReturnValue(dbBoosted);
    const boosted = await exploreNextTileServer("u1");

    const plainGround = plain.tile.baseUnits?.ground ?? 0;
    const boostedGround = boosted.tile.baseUnits?.ground ?? 0;
    expect(boostedGround).toBeGreaterThanOrEqual(plainGround);
  });

  it("advances phase to distribute after the 100th reveal", async () => {
    const { db } = exploreDb({ player: { tilesExplored: 99, phase: "explore" } });
    mockGetAdminDb.mockReturnValue(db);
    const result = await exploreNextTileServer("u1");
    expect(result.player.tilesExplored).toBe(100);
    expect(result.player.phase).toBe("distribute");
  });

  it("accepts Firestore Timestamp tile.createdAt when seeding base", async () => {
    const { db } = exploreDb({
      tile: { createdAt: tsLike("2024-01-01T00:00:00.000Z") },
    });
    mockGetAdminDb.mockReturnValue(db);
    const result = await exploreNextTileServer("u1");
    expect(result.tile.type).toBe("unassigned");
    expect(result.tile.baseUnits).toBeDefined();
  });
});

describe("bulkBuildUnitsServer multi-tile (wave 14)", () => {
  const mil1 = {
    ...BASE_TILE,
    tileId: "mil-1",
    type: "military" as const,
    units: { ground: 0, air: 0, siege: 0 },
  };
  const mil2 = {
    ...BASE_TILE,
    tileId: "mil-2",
    type: "military" as const,
    units: { ground: 0, air: 0, siege: 0 },
  };

  it("builds across multiple tiles in one transaction", async () => {
    const foodDocs = foodLandDocs(8);
    const { db } = buildBulkMutationDb({
      player: {
        ...BASE_PLAYER,
        phase: "play",
        turnsRemaining: 50,
        stats: { unitsAlive: 0, tilesHeld: 50 },
      },
      tiles: [
        { id: "mil-1", data: mil1 },
        { id: "mil-2", data: mil2 },
      ],
      ownedTileDocs: [
        { id: "mil-1", data: mil1 },
        { id: "mil-2", data: mil2 },
        ...foodDocs,
      ],
    });
    mockGetAdminDb.mockReturnValue(db);
    const result = await bulkBuildUnitsServer("u1", [
      { tileId: "mil-1", unitType: "ground", cycles: 1 },
      { tileId: "mil-2", unitType: "air", cycles: 1 },
    ]);
    expect(result.tiles).toHaveLength(2);
    expect(result.produced).toBeGreaterThan(0);
    expect(result.tiles.find((t) => t.tileId === "mil-2")!.units.air).toBeGreaterThan(0);
  });

  it("dedupes duplicate tile ids in the plan", async () => {
    const foodDocs = foodLandDocs(8);
    const { db, tx } = buildBulkMutationDb({
      player: {
        ...BASE_PLAYER,
        phase: "play",
        turnsRemaining: 20,
        stats: { unitsAlive: 0, tilesHeld: 50 },
      },
      tiles: [{ id: "mil-1", data: mil1 }],
      ownedTileDocs: [{ id: "mil-1", data: mil1 }, ...foodDocs],
    });
    mockGetAdminDb.mockReturnValue(db);
    await bulkBuildUnitsServer("u1", [
      { tileId: "mil-1", unitType: "ground", cycles: 1 },
      { tileId: "mil-1", unitType: "ground", cycles: 1 },
    ]);
    const tileUpdates = tx.update.mock.calls.filter((c) => c[1]?.units);
    expect(tileUpdates).toHaveLength(1);
  });

  it("stops early when turns run out after the first cycle", async () => {
    const foodDocs = foodLandDocs(8);
    const { db } = buildBulkMutationDb({
      player: {
        ...BASE_PLAYER,
        phase: "play",
        turnsRemaining: 6,
        stats: { unitsAlive: 0, tilesHeld: 50 },
      },
      tiles: [{ id: "mil-1", data: mil1 }],
      ownedTileDocs: [{ id: "mil-1", data: mil1 }, ...foodDocs],
    });
    mockGetAdminDb.mockReturnValue(db);
    const result = await bulkBuildUnitsServer("u1", [
      { tileId: "mil-1", unitType: "ground", cycles: 3 },
    ]);
    expect(result.stoppedEarly).toMatch(/out of turns/);
    expect(result.reports).toHaveLength(1);
  });

  it("throws GameUnitCapExceededError on the first cycle when over cap", async () => {
    const foodDocs = foodLandDocs(2);
    const { db } = buildBulkMutationDb({
      player: {
        ...BASE_PLAYER,
        phase: "play",
        turnsRemaining: 50,
        stats: { unitsAlive: 999_990, tilesHeld: 50 },
      },
      tiles: [{ id: "mil-1", data: mil1 }],
      ownedTileDocs: [{ id: "mil-1", data: mil1 }, ...foodDocs],
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      bulkBuildUnitsServer("u1", [{ tileId: "mil-1", unitType: "ground", cycles: 1 }]),
    ).rejects.toBeInstanceOf(GameUnitCapExceededError);
  });

  it("rejects an empty plan", async () => {
    mockGetAdminDb.mockReturnValue(makeFakeDb().db);
    await expect(bulkBuildUnitsServer("u1", [])).rejects.toThrow("plan must not be empty");
  });

  it("rejects zero total cycles", async () => {
    mockGetAdminDb.mockReturnValue(makeFakeDb().db);
    await expect(
      bulkBuildUnitsServer("u1", [{ tileId: "mil-1", unitType: "ground", cycles: 0 }]),
    ).rejects.toThrow("total cycles must be > 0");
  });

  it("rejects more than 100 cycles per call", async () => {
    mockGetAdminDb.mockReturnValue(makeFakeDb().db);
    await expect(
      bulkBuildUnitsServer("u1", [{ tileId: "mil-1", unitType: "ground", cycles: 101 }]),
    ).rejects.toThrow("at most 100 cycles");
  });

  it("rejects invalid unit types in the plan", async () => {
    mockGetAdminDb.mockReturnValue(makeFakeDb().db);
    await expect(
      bulkBuildUnitsServer("u1", [
        { tileId: "mil-1", unitType: "cavalry" as "ground", cycles: 1 },
      ]),
    ).rejects.toThrow("invalid unit type");
  });
});

describe("castProductionSpellServer all spell IDs (wave 14)", () => {
  it.each(PRODUCTION_SPELLS.map((s) => [s.id, s.caste] as const))(
    "casts production spell %s for caste %s",
    async (spellId, caste) => {
      const { db, tx } = buildGameMutationDb({
        player: {
          exists: true,
          data: {
            ...BASE_PLAYER,
            caste,
            phase: "play",
            turnsRemaining: 50,
            stats: { ...BASE_PLAYER.stats, tilesHeld: 25_000 },
            productionSpellsActive: [],
          },
        },
      });
      mockGetAdminDb.mockReturnValue(db);
      const result = await castProductionSpellServer("u1", spellId);
      expect(result.player.productionSpellsActive.some((a) => a.spellId === spellId)).toBe(
        true,
      );
      expect(tx.update).toHaveBeenCalled();
    },
  );

  it("prunes expired production spells before appending a new one", async () => {
    const { db } = buildGameMutationDb({
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          caste: "red",
          phase: "play",
          turnsRemaining: 50,
          turnsSpentTotal: 100,
          stats: { ...BASE_PLAYER.stats, tilesHeld: 25_000 },
          productionSpellsActive: [
            { spellId: "red-production-forge-boon", expiresAtTurn: 50 },
            { spellId: "red-production-bellows-rite-t2", expiresAtTurn: 200 },
          ],
        },
      },
    });
    mockGetAdminDb.mockReturnValue(db);
    const result = await castProductionSpellServer("u1", "red-production-forge-boon");
    const ids = result.player.productionSpellsActive.map((a) => a.spellId);
    expect(ids.filter((id) => id === "red-production-forge-boon")).toHaveLength(1);
    expect(ids).toContain("red-production-bellows-rite-t2");
  });

  it("throws GameInvalidSpellError for unknown production spell ids", async () => {
    const { db } = buildGameMutationDb({ player: { exists: true, data: BASE_PLAYER } });
    mockGetAdminDb.mockReturnValue(db);
    await expect(castProductionSpellServer("u1", "nope-production")).rejects.toBeInstanceOf(
      GameInvalidSpellError,
    );
  });

  it("throws GameInvalidSpellError when casting a non-production spell", async () => {
    const { db } = buildGameMutationDb({ player: { exists: true, data: BASE_PLAYER } });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      castProductionSpellServer("u1", "red-siege-firebreath"),
    ).rejects.toBeInstanceOf(GameInvalidSpellError);
  });
});

describe("castSpellServer all cast-able spell IDs (wave 14)", () => {
  it.each(CAST_SPELLS.map((s) => [s.id, s.type, s.caste] as const))(
    "casts %s (%s) for caste %s",
    async (spellId, spellType, caste) => {
      const { db } = combatDbForCaste(caste);
      mockGetAdminDb.mockReturnValue(db as never);
      const tiles = makeAdjacentCombatTiles();
      const result = await castSpellServer({
        attackerId: "u1",
        spellId,
        sourceTileId: tiles.sourceTileId,
        targetTileId: tiles.targetTileId,
      });
      if (spellType === "siege") {
        expect(result.siege).toBeDefined();
        expect(recordSiegeDebuffInTx).toHaveBeenCalled();
      } else if (spellType === "disarm") {
        expect(result.disarm).toBeDefined();
        expect(recordDefenseDisarmInTx).toHaveBeenCalled();
      } else {
        expect(result.attrition).toBeDefined();
      }
    },
  );

  it("throws GameInvalidSpellError for unknown spell ids", async () => {
    const { db } = combatDbForCaste("red");
    mockGetAdminDb.mockReturnValue(db as never);
    const tiles = makeAdjacentCombatTiles();
    await expect(
      castSpellServer({
        attackerId: "u1",
        spellId: "missing-spell",
        sourceTileId: tiles.sourceTileId,
        targetTileId: tiles.targetTileId,
      }),
    ).rejects.toBeInstanceOf(GameInvalidSpellError);
  });

  it("throws GameShieldedError when the defender is shielded", async () => {
    const tiles = makeAdjacentCombatTiles();
    const { db } = buildCombatMutationDb({
      attacker: BASE_ATTACKER,
      defender: {
        ...BASE_DEFENDER,
        shieldUntil: new Date(Date.now() + 86_400_000),
        shieldDropAtTurn: 999,
      },
      source: tiles.source,
      target: tiles.target,
      sourceTileId: tiles.sourceTileId,
      targetTileId: tiles.targetTileId,
    });
    mockGetAdminDb.mockReturnValue(db as never);
    await expect(
      castSpellServer({
        attackerId: "u1",
        spellId: "red-siege-firebreath",
        sourceTileId: tiles.sourceTileId,
        targetTileId: tiles.targetTileId,
      }),
    ).rejects.toBeInstanceOf(GameShieldedError);
  });

  it("throws GameNotAdjacentError when source cannot reach target", async () => {
    const tiles = makeAdjacentCombatTiles();
    const { db } = buildCombatMutationDb({
      attacker: BASE_ATTACKER,
      defender: BASE_DEFENDER,
      source: { ...tiles.source, neighborTileIds: [] },
      target: tiles.target,
      sourceTileId: tiles.sourceTileId,
      targetTileId: tiles.targetTileId,
    });
    mockGetAdminDb.mockReturnValue(db as never);
    await expect(
      castSpellServer({
        attackerId: "u1",
        spellId: "red-attrition-emberswarm",
        sourceTileId: tiles.sourceTileId,
        targetTileId: tiles.targetTileId,
      }),
    ).rejects.toBeInstanceOf(GameNotAdjacentError);
  });
});

describe("attackTileServer pacts, offense, dispatch (wave 14)", () => {
  async function attackUntilCaptured(
    setup: () => Partial<Parameters<typeof buildCombatMutationDb>[0]>,
    extra?: Partial<Parameters<typeof attackTileServer>[0]>,
  ) {
    const tiles = makeAdjacentCombatTiles();
    const uuidSpy = jest.spyOn(crypto, "randomUUID");
    try {
      for (let i = 0; i < 250; i++) {
        uuidSpy.mockReturnValue(
          `00000000-0000-4000-8000-${String(i).padStart(12, "0")}` as crypto.UUID,
        );
        const { db } = buildCombatMutationDb({
          attacker: BASE_ATTACKER,
          defender: BASE_DEFENDER,
          source: tiles.source,
          target: { ...tiles.target, units: { ground: 1, air: 0, siege: 0 } },
          sourceTileId: tiles.sourceTileId,
          targetTileId: tiles.targetTileId,
          ownedTileDocs: [{ id: tiles.sourceTileId, data: tiles.source }],
          ...setup(),
        });
        mockGetAdminDb.mockReturnValue(db as never);
        const result = await attackTileServer({
          attackerId: "u1",
          sourceTileId: tiles.sourceTileId,
          targetTileId: tiles.targetTileId,
          units: { ground: 50, air: 0, siege: 0 },
          offenseSpellId: null,
          ...extra,
        });
        if (result.combat.outcome === "captured") return result;
      }
      throw new Error("no capture within 250 seeds");
    } finally {
      uuidSpy.mockRestore();
    }
  }

  it("charges extra turns when an offense spell is used with a pact breach", async () => {
    mockFindPacts.mockResolvedValue([{ id: "pact-w14" } as never]);
    const result = await attackUntilCaptured(
      () => ({}),
      { offenseSpellId: "red-offense-inferno" },
    );
    expect(result.attack.offenseSpellId).toBe("red-offense-inferno");
    expect(result.attackerPlayer.turnsRemaining).toBeLessThan(BASE_ATTACKER.turnsRemaining);
  });

  it("sanitizes and stores dispatch text on the attack record", async () => {
    const result = await attackUntilCaptured(() => ({}), {
      dispatch: "  Hold the line!\t",
    });
    expect(result.attack.dispatch).toBe("Hold the line!");
  });

  it("throws GameInvalidSpellError for a non-offense spell id", async () => {
    const tiles = makeAdjacentCombatTiles();
    const { db } = buildCombatMutationDb({
      attacker: BASE_ATTACKER,
      defender: BASE_DEFENDER,
      source: tiles.source,
      target: tiles.target,
      sourceTileId: tiles.sourceTileId,
      targetTileId: tiles.targetTileId,
    });
    mockGetAdminDb.mockReturnValue(db as never);
    await expect(
      attackTileServer({
        attackerId: "u1",
        sourceTileId: tiles.sourceTileId,
        targetTileId: tiles.targetTileId,
        units: { ground: 10, air: 0, siege: 0 },
        offenseSpellId: "red-siege-firebreath",
      }),
    ).rejects.toBeInstanceOf(GameInvalidSpellError);
  });

  it("throws GameSelfAttackError when the target tile is unowned on pre-read", async () => {
    const tiles = makeAdjacentCombatTiles();
    const { db } = buildCombatMutationDb({
      attacker: BASE_ATTACKER,
      defender: BASE_DEFENDER,
      source: tiles.source,
      target: tiles.target,
      sourceTileId: tiles.sourceTileId,
      targetTileId: tiles.targetTileId,
    });
    const targetDoc = db.collection("game_tiles").doc(tiles.targetTileId) as {
      get: jest.Mock;
    };
    targetDoc.get = jest.fn().mockResolvedValue({
      exists: true,
      data: () => ({ ...tiles.target, ownerId: null }),
      id: tiles.targetTileId,
    });
    mockGetAdminDb.mockReturnValue(db as never);
    await expect(
      attackTileServer({
        attackerId: "u1",
        sourceTileId: tiles.sourceTileId,
        targetTileId: tiles.targetTileId,
        units: { ground: 5, air: 0, siege: 0 },
        offenseSpellId: null,
      }),
    ).rejects.toBeInstanceOf(GameSelfAttackError);
  });

  it("rejects zero-unit attacks before opening a transaction", async () => {
    const tiles = makeAdjacentCombatTiles();
    const { db } = buildCombatMutationDb({
      attacker: BASE_ATTACKER,
      defender: BASE_DEFENDER,
      source: tiles.source,
      target: tiles.target,
      sourceTileId: tiles.sourceTileId,
      targetTileId: tiles.targetTileId,
    });
    mockGetAdminDb.mockReturnValue(db as never);
    await expect(
      attackTileServer({
        attackerId: "u1",
        sourceTileId: tiles.sourceTileId,
        targetTileId: tiles.targetTileId,
        units: { ground: 0, air: 0, siege: 0 },
        offenseSpellId: null,
      }),
    ).rejects.toThrow("Must send at least 1 unit");
  });

  it("throws GameInsufficientTurnsError when offense spell cost exceeds remaining turns", async () => {
    const tiles = makeAdjacentCombatTiles();
    const { db } = buildCombatMutationDb({
      attacker: { ...BASE_ATTACKER, turnsRemaining: 0 },
      defender: BASE_DEFENDER,
      source: tiles.source,
      target: tiles.target,
      sourceTileId: tiles.sourceTileId,
      targetTileId: tiles.targetTileId,
    });
    mockGetAdminDb.mockReturnValue(db as never);
    await expect(
      attackTileServer({
        attackerId: "u1",
        sourceTileId: tiles.sourceTileId,
        targetTileId: tiles.targetTileId,
        units: { ground: 5, air: 0, siege: 0 },
        offenseSpellId: "red-offense-inferno",
      }),
    ).rejects.toBeInstanceOf(GameInsufficientTurnsError);
  });
});
