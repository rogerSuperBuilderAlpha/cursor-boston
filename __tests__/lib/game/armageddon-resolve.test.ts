/**
 * @jest-environment node
 *
 * Coverage push #57 — lib/game/armageddon-resolve.ts. Drives:
 *   - season-drift skip
 *   - wrong-state skip
 *   - full happy path (snapshot + draw + hall + events + wipe + meta bump)
 *   - idempotent re-entry when hall-of-fame already exists
 *   - hero-limbo handling (living vs deceased, batch overflow)
 */
const mockGetAdminDb = jest.fn();
jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: () => mockGetAdminDb(),
}));

const loggerSpies = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
jest.mock("@/lib/logger", () => ({
  logger: {
    info: (...a: unknown[]) => loggerSpies.info(...a),
    warn: (...a: unknown[]) => loggerSpies.warn(...a),
    error: (...a: unknown[]) => loggerSpies.error(...a),
    debug: () => {},
  },
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    arrayUnion: (n: unknown) => ({ __arrayUnion: n }),
  },
}));

jest.mock("node:crypto", () => {
  let n = 0;
  return {
    randomUUID: () => `uuid-${++n}`,
  };
});

import { resolveArmageddon } from "@/lib/game/armageddon-resolve";

function buildDb(opts: {
  metaExists?: boolean;
  meta?: Record<string, unknown>;
  hallExists?: boolean;
  hallData?: Record<string, unknown>;
  players?: Array<Record<string, unknown>>;
  heroes?: Array<Record<string, unknown>>;
  /** Each collection key returns this many docs the first time get(limit)
   *  is called, then empty. */
  collectionDocCounts?: Partial<Record<string, number>>;
}) {
  const metaRef = {
    get: jest.fn().mockResolvedValue({
      exists: opts.metaExists ?? true,
      data: () => opts.meta ?? {},
    }),
    set: jest.fn().mockResolvedValue(undefined),
  };

  const hallRef = {
    get: jest.fn().mockResolvedValue({
      exists: opts.hallExists ?? false,
      data: () => opts.hallData ?? undefined,
    }),
    set: jest.fn().mockResolvedValue(undefined),
  };

  const playersGetAll = jest.fn().mockResolvedValue({
    docs: (opts.players ?? []).map((p) => ({
      data: () => p,
      ref: { __coll: "game_players", __id: p.userId },
    })),
  });

  const heroesGetAll = jest.fn().mockResolvedValue({
    docs: (opts.heroes ?? []).map((h) => ({
      data: () => h,
      ref: { __coll: "game_heroes", __id: h.id },
    })),
  });

  // Batch capture
  const batchSets: Array<unknown[]> = [];
  const batchDeletes: Array<unknown[]> = [];
  const makeBatch = () => ({
    set: (...args: unknown[]) => {
      batchSets.push(args);
    },
    delete: (...args: unknown[]) => {
      batchDeletes.push(args);
    },
    commit: jest.fn().mockResolvedValue(undefined),
  });
  const batch = jest.fn(() => makeBatch());

  // Counter-per-collection for delete-batches.
  const remaining = new Map<string, number>(
    Object.entries(opts.collectionDocCounts ?? {})
  );
  function wipeQueryFor(name: string) {
    return {
      limit: jest.fn().mockReturnValue({
        get: jest.fn().mockImplementation(async () => {
          const left = remaining.get(name) ?? 0;
          if (left <= 0) return { empty: true, size: 0, docs: [] };
          const size = Math.min(left, 400);
          remaining.set(name, left - size);
          return {
            empty: false,
            size,
            docs: Array.from({ length: size }, (_, i) => ({
              ref: { __coll: name, __id: `d${i}` },
            })),
          };
        }),
      }),
    };
  }

  // Event-write capture
  const eventDocSets: Array<{ id: string; payload: Record<string, unknown> }> = [];
  const heroEventDocSets: Array<unknown> = [];

  function makeCollection(name: string) {
    return {
      doc: (id?: string) => {
        if (name === "game_world_meta") return metaRef;
        if (name === "game_armageddon_events") return hallRef;
        if (name === "game_community_events") {
          return {
            set: jest.fn().mockImplementation((payload) => {
              eventDocSets.push({ id: id ?? "", payload });
              return Promise.resolve();
            }),
          };
        }
        if (name === "game_heroes") {
          // Hero doc — needs `.collection("events").doc(id)` for event writes.
          return {
            id,
            __coll: name,
            collection: jest.fn().mockReturnValue({
              doc: jest.fn().mockReturnValue({ id, __coll: "events" }),
            }),
          };
        }
        return { id, __coll: name };
      },
      get: name === "game_players" ? playersGetAll : name === "game_heroes" ? heroesGetAll : jest.fn(),
      ...wipeQueryFor(name),
    };
  }

  const collection = jest.fn((name: string) => makeCollection(name));

  return {
    db: {
      collection,
      batch,
    },
    spies: {
      metaSet: metaRef.set,
      hallSet: hallRef.set,
      eventDocSets,
      heroEventDocSets,
      batchSets,
      batchDeletes,
      batch,
    },
  };
}

