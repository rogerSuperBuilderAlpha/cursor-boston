/**
 * @jest-environment node
 *
 * OpenSSF Gold coverage push #19 — internal hunt email-retry cron route.
 *
 * The route reads CRON_SECRET at module load and re-uses a single `handle`
 * implementation for both GET and POST, so each test re-imports the module
 * via importRoute() after configuring env + mocks.
 */
import { NextRequest } from "next/server";

jest.mock("@/lib/firebase-admin", () => ({ getAdminDb: jest.fn() }));
jest.mock("@/lib/mailgun", () => ({ sendEmail: jest.fn() }));
jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), logError: jest.fn() },
}));
jest.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: jest.fn(() => "TS") },
}));

function makeReq(opts: {
  method?: "GET" | "POST";
  cronSecretHeader?: string;
  bearerToken?: string;
} = {}) {
  const url = new URL("https://example.com/api/internal/hunt/email-retry");
  const headers: Record<string, string> = {};
  if (opts.cronSecretHeader) headers["x-cron-secret"] = opts.cronSecretHeader;
  if (opts.bearerToken) headers["authorization"] = `Bearer ${opts.bearerToken}`;
  return new NextRequest(url, { method: opts.method ?? "POST", headers });
}

type DocRef = { set: jest.Mock };
type Doc = { id: string; data: () => Record<string, unknown>; ref: DocRef };

function fakeMarker(opts: { exists?: boolean; queueEmpty?: boolean } = {}) {
  return {
    set: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue({
      exists: opts.exists ?? false,
      data: () => ({ queueEmpty: opts.queueEmpty ?? false }),
    }),
  };
}

function fakeStuckQuery(docs: Doc[]) {
  return {
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    get: jest.fn().mockResolvedValue({ docs, size: docs.length }),
  };
}

function setupDb(opts: {
  marker?: ReturnType<typeof fakeMarker>;
  stuckDocs?: Doc[];
}) {
  const marker = opts.marker ?? fakeMarker();
  const stuck = fakeStuckQuery(opts.stuckDocs ?? []);
  const db = {
    collection: jest.fn((name: string) => {
      if (name === "treasureHuntRuntime") {
        return { doc: jest.fn(() => marker) };
      }
      // treasureHuntProgress
      return stuck;
    }),
  };
  return { db, marker, stuck };
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
  const route = await import("@/app/api/internal/hunt/email-retry/route");
  const adminMod = await import("@/lib/firebase-admin");
  const mailgunMod = await import("@/lib/mailgun");
  const mockDb = adminMod.getAdminDb as jest.MockedFunction<typeof adminMod.getAdminDb>;
  const mockSendEmail = mailgunMod.sendEmail as jest.MockedFunction<typeof mailgunMod.sendEmail>;
  return { ...route, mockDb, mockSendEmail };
}

