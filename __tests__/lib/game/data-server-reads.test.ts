/**
 * @jest-environment node
 *
 * Wave 1a chunk 3 of the Silver coverage backlog — read functions in
 * lib/game/data-server.ts:766-1202 with Firestore Admin mocked via the
 * Wave 0 shared helpers (__tests__/_helpers/firebase-admin-mock.ts).
 *
 * Covered exports:
 *   getWorldMetaServer
 *   getPlayerServer
 *   getOwnedTilesServer
 *   getOwnedMapTilesServer
 *   getAllMapTilesServer
 *   getMapTilesInBoundsServer
 *   getMyMapServer
 *   getAllOwnerSummariesServer
 *   getTileServer
 *
 * First chunk that uses the Wave 0 helpers in anger — proves the
 * abstraction works for real reads.
 */

const mockGetAdminDb = jest.fn();
jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: () => mockGetAdminDb(),
}));

// Lazy-regen writes from applyLazyRegenBatch are fire-and-forget. We feed
// test data with `ownerId: null` so the regen path short-circuits at the
// top of applyLazyRegen and doesn't hit baseUnitsTarget / sibling helpers.

import {
  getAllMapTilesServer,
  getAllOwnerSummariesServer,
  getMapTilesInBoundsServer,
  getMyMapServer,
  getOwnedMapTilesServer,
  getOwnedTilesServer,
  getPlayerServer,
  getTileServer,
  getWorldMetaServer,
} from "@/lib/game/data-server";
import {
  makeChain,
  makeDoc,
  makeDocRef,
  makeQuerySnap,
} from "@/__tests__/_helpers/firebase-admin-mock";

beforeEach(() => {
  mockGetAdminDb.mockReset();
});

/**
 * Builder shared by every test below. Returns the spy bag so individual
 * tests can assert on where()/select()/get() calls.
 */
function buildDb(opts: {
  worldMeta?: ReturnType<typeof makeDoc>;
  playerById?: Record<string, ReturnType<typeof makeDoc>>;
  tilesByOwnerId?: Record<string, ReturnType<typeof makeDoc>[]>;
  allTiles?: ReturnType<typeof makeDoc>[];
  tilesByBbox?: ReturnType<typeof makeDoc>[];
  tilesById?: Record<string, ReturnType<typeof makeDoc>>;
  allPlayers?: ReturnType<typeof makeDoc>[];
}) {
  // Per-collection chain builders. Each chain returns a query-snap matching
  // the where() filter we configured. To keep this small we just always
  // return the same snap regardless of filter — the test asserts the
  // filter args directly.

  const playersChain = makeChain({});
  playersChain.get = jest
    .fn()
    .mockResolvedValue(makeQuerySnap(opts.allPlayers ?? []));
  (playersChain as Record<string, unknown>).doc = jest.fn((uid: string) => {
    const snap = opts.playerById?.[uid] ?? makeDoc(uid, undefined);
    return makeDocRef(uid, { snap });
  });

  const tilesChain = makeChain({});
  // .where(...).get() → tilesByOwnerId lookup
  tilesChain.where = jest.fn().mockImplementation((field: string, op: string, value: unknown) => {
    const sub = makeChain({});
    sub.get = jest.fn().mockImplementation(async () => {
      if (field === "ownerId") {
        return makeQuerySnap(opts.tilesByOwnerId?.[value as string] ?? []);
      }
      if (field === "q") {
        return makeQuerySnap(opts.tilesByBbox ?? []);
      }
      return makeQuerySnap([]);
    });
    return sub;
  });
  tilesChain.select = jest.fn().mockImplementation(() => {
    const sub = makeChain({});
    sub.get = jest.fn().mockResolvedValue(makeQuerySnap(opts.allTiles ?? []));
    sub.where = tilesChain.where;
    return sub;
  });
  tilesChain.get = jest.fn().mockResolvedValue(makeQuerySnap(opts.allTiles ?? []));
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

  // Players-select-chain for getAllOwnerSummariesServer
  const playersSelect = makeChain({});
  playersSelect.get = jest
    .fn()
    .mockResolvedValue(makeQuerySnap(opts.allPlayers ?? []));
  playersChain.select = jest.fn().mockReturnValue(playersSelect);

  const collection = jest.fn((name: string) => {
    if (name === "game_world_meta") return worldChain;
    if (name === "game_players") return playersChain;
    if (name === "game_tiles") return tilesChain;
    throw new Error(`unexpected collection: ${name}`);
  });

  const getAll = jest.fn(async (...refs: Array<{ get?: () => Promise<unknown> }>) =>
    Promise.all(refs.map((r) => (r.get ? r.get() : makeDoc("?", undefined)))),
  );

  const db = { collection, getAll };
  mockGetAdminDb.mockReturnValue(db);
  return { db, collection, playersChain, tilesChain, worldChain };
}

