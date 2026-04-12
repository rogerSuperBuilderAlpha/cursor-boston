/**
 * @jest-environment node
 */

import { GET } from "@/app/api/badges/definitions/route";
import { getAdminDb } from "@/lib/firebase-admin";
import { BADGE_DEFINITIONS } from "@/lib/badges/definitions";

jest.mock("@/lib/logger", () => ({
  logger: { logError: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(),
}));

const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;

describe("GET /api/badges/definitions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns local fallback when db is unavailable", async () => {
    mockGetAdminDb.mockReturnValue(null as never);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.source).toBe("local-fallback");
    expect(body.definitions).toEqual(BADGE_DEFINITIONS);
  });

  it("seeds Firestore and returns definitions when collection is empty", async () => {
    const batchSet = jest.fn();
    const batchCommit = jest.fn(async () => undefined);

    const collectionRef = {
      get: jest.fn(async () => ({ empty: true, docs: [] })),
      doc: jest.fn(() => ({})),
    };

    const db = {
      collection: jest.fn(() => collectionRef),
      batch: jest.fn(() => ({ set: batchSet, commit: batchCommit })),
    };

    mockGetAdminDb.mockReturnValue(db as never);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.source).toBe("seeded-fallback");
    expect(body.definitions).toEqual(BADGE_DEFINITIONS);
    expect(batchSet).toHaveBeenCalledTimes(BADGE_DEFINITIONS.length);
    expect(batchCommit).toHaveBeenCalledTimes(1);
  });

  it("returns Firestore definitions when all badges are present", async () => {
    const firestoreDefs = BADGE_DEFINITIONS.map((def) => ({
      id: def.id,
      data: () => ({ ...def }),
    }));

    const collectionRef = {
      get: jest.fn(async () => ({ empty: false, docs: firestoreDefs })),
    };

    const db = {
      collection: jest.fn(() => collectionRef),
    };

    mockGetAdminDb.mockReturnValue(db as never);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.source).toBe("firestore");
    expect(body.definitions.length).toBe(BADGE_DEFINITIONS.length);
  });

  it("falls back to local when Firestore definitions are incomplete", async () => {
    // Return only one badge definition
    const partialDefs = [
      {
        id: BADGE_DEFINITIONS[0].id,
        data: () => ({ ...BADGE_DEFINITIONS[0] }),
      },
    ];

    const collectionRef = {
      get: jest.fn(async () => ({ empty: false, docs: partialDefs })),
    };

    const db = {
      collection: jest.fn(() => collectionRef),
    };

    mockGetAdminDb.mockReturnValue(db as never);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.source).toBe("local-fallback");
    expect(body.definitions).toEqual(BADGE_DEFINITIONS);
  });

  it("returns local fallback on Firestore error", async () => {
    const collectionRef = {
      get: jest.fn(async () => {
        throw new Error("Firestore unavailable");
      }),
    };

    const db = {
      collection: jest.fn(() => collectionRef),
    };

    mockGetAdminDb.mockReturnValue(db as never);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.source).toBe("local-fallback");
    expect(body.definitions).toEqual(BADGE_DEFINITIONS);
  });
});
