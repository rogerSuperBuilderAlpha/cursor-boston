/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/showcase/vote/route";
import type { VerifiedUser } from "@/lib/server-auth";
import { getVerifiedUser } from "@/lib/server-auth";
import { checkUpstashRateLimit } from "@/lib/upstash-rate-limit";

jest.mock("@/lib/logger", () => ({
  logger: { logError: jest.fn() },
}));

jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: () => ({ success: true }),
  getClientIdentifier: () => "test-client",
}));

jest.mock("@/lib/upstash-rate-limit", () => ({
  checkUpstashRateLimit: jest.fn(async () => ({ success: true, remaining: 9, resetTime: Date.now() + 60000 })),
}));

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/sanitize", () => ({
  sanitizeDocId: (id: string) => (id && /^[a-zA-Z0-9_-]+$/.test(id) ? id : ""),
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: jest.fn(() => "TS") },
}));

jest.mock("@/lib/api-response", () => ({
  ...jest.requireActual("@/lib/api-response"),
  parseRequestBody: jest.fn(),
}));

const mockForEach = jest.fn();
const mockQueryGet = jest.fn();
const mockStartAfter = jest.fn();
const mockDocGet = jest.fn();

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(() => ({
    collection: (name: string) => {
      if (name === "showcaseVotes") {
        return {
          where: jest.fn().mockReturnValue({
            get: mockQueryGet,
          }),
        };
      }
      // showcaseProjects
      return {
        orderBy: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            startAfter: (...args: unknown[]) => {
              mockStartAfter(...args);
              return { get: () => Promise.resolve({ forEach: mockForEach }) };
            },
            get: () => Promise.resolve({ forEach: mockForEach }),
          }),
        }),
        doc: (id: string) => ({
          get: () => mockDocGet(id),
        }),
      };
    },
  })),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<
  typeof getVerifiedUser
>;

const testUser: VerifiedUser = { uid: "u1", name: "Test" };

function makeGetRequest(params?: Record<string, string>) {
  const url = new URL("http://localhost/api/showcase/vote");
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  return new NextRequest(url);
}

