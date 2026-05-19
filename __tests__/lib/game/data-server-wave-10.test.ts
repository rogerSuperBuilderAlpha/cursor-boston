/**
 * @jest-environment node
 *
 * Wave 10 — explore completion, siege errors, build hero emergence,
 * production spell validation, spawn, arm defense, intel artifact, getTile.
 */
jest.mock("@/lib/firebase-admin", () => ({ getAdminDb: jest.fn() }));

jest.mock("@/lib/game/world-gen", () => {
  const actual = jest.requireActual<typeof import("@/lib/game/world-gen")>(
    "@/lib/game/world-gen",
  );
  return {
    ...actual,
    makeSeededRng: jest.fn(() => () => 0),
  };
});

jest.mock("@/lib/game/turn-report", () => ({
  buildArmDefenseReport: jest.fn(() => ({ kind: "arm" })),
  buildBuildReport: jest.fn(() => ({ kind: "build" })),
  buildExploreReport: jest.fn(() => ({ kind: "explore" })),
  buildProduceReport: jest.fn(() => ({ kind: "produce" })),
  buildSiegeReport: jest.fn(() => ({ kind: "siege" })),
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
  recordSiegeDebuffInTx: jest.fn(),
}));
jest.mock("@/lib/game/intel", () => ({
  buildIntelReportServer: jest.fn().mockResolvedValue({
    id: "ir-wave10",
    targetTileId: "1_0",
    scope: "tile",
    capturedAtTurn: 4,
    lines: [],
  }),
}));
jest.mock("@/lib/game/hero-registry", () => ({
  appendHeroEventInTx: jest.fn(),
  upsertHeroInTx: jest.fn(),
  heroEvent: {
    emerged: jest.fn(() => ({})),
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

import { getAdminDb } from "@/lib/firebase-admin";
import { maybeEmergeHero } from "@/lib/game/heroes";
import { upsertHeroInTx } from "@/lib/game/hero-registry";
import {
  armDefenseSpellServer,
  buildUnitsServer,
  castProductionSpellServer,
  createPlayerWithSpawnServer,
  exploreNextTileServer,
  GameInsufficientTurnsError,
  GameInvalidSpellError,
  GameNotAdjacentError,
  GameSelfAttackError,
  GameShieldedError,
  getTileServer,
  NEW_PLAYER_TILE_COUNT,
  siegeTileServer,
  spendArtifactServer,
} from "@/lib/game/data-server";
import {
  makeChain,
  makeDoc,
  makeDocRef,
  makeQuerySnap,
} from "@/__tests__/_helpers/firebase-admin-mock";
import {
  BASE_ATTACKER,
  BASE_DEFENDER,
  BASE_PLAYER,
  BASE_TILE,
  buildCombatMutationDb,
  buildGameMutationDb,
  makeAdjacentCombatTiles,
} from "@/__tests__/_helpers/game-mutation-db";

const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockMaybeEmergeHero = maybeEmergeHero as jest.MockedFunction<typeof maybeEmergeHero>;

function foodLandDocs(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `f${i}`,
    data: {
      ...BASE_TILE,
      tileId: `f${i}`,
      type: "food" as const,
      units: { ground: 0, air: 0, siege: 0 },
    },
  }));
}

function buildGetTileDb(opts: {
  tile?: Record<string, unknown> | null;
  player?: Record<string, unknown> | null;
}) {
  const tileSnap =
    opts.tile === null
      ? makeDoc("missing", undefined)
      : makeDoc("t1", opts.tile ?? { tileId: "t1", q: 0, r: 0, type: "military" });

  const tilesCollection = {
    doc: jest.fn(() =>
      makeDocRef("t1", {
        get: jest.fn().mockResolvedValue(tileSnap),
      }),
    ),
  };

  const playersCollection = {
    doc: jest.fn(() =>
      makeDocRef("u1", {
        get: jest.fn().mockResolvedValue(
          opts.player
            ? makeDoc("u1", opts.player)
            : makeDoc("u1", undefined),
        ),
      }),
    ),
  };

  mockGetAdminDb.mockReturnValue({
    collection: jest.fn((name: string) => {
      if (name === "game_tiles") return tilesCollection;
      if (name === "game_players") return playersCollection;
      throw new Error(`unexpected collection: ${name}`);
    }),
  });
}

function buildCreatePlayerSpawnDb(userId = "spawn-wave10") {
  const cachedTileRefs = new Map<string, { id: string; __tile: true }>();
  function tileDocRef(tileId: string) {
    if (!cachedTileRefs.has(tileId)) {
      cachedTileRefs.set(tileId, { __tile: true, id: tileId });
    }
    return cachedTileRefs.get(tileId)!;
  }
  const playerRef = { id: userId, __player: true as const };
  const metaRef = { id: "singleton", __meta: true as const };

  const nameTakenChain = makeChain({ docs: [] });

  const tx = {
    get: jest.fn((ref: { id?: string; __player?: boolean; __meta?: boolean; __tile?: boolean }) => {
      if (ref.__player && ref.id === userId) {
        return Promise.resolve({ exists: false, id: userId, data: () => undefined });
      }
      if (ref.__meta) {
        return Promise.resolve({
          exists: true,
          id: "singleton",
          data: () => ({ playerCount: 0 }),
        });
      }
      if (ref.__tile) {
        return Promise.resolve({ exists: false, id: ref.id!, data: () => undefined });
      }
      return Promise.resolve({ exists: false, id: "", data: () => undefined });
    }),
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  mockGetAdminDb.mockReturnValue({
    collection: jest.fn((name: string) => {
      if (name === "game_players") {
        return {
          doc: jest.fn(() => playerRef),
          where: jest.fn(() => nameTakenChain),
        };
      }
      if (name === "game_tiles") {
        return { doc: jest.fn((tid: string) => tileDocRef(tid)) };
      }
      if (name === "game_world_meta") {
        return { doc: jest.fn(() => metaRef) };
      }
      return { doc: jest.fn(), where: jest.fn() };
    }),
    runTransaction: jest.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
  });

  return { tx };
}

function shieldedPlayer(overrides: Record<string, unknown> = {}) {
  return {
    ...BASE_ATTACKER,
    shieldUntil: new Date(Date.now() + 86_400_000),
    shieldDropAtTurn: 999,
    turnsSpentTotal: 0,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockMaybeEmergeHero.mockReturnValue(null);
});

describe("exploreNextTileServer", () => {
  it("transitions to distribute when tilesExplored reaches 100", async () => {
    const { db, tx } = buildGameMutationDb({
      unrevealedDocs: [{ id: "t1", data: { ...BASE_TILE, type: "unrevealed" } }],
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          phase: "explore",
          turnsRemaining: 5,
          tilesExplored: 99,
          caste: "red",
        },
      },
      tile: { exists: true, data: { ...BASE_TILE, type: "unrevealed" } },
    });
    mockGetAdminDb.mockReturnValue(db);

    const result = await exploreNextTileServer("u1");
    expect(result.player.tilesExplored).toBe(100);
    expect(result.player.phase).toBe("distribute");
    expect(result.tile.type).toBe("unassigned");
    expect(result.report).toEqual({ kind: "explore" });
    expect(tx.update).toHaveBeenCalled();
  });
});

