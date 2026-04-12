/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/cookbook/entries/route";
import { getVerifiedUser } from "@/lib/server-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { checkRateLimit } from "@/lib/rate-limit";

jest.mock("@/lib/logger", () => ({
  logger: { logError: jest.fn(), warn: jest.fn() },
}));

jest.mock("@/lib/rate-limit", () => {
  const actual = jest.requireActual("@/lib/rate-limit");
  return {
    ...actual,
    getClientIdentifier: jest.fn(() => "test-client"),
    checkRateLimit: jest.fn(() => ({ success: true, retryAfter: 0 })),
  };
});

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(),
}));

jest.mock("@/lib/cookbook-search", () => ({
  matchesCookbookSearchTerms: jest.fn(
    (title: string, _desc: string, _tags: string[], terms: string[]) =>
      terms.every((t: string) => title.toLowerCase().includes(t))
  ),
}));

jest.mock("@/lib/sanitize", () => ({
  sanitizeText: jest.fn((s: string) => s),
  sanitizeDocId: jest.fn((s: string) => (s && /^[a-zA-Z0-9_-]+$/.test(s) ? s : null)),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockCheckRateLimit = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;

/* ─── helpers ─── */

function makeFakeDoc(id: string, data: Record<string, unknown>) {
  return {
    id,
    exists: true,
    data: () => data,
  };
}

function makeQuerySnapshot(docs: ReturnType<typeof makeFakeDoc>[]) {
  return {
    empty: docs.length === 0,
    size: docs.length,
    docs,
  };
}

function buildMockDb({
  snapshots = [makeQuerySnapshot([])],
  cursorDoc = { exists: false, data: () => null },
  addResult = { id: "new-entry-id" },
}: {
  snapshots?: ReturnType<typeof makeQuerySnapshot>[];
  cursorDoc?: { exists: boolean; data: () => unknown };
  addResult?: { id: string };
} = {}) {
  let snapshotIndex = 0;
  const mockGet = jest.fn(() => {
    const snap = snapshots[snapshotIndex] ?? snapshots[snapshots.length - 1];
    snapshotIndex++;
    return Promise.resolve(snap);
  });

  const chainable = {
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    startAfter: jest.fn().mockReturnThis(),
    get: mockGet,
  };

  const mockDocGet = jest.fn().mockResolvedValue(cursorDoc);
  const mockAdd = jest.fn().mockResolvedValue(addResult);

  const db = {
    collection: jest.fn(() => ({
      ...chainable,
      doc: jest.fn(() => ({
        get: mockDocGet,
      })),
      add: mockAdd,
    })),
  };

  return { db, mockGet, mockDocGet, mockAdd, chainable };
}

function makeGetRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/cookbook/entries");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url);
}

function makePostRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/cookbook/entries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/* ─── GET tests ─── */

describe("GET /api/cookbook/entries", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns empty results when db is null", async () => {
    mockGetAdminDb.mockReturnValue(null as never);
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ entries: [], nextCursor: null, hasMore: false });
  });

  it("returns entries with default pagination", async () => {
    const docs = [
      makeFakeDoc("e1", {
        title: "First",
        description: "Desc 1",
        promptContent: "Prompt 1",
        category: "testing",
        tags: ["jest"],
        worksWith: ["TypeScript"],
        authorId: "u1",
        authorDisplayName: "User 1",
        createdAt: { toMillis: () => 1700000000000 },
        upCount: 5,
        downCount: 1,
      }),
    ];
    const { db } = buildMockDb({ snapshots: [makeQuerySnapshot(docs)] });
    mockGetAdminDb.mockReturnValue(db as never);

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0].id).toBe("e1");
    expect(body.entries[0].title).toBe("First");
    expect(body.entries[0].upCount).toBe(5);
    expect(body.hasMore).toBe(false);
    expect(body.nextCursor).toBeNull();
  });

  it("respects limit parameter capped at MAX_PAGE_SIZE", async () => {
    const { db, chainable } = buildMockDb();
    mockGetAdminDb.mockReturnValue(db as never);

    await GET(makeGetRequest({ limit: "100" }));
    // MAX_PAGE_SIZE is 24, so limit(24 + 1) = 25
    expect(chainable.limit).toHaveBeenCalledWith(25);
  });

  it("applies category filter", async () => {
    const { db, chainable } = buildMockDb();
    mockGetAdminDb.mockReturnValue(db as never);

    await GET(makeGetRequest({ category: "testing" }));
    expect(chainable.where).toHaveBeenCalledWith("category", "==", "testing");
  });

  it("applies worksWith filter", async () => {
    const { db, chainable } = buildMockDb();
    mockGetAdminDb.mockReturnValue(db as never);

    await GET(makeGetRequest({ worksWith: "TypeScript" }));
    expect(chainable.where).toHaveBeenCalledWith(
      "worksWith",
      "array-contains",
      "TypeScript"
    );
  });

  it("applies sort=oldest ordering", async () => {
    const { db, chainable } = buildMockDb();
    mockGetAdminDb.mockReturnValue(db as never);

    await GET(makeGetRequest({ sort: "oldest" }));
    expect(chainable.orderBy).toHaveBeenCalledWith("createdAt", "asc");
  });

  it("applies sort=top ordering", async () => {
    const { db, chainable } = buildMockDb();
    mockGetAdminDb.mockReturnValue(db as never);

    await GET(makeGetRequest({ sort: "top" }));
    expect(chainable.orderBy).toHaveBeenCalledWith("netScore", "desc");
  });

  it("indicates hasMore when results exceed limit", async () => {
    // Create 13 docs (limit default 12 + 1 extra signals hasMore)
    const docs = Array.from({ length: 13 }, (_, i) =>
      makeFakeDoc(`e${i}`, {
        title: `Entry ${i}`,
        description: "",
        promptContent: "",
        category: "other",
        tags: [],
        worksWith: [],
        authorId: "u1",
        authorDisplayName: "User",
        createdAt: { toMillis: () => 1700000000000 },
        upCount: 0,
        downCount: 0,
      })
    );
    const { db } = buildMockDb({ snapshots: [makeQuerySnapshot(docs)] });
    mockGetAdminDb.mockReturnValue(db as never);

    const res = await GET(makeGetRequest());
    const body = await res.json();
    expect(body.entries).toHaveLength(12);
    expect(body.hasMore).toBe(true);
    expect(body.nextCursor).toBe("e11");
  });

  it("returns filtered results for search query", async () => {
    const docs = [
      makeFakeDoc("e1", {
        title: "React hooks guide",
        description: "Desc",
        promptContent: "Content",
        category: "other",
        tags: [],
        worksWith: [],
        authorId: "u1",
        authorDisplayName: "User",
        createdAt: { toMillis: () => 1700000000000 },
        upCount: 0,
        downCount: 0,
      }),
      makeFakeDoc("e2", {
        title: "Python tips",
        description: "Desc",
        promptContent: "Content",
        category: "other",
        tags: [],
        worksWith: [],
        authorId: "u1",
        authorDisplayName: "User",
        createdAt: { toMillis: () => 1700000000000 },
        upCount: 0,
        downCount: 0,
      }),
    ];
    const { db } = buildMockDb({ snapshots: [makeQuerySnapshot(docs)] });
    mockGetAdminDb.mockReturnValue(db as never);

    const res = await GET(makeGetRequest({ search: "react" }));
    const body = await res.json();
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0].title).toBe("React hooks guide");
  });

  it("returns graceful empty response on error", async () => {
    mockGetAdminDb.mockImplementation(() => {
      throw new Error("boom");
    });
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ entries: [], nextCursor: null, hasMore: false });
  });
});