describe("getWorldMetaServer", () => {
  it("returns defaulted shape when the singleton doc doesn't exist", async () => {
    buildDb({});
    const out = await getWorldMetaServer();
    expect(out).toMatchObject({
      playerCount: 0,
      seasonNumber: 1,
      sealsBroken: 0,
      seals: [],
      armageddonState: "active",
    });
  });

  it("merges existing fields with the defaulted shape", async () => {
    buildDb({
      worldMeta: makeDoc("singleton", {
        playerCount: 42,
        seasonNumber: 3,
        sealsBroken: 2,
        seals: [{ idx: 0 }, { idx: 1 }],
        armageddonState: "in_progress",
      }),
    });
    const out = await getWorldMetaServer();
    expect(out.playerCount).toBe(42);
    expect(out.seasonNumber).toBe(3);
    expect(out.sealsBroken).toBe(2);
    expect(out.armageddonState).toBe("in_progress");
  });

  it("throws when admin db is unavailable", async () => {
    mockGetAdminDb.mockReturnValue(null);
    await expect(getWorldMetaServer()).rejects.toThrow(
      "Firebase Admin not initialized",
    );
  });
});

describe("getPlayerServer", () => {
  it("returns the player record when the doc exists", async () => {
    buildDb({
      playerById: {
        u1: makeDoc("u1", {
          userId: "u1",
          displayName: "Alice",
          caste: "white",
          turnsSpentTotal: 5,
        }),
      },
    });
    const out = await getPlayerServer("u1");
    expect(out).toMatchObject({
      userId: "u1",
      displayName: "Alice",
      caste: "white",
    });
  });

  it("returns null when the doc is missing", async () => {
    buildDb({});
    expect(await getPlayerServer("missing")).toBeNull();
  });
});

describe("getOwnedTilesServer", () => {
  it("returns owned tiles untouched when each tile.ownerId is null (regen short-circuit)", async () => {
    buildDb({
      tilesByOwnerId: {
        u1: [
          makeDoc("t1", {
            tileId: "t1",
            q: 0,
            r: 0,
            type: "military",
            ownerId: null,
            units: { ground: 5 },
          }),
        ],
      },
      playerById: { u1: makeDoc("u1", { userId: "u1" }) },
    });
    const out = await getOwnedTilesServer("u1");
    expect(out).toHaveLength(1);
    expect(out[0]?.tileId).toBe("t1");
  });

  it("returns [] when the player owns no tiles", async () => {
    buildDb({
      tilesByOwnerId: { u1: [] },
      playerById: { u1: makeDoc("u1", undefined) },
    });
    expect(await getOwnedTilesServer("u1")).toEqual([]);
  });
});

describe("getOwnedMapTilesServer", () => {
  it("projects tiles into MapTile shape with baseUnits + hero fallbacks", async () => {
    buildDb({
      tilesByOwnerId: {
        u1: [
          makeDoc("t1", {
            tileId: "t1",
            q: 1,
            r: 2,
            type: "food",
            ownerId: "u1",
            units: { ground: 1 },
            // baseUnits intentionally omitted → falls back to zero shape
            // hero intentionally omitted → key not present
          }),
          makeDoc("t2", {
            tileId: "t2",
            q: 3,
            r: 4,
            type: "magic",
            ownerId: "u1",
            units: { ground: 2 },
            baseUnits: { ground: 10, siege: 0, air: 0 },
            armedDefenseSpellId: "white-defense-1",
            hero: { id: "h1", class: "military" },
          }),
        ],
      },
    });
    const out = await getOwnedMapTilesServer("u1");
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({
      tileId: "t1",
      q: 1,
      r: 2,
      type: "food",
      ownerId: "u1",
      units: { ground: 1 },
      baseUnits: { ground: 0, siege: 0, air: 0 },
      armedDefenseSpellId: null,
    });
    expect(out[1]?.armedDefenseSpellId).toBe("white-defense-1");
    expect(out[1]?.hero?.id).toBe("h1");
  });
});

