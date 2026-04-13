/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { GET } from "@/app/api/careers/listings/route";
import { getAdminDb } from "@/lib/firebase-admin";

jest.mock("@/lib/logger", () => ({
  logger: { logError: jest.fn(), warn: jest.fn() },
}));

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(),
}));

jest.mock("@/lib/sanitize", () => ({
  sanitizeDocId: jest.fn((s: string) =>
    s && /^[a-zA-Z0-9_-]+$/.test(s) ? s : null
  ),
}));

const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;

function makeFakeDoc(id: string, data: Record<string, unknown>) {
  return { id, exists: true, data: () => data };
}

function makeQuerySnapshot(docs: ReturnType<typeof makeFakeDoc>[]) {
  return { empty: docs.length === 0, size: docs.length, docs };
}

function buildMockDb(
  snap = makeQuerySnapshot([]),
  singleDoc: { exists: boolean; data: () => unknown } = {
    exists: false,
    data: () => null,
  }
) {
  const chainable = {
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    startAfter: jest.fn().mockReturnThis(),
    get: jest.fn().mockResolvedValue(snap),
  };

  const db = {
    collection: jest.fn(() => ({
      ...chainable,
      doc: jest.fn(() => ({
        get: jest.fn().mockResolvedValue(singleDoc),
      })),
    })),
  };

  return db;
}

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/careers/listings");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url.toString());
}

describe("GET /api/careers/listings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns demo listings when db is not configured", async () => {
    mockGetAdminDb.mockReturnValue(null as never);
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.listings)).toBe(true);
    expect(body.listings.length).toBeGreaterThan(0);
    expect(body.listings[0]).toHaveProperty("title");
    expect(body.listings[0]).toHaveProperty("company");
    expect(typeof body.hasMore).toBe("boolean");
  });

  it("returns paginated listings", async () => {
    const fakeDoc = makeFakeDoc("job1", {
      title: "Senior Engineer",
      company: "Acme",
      description: "Build cool stuff",
      location: "Boston, MA",
      type: "full-time",
      experienceLevel: "senior",
      remote: false,
      tags: ["Cursor", "TypeScript"],
      featured: false,
      status: "active",
      postedById: "user1",
      postedAt: { toMillis: () => 1700000000000 },
    });
    const snap = makeQuerySnapshot([fakeDoc]);
    const db = buildMockDb(snap);
    mockGetAdminDb.mockReturnValue(db as never);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.listings).toHaveLength(1);
    expect(body.listings[0].id).toBe("job1");
    expect(body.listings[0].title).toBe("Senior Engineer");
    expect(body.hasMore).toBe(false);
  });

  it("returns single listing by id", async () => {
    const singleDoc = {
      id: "job1",
      exists: true,
      data: () => ({
        title: "Frontend Dev",
        company: "Startup",
        description: "React work",
        location: "Remote",
        type: "contract",
        experienceLevel: "mid",
        remote: true,
        tags: [],
        featured: false,
        status: "active",
        postedById: "user2",
        postedAt: { toMillis: () => 1700000000000 },
      }),
    };

    const db = {
      collection: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue(makeQuerySnapshot([])),
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue(singleDoc),
        })),
      })),
    };
    mockGetAdminDb.mockReturnValue(db as never);

    const res = await GET(makeRequest({ id: "job1" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.listing).toBeDefined();
    expect(body.listing.title).toBe("Frontend Dev");
  });

  it("returns 404 for unknown id", async () => {
    const db = {
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({ exists: false, data: () => null }),
        })),
      })),
    };
    mockGetAdminDb.mockReturnValue(db as never);

    const res = await GET(makeRequest({ id: "nonexistent" }));
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid id", async () => {
    mockGetAdminDb.mockReturnValue({} as never);
    const res = await GET(makeRequest({ id: "bad id with spaces!" }));
    expect(res.status).toBe(400);
  });

  it("filters by remote=true", async () => {
    const db = buildMockDb(makeQuerySnapshot([]));
    mockGetAdminDb.mockReturnValue(db as never);

    await GET(makeRequest({ remote: "true" }));
    const collectionCall = db.collection.mock.results[0].value;
    expect(collectionCall.where).toHaveBeenCalledWith("remote", "==", true);
  });

  it("filters by job type", async () => {
    const db = buildMockDb(makeQuerySnapshot([]));
    mockGetAdminDb.mockReturnValue(db as never);

    await GET(makeRequest({ type: "contract" }));
    const collectionCall = db.collection.mock.results[0].value;
    expect(collectionCall.where).toHaveBeenCalledWith("type", "==", "contract");
  });

  it("ignores invalid job type", async () => {
    const db = buildMockDb(makeQuerySnapshot([]));
    mockGetAdminDb.mockReturnValue(db as never);

    await GET(makeRequest({ type: "invalid-type" }));
    const collectionCall = db.collection.mock.results[0].value;
    // where should only be called once (for status == active)
    const typeCalls = collectionCall.where.mock.calls.filter(
      (c: string[]) => c[0] === "type"
    );
    expect(typeCalls).toHaveLength(0);
  });
});
