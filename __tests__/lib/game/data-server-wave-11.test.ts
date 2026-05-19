/**
 * @jest-environment node
 *
 * Wave 11 — remaining data-server branches: bulk distribute, intel, preview,
 * far expedition, weekly rollover, upgrades, caste, armageddon, admin grant,
 * inscription, bulk frontier explore.
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

jest.mock("@/lib/game/content/armageddon", () => {
  const actual = jest.requireActual<typeof import("@/lib/game/content/armageddon")>(
    "@/lib/game/content/armageddon",
  );
  return {
    ...actual,
    computeArmageddonSuccessChanceFromMultiplier: jest.fn(() => 0.5),
  };
});

jest.mock("@/lib/game/prophecies", () => ({
  resolveProphesiesForSealInTx: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/game/turn-report", () => ({
  buildAttackReport: jest.fn(() => ({ kind: "attack" })),
  buildDistributeReport: jest.fn(() => ({ kind: "distribute" })),
  buildExploreReport: jest.fn(() => ({
    action: "explore",
    narrative: ["explored"],
    outcome: {},
  })),
  buildProduceReport: jest.fn(() => ({ kind: "intel" })),
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
  recordIntelEffectInTx: jest.fn(),
}));
jest.mock("@/lib/game/intel", () => ({
  buildIntelReportServer: jest.fn().mockResolvedValue({
    id: "ir-wave11",
    targetTileId: "1_0",
    scope: "weak-face",
    capturedAtTurn: 4,
    lines: [],
  }),
}));
jest.mock("@/lib/game/heroes", () => {
  const actual = jest.requireActual<typeof import("@/lib/game/heroes")>("@/lib/game/heroes");
  return { ...actual, maybeEmergeHero: jest.fn(() => null) };
});
jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), logError: jest.fn() },
}));

import { getAdminDb } from "@/lib/firebase-admin";
import { computeArmageddonSuccessChanceFromMultiplier } from "@/lib/game/content/armageddon";
import {
  adminGrantUnitsServer,
  applyUpgradeServer,
  attackPreviewServer,
  bulkDistributeTilesServer,
  bulkFrontierExploreServer,
  castArmageddonServer,
  castIntelSpellServer,
  changeCasteServer,
  farExpeditionExploreServer,
  GameCasteChangeUnavailableError,
  GameInsufficientTurnsError,
  GameInvalidLandTypeError,
  GamePlayerNotFoundError,
  GameSelfAttackError,
  removeUpgradeServer,
  runWeeklyRolloverServer,
  setTileInscriptionServer,
} from "@/lib/game/data-server";
import { SEAL_COUNT } from "@/lib/game/content/armageddon";
import { makeChain, makeDoc } from "@/__tests__/_helpers/firebase-admin-mock";
import {
  BASE_ATTACKER,
  BASE_DEFENDER,
  BASE_PLAYER,
  BASE_TILE,
  buildCombatMutationDb,
  buildGameMutationDb,
  makeAdjacentCombatTiles,
} from "@/__tests__/_helpers/game-mutation-db";
import { neighborTileIds } from "@/lib/game/world-gen";

const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockArmaChance = computeArmageddonSuccessChanceFromMultiplier as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockArmaChance.mockReturnValue(0.5);
});

function buildBulkDistributeDb(opts: {
  player: Record<string, unknown>;
  tiles: Array<Record<string, unknown>>;
}) {
  const playerSnap = { exists: true, data: () => opts.player };
  const tileSnaps = opts.tiles.map((t) => ({
    exists: true,
    data: () => t,
  }));
  const playerRef = { __kind: "player" };
  const tileIds = opts.tiles.map(
    (t, i) => (typeof t.tileId === "string" ? t.tileId : `t${i}`),
  );
  const tileRefs = tileIds.map((id) => ({ __kind: "tile" as const, id }));

  const db = {
    collection: jest.fn((name: string) => {
      if (name === "game_players") {
        return { doc: jest.fn(() => playerRef) };
      }
      if (name === "game_tiles") {
        return {
          doc: jest.fn((id: string) => {
            const ref = tileRefs.find((r) => r.id === id);
            return ref ?? tileRefs[0];
          }),
        };
      }
      return { doc: jest.fn() };
    }),
    runTransaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        getAll: jest.fn().mockResolvedValue([playerSnap, ...tileSnaps]),
        update: jest.fn(),
        set: jest.fn(),
      };
      return cb(tx);
    }),
  };
  return { db };
}

function buildFarExpeditionDb() {
  const playerData = {
    ...BASE_PLAYER,
    userId: "u1",
    phase: "play",
    caste: "red",
    turnsRemaining: 20,
    turnsSpentTotal: 10,
    stats: { ...BASE_PLAYER.stats, tilesHeld: 5 },
    tilesExplored: 3,
  };
  const enemyPlayer = {
    userId: "u2",
    phase: "play",
    stats: { tilesHeld: 50, unitsAlive: 0 },
  };
  const ownedTile = {
    tileId: "0_0",
    q: 0,
    r: 0,
    ownerId: "u1",
    type: "military",
    units: { ground: 1, air: 0, siege: 0 },
  };
  const enemyTile = {
    tileId: "1_0",
    q: 1,
    r: 0,
    ownerId: "u2",
    type: "military",
    units: { ground: 2, air: 0, siege: 0 },
  };
  const existingTiles = new Map<string, Record<string, unknown>>([
    ["0_0", ownedTile],
    ["1_0", enemyTile],
  ]);

  const playerRef = { __kind: "player" as const, id: "u1" };
  const tileDoc = (id: string) => ({ __tileId: id });

  const db = {
    collection: jest.fn((name: string) => {
      if (name === "game_players") {
        return {
          doc: jest.fn((id: string) => ({
            get: jest.fn().mockResolvedValue(
              makeDoc(id, id === "u1" ? playerData : undefined),
            ),
          })),
          where: jest.fn((field: string) => {
            if (field === "phase") {
              return {
                get: jest.fn().mockResolvedValue({
                  docs: [
                    makeDoc("u1", playerData),
                    makeDoc("u2", enemyPlayer),
                  ],
                }),
              };
            }
            return { get: jest.fn().mockResolvedValue({ docs: [] }) };
          }),
        };
      }
      if (name === "game_tiles") {
        return {
          doc: jest.fn((id: string) => tileDoc(id)),
          where: jest.fn((_f: string, _op: string, value: string) => {
            if (value === "u1") {
              return {
                get: jest.fn().mockResolvedValue({
                  docs: [makeDoc("0_0", ownedTile)],
                }),
              };
            }
            if (value === "u2") {
              return {
                limit: jest.fn().mockReturnValue({
                  get: jest.fn().mockResolvedValue({
                    docs: [makeDoc("1_0", enemyTile)],
                  }),
                }),
              };
            }
            return { get: jest.fn().mockResolvedValue({ docs: [] }) };
          }),
        };
      }
      return { doc: jest.fn() };
    }),
    getAll: jest.fn(async (...refs: Array<{ __tileId?: string }>) =>
      refs.map((ref) => {
        const id = ref.__tileId ?? "";
        const data = existingTiles.get(id);
        return makeDoc(id, data);
      }),
    ),
    runTransaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        get: jest.fn(async (ref: { __tileId?: string }) => {
          if (ref?.__tileId) {
            const id = ref.__tileId;
            return makeDoc(id, existingTiles.get(id));
          }
          return makeDoc("u1", playerData);
        }),
        set: jest.fn(),
        update: jest.fn(),
      };
      return cb(tx);
    }),
  };

  return { db, existingTiles, playerData };
}

function buildWeeklyRolloverDb(opts: { hasPr: boolean; players?: Array<Record<string, unknown>> }) {
  const defaultPlayer = {
    ...BASE_PLAYER,
    userId: "u1",
    turnsRemaining: 2,
    lastWeeklyGrantWeekStart: undefined,
  };
  const players = opts.players ?? [defaultPlayer];
  const prChain = {
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnValue({
      get: jest.fn().mockResolvedValue(
        opts.hasPr
          ? { empty: false, docs: [makeDoc("pr1", {})] }
          : { empty: true, docs: [] },
      ),
    }),
  };
  return {
    collection: jest.fn((name: string) => {
      if (name === "game_players") {
        return {
          get: jest.fn().mockResolvedValue({
            size: players.length,
            docs: players.map((p, i) =>
              makeDoc((p.userId as string) ?? `u${i + 1}`, p),
            ),
          }),
          doc: jest.fn(() => ({})),
        };
      }
      if (name === "pullRequests") return prChain;
      return { doc: jest.fn() };
    }),
    runTransaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        get: jest.fn().mockResolvedValue(makeDoc("u1", players[0])),
        update: jest.fn(),
      };
      return cb(tx);
    }),
  };
}

function buildBulkFrontierSecondExploreDb() {
  const userId = "u1";
  const playerPre = {
    userId,
    phase: "play" as const,
    turnsRemaining: 5,
    turnsSpentTotal: 101,
    tilesExplored: 40,
    caste: "white" as const,
    stats: {
      tilesHeld: 220,
      unitsAlive: 1,
      attacksWon: 0,
      attacksLost: 0,
    },
    activeUpgrades: {},
    productionSpellsActive: [],
  };

  const playerDocRef = {
    id: userId,
    get: jest.fn().mockResolvedValue({
      exists: true,
      data: () => playerPre,
    }),
  };

  const ownedChain = makeChain({
    docs: [
      makeDoc("10_15", {
        tileId: "10_15",
        q: 10,
        r: 15,
        ownerId: userId,
        type: "food",
      }),
    ],
  });

  const tilesDocById = new Map<string, { id: string }>();
  let getAllCall = 0;

  const tx = {
    getAll: jest.fn((...refs: Array<{ id: string }>) => {
      getAllCall += 1;
      return Promise.resolve(
        refs.map((ref, idx) => {
          if (idx === 0) {
            return {
              exists: true,
              id: userId,
              data: () => ({ ...playerPre }),
            };
          }
          if (idx === 1) {
            return {
              exists: true,
              id: ref.id,
              data: () => ({}),
            };
          }
          return {
            exists: false,
            id: ref.id,
            data: () => undefined,
          };
        }),
      );
    }),
    set: jest.fn(),
    update: jest.fn(),
    get: jest.fn(),
  };

  const db = {
    collection: jest.fn((name: string) => {
      if (name === "game_players") {
        return {
          doc: jest.fn(() => playerDocRef),
          where: jest.fn(),
        };
      }
      if (name === "game_tiles") {
        return {
          doc: jest.fn((id: string) => {
            if (!tilesDocById.has(id)) tilesDocById.set(id, { id });
            return tilesDocById.get(id)!;
          }),
          where: jest.fn(() => ownedChain),
        };
      }
      return { doc: jest.fn(), where: jest.fn() };
    }),
    getAll: jest.fn((...refs: Array<{ id: string }>) =>
      Promise.resolve(
        refs.map((r) => ({
          exists: false,
          id: r.id,
          data: () => undefined,
        })),
      ),
    ),
    runTransaction: jest.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
  };

  return { db, tx, getAllCall };
}

function buildArmageddonDb(opts: {
  sealsBrokenBefore: number;
  turnsRemaining: number;
}) {
  const userId = "arma-wave11";
  const playerRef = { id: userId, __p: true as const };
  const worldRef = { id: "singleton", __w: true as const };

  const landsChain = makeChain({
    docs: [
      makeDoc("m1", {
        tileId: "m1",
        ownerId: userId,
        type: "magic",
      }),
    ],
  });
  landsChain.where = jest.fn(() => landsChain);

  const playerTxn = {
    userId,
    displayName: "Breaker",
    caste: "red" as const,
    phase: "play" as const,
    turnsRemaining: opts.turnsRemaining,
    turnsSpentTotal: 50,
    seasonNumber: 1,
    stats: {
      tilesHeld: 10_050,
      unitsAlive: 1,
    },
    activeUpgrades: {},
    armageddonCastsAttempted: 0,
    armageddonSealsBroken: 0,
    productionSpellsActive: [],
  };

  const tx = {
    get: jest.fn((ref: { __p?: boolean; __w?: boolean }) => {
      if (ref.__p) {
        return Promise.resolve({
          exists: true,
          id: userId,
          data: () => playerTxn,
        });
      }
      if (ref.__w) {
        return Promise.resolve({
          exists: true,
          id: "singleton",
          data: () => ({
            playerCount: 2,
            seasonNumber: 1,
            sealsBroken: opts.sealsBrokenBefore,
            seals: [],
            armageddonState: "active",
          }),
        });
      }
      return Promise.resolve({ exists: false, id: "", data: () => undefined });
    }),
    update: jest.fn(),
    set: jest.fn(),
  };

  const db = {
    collection: jest.fn((name: string) => {
      if (name === "game_players") {
        return {
          doc: jest.fn(() => playerRef),
          where: jest.fn(),
        };
      }
      if (name === "game_world_meta") {
        return { doc: jest.fn(() => worldRef) };
      }
      if (name === "game_tiles") {
        return {
          doc: jest.fn(),
          where: jest.fn((_f: string, _op: string, uid: unknown) => {
            if (uid === userId) return landsChain;
            return makeChain({ docs: [] });
          }),
        };
      }
      return { doc: jest.fn(), where: jest.fn() };
    }),
    runTransaction: jest.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
  };

  return { db, tx, userId };
}

describe("bulkDistributeTilesServer (wave 11)", () => {
  it("distributes one tile on success", async () => {
    const tile = { ...BASE_TILE, type: "unassigned" as const };
    const { db } = buildBulkDistributeDb({
      player: { ...BASE_PLAYER, phase: "play", turnsRemaining: 5 },
      tiles: [tile],
    });
    mockGetAdminDb.mockReturnValue(db);
    const result = await bulkDistributeTilesServer("u1", ["t1"], "food");
    expect(result.tiles).toHaveLength(1);
    expect(result.tiles[0].type).toBe("food");
    expect(result.player.turnsRemaining).toBe(4);
  });

  it("throws GameInvalidLandTypeError for bad types", async () => {
    const { db } = buildBulkDistributeDb({ player: BASE_PLAYER, tiles: [] });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      bulkDistributeTilesServer("u1", ["t1"], "unrevealed" as never),
    ).rejects.toBeInstanceOf(GameInvalidLandTypeError);
  });

  it("throws when tileIds is empty", async () => {
    const { db } = buildBulkDistributeDb({ player: BASE_PLAYER, tiles: [] });
    mockGetAdminDb.mockReturnValue(db);
    await expect(bulkDistributeTilesServer("u1", [], "food")).rejects.toThrow(
      "must not be empty",
    );
  });

  it("throws GamePlayerNotFoundError when player missing", async () => {
    const db = {
      collection: jest.fn(() => ({ doc: jest.fn(() => ({})) })),
      runTransaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          getAll: jest.fn().mockResolvedValue([
            { exists: false, data: () => undefined },
            { exists: true, data: () => BASE_TILE },
          ]),
          update: jest.fn(),
        };
        return cb(tx);
      }),
    };
    mockGetAdminDb.mockReturnValue(db);
    await expect(bulkDistributeTilesServer("u1", ["t1"], "food")).rejects.toBeInstanceOf(
      GamePlayerNotFoundError,
    );
  });
});

describe("castIntelSpellServer (wave 11)", () => {
  it("casts intel spell when eligible", async () => {
    const { db, tx } = buildGameMutationDb({
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          phase: "play",
          caste: "red",
          turnsRemaining: 10,
          stats: { ...BASE_PLAYER.stats, tilesHeld: 2000 },
        },
      },
      tile: {
        exists: true,
        data: { ...BASE_TILE, type: "magic", ownerId: "u2" },
      },
    });
    mockGetAdminDb.mockReturnValue(db);
    const result = await castIntelSpellServer(
      "u1",
      "red-intel-forge-sight-t2",
      "t1",
    );
    expect(result.report.action).toBe("spell-arm");
    expect(result.intelReport.id).toBe("ir-wave11");
    expect(tx.update).toHaveBeenCalled();
  });

  it("throws GameInsufficientTurnsError when out of turns", async () => {
    const { db } = buildGameMutationDb({
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          phase: "play",
          caste: "red",
          turnsRemaining: 0,
          stats: { ...BASE_PLAYER.stats, tilesHeld: 2000 },
        },
      },
      tile: {
        exists: true,
        data: { ...BASE_TILE, type: "magic", ownerId: "u2" },
      },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      castIntelSpellServer("u1", "red-intel-forge-sight-t2", "t1"),
    ).rejects.toBeInstanceOf(GameInsufficientTurnsError);
  });

  it("throws GameSelfAttackError on owned target tile", async () => {
    const { db } = buildGameMutationDb({
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          phase: "play",
          caste: "red",
          turnsRemaining: 10,
          stats: { ...BASE_PLAYER.stats, tilesHeld: 2000 },
        },
      },
      tile: { exists: true, data: BASE_TILE },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      castIntelSpellServer("u1", "red-intel-forge-sight-t2", "t1"),
    ).rejects.toBeInstanceOf(GameSelfAttackError);
  });
});

describe("attackPreviewServer (wave 11)", () => {
  function targetHero() {
    return {
      id: "hero-def",
      ownerId: "u2",
      tileId: "1_0",
      class: "military" as const,
      specialty: "ground" as const,
      name: "Defender Hero",
      caste: "blue" as const,
      stamina: 5,
      staminaMax: 20,
      emergedAtTurn: 1,
      lastEngagedAtTurn: 1,
    };
  }

  it("returns combat projection with offense spell and hero on target", async () => {
    const tiles = makeAdjacentCombatTiles({
      sourceUnits: { ground: 80, air: 0, siege: 0 },
      targetUnits: { ground: 10, air: 0, siege: 0 },
    });
    const { db } = buildCombatMutationDb({
      attacker: BASE_ATTACKER,
      defender: BASE_DEFENDER,
      source: tiles.source,
      target: { ...tiles.target, hero: targetHero() },
      sourceTileId: tiles.sourceTileId,
      targetTileId: tiles.targetTileId,
      ownedTileDocs: [{ id: tiles.sourceTileId, data: tiles.source }],
    });
    mockGetAdminDb.mockReturnValue(db as never);

    const preview = await attackPreviewServer({
      attackerId: "u1",
      sourceTileId: tiles.sourceTileId,
      targetTileId: tiles.targetTileId,
      units: { ground: 50, air: 0, siege: 0 },
      offenseSpellId: "red-offense-inferno",
    });

    expect(preview.combat).toBeDefined();
    expect(preview.target.hero?.id).toBe("hero-def");
    expect(preview.defender.userId).toBe("u2");
    expect(preview.effects.siegeDebuffMagnitude).toBe(0);
  });

  it("returns combat projection without spell", async () => {
    const tiles = makeAdjacentCombatTiles();
    const { db } = buildCombatMutationDb({
      attacker: BASE_ATTACKER,
      defender: BASE_DEFENDER,
      source: tiles.source,
      target: tiles.target,
      sourceTileId: tiles.sourceTileId,
      targetTileId: tiles.targetTileId,
      ownedTileDocs: [{ id: tiles.sourceTileId, data: tiles.source }],
    });
    mockGetAdminDb.mockReturnValue(db as never);

    const preview = await attackPreviewServer({
      attackerId: "u1",
      sourceTileId: tiles.sourceTileId,
      targetTileId: tiles.targetTileId,
      units: { ground: 5, air: 0, siege: 0 },
      offenseSpellId: null,
    });

    expect(preview.combat).toBeDefined();
    expect(preview.source.ownerId).toBe("u1");
  });
});

describe("farExpeditionExploreServer (wave 11)", () => {
  it("claims a vacant neighbor beside an enemy tile", async () => {
    const { db, existingTiles } = buildFarExpeditionDb();
    mockGetAdminDb.mockReturnValue(db);

    const result = await farExpeditionExploreServer("u1");
    expect(result.player.turnsRemaining).toBeLessThan(20);
    expect(result.tile.ownerId).toBe("u1");
    expect(result.targetEnemyTileId).toBe("1_0");
    expect(neighborTileIds(1, 0)).toContain(result.tile.tileId);
    expect(existingTiles.has(result.tile.tileId)).toBe(false);
  });
});

describe("runWeeklyRolloverServer (wave 11)", () => {
  it("grants turns when merged PR exists in window", async () => {
    mockGetAdminDb.mockReturnValue(buildWeeklyRolloverDb({ hasPr: true }));
    const summary = await runWeeklyRolloverServer("2026-05-12T00:00:00.000Z");
    expect(summary.scanned).toBe(1);
    expect(summary.granted).toBeGreaterThanOrEqual(1);
    expect(summary.skippedNoPrs).toBe(0);
  });

  it("skips players with no merged PRs in window", async () => {
    mockGetAdminDb.mockReturnValue(buildWeeklyRolloverDb({ hasPr: false }));
    const summary = await runWeeklyRolloverServer("2026-05-12T00:00:00.000Z");
    expect(summary.skippedNoPrs).toBe(1);
    expect(summary.granted).toBe(0);
  });

  it("scans multiple mock players", async () => {
    const players = [
      { ...BASE_PLAYER, userId: "u1", lastWeeklyGrantWeekStart: undefined },
      { ...BASE_PLAYER, userId: "u2", lastWeeklyGrantWeekStart: undefined },
    ];
    mockGetAdminDb.mockReturnValue(
      buildWeeklyRolloverDb({ hasPr: true, players }),
    );
    const summary = await runWeeklyRolloverServer("2026-05-12T00:00:00.000Z");
    expect(summary.scanned).toBe(2);
  });
});

describe("applyUpgradeServer / removeUpgradeServer (wave 11)", () => {
  const upgradeId = "red-ground-marauder-upgrade-1";
  const targetId = "red-ground-marauder";

  it("applies a unit upgrade", async () => {
    const { db, tx } = buildGameMutationDb({
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          phase: "play",
          caste: "red",
          turnsRemaining: 10,
          activeUpgrades: {},
        },
      },
    });
    mockGetAdminDb.mockReturnValue(db);
    const { player } = await applyUpgradeServer({
      userId: "u1",
      targetId,
      upgradeId,
    });
    expect(player.activeUpgrades?.[targetId]).toBe(upgradeId);
    expect(tx.update).toHaveBeenCalled();
  });

  it("removes an active upgrade", async () => {
    const { db, tx } = buildGameMutationDb({
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          phase: "play",
          caste: "red",
          turnsRemaining: 10,
          activeUpgrades: { [targetId]: upgradeId },
        },
      },
    });
    mockGetAdminDb.mockReturnValue(db);
    const { player } = await removeUpgradeServer({
      userId: "u1",
      targetId,
    });
    expect(player.activeUpgrades?.[targetId]).toBeUndefined();
    expect(tx.update).toHaveBeenCalled();
  });
});

describe("changeCasteServer (wave 11)", () => {
  it("updates caste when eligible", async () => {
    const { db, tx } = buildGameMutationDb({
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          caste: "red",
          phase: "play",
          casteChangesUsed: 0,
          stats: { ...BASE_PLAYER.stats, tilesHeld: 1000 },
        },
      },
    });
    mockGetAdminDb.mockReturnValue(db);
    const out = await changeCasteServer("u1", "blue");
    expect(out.caste).toBe("blue");
    expect(tx.update).toHaveBeenCalled();
  });

  it("throws when caste change already used", async () => {
    const { db } = buildGameMutationDb({
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          caste: "red",
          casteChangesUsed: 1,
          stats: { ...BASE_PLAYER.stats, tilesHeld: 1000 },
        },
      },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(changeCasteServer("u1", "blue")).rejects.toBeInstanceOf(
      GameCasteChangeUnavailableError,
    );
  });
});

describe("castArmageddonServer (wave 11)", () => {
  it("does not break a seal when world seals are incomplete and roll fails", async () => {
    mockArmaChance.mockReturnValue(0);
    const sealsBrokenBefore = 3;
    expect(sealsBrokenBefore).toBeLessThan(SEAL_COUNT);

    const { db, tx, userId } = buildArmageddonDb({
      sealsBrokenBefore,
      turnsRemaining: 120,
    });
    mockGetAdminDb.mockReturnValue(db);

    const res = await castArmageddonServer({
      userId,
      now: new Date("2026-05-11T11:11:11.111Z"),
    });

    expect(res.success).toBe(false);
    expect(res.sealsBroken).toBe(sealsBrokenBefore);
    expect(res.shouldTriggerResolve).toBe(false);
    expect(tx.set).not.toHaveBeenCalled();
    expect(tx.update).toHaveBeenCalled();
  });

  it("throws GameInsufficientTurnsError when turns are too low", async () => {
    const { db, userId } = buildArmageddonDb({
      sealsBrokenBefore: 2,
      turnsRemaining: 0,
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      castArmageddonServer({ userId, now: new Date("2026-05-11T11:11:11.111Z") }),
    ).rejects.toBeInstanceOf(GameInsufficientTurnsError);
  });
});

describe("adminGrantUnitsServer (wave 11)", () => {
  it("grants units to player tile", async () => {
    const { db, tx } = buildGameMutationDb({
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          stats: { ...BASE_PLAYER.stats, unitsAlive: 10 },
        },
      },
      tile: {
        exists: true,
        data: {
          ...BASE_TILE,
          units: { ground: 0, air: 0, siege: 0 },
        },
      },
    });
    mockGetAdminDb.mockReturnValue(db);
    const out = await adminGrantUnitsServer({
      ownerId: "u1",
      tileId: "t1",
      unitType: "ground",
      count: 5,
    });
    expect(out.tile.units.ground).toBe(5);
    expect(out.player.stats.unitsAlive).toBe(15);
    expect(tx.update).toHaveBeenCalled();
  });
});

describe("setTileInscriptionServer (wave 11)", () => {
  it("sets inscription on owned tile", async () => {
    const { db, tx } = buildGameMutationDb({
      player: { exists: true, data: BASE_PLAYER },
      tile: { exists: true, data: BASE_TILE },
    });
    mockGetAdminDb.mockReturnValue(db);
    const tile = await setTileInscriptionServer("u1", "t1", "hold the line");
    expect(tile.inscription).toBe("hold the line");
    expect(tx.update).toHaveBeenCalled();
  });
});

describe("bulkFrontierExploreServer (wave 11)", () => {
  it("claims the second explore in batch when the first slot was raced", async () => {
    const { db } = buildBulkFrontierSecondExploreDb();
    mockGetAdminDb.mockReturnValue(db);

    const bulkNow = new Date("2026-05-03T09:30:00.000Z");
    const out = await bulkFrontierExploreServer("u1", 3, bulkNow);

    expect(out.tiles).toHaveLength(2);
    expect(out.reports).toHaveLength(2);
    expect(out.stoppedEarly).toContain("claimed");
    expect(out.player.turnsRemaining).toBe(3);
  });
});