/* ─── POST tests ─── */

describe("POST /api/cookbook/entries", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ success: true, retryAfter: 0 });
  });

  it("returns 429 when rate limited", async () => {
    mockCheckRateLimit.mockReturnValue({ success: false, retryAfter: 30 });
    const res = await POST(
      makePostRequest({ title: "T", description: "D", promptContent: "P" })
    );
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toMatch(/too many/i);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await POST(
      makePostRequest({ title: "T", description: "D", promptContent: "P" })
    );
    expect(res.status).toBe(401);
  });

  it("returns 500 when db is not configured", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", name: "Test" });
    mockGetAdminDb.mockReturnValue(null as never);
    const res = await POST(
      makePostRequest({ title: "T", description: "D", promptContent: "P" })
    );
    expect(res.status).toBe(500);
  });

  it("returns 400 when title is missing", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", name: "Test" });
    const { db } = buildMockDb();
    mockGetAdminDb.mockReturnValue(db as never);

    const res = await POST(
      makePostRequest({ title: "", description: "D", promptContent: "P" })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/required/i);
  });

  it("returns 400 when description is missing", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", name: "Test" });
    const { db } = buildMockDb();
    mockGetAdminDb.mockReturnValue(db as never);

    const res = await POST(
      makePostRequest({ title: "T", description: "", promptContent: "P" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when promptContent is missing", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", name: "Test" });
    const { db } = buildMockDb();
    mockGetAdminDb.mockReturnValue(db as never);

    const res = await POST(
      makePostRequest({ title: "T", description: "D", promptContent: "" })
    );
    expect(res.status).toBe(400);
  });

  it("creates an entry successfully", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", name: "Test User" });
    const { db, mockAdd } = buildMockDb({ addResult: { id: "new-id-123" } });
    mockGetAdminDb.mockReturnValue(db as never);

    const res = await POST(
      makePostRequest({
        title: "My Prompt",
        description: "A great prompt",
        promptContent: "Do the thing",
        category: "testing",
        tags: ["jest", "unit"],
        worksWith: ["TypeScript", "React"],
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("new-id-123");
    expect(body.title).toBe("My Prompt");
    expect(body.category).toBe("testing");
    expect(body.tags).toEqual(["jest", "unit"]);
    expect(body.worksWith).toEqual(["TypeScript", "React"]);
    expect(body.authorId).toBe("u1");
    expect(body.upCount).toBe(0);
    expect(body.downCount).toBe(0);
    expect(mockAdd).toHaveBeenCalledTimes(1);
  });

  it("defaults invalid category to 'other'", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", name: "Test" });
    const { db } = buildMockDb({ addResult: { id: "x" } });
    mockGetAdminDb.mockReturnValue(db as never);

    const res = await POST(
      makePostRequest({
        title: "T",
        description: "D",
        promptContent: "P",
        category: "invalid-category",
      })
    );
    const body = await res.json();
    expect(body.category).toBe("other");
  });

  it("filters invalid worksWith values", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", name: "Test" });
    const { db } = buildMockDb({ addResult: { id: "x" } });
    mockGetAdminDb.mockReturnValue(db as never);

    const res = await POST(
      makePostRequest({
        title: "T",
        description: "D",
        promptContent: "P",
        worksWith: ["TypeScript", "NotALanguage"],
      })
    );
    const body = await res.json();
    expect(body.worksWith).toEqual(["TypeScript"]);
  });

  it("returns 500 on unexpected error", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", name: "Test" });
    const { db, mockAdd } = buildMockDb();
    mockAdd.mockRejectedValue(new Error("firestore down"));
    mockGetAdminDb.mockReturnValue(db as never);

    const res = await POST(
      makePostRequest({
        title: "T",
        description: "D",
        promptContent: "P",
      })
    );
    expect(res.status).toBe(500);
  });
});
