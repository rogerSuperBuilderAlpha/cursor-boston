/**
 * @jest-environment node
 */

jest.mock("@/lib/firebase-admin", () => ({ getAdminDb: jest.fn() }));

jest.mock("@/lib/game/content/armageddon", () => {
  const actual = jest.requireActual<typeof import("@/lib/game/content/armageddon")>(
    "@/lib/game/content/armageddon",
  );
  return {
    ...actual,
    computeArmageddonSuccessChanceFromMultiplier: jest.fn(() => 1),
  };
});

jest.mock("@/lib/game/prophecies", () => ({
  resolveProphesiesForSealInTx: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/game/turn-report", () => ({
  buildExploreReport: jest.fn(() => ({
    action: "explore",
    narrative: [],
    outcome: {},
  })),
}));

jest.mock("@/lib/game/artifacts", () => ({
  rollArtifact: jest.fn(() => null),
}));
jest.mock("@/lib/game/community", () => ({
  logCommunityEventInTx: jest.fn(),
}));

jest.mock("@/lib/game/intel", () => ({
  buildIntelReportServer: jest.fn().mockResolvedValue({
    id: "ir-wave5",
    targetTileId: "t1",
    scope: "weak-face",
    capturedAtTurn: 1,
    lines: [],
  }),
}));

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
  recordIntelEffectInTx: jest.fn(),
}));

jest.mock("@/lib/game/heroes", () => {
  const actual = jest.requireActual<typeof import("@/lib/game/heroes")>("@/lib/game/heroes");
  return {
    ...actual,
    maybeEmergeHero: jest.fn(() => null),
  };
});

jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), logError: jest.fn() },
}));

import { getAdminDb } from "@/lib/firebase-admin";
import {
  bulkFrontierExploreServer,
  castArmageddonServer,
  createPlayerWithSpawnServer,
  declareLastStandServer,
  frontierExploreServer,
  getAllOwnerSummariesServer,
  getOwnedTilesServer,
  getTileServer,
  meditateHeroServer,
  NEW_PLAYER_TILE_COUNT,
  pepTalkHeroServer,
} from "@/lib/game/data-server";
import {
  makeChain,
  makeDoc,
  makeDocRef,
  makeQuerySnap,
} from "@/__tests__/_helpers/firebase-admin-mock";
import { LAST_STAND_COOLDOWN_MS, LAST_STAND_THREAT_WINDOW_MS } from "@/lib/game/types";
import type { GameHero } from "@/lib/game/types";

const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;

beforeEach(() => {
  mockGetAdminDb.mockReset();
});

function buildReadsDbFive(opts: {
  worldMeta?: ReturnType<typeof makeDoc>;
  playerById?: Record<string, ReturnType<typeof makeDoc>>;
  tilesByOwnerId?: Record<string, ReturnType<typeof makeDoc>[]>;
  tilesById?: Record<string, ReturnType<typeof makeDoc>>;
  allPlayers?: ReturnType<typeof makeDoc>[];
}) {
  const playersChain = makeChain({});
  playersChain.get = jest
    .fn()
    .mockResolvedValue(makeQuerySnap(opts.allPlayers ?? []));
  (playersChain as Record<string, unknown>).doc = jest.fn((uid: string) => {
    const snap = opts.playerById?.[uid] ?? makeDoc(uid, undefined);
    return makeDocRef(uid, { snap });
  });

  const tilesChain = makeChain({});
  tilesChain.where = jest.fn().mockImplementation((_field: string, _op: string, value: unknown) => {
    const sub = makeChain({});
    sub.get = jest.fn().mockImplementation(async () =>
      makeQuerySnap(opts.tilesByOwnerId?.[value as string] ?? []),
    );
    return sub;
  });
  (tilesChain as Record<string, unknown>).doc = jest.fn((tileId: string) => {
    const snap = opts.tilesById?.[tileId] ?? makeDoc(tileId, undefined);
    return makeDocRef(tileId, { snap });
  });

  const worldChain = makeChain({});
  (worldChain as Record<string, unknown>).doc = jest.fn(() =>
    makeDocRef("singleton", {
      snap: opts.worldMeta ?? makeDoc("singleton", undefined),
    }),
  );

  const playersSelect = makeChain({});
  playersSelect.get = jest.fn().mockResolvedValue(makeQuerySnap(opts.allPlayers ?? []));
  playersChain.select = jest.fn().mockReturnValue(playersSelect);

  const collection = jest.fn((name: string) => {
    if (name === "game_world_meta") return worldChain;
    if (name === "game_players") return playersChain;
    if (name === "game_tiles") return tilesChain;
    throw new Error(`unexpected collection: ${name}`);
  });

  mockGetAdminDb.mockReturnValue({
    collection,
    getAll: jest.fn(async (...refs: Array<{ get?: () => Promise<unknown> }>) =>
      Promise.all(refs.map((r) => (r.get ? r.get() : makeDoc("?", undefined)))),
    ),
  });
}