describe("siegeTileServer error paths", () => {
  it("throws GameNotAdjacentError when source is not a neighbor", async () => {
    const tiles = makeAdjacentCombatTiles();
    const { db } = buildCombatMutationDb({
      attacker: { ...BASE_ATTACKER, turnsRemaining: 20 },
      defender: BASE_DEFENDER,
      source: { ...tiles.source, neighborTileIds: [] },
      target: tiles.target,
      sourceTileId: tiles.sourceTileId,
      targetTileId: tiles.targetTileId,
    });
    mockGetAdminDb.mockReturnValue(db as never);

    await expect(
      siegeTileServer({
        attackerId: "u1",
        sourceTileId: tiles.sourceTileId,
        targetTileId: tiles.targetTileId,
      }),
    ).rejects.toBeInstanceOf(GameNotAdjacentError);
  });

  it("throws GameShieldedError when attacker is shielded", async () => {
    const tiles = makeAdjacentCombatTiles();
    const { db } = buildCombatMutationDb({
      attacker: shieldedPlayer({ turnsRemaining: 20 }),
      defender: BASE_DEFENDER,
      source: tiles.source,
      target: tiles.target,
      sourceTileId: tiles.sourceTileId,
      targetTileId: tiles.targetTileId,
    });
    mockGetAdminDb.mockReturnValue(db as never);

    await expect(
      siegeTileServer({
        attackerId: "u1",
        sourceTileId: tiles.sourceTileId,
        targetTileId: tiles.targetTileId,
      }),
    ).rejects.toBeInstanceOf(GameShieldedError);
  });

  it("throws GameShieldedError when defender is shielded", async () => {
    const tiles = makeAdjacentCombatTiles();
    const { db } = buildCombatMutationDb({
      attacker: { ...BASE_ATTACKER, turnsRemaining: 20 },
      defender: shieldedPlayer({ userId: "u2", caste: "blue" }),
      source: tiles.source,
      target: tiles.target,
      sourceTileId: tiles.sourceTileId,
      targetTileId: tiles.targetTileId,
    });
    mockGetAdminDb.mockReturnValue(db as never);

    await expect(
      siegeTileServer({
        attackerId: "u1",
        sourceTileId: tiles.sourceTileId,
        targetTileId: tiles.targetTileId,
      }),
    ).rejects.toBeInstanceOf(GameShieldedError);
  });

  it("throws GameInsufficientTurnsError when attacker lacks siege turns", async () => {
    const tiles = makeAdjacentCombatTiles();
    const { db } = buildCombatMutationDb({
      attacker: { ...BASE_ATTACKER, turnsRemaining: 2 },
      defender: BASE_DEFENDER,
      source: tiles.source,
      target: tiles.target,
      sourceTileId: tiles.sourceTileId,
      targetTileId: tiles.targetTileId,
    });
    mockGetAdminDb.mockReturnValue(db as never);

    await expect(
      siegeTileServer({
        attackerId: "u1",
        sourceTileId: tiles.sourceTileId,
        targetTileId: tiles.targetTileId,
      }),
    ).rejects.toBeInstanceOf(GameInsufficientTurnsError);
  });

  it("throws GameSelfAttackError when targeting own tile", async () => {
    const tiles = makeAdjacentCombatTiles({ targetOwnerId: "u1" });
    const { db } = buildCombatMutationDb({
      attacker: { ...BASE_ATTACKER, turnsRemaining: 20 },
      defender: { ...BASE_DEFENDER, userId: "u1" },
      source: tiles.source,
      target: { ...tiles.target, ownerId: "u1" },
      sourceTileId: tiles.sourceTileId,
      targetTileId: tiles.targetTileId,
    });
    mockGetAdminDb.mockReturnValue(db as never);

    await expect(
      siegeTileServer({
        attackerId: "u1",
        sourceTileId: tiles.sourceTileId,
        targetTileId: tiles.targetTileId,
      }),
    ).rejects.toBeInstanceOf(GameSelfAttackError);
  });
});

