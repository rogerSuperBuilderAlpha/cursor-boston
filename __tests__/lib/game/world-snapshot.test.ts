/**
 * @jest-environment node
 *
 * Coverage push #56 — lib/game/world-snapshot.ts. Drives:
 *   - rebuildWorldSnapshotServer (skip-when-unchanged + force + first-time)
 *   - readWorldSnapshotServer (v1 + v2 doc shapes + missing/null cases)
 *   - filterSnapshotToBbox + deriveMyMapFromSnapshot (pure)
 *   - computeWorldSnapshot
 */
const mockGetAdminDb = jest.fn();
jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: () => mockGetAdminDb(),
}));

const loggerSpies = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};
jest.mock("@/lib/logger", () => ({
  logger: {
    info: (...a: unknown[]) => loggerSpies.info(...a),
    warn: (...a: unknown[]) => loggerSpies.warn(...a),
    error: (...a: unknown[]) => loggerSpies.error(...a),
    debug: (...a: unknown[]) => loggerSpies.debug(...a),
  },
}));

import {
  WORLD_SNAPSHOT_COLLECTION,
  WORLD_SNAPSHOT_DOC,
  WORLD_SNAPSHOT_TTL_MS,
  computeWorldSnapshot,
  deriveMyMapFromSnapshot,
  filterSnapshotToBbox,
  rebuildWorldSnapshotServer,
  readWorldSnapshotServer,
  type WorldSnapshot,
} from "@/lib/game/world-snapshot";
import { compactTile } from "@/lib/game/world-snapshot-codec";
import type { MapTile } from "@/lib/game/types";

const tile = (overrides: Partial<MapTile> = {}): MapTile => ({
  tileId: "0_0",
  q: 0,
  r: 0,
  type: "unassigned",
  ownerId: null,
  units: { ground: 0, siege: 0, air: 0 },
  baseUnits: { ground: 0, siege: 0, air: 0 },
  armedDefenseSpellId: null,
  ...overrides,
});

function tsLike(d: Date) {
  return { toDate: () => d, toMillis: () => d.getTime() };
}

function buildFakeDb(opts: {
  tiles?: Array<Record<string, unknown>>;
  players?: Array<Record<string, unknown>>;
  existingSnapshot?: {
    exists: boolean;
    data?: Record<string, unknown>;
  };
  hasChangedSince?: { tiles?: boolean; players?: boolean };
}) {
  const tilesSelect = jest.fn().mockReturnThis();
  const playersSelect = jest.fn().mockReturnThis();
  const tilesGet = jest.fn().mockResolvedValue({
    docs: (opts.tiles ?? []).map((d) => ({ data: () => d })),
  });
  const playersGet = jest.fn().mockResolvedValue({
    docs: (opts.players ?? []).map((d) => ({ data: () => d })),
  });

  const tilesWhereGet = jest.fn().mockResolvedValue({
    empty: !(opts.hasChangedSince?.tiles ?? false),
  });
  const playersWhereGet = jest.fn().mockResolvedValue({
    empty: !(opts.hasChangedSince?.players ?? false),
  });
  const tilesWhere = jest.fn().mockReturnValue({
    limit: jest.fn().mockReturnValue({ get: tilesWhereGet }),
  });
  const playersWhere = jest.fn().mockReturnValue({
    limit: jest.fn().mockReturnValue({ get: playersWhereGet }),
  });

  const snapshotDocGet = jest.fn().mockResolvedValue({
    exists: opts.existingSnapshot?.exists ?? false,
    data: () => opts.existingSnapshot?.data ?? undefined,
  });
  const snapshotDocSet = jest.fn().mockResolvedValue(undefined);
  const snapshotDocRef = {
    get: snapshotDocGet,
    set: snapshotDocSet,
  };

  const collection = jest.fn((name: string) => {
    if (name === "game_tiles") {
      return {
        select: tilesSelect,
        get: tilesGet,
        where: tilesWhere,
      };
    }
    if (name === "game_players") {
      return {
        select: playersSelect,
        get: playersGet,
        where: playersWhere,
      };
    }
    if (name === WORLD_SNAPSHOT_COLLECTION) {
      return {
        doc: jest.fn().mockReturnValue(snapshotDocRef),
      };
    }
    throw new Error(`Unknown collection: ${name}`);
  });

  return {
    db: { collection },
    spies: {
      tilesGet,
      playersGet,
      tilesWhere,
      playersWhere,
      tilesWhereGet,
      playersWhereGet,
      snapshotDocGet,
      snapshotDocSet,
    },
  };
}

