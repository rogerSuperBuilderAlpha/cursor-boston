/**
 * @jest-environment node
 *
 * OpenSSF Gold coverage push #18 — internal rate-limits cleanup cron route.
 */
import { NextRequest } from "next/server";

jest.mock("@/lib/firebase-admin", () => ({ getAdminDb: jest.fn() }));
jest.mock("@/lib/logger", () => ({
  logger: { logError: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock("firebase-admin/firestore", () => ({
  Timestamp: { now: jest.fn(() => ({ _ts: "now" })) },
}));

function makeReq(opts: {
  searchParams?: Record<string, string>;
  cronSecretHeader?: string;
  bearerToken?: string;
} = {}) {
  const url = new URL("https://example.com/api/internal/rate-limits/cleanup");
  for (const [k, v] of Object.entries(opts.searchParams ?? {})) {
    url.searchParams.set(k, v);
  }
  const headers: Record<string, string> = {};
  if (opts.cronSecretHeader) headers["x-cron-secret"] = opts.cronSecretHeader;
  if (opts.bearerToken) headers["authorization"] = `Bearer ${opts.bearerToken}`;
  return new NextRequest(url, { method: "POST", headers });
}

function fakeDb(batches: Array<{ size: number; docs: Array<{ ref: unknown }> }>) {
  let callCount = 0;
  const queryChain: {
    where: jest.Mock;
    orderBy: jest.Mock;
    limit: jest.Mock;
    get: jest.Mock;
  } = {
    where: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    get: jest.fn().mockImplementation(() => {
      const batch = batches[callCount++] ?? { size: 0, docs: [] };
      return Promise.resolve({
        empty: batch.size === 0,
        size: batch.size,
        docs: batch.docs,
      });
    }),
  };
  queryChain.where.mockReturnValue(queryChain);
  queryChain.orderBy.mockReturnValue(queryChain);
  queryChain.limit.mockReturnValue(queryChain);

  const batchCommit = jest.fn().mockResolvedValue(undefined);
  const batchDelete = jest.fn();

  return {
    spies: { batchCommit, batchDelete, get: queryChain.get },
    db: {
      collection: jest.fn(() => queryChain),
      batch: jest.fn(() => ({ delete: batchDelete, commit: batchCommit })),
    } as never,
  };
}

const originalEnv = { ...process.env };

beforeEach(() => {
  jest.clearAllMocks();
  process.env.CRON_SECRET = "test-secret";
});
afterEach(() => {
  process.env = { ...originalEnv };
});

async function importRoute() {
  jest.resetModules();
  const route = await import("@/app/api/internal/rate-limits/cleanup/route");
  const adminMod = await import("@/lib/firebase-admin");
  const mockDb = adminMod.getAdminDb as jest.MockedFunction<typeof adminMod.getAdminDb>;
  return { ...route, mockDb };
}

describe("POST /api/internal/rate-limits/cleanup", () => {
  it("returns 500 when CRON_SECRET env is missing", async () => {
    delete process.env.CRON_SECRET;
    const { POST, mockDb } = await importRoute();
    const res = await POST(makeReq({ cronSecretHeader: "anything" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("CRON_SECRET not set");
  });

  it("returns 401 when no cron secret is provided", async () => {
    const { POST, mockDb } = await importRoute();
    const res = await POST(makeReq());
    expect(res.status).toBe(401);
  });

  it("returns 401 when cron secret mismatches", async () => {
    const { POST, mockDb } = await importRoute();
    const res = await POST(makeReq({ cronSecretHeader: "wrong" }));
    expect(res.status).toBe(401);
  });

  it("accepts CRON_SECRET via x-cron-secret header", async () => {
    const { POST, mockDb } = await importRoute();
    const { db } = fakeDb([{ size: 0, docs: [] }]);
    mockDb.mockReturnValue(db);
    const res = await POST(makeReq({ cronSecretHeader: "test-secret" }));
    expect(res.status).toBe(200);
  });

  it("accepts CRON_SECRET via Authorization: Bearer header", async () => {
    const { POST, mockDb } = await importRoute();
    const { db } = fakeDb([{ size: 0, docs: [] }]);
    mockDb.mockReturnValue(db);
    const res = await POST(makeReq({ bearerToken: "test-secret" }));
    expect(res.status).toBe(200);
  });

  it("returns 500 when admin db unavailable", async () => {
    const { POST, mockDb } = await importRoute();
    mockDb.mockReturnValue(null as never);
    const res = await POST(makeReq({ cronSecretHeader: "test-secret" }));
    expect(res.status).toBe(500);
  });

  it("breaks out of the loop when first batch is empty", async () => {
    const { POST, mockDb } = await importRoute();
    const { db, spies } = fakeDb([{ size: 0, docs: [] }]);
    mockDb.mockReturnValue(db);
    const res = await POST(makeReq({ cronSecretHeader: "test-secret" }));
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.totalMatched).toBe(0);
    expect(body.totalDeleted).toBe(0);
    expect(body.batchesProcessed).toBe(0);
    expect(spies.batchCommit).not.toHaveBeenCalled();
  });

  it("processes one full batch and continues if exactly batchSize results", async () => {
    const { POST, mockDb } = await importRoute();
    // First call returns full batch of size 500, second returns 0 → stop.
    const fullBatch = {
      size: 500,
      docs: Array.from({ length: 500 }, (_, i) => ({ ref: { id: `r${i}` } })),
    };
    const { db, spies } = fakeDb([fullBatch, { size: 0, docs: [] }]);
    mockDb.mockReturnValue(db);
    const res = await POST(makeReq({ cronSecretHeader: "test-secret" }));
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.totalDeleted).toBe(500);
    expect(body.batchesProcessed).toBe(1);
    expect(spies.batchCommit).toHaveBeenCalled();
  });

  it("dryRun=true matches but does not delete", async () => {
    const { POST, mockDb } = await importRoute();
    const { db, spies } = fakeDb([
      { size: 3, docs: [{ ref: 1 }, { ref: 2 }, { ref: 3 }] },
    ]);
    mockDb.mockReturnValue(db);
    const res = await POST(
      makeReq({
        cronSecretHeader: "test-secret",
        searchParams: { dryRun: "true" },
      }),
    );
    const body = await res.json();
    expect(body.dryRun).toBe(true);
    expect(body.totalMatched).toBe(3);
    expect(body.totalDeleted).toBe(0);
    expect(spies.batchCommit).not.toHaveBeenCalled();
  });

  it("clamps batchSize / maxBatches to documented bounds", async () => {
    const { POST, mockDb } = await importRoute();
    const { db } = fakeDb([{ size: 0, docs: [] }]);
    mockDb.mockReturnValue(db);
    const res = await POST(
      makeReq({
        cronSecretHeader: "test-secret",
        searchParams: { batchSize: "10000", maxBatches: "9999" },
      }),
    );
    const body = await res.json();
    expect(body.batchSize).toBe(500); // MAX_BATCH_SIZE
    expect(body.maxBatches).toBe(20); // MAX_MAX_BATCHES
  });

  it("breaks early when batch returns less than batchSize", async () => {
    const { POST, mockDb } = await importRoute();
    const { db } = fakeDb([
      { size: 2, docs: [{ ref: 1 }, { ref: 2 }] }, // < default 500
    ]);
    mockDb.mockReturnValue(db);
    const res = await POST(makeReq({ cronSecretHeader: "test-secret" }));
    const body = await res.json();
    expect(body.batchesProcessed).toBe(1);
    expect(body.totalDeleted).toBe(2);
    expect(body.hasMore).toBe(false);
  });

  it("catch-block returns 500 when get() throws", async () => {
    const { POST, mockDb } = await importRoute();
    mockDb.mockReturnValue({
      collection: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => ({
              get: jest.fn().mockRejectedValue(new Error("query failed")),
            }),
          }),
        }),
      }),
    } as never);
    const res = await POST(makeReq({ cronSecretHeader: "test-secret" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("Failed to clean");
  });
});

describe("GET /api/internal/rate-limits/cleanup", () => {
  it("returns 405 method not allowed", async () => {
    const { GET } = await importRoute();
    const res = await GET();
    expect(res.status).toBe(405);
  });
});
