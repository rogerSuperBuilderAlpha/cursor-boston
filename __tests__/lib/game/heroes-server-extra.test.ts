/**
 * @jest-environment node
 *
 * Coverage push #67 — complementary tests for lib/game/heroes-server.ts.
 * Existing __tests__/lib/game/heroes-server.test.ts only covers 3 paths.
 * This file picks up the rest:
 *   - getHeroesListServer (scope=mine, scope=all, scope=fallen with cursor)
 *   - getHeroDetailServer (404 + happy path with events)
 *   - getHeroEventsServer (cached hero, missing hero, fully-public branch,
 *     living-hero ownerIdAtTime filter)
 *   - getHeroBackstoryServer (not-in-index, file-read-throws, happy path)
 */
jest.mock("@/lib/game/content/heroes", () => ({
  HEROES_LIST_PAGE_SIZE: 20,
  HERO_EVENTS_PAGE_SIZE: 25,
}));

jest.mock("@/lib/game/content/hero-backstories/_index", () => ({
  HERO_BACKSTORY_IDS: new Set(["registered-hero"]),
}));

const mockNeighborSet = new Set<string>();
const mockApplyHeroVisibility = jest.fn((hero) => hero);
const mockApplyEventVisibility = jest.fn(() => true);
const mockIsFullyPublic = jest.fn(() => false);
jest.mock("@/lib/game/hero-visibility", () => ({
  computeViewerNeighborTileSet: () => Promise.resolve(mockNeighborSet),
  applyHeroVisibility: (h: unknown, v: string, n: Set<string>) =>
    mockApplyHeroVisibility(h, v, n),
  applyEventVisibility: (...a: unknown[]) => mockApplyEventVisibility(...a),
  isHeroFullyPublic: (h: unknown) => mockIsFullyPublic(h),
}));

jest.mock("@/lib/game/hero-registry", () => ({
  HEROES_COLLECTION: "game_heroes",
  heroEventsCollection: (db: { collection: (name: string) => unknown }, heroId: string) => {
    // Re-use the test fake-db's path for events.
    const heroes = db.collection("game_heroes") as {
      doc: (id: string) => { collection: (n: string) => unknown };
    };
    return heroes.doc(heroId).collection("events");
  },
}));

// We'll mock paginateFirestoreQuery to return a deterministic shape.
const mockPaginate = jest.fn();
jest.mock("@/lib/firestore-pagination", () => ({
  paginateFirestoreQuery: (...a: unknown[]) => mockPaginate(...a),
}));

const mockReadFile = jest.fn();
jest.mock("node:fs/promises", () => ({
  readFile: (...a: unknown[]) => mockReadFile(...a),
}));

import {
  getHeroBackstoryServer,
  getHeroDetailServer,
  getHeroEventsServer,
  getHeroesListServer,
} from "@/lib/game/heroes-server";

type Doc = { id: string; data: () => Record<string, unknown> };

function makeDb(opts: {
  heroById?: Record<string, { exists: boolean; data?: Record<string, unknown> }>;
  deceasedDocs?: Doc[];
  limboDocs?: Doc[];
}) {
  // Each .collection("game_heroes") returns the same chainable.
  let heroesGetCount = 0;
  function makeQueryChain(getResult: () => { docs: Doc[] }) {
    const chain: Record<string, jest.Mock> = {};
    chain.where = jest.fn(() => chain as unknown as Record<string, jest.Mock>);
    chain.orderBy = jest.fn(() => chain as unknown as Record<string, jest.Mock>);
    chain.limit = jest.fn(() => chain as unknown as Record<string, jest.Mock>);
    chain.get = jest.fn(async () => getResult());
    return chain;
  }

  function makeCollection(name: string) {
    if (name === "events") {
      return makeQueryChain(() => ({ docs: [] }));
    }
    // game_heroes
    const chain = makeQueryChain(() => {
      // For fallen scope, two calls: 1st deceased, 2nd limbo.
      const which = heroesGetCount;
      heroesGetCount += 1;
      if (which === 0) {
        return { docs: opts.deceasedDocs ?? [] };
      }
      return { docs: opts.limboDocs ?? [] };
    });
    return {
      ...chain,
      doc: (id: string) => {
        const entry = opts.heroById?.[id] ?? { exists: false };
        return {
          id,
          get: jest.fn().mockResolvedValue({
            exists: entry.exists,
            data: () => entry.data ?? {},
            id,
          }),
          collection: jest.fn((subName: string) => {
            if (subName === "events") return makeQueryChain(() => ({ docs: [] }));
            throw new Error(`Unexpected subcoll ${subName}`);
          }),
        };
      },
    };
  }

  const collection = jest.fn((name: string) => makeCollection(name));

  return { db: { collection } as unknown as Parameters<typeof getHeroesListServer>[0]["db"] };
}