describe("module surface", () => {
  it("exports stable constants", () => {
    expect(WORLD_SNAPSHOT_COLLECTION).toBe("game_world_snapshots");
    expect(WORLD_SNAPSHOT_DOC).toBe("latest");
    expect(WORLD_SNAPSHOT_TTL_MS).toBe(5 * 60 * 1000);
  });
});

describe("computeWorldSnapshot", () => {
  it("maps tiles + owners with sensible defaults", async () => {
    const { db } = buildFakeDb({
      tiles: [
        {
          tileId: "0_0",
          q: 0,
          r: 0,
          type: "unassigned",
          ownerId: "u1",
          units: { ground: 5, siege: 0, air: 0 },
          // baseUnits missing → defaults to zero
        },
        {
          tileId: "1_0",
          q: 1,
          r: 0,
          type: "military",
          // ownerId missing → null
          units: { ground: 1, siege: 0, air: 0 },
          baseUnits: { ground: 2, siege: 0, air: 0 },
          armedDefenseSpellId: "wall",
        },
      ],
      players: [
        {
          userId: "u1",
          displayName: "Alice",
          caste: "warrior",
          isNpc: false,
        },
        {
          // no displayName → coerces to ""
          userId: "npc1",
          // no caste → null
          isNpc: true,
        },
      ],
    });
    const out = await computeWorldSnapshot(
      db as unknown as Parameters<typeof computeWorldSnapshot>[0],
      new Date("2026-05-18T03:00:00.000Z")
    );
    expect(out.tileCount).toBe(2);
    expect(out.ownerCount).toBe(2);
    expect(out.tiles[0].ownerId).toBe("u1");
    expect(out.tiles[1].ownerId).toBeNull();
    expect(out.tiles[0].baseUnits).toEqual({ ground: 0, siege: 0, air: 0 });
    expect(out.owners[0].displayName).toBe("Alice");
    expect(out.owners[0].isNpc).toBe(false);
    expect(out.owners[1].displayName).toBe("");
    expect(out.owners[1].caste).toBeNull();
    expect(out.owners[1].isNpc).toBe(true);
    expect(out.generatedAt).toBe("2026-05-18T03:00:00.000Z");
  });
});