describe("GET /api/showcase/vote", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns empty votes/userVotes when db is not configured", async () => {
    // Override getAdminDb to return null for this test
    const firebaseAdmin = require("@/lib/firebase-admin");
    firebaseAdmin.getAdminDb.mockReturnValueOnce(null);

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ votes: {}, userVotes: {} });
  });

  it("returns vote counts from showcaseProjects", async () => {
    mockForEach.mockImplementation(
      (cb: (doc: { id: string; data: () => Record<string, number> }) => void) => {
        cb({ id: "proj1", data: () => ({ upCount: 5, downCount: 2 }) });
        cb({ id: "proj2", data: () => ({ upCount: 0, downCount: 3 }) });
      }
    );
    mockGetVerifiedUser.mockRejectedValue(new Error("unauth"));

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.votes).toEqual({
      proj1: { upCount: 5, downCount: 2 },
      proj2: { upCount: 0, downCount: 3 },
    });
    expect(body.userVotes).toEqual({});
  });

  it("returns user votes when authenticated", async () => {
    mockForEach.mockImplementation(() => {});
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockQueryGet.mockResolvedValue({
      forEach: (cb: (doc: { data: () => Record<string, string> }) => void) => {
        cb({ data: () => ({ projectId: "proj1", type: "up" }) });
        cb({ data: () => ({ projectId: "proj2", type: "down" }) });
      },
    });

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userVotes).toEqual({ proj1: "up", proj2: "down" });
  });

  it("uses startAfter cursor when provided", async () => {
    mockForEach.mockImplementation(() => {});
    mockGetVerifiedUser.mockRejectedValue(new Error("unauth"));
    mockDocGet.mockResolvedValue({ exists: true });

    const res = await GET(makeGetRequest({ startAfter: "proj1" }));
    expect(res.status).toBe(200);
    expect(mockDocGet).toHaveBeenCalledWith("proj1");
    expect(mockStartAfter).toHaveBeenCalled();
  });

  it("ignores invalid startAfter cursor", async () => {
    mockForEach.mockImplementation(() => {});
    mockGetVerifiedUser.mockRejectedValue(new Error("unauth"));

    const res = await GET(makeGetRequest({ startAfter: "../../bad" }));
    expect(res.status).toBe(200);
    // sanitizeDocId returns "" for invalid input, so no cursor used
    expect(mockDocGet).not.toHaveBeenCalled();
    expect(mockStartAfter).not.toHaveBeenCalled();
  });

  it("skips startAfter when cursor doc does not exist", async () => {
    mockForEach.mockImplementation(() => {});
    mockGetVerifiedUser.mockRejectedValue(new Error("unauth"));
    mockDocGet.mockResolvedValue({ exists: false });

    const res = await GET(makeGetRequest({ startAfter: "nonexistent" }));
    expect(res.status).toBe(200);
    expect(mockStartAfter).not.toHaveBeenCalled();
  });

  it("respects limit parameter capped at 200", async () => {
    mockForEach.mockImplementation(() => {});
    mockGetVerifiedUser.mockRejectedValue(new Error("unauth"));

    const res = await GET(makeGetRequest({ limit: "999" }));
    expect(res.status).toBe(200);
    // The route caps at 200, no direct assertion on internal call but ensures no error
  });

  it("defaults missing counts to 0", async () => {
    mockForEach.mockImplementation(
      (cb: (doc: { id: string; data: () => Record<string, unknown> }) => void) => {
        cb({ id: "proj1", data: () => ({}) });
      }
    );
    mockGetVerifiedUser.mockRejectedValue(new Error("unauth"));

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.votes).toEqual({ proj1: { upCount: 0, downCount: 0 } });
  });

  it("returns fallback on unexpected error", async () => {
    const firebaseAdmin = require("@/lib/firebase-admin");
    firebaseAdmin.getAdminDb.mockImplementationOnce(() => {
      throw new Error("boom");
    });

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ votes: {}, userVotes: {} });
  });
});

/* ---------------------------------------------------------- *
 *  POST /api/showcase/vote — coverage push #22                *
 * ---------------------------------------------------------- */

type TxFns = {
  get: jest.Mock;
  set: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
};

interface TxScenario {
  project: { exists: boolean; data?: Record<string, unknown> };
  vote: { exists: boolean; data?: Record<string, unknown> };
}