describe("getAllMapTilesServer", () => {
  it("returns the projected MapTile shape across all tiles", async () => {
    buildDb({
      allTiles: [
        makeDoc("t1", {
          tileId: "t1",
          q: 0,
          r: 0,
          type: "military",
          ownerId: null,
          units: { ground: 0 },
        }),
        makeDoc("t2", {
          tileId: "t2",
          q: 1,
          r: 1,
          type: "food",
          ownerId: "u9",
          units: { ground: 0 },
          baseUnits: { ground: 5, siege: 0, air: 0 },
        }),
      ],
    });
    const out = await getAllMapTilesServer();
    expect(out.map((t) => t.tileId)).toEqual(["t1", "t2"]);
    expect(out[0]?.ownerId).toBeNull();
    expect(out[1]?.ownerId).toBe("u9");
    expect(out[1]?.baseUnits).toEqual({ ground: 5, siege: 0, air: 0 });
  });
});

describe("getMapTilesInBoundsServer", () => {
  it("returns tiles inside the bbox and filters by r in memory", async () => {
    buildDb({
      tilesByBbox: [
        makeDoc("in", {
          tileId: "in",
          q: 0,
          r: 0,
          type: "food",
          ownerId: null,
          units: {},
        }),
        makeDoc("r-out", {
          tileId: "r-out",
          q: 0,
          r: 100, // outside the rMax filter below
          type: "food",
          ownerId: null,
          units: {},
        }),
        makeDoc("bad-r", {
          tileId: "bad-r",
          q: 0,
          r: "not-a-number",
          type: "food",
          ownerId: null,
          units: {},
        }),
      ],
    });
    const out = await getMapTilesInBoundsServer({
      qMin: -10,
      qMax: 10,
      rMin: -10,
      rMax: 10,
    });
    expect(out.map((t) => t.tileId)).toEqual(["in"]);
  });

  it("throws when the bbox returns more than the viewport limit", async () => {
    // Build 5001 docs to overflow the cap.
    const docs = Array.from({ length: 5001 }, (_, i) =>
      makeDoc(`t${i}`, {
        tileId: `t${i}`,
        q: 0,
        r: 0,
        type: "food",
        ownerId: null,
        units: {},
      }),
    );
    buildDb({ tilesByBbox: docs });
    await expect(
      getMapTilesInBoundsServer({ qMin: -1, qMax: 1, rMin: -1, rMax: 1 }),
    ).rejects.toThrow(/bbox returned more than/);
  });
});

describe("getAllOwnerSummariesServer", () => {
  it("maps player docs into OwnerSummary records (displayName/caste/isNpc default)", async () => {
    buildDb({
      allPlayers: [
        makeDoc("u1", {
          userId: "u1",
          displayName: "Alice",
          caste: "blue",
          isNpc: true,
        }),
        makeDoc("u2", {
          userId: "u2",
          // displayName intentionally missing → falls back to ""
          // caste intentionally null
        }),
      ],
    });
    const out = await getAllOwnerSummariesServer();
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      userId: "u1",
      displayName: "Alice",
      caste: "blue",
      isNpc: true,
    });
    expect(out[1]).toMatchObject({
      userId: "u2",
      displayName: "",
      caste: null,
      isNpc: false,
    });
  });
});

describe("getTileServer", () => {
  it("returns null when the tile doc does not exist", async () => {
    buildDb({});
    expect(await getTileServer("missing")).toBeNull();
  });

  it("returns the tile untouched when it has no ownerId (unowned)", async () => {
    buildDb({
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
});

describe("getMyMapServer", () => {
  it("returns empty when the player owns no tiles", async () => {
    buildDb({
      tilesByOwnerId: { u1: [] },
    });
    const out = await getMyMapServer("u1");
    expect(out).toEqual({ myTiles: [], borderTiles: [], owners: [] });
  });
});