describe("buildUnitsServer farm hero emergence", () => {
  it("emerges a farm hero on food tile recruit when maybeEmergeHero returns one", async () => {
    const farmHero = {
      id: "hero-farm-wave10",
      ownerId: "u1",
      tileId: "t1",
      class: "farm" as const,
      specialty: "food" as const,
      name: "Harvest Knight",
      caste: "red" as const,
      stamina: 12,
      staminaMax: 20,
      emergedAtTurn: 6,
      lastEngagedAtTurn: 6,
    };
    mockMaybeEmergeHero.mockReturnValue(farmHero);

    const foodTile = {
      ...BASE_TILE,
      type: "food" as const,
      hero: null,
    };
    const { db, tx } = buildGameMutationDb({
      ownedTileDocs: [{ id: "t1", data: foodTile }, ...foodLandDocs(10)],
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          phase: "play",
          caste: "red",
          turnsRemaining: 10,
          stats: { unitsAlive: 0, tilesHeld: 100 },
        },
      },
      tile: { exists: true, data: foodTile },
    });
    mockGetAdminDb.mockReturnValue(db);

    const result = await buildUnitsServer("u1", "t1", "ground");
    expect(result.produced).toBeGreaterThan(0);
    expect(result.tile.hero).toEqual(farmHero);
    expect(upsertHeroInTx).toHaveBeenCalled();
    expect(tx.update).toHaveBeenCalled();
  });
});

describe("castProductionSpellServer validation", () => {
  it("throws GameInvalidSpellError for unknown spell ids", async () => {
    const { db } = buildGameMutationDb({
      player: { exists: true, data: { ...BASE_PLAYER, phase: "play", caste: "red" } },
    });
    mockGetAdminDb.mockReturnValue(db);

    await expect(
      castProductionSpellServer("u1", "not-a-real-production-spell"),
    ).rejects.toBeInstanceOf(GameInvalidSpellError);
  });

  it("throws GameInvalidSpellError when spell is not production type", async () => {
    const { db } = buildGameMutationDb({
      player: { exists: true, data: { ...BASE_PLAYER, phase: "play", caste: "red" } },
    });
    mockGetAdminDb.mockReturnValue(db);

    await expect(
      castProductionSpellServer("u1", "red-defense-fire-wall"),
    ).rejects.toBeInstanceOf(GameInvalidSpellError);
  });

  it("throws GameInvalidSpellError when player caste does not match spell", async () => {
    const { db } = buildGameMutationDb({
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          phase: "play",
          caste: "blue",
          stats: { ...BASE_PLAYER.stats, tilesHeld: 500 },
        },
      },
    });
    mockGetAdminDb.mockReturnValue(db);

    await expect(
      castProductionSpellServer("u1", "red-production-forge-boon"),
    ).rejects.toBeInstanceOf(GameInvalidSpellError);
  });
});