describe("rebuildWorldSnapshotServer", () => {
  beforeEach(() => {
    mockGetAdminDb.mockReset();
    loggerSpies.info.mockClear();
  });

  it("throws when admin db is missing", async () => {
    mockGetAdminDb.mockReturnValueOnce(null);
    await expect(rebuildWorldSnapshotServer()).rejects.toThrow(
      "Firebase Admin not initialized"
    );
  });

  it("rebuilds from scratch when no snapshot exists", async () => {
    const { db, spies } = buildFakeDb({
      tiles: [
        {
          tileId: "0_0",
          q: 0,
          r: 0,
          type: "unassigned",
          units: { ground: 1, siege: 0, air: 0 },
        },
      ],
      players: [{ userId: "u1" }],
      existingSnapshot: { exists: false },
    });
    mockGetAdminDb.mockReturnValueOnce(db);
    const out = await rebuildWorldSnapshotServer(
      new Date("2026-05-18T03:00:00.000Z")
    );
    expect(out.skipped).toBe(false);
    expect(out.tileCount).toBe(1);
    expect(out.ownerCount).toBe(1);
    expect(spies.snapshotDocSet).toHaveBeenCalledTimes(1);
    const written = spies.snapshotDocSet.mock.calls[0][0];
    expect(written.schemaVersion).toBeDefined();
    expect(Array.isArray(written.compactTiles)).toBe(true);
  });

  it("skips rebuild when an existing snapshot is unchanged", async () => {
    const generatedAt = new Date("2026-05-18T00:00:00.000Z");
    const { db, spies } = buildFakeDb({
      existingSnapshot: {
        exists: true,
        data: {
          generatedAt: tsLike(generatedAt),
          tileCount: 42,
          ownerCount: 7,
        },
      },
      hasChangedSince: { tiles: false, players: false },
    });
    mockGetAdminDb.mockReturnValueOnce(db);
    const out = await rebuildWorldSnapshotServer();
    expect(out.skipped).toBe(true);
    expect(out.tileCount).toBe(42);
    expect(out.ownerCount).toBe(7);
    expect(out.bytes).toBe(0);
    expect(spies.snapshotDocSet).not.toHaveBeenCalled();
  });

  it("accepts a generatedAt that is already a Date (not a Timestamp)", async () => {
    const generatedAt = new Date("2026-05-18T00:00:00.000Z");
    const { db } = buildFakeDb({
      existingSnapshot: {
        exists: true,
        data: { generatedAt, tileCount: 0, ownerCount: 0 },
      },
      hasChangedSince: { tiles: false, players: false },
    });
    mockGetAdminDb.mockReturnValueOnce(db);
    const out = await rebuildWorldSnapshotServer();
    expect(out.skipped).toBe(true);
  });

  it("treats nullable tile/owner counts on the existing doc as zero", async () => {
    const { db } = buildFakeDb({
      existingSnapshot: {
        exists: true,
        data: {
          generatedAt: tsLike(new Date()),
          // tileCount / ownerCount intentionally missing
        },
      },
      hasChangedSince: { tiles: false, players: false },
    });
    mockGetAdminDb.mockReturnValueOnce(db);
    const out = await rebuildWorldSnapshotServer();
    expect(out.tileCount).toBe(0);
    expect(out.ownerCount).toBe(0);
  });

  it("rebuilds when changes are detected", async () => {
    const { db, spies } = buildFakeDb({
      tiles: [
        {
          tileId: "0_0",
          q: 0,
          r: 0,
          type: "unassigned",
          units: { ground: 0, siege: 0, air: 0 },
        },
      ],
      players: [],
      existingSnapshot: {
        exists: true,
        data: {
          generatedAt: tsLike(new Date()),
          tileCount: 0,
          ownerCount: 0,
        },
      },
      hasChangedSince: { tiles: true, players: false },
    });
    mockGetAdminDb.mockReturnValueOnce(db);
    const out = await rebuildWorldSnapshotServer();
    expect(out.skipped).toBe(false);
    expect(spies.snapshotDocSet).toHaveBeenCalledTimes(1);
  });

  it("force: true bypasses the change-detection gate", async () => {
    const { db, spies } = buildFakeDb({
      tiles: [],
      players: [],
      existingSnapshot: {
        exists: true,
        data: {
          generatedAt: tsLike(new Date()),
          tileCount: 0,
          ownerCount: 0,
        },
      },
      hasChangedSince: { tiles: false, players: false },
    });
    mockGetAdminDb.mockReturnValueOnce(db);
    const out = await rebuildWorldSnapshotServer(new Date(), { force: true });
    expect(out.skipped).toBe(false);
    expect(spies.snapshotDocSet).toHaveBeenCalledTimes(1);
    // the change-detection where() should NOT have been called
    expect(spies.tilesWhere).not.toHaveBeenCalled();
  });
});