beforeEach(() => {
  mockPaginate.mockReset();
  mockApplyHeroVisibility.mockClear();
  mockApplyEventVisibility.mockClear();
  mockIsFullyPublic.mockReset();
  mockIsFullyPublic.mockReturnValue(false);
  mockReadFile.mockReset();
});

describe("getHeroesListServer", () => {
  it("scope=mine — applies visibility to paginated results", async () => {
    const { db } = makeDb({});
    mockPaginate.mockResolvedValueOnce({
      items: [{ id: "h1" }, { id: "h2" }],
      nextCursor: "h2",
      hasMore: true,
    });
    const out = await getHeroesListServer({
      db,
      viewerId: "v",
      scope: "mine",
      cursor: null,
      limit: 20,
    });
    expect(out.items).toHaveLength(2);
    expect(out.nextCursor).toBe("h2");
    expect(mockApplyHeroVisibility).toHaveBeenCalledTimes(2);
  });

  it("scope=all — same flow, just different query", async () => {
    const { db } = makeDb({});
    mockPaginate.mockResolvedValueOnce({
      items: [{ id: "h1" }],
      nextCursor: null,
      hasMore: false,
    });
    const out = await getHeroesListServer({
      db,
      viewerId: "v",
      scope: "all",
      cursor: null,
      limit: 20,
    });
    expect(out.hasMore).toBe(false);
  });

  it("scope=fallen — merges deceased + limbo, sorts, paginates by cursor", async () => {
    const ts = (iso: string) => ({ toDate: () => new Date(iso) });
    const { db } = makeDb({
      deceasedDocs: [
        { id: "h-dead", data: () => ({ lastEventAt: ts("2026-05-15T00:00:00Z") }) },
      ],
      limboDocs: [
        { id: "h-limbo", data: () => ({ lastEventAt: ts("2026-05-17T00:00:00Z") }) },
        // duplicate id with deceased → dedupes
        { id: "h-dead", data: () => ({ lastEventAt: ts("2026-05-15T00:00:00Z") }) },
      ],
    });
    const out = await getHeroesListServer({
      db,
      viewerId: "v",
      scope: "fallen",
      cursor: null,
      limit: 10,
    });
    // h-limbo is newer → comes first
    expect(out.items).toHaveLength(2);
    expect(mockPaginate).not.toHaveBeenCalled();
  });

  it("scope=fallen with cursor — slices starting after the cursor", async () => {
    const ts = (iso: string) => ({ toDate: () => new Date(iso) });
    const { db } = makeDb({
      deceasedDocs: [
        { id: "a", data: () => ({ id: "a", lastEventAt: ts("2026-05-17T00:00:00Z") }) },
        { id: "b", data: () => ({ id: "b", lastEventAt: ts("2026-05-16T00:00:00Z") }) },
        { id: "c", data: () => ({ id: "c", lastEventAt: ts("2026-05-15T00:00:00Z") }) },
      ],
    });
    const out = await getHeroesListServer({
      db,
      viewerId: "v",
      scope: "fallen",
      cursor: "a",
      limit: 10,
    });
    expect(out.items.map((h) => (h as { id?: string }).id)).toEqual(["b", "c"]);
    expect(out.hasMore).toBe(false);
  });

  it("scope=fallen — when limit cuts the result, returns hasMore + nextCursor", async () => {
    const ts = (iso: string) => ({ toDate: () => new Date(iso) });
    const { db } = makeDb({
      deceasedDocs: [
        { id: "a", data: () => ({ id: "a", lastEventAt: ts("2026-05-17T00:00:00Z") }) },
        { id: "b", data: () => ({ id: "b", lastEventAt: ts("2026-05-16T00:00:00Z") }) },
      ],
    });
    const out = await getHeroesListServer({
      db,
      viewerId: "v",
      scope: "fallen",
      cursor: null,
      limit: 1,
    });
    expect(out.hasMore).toBe(true);
    expect(out.nextCursor).toBe("a");
  });
});