describe("createPlayerWithSpawnServer", () => {
  it("spawns explore-phase player with NEW_PLAYER_TILE_COUNT claimed tiles", async () => {
    const userId = "wave10-spawn-u1";
    const { tx } = buildCreatePlayerSpawnDb(userId);
    const fixedNow = new Date("2026-05-19T12:00:00.000Z");

    const { player, tileIds } = await createPlayerWithSpawnServer(
      userId,
      "WaveTenGeneral",
      fixedNow,
    );

    expect(player.userId).toBe(userId);
    expect(player.phase).toBe("explore");
    expect(tileIds).toHaveLength(NEW_PLAYER_TILE_COUNT);
    expect(tx.set.mock.calls.length).toBeGreaterThanOrEqual(NEW_PLAYER_TILE_COUNT + 2);
  });
});

describe("armDefenseSpellServer", () => {
  it("arms defense spell on owned military tile", async () => {
    const { db, tx } = buildGameMutationDb({
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          phase: "play",
          caste: "red",
          turnsRemaining: 10,
          stats: { ...BASE_PLAYER.stats, tilesHeld: 500 },
        },
      },
      tile: {
        exists: true,
        data: { ...BASE_TILE, type: "military", armedDefenseSpellId: null },
      },
    });
    mockGetAdminDb.mockReturnValue(db);

    const result = await armDefenseSpellServer("u1", "t1", "red-defense-fire-wall");
    expect(result.tile.armedDefenseSpellId).toBe("red-defense-fire-wall");
    expect(result.report).toEqual({ kind: "arm" });
    expect(tx.update).toHaveBeenCalled();
  });
});

describe("spendArtifactServer intel branch", () => {
  it("returns intel report after marking intel artifact used", async () => {
    const artifactRef = { __kind: "artifact" };
    const playerDoc = {
      get: jest.fn().mockResolvedValue(
        makeDoc("u1", { ...BASE_PLAYER, turnsSpentTotal: 7 }),
      ),
    };
    const db = {
      collection: jest.fn((name: string) => {
        if (name === "game_artifacts") {
          return { doc: jest.fn(() => artifactRef) };
        }
        if (name === "game_players") {
          return { doc: jest.fn(() => playerDoc) };
        }
        return { doc: jest.fn() };
      }),
      runTransaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          get: jest.fn((ref: { __kind?: string }) => {
            if (ref.__kind === "artifact") {
              return Promise.resolve({
                exists: true,
                data: () => ({
                  id: "art-wave10-intel",
                  ownerId: "u1",
                  used: false,
                  definitionId: "common-whispered-map",
                  foundAtTurn: 5,
                }),
              });
            }
            return Promise.resolve({ exists: false, data: () => undefined });
          }),
          update: jest.fn(),
        };
        return cb(tx);
      }),
    };
    mockGetAdminDb.mockReturnValue(db);

    const out = await spendArtifactServer({
      userId: "u1",
      artifactId: "art-wave10-intel",
      targetTileId: "1_0",
    });
    expect(out.artifact.used).toBe(true);
    expect(out.intelReport?.id).toBe("ir-wave10");
  });
});

describe("getTileServer", () => {
  it("returns null when tile doc is missing", async () => {
    buildGetTileDb({ tile: null });
    expect(await getTileServer("missing")).toBeNull();
  });

  it("returns owned tile after lazy-regen when player exists", async () => {
    buildGetTileDb({
      tile: {
        tileId: "t1",
        q: 0,
        r: 0,
        type: "military",
        ownerId: "u1",
        units: { ground: 5, air: 0, siege: 0 },
        baseUnits: { ground: 0, siege: 0, air: 0 },
        baseRegenedAt: new Date(),
      },
      player: {
        userId: "u1",
        caste: "red",
        turnsSpentTotal: 10,
        activeUpgrades: {},
        productionSpellsActive: [],
      },
    });

    const out = await getTileServer("t1");
    expect(out?.tileId).toBe("t1");
    expect(out?.ownerId).toBe("u1");
  });
});