describe("readWorldSnapshotServer", () => {
  beforeEach(() => {
    mockGetAdminDb.mockReset();
  });

  it("returns null when admin db is missing", async () => {
    mockGetAdminDb.mockReturnValueOnce(null);
    const out = await readWorldSnapshotServer();
    expect(out).toBeNull();
  });

  it("returns null when the snapshot doc doesn't exist", async () => {
    const { db } = buildFakeDb({
      existingSnapshot: { exists: false },
    });
    mockGetAdminDb.mockReturnValueOnce(db);
    const out = await readWorldSnapshotServer();
    expect(out).toBeNull();
  });

  it("returns null when data exists but owners aren't an array", async () => {
    const { db } = buildFakeDb({
      existingSnapshot: {
        exists: true,
        data: {
          owners: "not-an-array" as unknown as never,
          generatedAt: tsLike(new Date()),
          expiresAt: tsLike(new Date()),
        },
      },
    });
    mockGetAdminDb.mockReturnValueOnce(db);
    const out = await readWorldSnapshotServer();
    expect(out).toBeNull();
  });

  it("returns null when neither compactTiles nor tiles is present", async () => {
    const { db } = buildFakeDb({
      existingSnapshot: {
        exists: true,
        data: {
          owners: [],
          generatedAt: tsLike(new Date()),
          expiresAt: tsLike(new Date()),
        },
      },
    });
    mockGetAdminDb.mockReturnValueOnce(db);
    const out = await readWorldSnapshotServer();
    expect(out).toBeNull();
  });

  it("decodes v2 compactTiles + isStale=false when expiresAt is in the future", async () => {
    const generatedAt = new Date("2026-05-18T00:00:00.000Z");
    const expiresAt = new Date(Date.now() + 60_000);
    const t = tile({ tileId: "0_0" });
    const { db } = buildFakeDb({
      existingSnapshot: {
        exists: true,
        data: {
          schemaVersion: 3,
          compactTiles: [compactTile(t)],
          owners: [{ userId: "u1", displayName: "A", isNpc: false }],
          generatedAt: tsLike(generatedAt),
          expiresAt: tsLike(expiresAt),
          tileCount: 1,
          ownerCount: 1,
        },
      },
    });
    mockGetAdminDb.mockReturnValueOnce(db);
    const out = await readWorldSnapshotServer();
    expect(out).not.toBeNull();
    expect(out!.snapshot.tileCount).toBe(1);
    expect(out!.snapshot.tiles[0].tileId).toBe("0_0");
    expect(out!.isStale).toBe(false);
  });

  it("decodes v1 tiles + isStale=true when expiresAt is in the past", async () => {
    const generatedAt = new Date("2026-05-18T00:00:00.000Z");
    const expiresAt = new Date(0);
    const { db } = buildFakeDb({
      existingSnapshot: {
        exists: true,
        data: {
          tiles: [tile({ tileId: "1_1", q: 1, r: 1 })],
          owners: [{ userId: "u1", displayName: "A", isNpc: false }],
          generatedAt: tsLike(generatedAt),
          expiresAt: tsLike(expiresAt),
        },
      },
    });
    mockGetAdminDb.mockReturnValueOnce(db);
    const out = await readWorldSnapshotServer();
    expect(out!.snapshot.tiles[0].tileId).toBe("1_1");
    expect(out!.snapshot.tileCount).toBe(1);
    expect(out!.snapshot.ownerCount).toBe(1);
    expect(out!.isStale).toBe(true);
  });

  it("falls back to epoch dates when generatedAt/expiresAt lack toDate()", async () => {
    const { db } = buildFakeDb({
      existingSnapshot: {
        exists: true,
        data: {
          compactTiles: [],
          owners: [],
          generatedAt: { foo: "bar" } as unknown as Date,
          expiresAt: { foo: "bar" } as unknown as Date,
          tileCount: 0,
          ownerCount: 0,
        },
      },
    });
    mockGetAdminDb.mockReturnValueOnce(db);
    const out = await readWorldSnapshotServer();
    expect(out!.snapshot.generatedAt).toBe(new Date(0).toISOString());
    expect(out!.isStale).toBe(true);
  });
});