describe("POST /api/internal/hunt/email-retry", () => {
  it("returns 500 when CRON_SECRET env is missing", async () => {
    delete process.env.CRON_SECRET;
    const { POST } = await importRoute();
    const res = await POST(makeReq({ cronSecretHeader: "anything" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("CRON_SECRET missing");
  });

  it("returns 401 when no cron secret is provided", async () => {
    const { POST } = await importRoute();
    const res = await POST(makeReq());
    expect(res.status).toBe(401);
  });

  it("returns 401 when cron secret mismatches", async () => {
    const { POST } = await importRoute();
    const res = await POST(makeReq({ cronSecretHeader: "wrong" }));
    expect(res.status).toBe(401);
  });

  it("accepts CRON_SECRET via x-cron-secret header", async () => {
    const { POST, mockDb } = await importRoute();
    const { db } = setupDb({});
    mockDb.mockReturnValue(db as never);
    const res = await POST(makeReq({ cronSecretHeader: "test-secret" }));
    expect(res.status).toBe(200);
  });

  it("accepts CRON_SECRET via Authorization: Bearer header (case-insensitive)", async () => {
    const { POST, mockDb } = await importRoute();
    const { db } = setupDb({});
    mockDb.mockReturnValue(db as never);
    const res = await POST(makeReq({ bearerToken: "test-secret" }));
    expect(res.status).toBe(200);
  });

  it("returns 500 when admin db unavailable", async () => {
    const { POST, mockDb } = await importRoute();
    mockDb.mockReturnValue(null as never);
    const res = await POST(makeReq({ cronSecretHeader: "test-secret" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("No DB");
  });

  it("short-circuits when known_empty marker is set", async () => {
    const { POST, mockDb } = await importRoute();
    const marker = fakeMarker({ exists: true, queueEmpty: true });
    const { db, stuck } = setupDb({ marker });
    mockDb.mockReturnValue(db as never);
    const res = await POST(makeReq({ cronSecretHeader: "test-secret" }));
    const body = await res.json();
    expect(body).toEqual({ scanned: 0, sent: 0, failed: 0, skipped: "known_empty" });
    // Never queried treasureHuntProgress
    expect(stuck.get).not.toHaveBeenCalled();
  });

  it("sets queueEmpty=true when no stuck docs found", async () => {
    const { POST, mockDb } = await importRoute();
    const { db, marker } = setupDb({ stuckDocs: [] });
    mockDb.mockReturnValue(db as never);
    const res = await POST(makeReq({ cronSecretHeader: "test-secret" }));
    const body = await res.json();
    expect(body).toEqual({ scanned: 0, sent: 0, failed: 0 });
    expect(marker.set).toHaveBeenCalledWith(
      { queueEmpty: true, updatedAt: "TS" },
      { merge: true },
    );
  });

  it("sends emails for stuck docs and marks them delivered", async () => {
    const { POST, mockDb, mockSendEmail } = await importRoute();
    const doc1Ref = { set: jest.fn().mockResolvedValue(undefined) };
    const doc2Ref = { set: jest.fn().mockResolvedValue(undefined) };
    const stuckDocs: Doc[] = [
      {
        id: "u1",
        data: () => ({ winnerEmail: "a@x", prizeCreditUrl: "https://credit/a" }),
        ref: doc1Ref,
      },
      {
        id: "u2",
        data: () => ({ winnerEmail: "b@x", prizeCreditUrl: "https://credit/b" }),
        ref: doc2Ref,
      },
    ];
    const { db, marker } = setupDb({ stuckDocs });
    mockDb.mockReturnValue(db as never);
    mockSendEmail.mockResolvedValue(undefined as never);
    const res = await POST(makeReq({ cronSecretHeader: "test-secret" }));
    const body = await res.json();
    expect(body).toEqual({ scanned: 2, sent: 2, failed: 0 });
    expect(mockSendEmail).toHaveBeenCalledTimes(2);
    expect(doc1Ref.set).toHaveBeenCalledWith(
      { prizeEmailSentAt: "TS" },
      { merge: true },
    );
    // queueEmpty=false marker written because we found work
    expect(marker.set).toHaveBeenCalledWith(
      { queueEmpty: false, updatedAt: "TS" },
      { merge: true },
    );
  });

  it("skips docs missing winnerEmail or prizeCreditUrl", async () => {
    const { POST, mockDb, mockSendEmail } = await importRoute();
    const docRef = { set: jest.fn() };
    const stuckDocs: Doc[] = [
      {
        id: "u1",
        data: () => ({ winnerEmail: "", prizeCreditUrl: "https://credit/a" }),
        ref: docRef,
      },
      {
        id: "u2",
        data: () => ({ winnerEmail: "b@x", prizeCreditUrl: 123 /* not string */ }),
        ref: docRef,
      },
    ];
    const { db } = setupDb({ stuckDocs });
    mockDb.mockReturnValue(db as never);
    const res = await POST(makeReq({ cronSecretHeader: "test-secret" }));
    const body = await res.json();
    expect(body).toEqual({ scanned: 2, sent: 0, failed: 0 });
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(docRef.set).not.toHaveBeenCalled();
  });

  it("counts a failed sendEmail as failed and continues the loop", async () => {
    const { POST, mockDb, mockSendEmail } = await importRoute();
    const docRef1 = { set: jest.fn().mockResolvedValue(undefined) };
    const docRef2 = { set: jest.fn().mockResolvedValue(undefined) };
    const stuckDocs: Doc[] = [
      {
        id: "u1",
        data: () => ({ winnerEmail: "a@x", prizeCreditUrl: "https://credit/a" }),
        ref: docRef1,
      },
      {
        id: "u2",
        data: () => ({ winnerEmail: "b@x", prizeCreditUrl: "https://credit/b" }),
        ref: docRef2,
      },
    ];
    const { db } = setupDb({ stuckDocs });
    mockDb.mockReturnValue(db as never);
    mockSendEmail
      .mockRejectedValueOnce(new Error("mailgun 5xx"))
      .mockResolvedValueOnce(undefined as never);
    const res = await POST(makeReq({ cronSecretHeader: "test-secret" }));
    const body = await res.json();
    expect(body).toEqual({ scanned: 2, sent: 1, failed: 1 });
    // Only the successful send wrote the marker
    expect(docRef1.set).not.toHaveBeenCalled();
    expect(docRef2.set).toHaveBeenCalled();
  });
});

describe("GET /api/internal/hunt/email-retry", () => {
  it("shares the same handle — accepts cron secret and returns scan summary", async () => {
    const { GET, mockDb } = await importRoute();
    const { db } = setupDb({});
    mockDb.mockReturnValue(db as never);
    const res = await GET(makeReq({ method: "GET", cronSecretHeader: "test-secret" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ scanned: 0, sent: 0, failed: 0 });
  });

  it("returns 401 when GET is unauthorized", async () => {
    const { GET } = await importRoute();
    const res = await GET(makeReq({ method: "GET" }));
    expect(res.status).toBe(401);
  });
});