function buildCreatePlayerSpawnDb(userId = "spawn-new-u1") {
  const cachedTileRefs = new Map<string, { id: string; __tile: true }>();
  function tileDocRef(tileId: string) {
    if (!cachedTileRefs.has(tileId)) {
      cachedTileRefs.set(tileId, { __tile: true, id: tileId });
    }
    return cachedTileRefs.get(tileId)!;
  }
  const playerRef = { id: userId, __player: true as const };
  const metaRef = { id: "singleton", __meta: true as const };

  const tilesCollection = {
    doc: jest.fn((tid: string) => tileDocRef(tid)),
  };

  const nameTakenChain = makeChain({ docs: [] });

  const playersCollection = {
    doc: jest.fn(() => playerRef),
    where: jest.fn((_f: string, _op: string, _val: unknown) => nameTakenChain),
  };

  const worldMetaCollection = {
    doc: jest.fn(() => metaRef),
  };

  const tx = {
    get: jest.fn((ref: { id?: string; __player?: boolean; __meta?: boolean; __tile?: boolean }) => {
      if (ref.__player && ref.id === userId) {
        return Promise.resolve({ exists: false, id: userId, data: () => undefined });
      }
      if (ref.__meta) {
        return Promise.resolve({
          exists: true,
          id: "singleton",
          data: () => ({
            playerCount: 0,
            seasonNumber: 1,
            sealsBroken: 0,
            armageddonState: "active",
          }),
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
      if (name === "game_players") return playersCollection;
      if (name === "game_tiles") return tilesCollection;
      if (name === "game_world_meta") return worldMetaCollection;
      return { doc: jest.fn(), where: jest.fn() };
    }),
    runTransaction: jest.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
  });

  return { tx, tilesCollection };
}

function buildFrontierExploreSuccessDb(opts: {
  centroidTileId?: string;
  tilesExplored?: number;
}) {
  const centroidId = opts.centroidTileId ?? "0_0";
  const userId = "u1";

  const playerPreData = {
    userId,
    phase: "play" as const,
    turnsRemaining: 10,
    turnsSpentTotal: 88,
    tilesExplored: opts.tilesExplored ?? 20,
    caste: "red" as const,
    stats: {
      tilesHeld: 120,
      unitsAlive: 1,
      attacksWon: 0,
      attacksLost: 0,
      tilesCaptured: 0,
      tilesLost: 0,
    },
    activeUpgrades: {},
    productionSpellsActive: [],
  };

  const playerTxnData = {
    ...playerPreData,
  };

  const playerDocRef = {
    id: userId,
    get: jest.fn().mockResolvedValue({
      exists: true,
      id: userId,
      data: () => playerPreData,
    }),
  };

  const ownedTileSnap = makeDoc(centroidId, {
    tileId: centroidId,
    q: 0,
    r: 0,
    ownerId: userId,
    type: "military",
    neighborTileIds: [],
    units: { ground: 0, siege: 0, air: 0 },
  });

  const ownedChain = makeChain({ docs: [ownedTileSnap] });

  const tileDocById = new Map<string, { id: string }>();

  const tx = {
    get: jest.fn((ref: { id: string } | typeof playerDocRef) => {
      if (ref === playerDocRef) {
        return Promise.resolve({
          exists: true,
          id: userId,
          data: () => playerTxnData,
        });
      }
      return Promise.resolve({
        exists: false,
        id: (ref as { id: string }).id,
        data: () => undefined,
      });
    }),
    set: jest.fn(),
    update: jest.fn(),
    getAll: jest.fn(),
    delete: jest.fn(),
  };

  const tilesCollection = {
    doc: jest.fn((id: string) => {
      if (!tileDocById.has(id)) tileDocById.set(id, { id });
      return tileDocById.get(id)!;
    }),
    where: jest.fn(() => ownedChain),
  };

  const db = {
    collection: jest.fn((name: string) => {
      if (name === "game_players") {
        return {
          doc: jest.fn(() => playerDocRef),
          where: jest.fn(),
        };
      }
      if (name === "game_tiles") return tilesCollection;
      return { doc: jest.fn(), where: jest.fn() };
    }),
    runTransaction: jest.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
    getAll: jest.fn((...refs: Array<{ id?: string }>) =>
      Promise.resolve(
        refs.map((r) => ({
          exists: false,
          id: r.id ?? "",
          data: () => undefined,
        })),
      ),
    ),
  };

  mockGetAdminDb.mockReturnValue(db);
  return { db, tx, playerRef: playerDocRef };
}

describe("reads (wave-5 sanity)", () => {
  beforeEach(() => mockGetAdminDb.mockReset());

  it("getOwnedTilesServer returns tiles without regen when ownerId absent on docs", async () => {
    buildReadsDbFive({
      tilesByOwnerId: {
        u1: [
          makeDoc("t1", {
            tileId: "t1",
            q: 0,
            r: 0,
            type: "military",
            ownerId: null,
            units: { ground: 5, siege: 0, air: 0 },
          }),
        ],
      },
      playerById: { u1: makeDoc("u1", { userId: "u1" }) },
    });
    const out = await getOwnedTilesServer("u1");
    expect(out).toHaveLength(1);
    expect(out[0]?.tileId).toBe("t1");
  });

  it("getTileServer returns unowned tiles without fetching player docs", async () => {
    buildReadsDbFive({
      tilesById: {
        t1: makeDoc("t1", {
          tileId: "t1",
          q: 0,
          r: 0,
          type: "unassigned",
          ownerId: null,
        }),
      },
    });
    const out = await getTileServer("t1");
    expect(out?.tileId).toBe("t1");
    expect(out?.ownerId).toBeNull();
  });

  it("getAllOwnerSummariesServer maps select query results", async () => {
    buildReadsDbFive({
      allPlayers: [
        makeDoc("u9", {
          userId: "u9",
          displayName: "Summoner",
          caste: "green",
          isNpc: false,
        }),
      ],
    });
    const out = await getAllOwnerSummariesServer();
    expect(out.some((r) => r.userId === "u9")).toBe(true);
    expect(out.find((r) => r.userId === "u9")).toMatchObject({
      displayName: "Summoner",
      caste: "green",
      isNpc: false,
    });
  });
});

describe("createPlayerWithSpawnServer", () => {
  it("writes player and NEW_PLAYER_TILE_COUNT tiles when spawn center hex is vacant", async () => {
    const userId = "brand-new-general";
    const { tx } = buildCreatePlayerSpawnDb(userId);
    const fixedNow = new Date("2026-05-01T12:00:00.000Z");

    const { player, tileIds } = await createPlayerWithSpawnServer(
      userId,
      "ValidName",
      fixedNow,
    );

    expect(player.userId).toBe(userId);
    expect(player.phase).toBe("explore");
    expect(tileIds).toHaveLength(NEW_PLAYER_TILE_COUNT);
    expect(tx.set.mock.calls.length).toBeGreaterThanOrEqual(
      NEW_PLAYER_TILE_COUNT + 2,
    );
  });
});

describe("frontierExploreServer / bulkFrontierExploreServer", () => {
  it("frontierExploreServer claims first batched vacancy around centroid", async () => {
    const { tx } = buildFrontierExploreSuccessDb({ tilesExplored: 40 });
    const now = new Date("2026-05-02T08:00:00.000Z");
    const out = await frontierExploreServer("u1", now);

    expect(out.tile.ownerId).toBe("u1");
    expect(out.tile.type).toBe("unassigned");
    expect(out.player.turnsRemaining).toBe(9);
    expect(tx.set).toHaveBeenCalled();
    expect(tx.update).toHaveBeenCalled();
    expect(out.frontier.tileId).toBeDefined();
  });

  it("bulkFrontierExploreServer returns partial success when the first prefetch slot is raced", async () => {
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

    const tilesDocById = new Map<string, { id: string }>();

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

    const tx = {
      getAll: jest.fn((...refs: Array<{ id: string }>) =>
        Promise.resolve(
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
        ),
      ),
      set: jest.fn(),
      update: jest.fn(),
      get: jest.fn(),
    };

    mockGetAdminDb.mockReturnValue({
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
      runTransaction: jest.fn((cb: (t: typeof tx) => Promise<unknown>) =>
        cb(tx),
      ),
    });

    const bulkNow = new Date("2026-05-03T09:30:00.000Z");

    const out = await bulkFrontierExploreServer(userId, 3, bulkNow);

    expect(out.tiles).toHaveLength(2);
    expect(out.reports).toHaveLength(2);
    expect(out.stoppedEarly).toContain("claimed");
    expect(out.player.turnsRemaining).toBe(3);
  });
});

describe("castArmageddonServer", () => {
  it("fires success path — breaks a seal when roll succeeds under mocked odds", async () => {
    const userId = "arma-u1";

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
      turnsRemaining: 120,
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
              sealsBroken: 2,
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

    mockGetAdminDb.mockReturnValue({
      collection: jest.fn((name: string) => {
        if (name === "game_players") {
          return {
            doc: jest.fn(() => playerRef),
            where: jest.fn(),
          };
        }
        if (name === "game_world_meta") {
          return {
            doc: jest.fn(() => worldRef),
          };
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
      runTransaction: jest.fn((cb: (t: typeof tx) => Promise<unknown>) =>
        cb(tx),
      ),
    });

    const res = await castArmageddonServer({ userId, now: new Date("2026-05-10T11:11:11.111Z") });

    expect(res.success).toBe(true);
    expect(res.sealsBroken).toBeGreaterThanOrEqual(3);
    expect(res.player.turnsRemaining).toBeLessThan(playerTxn.turnsRemaining);
    expect(tx.update).toHaveBeenCalledWith(playerRef, expect.any(Object));
    expect(tx.set).toHaveBeenCalledWith(worldRef, expect.any(Object), { merge: true });
  });
});

describe("declareLastStandServer", () => {
  it("writes activeLastStand when player is at zero turns and tile recently attacked", async () => {
    const now = new Date("2026-05-07T07:07:07.707Z");

    const playerRef = { id: "ls-u1", __p: true as const };
    const tileRef = { id: "ls-tile", __t: true as const };

    const tx = {
      get: jest.fn((ref: typeof playerRef | typeof tileRef) => {
        if (ref.__p) {
          return Promise.resolve({
            exists: true,
            data: () => ({
              userId: "ls-u1",
              turnsRemaining: 0,
              lastStandUsedAt: new Date(now.getTime() - LAST_STAND_COOLDOWN_MS),
            }),
          });
        }
        if (ref.__t) {
          return Promise.resolve({
            exists: true,
            data: () => ({
              tileId: "ls-tile",
              ownerId: "ls-u1",
              units: {},
              neighborTileIds: [],
              lastAttackedAt: new Date(now.getTime() - LAST_STAND_THREAT_WINDOW_MS + 120_000),
            }),
          });
        }
        return Promise.resolve({ exists: false });
      }),
      update: jest.fn(),
    };

    mockGetAdminDb.mockReturnValue({
      collection: jest.fn((col: string) => {
        if (col === "game_players") {
          return { doc: jest.fn(() => playerRef) };
        }
        if (col === "game_tiles") {
          return { doc: jest.fn(() => tileRef) };
        }
        return { doc: jest.fn() };
      }),
      runTransaction: jest.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
    });

    const out = await declareLastStandServer({
      callerUserId: "ls-u1",
      tileId: "ls-tile",
      now,
    });

    expect(out.activeLastStand).toMatchObject({
      declaredAt: now,
      expiresAt: expect.any(Date),
    });
    expect(tx.update).toHaveBeenCalledWith(tileRef, expect.any(Object));
    expect(tx.update).toHaveBeenCalledWith(playerRef, expect.any(Object));
  });
});

describe("pepTalkHeroServer / meditateHeroServer", () => {
  function buildHeroTilesDb(heroOverrides: Partial<GameHero>) {
    const hero: GameHero = {
      id: "hero-wave5",
      ownerId: "h-u1",
      tileId: "tHero",
      class: "magic",
      specialty: "armageddon",
      name: "Seer",
      caste: "red",
      stamina: 3,
      staminaMax: 20,
      emergedAtTurn: 0,
      lastEngagedAtTurn: 5,
      ...heroOverrides,
    };

    const playerRef = { id: "h-u1", __p: true as const };
    const tileRef = { id: "tHero", __t: true as const };

    const tileData = {
      tileId: "tHero",
      ownerId: "h-u1",
      units: {},
      hero,
      neighborTileIds: [],
    };

    const tx = {
      get: jest.fn((ref: typeof playerRef | typeof tileRef) => {
        if (ref.__p) {
          return Promise.resolve({
            exists: true,
            data: () => ({
              userId: "h-u1",
              turnsRemaining: 0,
              turnsSpentTotal: 12,
            }),
          });
        }
        if (ref.__t) {
          return Promise.resolve({
            exists: true,
            data: () => tileData,
          });
        }
        return Promise.resolve({ exists: false });
      }),
      update: jest.fn(),
    };

    const ownedTileDoc = makeDoc("tHero", tileData);

    mockGetAdminDb.mockReturnValue({
      collection: jest.fn((col: string) => {
        if (col === "game_players") return { doc: jest.fn(() => playerRef), where: jest.fn() };
        if (col === "game_tiles") {
          return {
            doc: jest.fn(() => tileRef),
            where: jest.fn((_f: string, _op: string, uid: unknown) =>
              uid === "h-u1" ? makeChain({ docs: [ownedTileDoc] }) : makeChain({ docs: [] }),
            ),
          };
        }
        if (col === "game_heroes") {
          return {
            doc: jest.fn((_hid: string) => ({ __h: true, id: _hid })),
          };
        }
        return { doc: jest.fn(), where: jest.fn() };
      }),
      runTransaction: jest.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
    });

    return { tx };
  }

  it("pepTalkHeroServer tops up stamina capped at staminaMax", async () => {
    const { tx } = buildHeroTilesDb({});
    const out = await pepTalkHeroServer({
      callerUserId: "h-u1",
      tileId: "tHero",
      now: new Date("2026-05-06T06:06:06.606Z"),
    });
    expect(out.hero?.stamina).toBe(18);
    expect(tx.update).toHaveBeenCalledTimes(2);
  });

  it("meditateHeroServer sets meditatingUntil and max stamina while slot available", async () => {
    const { tx } = buildHeroTilesDb({ meditatingUntil: undefined });
    const now = new Date("2026-05-06T07:07:07.707Z");

    await meditateHeroServer({
      callerUserId: "h-u1",
      tileId: "tHero",
      now,
    });

    expect(tx.update).toHaveBeenCalledTimes(2);
    const heroPatch = tx.update.mock.calls.find(
      (c) => typeof c[1] === "object" && "hero" in (c[1] as object),
    )?.[1] as { hero?: { meditatingUntil?: Date } } | undefined;
    expect(heroPatch?.hero?.meditatingUntil instanceof Date).toBe(true);
  });
});