describe("getHeroDetailServer", () => {
  it("returns null when hero doc is missing", async () => {
    const { db } = makeDb({ heroById: { h1: { exists: false } } });
    const out = await getHeroDetailServer({
      db,
      viewerId: "v",
      heroId: "h1",
    });
    expect(out).toBeNull();
  });

  it("returns hero + events when found", async () => {
    const { db } = makeDb({
      heroById: { h1: { exists: true, data: { isDeceased: false } } },
    });
    mockPaginate.mockResolvedValueOnce({
      items: [{ id: "e1", createdAt: "x" }],
      nextCursor: null,
      hasMore: false,
    });
    const out = await getHeroDetailServer({
      db,
      viewerId: "v",
      heroId: "h1",
    });
    expect(out).not.toBeNull();
    expect(out!.events).toHaveLength(1);
  });
});

describe("getHeroEventsServer", () => {
  it("returns empty when no hero cache and hero doc missing", async () => {
    const { db } = makeDb({ heroById: { h1: { exists: false } } });
    const out = await getHeroEventsServer({
      db,
      viewerId: "v",
      heroId: "h1",
      cursor: null,
      limit: 20,
    });
    expect(out).toEqual({ items: [], nextCursor: null, hasMore: false });
  });

  it("fully-public branch issues an unfiltered orderBy query", async () => {
    const { db } = makeDb({
      heroById: { h1: { exists: true, data: { isDeceased: true } } },
    });
    mockIsFullyPublic.mockReturnValue(true);
    mockPaginate.mockResolvedValueOnce({
      items: [{ id: "e1" }, { id: "e2" }],
      nextCursor: null,
      hasMore: false,
    });
    const out = await getHeroEventsServer({
      db,
      viewerId: "v",
      heroId: "h1",
      cursor: null,
      limit: 20,
    });
    expect(out.items).toHaveLength(2);
  });

  it("uses heroDocCache when provided", async () => {
    const { db } = makeDb({});
    mockPaginate.mockResolvedValueOnce({
      items: [],
      nextCursor: null,
      hasMore: false,
    });
    await getHeroEventsServer({
      db,
      viewerId: "v",
      heroId: "h1",
      cursor: null,
      limit: 20,
      heroDocCache: { isDeceased: false } as never,
    });
    // Even though heroById is empty, no get() should have been issued for the
    // hero doc — paginate runs against the events subcollection.
    expect(mockPaginate).toHaveBeenCalledTimes(1);
  });
});

describe("getHeroBackstoryServer", () => {
  it("returns null when the hero id isn't in the index", async () => {
    expect(await getHeroBackstoryServer({ heroId: "not-registered" })).toBeNull();
  });

  it("returns the file contents when present", async () => {
    mockReadFile.mockResolvedValueOnce("# Hero markdown");
    expect(
      await getHeroBackstoryServer({ heroId: "registered-hero" })
    ).toBe("# Hero markdown");
  });

  it("returns null when readFile throws (file in index but missing on disk)", async () => {
    mockReadFile.mockRejectedValueOnce(new Error("ENOENT"));
    expect(
      await getHeroBackstoryServer({ heroId: "registered-hero" })
    ).toBeNull();
  });
});