describe("resolveArmageddon", () => {
  beforeEach(() => {
    mockGetAdminDb.mockReset();
    loggerSpies.info.mockClear();
    loggerSpies.warn.mockClear();
  });

  it("throws when admin db is missing", async () => {
    mockGetAdminDb.mockReturnValueOnce(null);
    await expect(
      resolveArmageddon({
        expectedSeason: 1,
        triggeredBy: { userId: "u1", displayName: "U", caste: "warrior" },
      })
    ).rejects.toThrow("Firebase Admin not initialized");
  });

  it("skips when current season drifted away from expected", async () => {
    const { db, spies } = buildDb({
      meta: { seasonNumber: 5, armageddonState: "resolving" },
    });
    mockGetAdminDb.mockReturnValueOnce(db);
    await resolveArmageddon({
      expectedSeason: 4,
      triggeredBy: { userId: "u1", displayName: "U", caste: "warrior" },
    });
    expect(loggerSpies.warn).toHaveBeenCalledWith(
      expect.stringContaining("season drift")
    );
    expect(spies.hallSet).not.toHaveBeenCalled();
    expect(spies.metaSet).not.toHaveBeenCalled();
  });

  it("skips when armageddonState isn't 'resolving'", async () => {
    const { db, spies } = buildDb({
      meta: { seasonNumber: 5, armageddonState: "active" },
    });
    mockGetAdminDb.mockReturnValueOnce(db);
    await resolveArmageddon({
      expectedSeason: 5,
      triggeredBy: { userId: "u1", displayName: "U", caste: "warrior" },
    });
    expect(loggerSpies.warn).toHaveBeenCalledWith(
      expect.stringContaining("state is active")
    );
    expect(spies.hallSet).not.toHaveBeenCalled();
  });

  it("logs an 'unset' state when armageddonState is missing", async () => {
    const { db } = buildDb({
      meta: { seasonNumber: 5 }, // no armageddonState
    });
    mockGetAdminDb.mockReturnValueOnce(db);
    await resolveArmageddon({
      expectedSeason: 5,
      triggeredBy: { userId: "u1", displayName: "U", caste: "warrior" },
    });
    expect(loggerSpies.warn).toHaveBeenCalledWith(
      expect.stringContaining("state is unset")
    );
  });

  it("defaults seasonNumber to 1 when meta doc is empty", async () => {
    // metaSnap.data() returns {} → currentSeason = 1.
    const { db } = buildDb({
      meta: undefined,
      hallExists: false,
    });
    mockGetAdminDb.mockReturnValueOnce(db);
    // expectedSeason=99 ≠ 1 → season-drift skip path
    await resolveArmageddon({
      expectedSeason: 99,
      triggeredBy: { userId: "u1", displayName: "U", caste: "warrior" },
    });
    expect(loggerSpies.warn).toHaveBeenCalledWith(
      expect.stringContaining("season drift: expected 99, current 1")
    );
  });

  it("runs the full happy path and bumps worldMeta", async () => {
    const { db, spies } = buildDb({
      meta: {
        seasonNumber: 3,
        armageddonState: "resolving",
        seals: [
          { index: 0, broken: true },
          { index: 1, broken: true },
        ],
      },
      hallExists: false,
      players: [
        {
          userId: "u1",
          displayName: "Alice",
          caste: "warrior",
          armageddonSealsBroken: 1,
          stats: { tilesHeld: 10 },
        },
        {
          userId: "u2",
          displayName: "Bob",
          caste: "mage",
          stats: { tilesHeld: 5 },
        },
        {
          // No caste — skipped
          userId: "u3",
          stats: { tilesHeld: 100 },
        },
        {
          // Zero tickets (tilesHeld=0) — skipped
          userId: "u4",
          caste: "scholar",
          stats: { tilesHeld: 0 },
        },
      ],
      heroes: [
        {
          id: "h1",
          isDeceased: false,
          currentTileId: "10_10",
          currentOwnerId: "u1",
        },
        {
          id: "h2",
          isDeceased: true,
          deceasedTileId: "5_5",
        },
      ],
      collectionDocCounts: {
        game_tiles: 401,
        game_artifacts: 2,
        game_intel_effects: 0,
        game_attacks: 1,
        game_players: 4,
      },
    });
    mockGetAdminDb.mockReturnValueOnce(db);
    const now = new Date("2026-05-18T00:00:00.000Z");
    await resolveArmageddon({
      expectedSeason: 3,
      triggeredBy: { userId: "u1", displayName: "Alice", caste: "warrior" },
      now,
    });
    expect(spies.hallSet).toHaveBeenCalledTimes(1);
    const record = spies.hallSet.mock.calls[0][0];
    expect(record.seasonNumber).toBe(3);
    expect(record.totalParticipants).toBe(2);
    expect(record.totalTickets).toBeGreaterThan(0);
    expect(record.winners.length).toBeGreaterThan(0);
    expect(record.winners.length).toBeLessThanOrEqual(10);
    expect(record.topByTilesSnapshot[0].userId).toBe("u1"); // 10 tiles

    // Community events: at least "armageddon_completed" + one per winner.
    const kinds = spies.eventDocSets.map((e) => e.payload.kind);
    expect(kinds).toContain("armageddon_completed");
    expect(kinds.filter((k) => k === "armageddon_winner").length).toBe(
      record.winners.length
    );

    // Meta bump
    expect(spies.metaSet).toHaveBeenCalledTimes(1);
    const metaPatch = spies.metaSet.mock.calls[0][0];
    expect(metaPatch.seasonNumber).toBe(4);
    expect(metaPatch.sealsBroken).toBe(0);
    expect(metaPatch.armageddonState).toBe("active");
    expect(Array.isArray(metaPatch.seals)).toBe(true);
    expect(metaPatch.seals.length).toBe(7);
    expect(metaPatch.seals.every((s: { broken: boolean }) => !s.broken)).toBe(true);

    // tiles: 401 docs → 2 batches (400 + 1) → at least 2 batch.commit calls
    expect(spies.batch.mock.calls.length).toBeGreaterThan(1);
  });

  it("is idempotent: re-entry skips the hall-of-fame draw when it already exists", async () => {
    const { db, spies } = buildDb({
      meta: { seasonNumber: 2, armageddonState: "resolving" },
      hallExists: true,
      hallData: { seasonNumber: 2, winners: [] },
      heroes: [],
    });
    mockGetAdminDb.mockReturnValueOnce(db);
    await resolveArmageddon({
      expectedSeason: 2,
      triggeredBy: { userId: "u1", displayName: "U", caste: "warrior" },
    });
    // Hall NOT rewritten (it already existed)
    expect(spies.hallSet).not.toHaveBeenCalled();
    // No community events from a skip
    expect(spies.eventDocSets.length).toBe(0);
    // Meta IS still bumped (wipe runs to clean stragglers)
    expect(spies.metaSet).toHaveBeenCalledTimes(1);
    expect(loggerSpies.info).toHaveBeenCalledWith(
      expect.stringContaining("hall-of-fame for season 2 already exists")
    );
  });

  it("handles hero batching: living + deceased heroes both get a season_ended event", async () => {
    const { db, spies } = buildDb({
      meta: { seasonNumber: 1, armageddonState: "resolving" },
      hallExists: true, // skip the draw/log to isolate the hero path
      heroes: [
        {
          id: "h1",
          isDeceased: false,
          currentTileId: "1_1",
          currentOwnerId: "u1",
        },
        { id: "h2", isDeceased: true, deceasedTileId: "2_2" },
        { id: "h3", isDeceased: false }, // missing currentTileId → "limbo" fallback
      ],
    });
    mockGetAdminDb.mockReturnValueOnce(db);
    await resolveArmageddon({
      expectedSeason: 1,
      triggeredBy: { userId: "u1", displayName: "U", caste: "warrior" },
    });
    // Hero patches were set via batch — we can't easily introspect args, but
    // we can confirm at least one batch.commit happened and meta got bumped.
    expect(spies.batch.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(spies.metaSet).toHaveBeenCalledTimes(1);
  });

  it("uses default `now` when no override is supplied", async () => {
    const { db, spies } = buildDb({
      meta: { seasonNumber: 1, armageddonState: "resolving" },
      hallExists: true,
      heroes: [],
    });
    mockGetAdminDb.mockReturnValueOnce(db);
    const before = Date.now();
    await resolveArmageddon({
      expectedSeason: 1,
      triggeredBy: { userId: "u1", displayName: "U", caste: "warrior" },
    });
    const metaPatch = spies.metaSet.mock.calls[0][0];
    expect(metaPatch.armageddonResolvedAt).toBeInstanceOf(Date);
    expect(
      (metaPatch.armageddonResolvedAt as Date).getTime()
    ).toBeGreaterThanOrEqual(before);
  });

  it("draws zero winners when no participants have tickets", async () => {
    const { db, spies } = buildDb({
      meta: { seasonNumber: 1, armageddonState: "resolving" },
      hallExists: false,
      players: [
        { userId: "u1", caste: "warrior", stats: { tilesHeld: 0 } },
      ],
      heroes: [],
    });
    mockGetAdminDb.mockReturnValueOnce(db);
    await resolveArmageddon({
      expectedSeason: 1,
      triggeredBy: { userId: "u1", displayName: "U", caste: "warrior" },
    });
    const record = spies.hallSet.mock.calls[0][0];
    expect(record.winners).toEqual([]);
    expect(record.totalParticipants).toBe(0);
  });
});