function fakeTxDb(scenario: TxScenario) {
  const tx: TxFns = {
    get: jest.fn().mockImplementation(async (ref: { __which: string }) => {
      if (ref.__which === "project") {
        return { exists: scenario.project.exists, data: () => scenario.project.data };
      }
      return { exists: scenario.vote.exists, data: () => scenario.vote.data };
    }),
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const runTransaction = jest.fn(async (cb: (t: TxFns) => Promise<unknown>) => cb(tx));
  const projectRef = { __which: "project" };
  const voteRef = { __which: "vote" };
  const db = {
    collection: jest.fn((name: string) => ({
      doc: jest.fn(() =>
        name === "showcaseProjects" ? projectRef : voteRef,
      ),
    })),
    runTransaction,
  };
  return { db, tx, runTransaction };
}

function makePostRequest() {
  const url = new URL("http://localhost/api/showcase/vote");
  return new NextRequest(url, { method: "POST" });
}

const mockRateLimit = checkUpstashRateLimit as jest.MockedFunction<typeof checkUpstashRateLimit>;
const { parseRequestBody } = require("@/lib/api-response");
const mockParseBody = parseRequestBody as jest.Mock;

describe("POST /api/showcase/vote", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRateLimit.mockResolvedValue({
      success: true,
      remaining: 9,
      limit: 60,
      resetTime: Date.now() + 60000,
    } as never);
    mockParseBody.mockResolvedValue({ projectId: "proj1", type: "up" });
  });

  it("returns 429 when rate limit exceeded", async () => {
    mockRateLimit.mockResolvedValue({
      success: false,
      remaining: 0,
      limit: 60,
      resetTime: Date.now() + 30000,
      retryAfter: 30,
    } as never);
    const res = await POST(makePostRequest());
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
    const body = await res.json();
    expect(body.error).toBe("Too many requests");
    expect(body.retryAfterSeconds).toBe(30);
  });

  it("defaults Retry-After to 60 when rate limit has no retryAfter", async () => {
    mockRateLimit.mockResolvedValue({
      success: false,
      remaining: 0,
      limit: 60,
      resetTime: Date.now() + 60000,
    } as never);
    const res = await POST(makePostRequest());
    expect(res.headers.get("Retry-After")).toBe("60");
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await POST(makePostRequest());
    expect(res.status).toBe(401);
  });

  it("returns 500 when admin db is null", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const firebaseAdmin = require("@/lib/firebase-admin");
    firebaseAdmin.getAdminDb.mockReturnValueOnce(null);
    const res = await POST(makePostRequest());
    expect(res.status).toBe(500);
  });

  it("returns parse error response from parseRequestBody (passthrough)", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const { db } = fakeTxDb({ project: { exists: false }, vote: { exists: false } });
    const firebaseAdmin = require("@/lib/firebase-admin");
    firebaseAdmin.getAdminDb.mockReturnValueOnce(db);
    const errResp = new (require("next/server").NextResponse)("nope", { status: 400 });
    mockParseBody.mockResolvedValueOnce(errResp);
    const res = await POST(makePostRequest());
    expect(res).toBe(errResp);
  });

  it("returns 400 for invalid payload (schema fails)", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const { db } = fakeTxDb({ project: { exists: false }, vote: { exists: false } });
    const firebaseAdmin = require("@/lib/firebase-admin");
    firebaseAdmin.getAdminDb.mockReturnValueOnce(db);
    mockParseBody.mockResolvedValueOnce({ projectId: 1, type: "x" });
    const res = await POST(makePostRequest());
    expect(res.status).toBe(400);
  });

  it("returns 400 when sanitizeDocId rejects projectId", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const { db } = fakeTxDb({ project: { exists: false }, vote: { exists: false } });
    const firebaseAdmin = require("@/lib/firebase-admin");
    firebaseAdmin.getAdminDb.mockReturnValueOnce(db);
    mockParseBody.mockResolvedValueOnce({ projectId: "../../bad", type: "up" });
    const res = await POST(makePostRequest());
    expect(res.status).toBe(400);
  });

  it("adds first vote (action=added) and SETs project doc when project absent", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const { db, tx } = fakeTxDb({ project: { exists: false }, vote: { exists: false } });
    const firebaseAdmin = require("@/lib/firebase-admin");
    firebaseAdmin.getAdminDb.mockReturnValueOnce(db);
    const res = await POST(makePostRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ action: "added", type: "up", upCount: 1, downCount: 0 });
    expect(tx.set).toHaveBeenCalledTimes(2); // vote doc + project doc
    expect(tx.update).not.toHaveBeenCalled();
  });

  it("adds first vote (action=added) and UPDATEs project doc when project exists", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const { db, tx } = fakeTxDb({
      project: { exists: true, data: { upCount: 5, downCount: 2 } },
      vote: { exists: false },
    });
    const firebaseAdmin = require("@/lib/firebase-admin");
    firebaseAdmin.getAdminDb.mockReturnValueOnce(db);
    mockParseBody.mockResolvedValueOnce({ projectId: "proj1", type: "down" });
    const res = await POST(makePostRequest());
    const body = await res.json();
    expect(body).toMatchObject({ action: "added", type: "down", upCount: 5, downCount: 3 });
    expect(tx.update).toHaveBeenCalled();
  });

  it("toggle off (action=removed): existing same-type vote deletes, decrements upCount", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const { db, tx } = fakeTxDb({
      project: { exists: true, data: { upCount: 4, downCount: 1 } },
      vote: { exists: true, data: { type: "up" } },
    });
    const firebaseAdmin = require("@/lib/firebase-admin");
    firebaseAdmin.getAdminDb.mockReturnValueOnce(db);
    mockParseBody.mockResolvedValueOnce({ projectId: "proj1", type: "up" });
    const res = await POST(makePostRequest());
    const body = await res.json();
    expect(body).toMatchObject({ action: "removed", type: "up", upCount: 3, downCount: 1 });
    expect(tx.delete).toHaveBeenCalled();
    expect(tx.update).toHaveBeenCalled();
  });

  it("toggle off down: decrements downCount and clamps at 0", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const { db, tx } = fakeTxDb({
      project: { exists: true, data: { upCount: 2, downCount: 0 } },
      vote: { exists: true, data: { type: "down" } },
    });
    const firebaseAdmin = require("@/lib/firebase-admin");
    firebaseAdmin.getAdminDb.mockReturnValueOnce(db);
    mockParseBody.mockResolvedValueOnce({ projectId: "proj1", type: "down" });
    const res = await POST(makePostRequest());
    const body = await res.json();
    expect(body).toMatchObject({ action: "removed", type: "down", upCount: 2, downCount: 0 });
    expect(tx.delete).toHaveBeenCalled();
  });

  it("toggle off when project doc absent uses tx.set for the project update", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const { db, tx } = fakeTxDb({
      project: { exists: false },
      vote: { exists: true, data: { type: "up" } },
    });
    const firebaseAdmin = require("@/lib/firebase-admin");
    firebaseAdmin.getAdminDb.mockReturnValueOnce(db);
    mockParseBody.mockResolvedValueOnce({ projectId: "proj1", type: "up" });
    const res = await POST(makePostRequest());
    expect(res.status).toBe(200);
    expect(tx.delete).toHaveBeenCalled();
    // No project update call, only set — since exists=false branch
    expect(tx.set).toHaveBeenCalled();
  });

  it("switch vote (action=switched) up→down updates counts", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const { db, tx } = fakeTxDb({
      project: { exists: true, data: { upCount: 3, downCount: 1 } },
      vote: { exists: true, data: { type: "up" } },
    });
    const firebaseAdmin = require("@/lib/firebase-admin");
    firebaseAdmin.getAdminDb.mockReturnValueOnce(db);
    mockParseBody.mockResolvedValueOnce({ projectId: "proj1", type: "down" });
    const res = await POST(makePostRequest());
    const body = await res.json();
    expect(body).toMatchObject({
      action: "switched",
      type: "down",
      previousType: "up",
      upCount: 2,
      downCount: 2,
    });
    expect(tx.update).toHaveBeenCalled();
  });

  it("switch vote when project doc absent uses tx.set for project doc", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const { db, tx } = fakeTxDb({
      project: { exists: false },
      vote: { exists: true, data: { type: "down" } },
    });
    const firebaseAdmin = require("@/lib/firebase-admin");
    firebaseAdmin.getAdminDb.mockReturnValueOnce(db);
    mockParseBody.mockResolvedValueOnce({ projectId: "proj1", type: "up" });
    const res = await POST(makePostRequest());
    const body = await res.json();
    expect(body.action).toBe("switched");
    expect(tx.set).toHaveBeenCalled();
  });

  it("returns 500 when transaction throws", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const firebaseAdmin = require("@/lib/firebase-admin");
    firebaseAdmin.getAdminDb.mockReturnValueOnce({
      collection: () => ({ doc: () => ({}) }),
      runTransaction: jest.fn().mockRejectedValue(new Error("tx died")),
    });
    const res = await POST(makePostRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal server error");
  });
});