describe("filterSnapshotToBbox", () => {
  it("keeps only tiles within the given inclusive bbox", () => {
    const snap: WorldSnapshot = {
      tiles: [
        tile({ tileId: "0_0", q: 0, r: 0 }),
        tile({ tileId: "5_5", q: 5, r: 5 }),
        tile({ tileId: "-1_0", q: -1, r: 0 }),
        tile({ tileId: "2_11", q: 2, r: 11 }),
      ],
      owners: [],
      generatedAt: new Date().toISOString(),
      tileCount: 4,
      ownerCount: 0,
    };
    const got = filterSnapshotToBbox(snap, {
      qMin: 0,
      qMax: 5,
      rMin: 0,
      rMax: 10,
    });
    expect(got.map((t) => t.tileId).sort()).toEqual(["0_0", "5_5"]);
  });
});

describe("deriveMyMapFromSnapshot", () => {
  it("returns my tiles, border tiles with enemy owners, and just those owner summaries", () => {
    // Tiles around origin: my tile at 0,0; enemy at 1,0 + 0,1; neutral at -1,0;
    // self at 1,1 (mine, neighbor of 1,0). 5,5 unrelated.
    const my1 = tile({ tileId: "0_0", q: 0, r: 0, ownerId: "me" });
    const my2 = tile({ tileId: "1_1", q: 1, r: 1, ownerId: "me" });
    const enemyA = tile({ tileId: "1_0", q: 1, r: 0, ownerId: "enemyA" });
    const enemyB = tile({ tileId: "0_1", q: 0, r: 1, ownerId: "enemyB" });
    const neutral = tile({ tileId: "-1_0", q: -1, r: 0, ownerId: null });
    const unrelated = tile({ tileId: "5_5", q: 5, r: 5, ownerId: "enemyC" });
    const snap: WorldSnapshot = {
      tiles: [my1, my2, enemyA, enemyB, neutral, unrelated],
      owners: [
        { userId: "me", displayName: "Me", caste: null, shielded: false, isNpc: false },
        { userId: "enemyA", displayName: "A", caste: null, shielded: false, isNpc: false },
        { userId: "enemyB", displayName: "B", caste: null, shielded: false, isNpc: false },
        { userId: "enemyC", displayName: "C", caste: null, shielded: false, isNpc: false },
      ],
      generatedAt: new Date().toISOString(),
      tileCount: 6,
      ownerCount: 4,
    };
    const out = deriveMyMapFromSnapshot(snap, "me");
    expect(new Set(out.myTiles.map((t) => t.tileId))).toEqual(
      new Set(["0_0", "1_1"])
    );
    // Neutral + my-own tiles are excluded from border; only enemyA + enemyB
    expect(new Set(out.borderTiles.map((t) => t.tileId))).toEqual(
      new Set(["1_0", "0_1"])
    );
    // Only enemy owners that border me — enemyC is too far
    expect(new Set(out.owners.map((o) => o.userId))).toEqual(
      new Set(["enemyA", "enemyB"])
    );
  });

  it("returns empty arrays when the user has no tiles", () => {
    const snap: WorldSnapshot = {
      tiles: [tile({ tileId: "0_0", ownerId: "other" })],
      owners: [
        { userId: "other", displayName: "Other", caste: null, shielded: false, isNpc: false },
      ],
      generatedAt: new Date().toISOString(),
      tileCount: 1,
      ownerCount: 1,
    };
    const out = deriveMyMapFromSnapshot(snap, "me");
    expect(out.myTiles).toEqual([]);
    expect(out.borderTiles).toEqual([]);
    expect(out.owners).toEqual([]);
  });
});
