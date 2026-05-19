/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST, GET } from "@/app/api/cookbook/vote/route";
import type { VerifiedUser } from "@/lib/server-auth";
import { getVerifiedUser } from "@/lib/server-auth";
import { checkUpstashRateLimit } from "@/lib/upstash-rate-limit";
import { getAdminDb } from "@/lib/firebase-admin";

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

const mockRunTransaction = jest.fn();
const mockCollection = jest.fn();
const mockDoc = jest.fn();
const mockGet = jest.fn();

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(() => ({
    collection: (...args: unknown[]) => {
      mockCollection(...args);
      return {
        doc: (...docArgs: unknown[]) => {
          mockDoc(...docArgs);
          return {
            collection: (...subArgs: unknown[]) => {
              mockCollection(...subArgs);
              return {
                doc: (...subDocArgs: unknown[]) => {
                  mockDoc(...subDocArgs);
                  return {};
                },
              };
            },
          };
        },
        where: jest.fn().mockReturnValue({
          get: mockGet,
        }),
      };
    },
    runTransaction: mockRunTransaction,
  })),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<
  typeof getVerifiedUser
>;

const testUser: VerifiedUser = { uid: "u1", name: "Test" };

function makePostRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/cookbook/vote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/cookbook/vote", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await POST(makePostRequest({ entryId: "abc", type: "up" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid payload", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const res = await POST(makePostRequest({ entryId: "", type: "up" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when type is not up or down", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const res = await POST(makePostRequest({ entryId: "abc", type: "invalid" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when entryId is missing", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const res = await POST(makePostRequest({ type: "up" }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when entry does not exist", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockRunTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        get: jest.fn().mockResolvedValue({ exists: false, data: () => null }),
      };
      return fn(tx);
    });

    const res = await POST(makePostRequest({ entryId: "missing", type: "up" }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Entry not found");
  });

  it("adds a new upvote when no prior vote exists", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const mockTxSet = jest.fn();
    const mockTxUpdate = jest.fn();

    mockRunTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        get: jest.fn()
          .mockResolvedValueOnce({ exists: true, data: () => ({ upCount: 3, downCount: 1 }) })
          .mockResolvedValueOnce({ exists: false }),
        set: mockTxSet,
        update: mockTxUpdate,
      };
      return fn(tx);
    });

    const res = await POST(makePostRequest({ entryId: "entry1", type: "up" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.action).toBe("added");
    expect(body.type).toBe("up");
    expect(body.upCount).toBe(4);
    expect(body.downCount).toBe(1);
  });

  it("removes a vote when same type is cast again", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const mockTxDelete = jest.fn();
    const mockTxUpdate = jest.fn();

    mockRunTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        get: jest.fn()
          .mockResolvedValueOnce({ exists: true, data: () => ({ upCount: 3, downCount: 1 }) })
          .mockResolvedValueOnce({ exists: true, data: () => ({ type: "up" }) }),
        delete: mockTxDelete,
        update: mockTxUpdate,
      };
      return fn(tx);
    });

    const res = await POST(makePostRequest({ entryId: "entry1", type: "up" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.action).toBe("removed");
    expect(body.upCount).toBe(2);
    expect(body.downCount).toBe(1);
  });

  it("switches a vote from up to down", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const mockTxUpdate = jest.fn();
    const mockTxSet = jest.fn();

    mockRunTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        get: jest.fn()
          .mockResolvedValueOnce({ exists: true, data: () => ({ upCount: 3, downCount: 1 }) })
          .mockResolvedValueOnce({ exists: true, data: () => ({ type: "up" }) }),
        update: mockTxUpdate,
        set: mockTxSet,
      };
      return fn(tx);
    });

    const res = await POST(makePostRequest({ entryId: "entry1", type: "down" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.action).toBe("switched");
    expect(body.type).toBe("down");
    expect(body.previousType).toBe("up");
    expect(body.upCount).toBe(2);
    expect(body.downCount).toBe(2);
  });
});

describe("GET /api/cookbook/vote", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns empty userVotes when not authenticated", async () => {
    mockGetVerifiedUser.mockRejectedValue(new Error("unauth"));
    const req = new NextRequest("http://localhost/api/cookbook/vote");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userVotes).toEqual({});
  });

  it("returns user votes when authenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const mockDocs = [
      { data: () => ({ entryId: "e1", type: "up" }) },
      { data: () => ({ entryId: "e2", type: "down" }) },
    ];
    mockGet.mockResolvedValue({
      forEach: (cb: (doc: { data: () => Record<string, string> }) => void) =>
        mockDocs.forEach(cb),
    });

    const req = new NextRequest("http://localhost/api/cookbook/vote");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userVotes).toEqual({ e1: "up", e2: "down" });
  });

  it("returns empty userVotes when admin db is null", async () => {
    (getAdminDb as jest.MockedFunction<typeof getAdminDb>).mockReturnValueOnce(null as never);
    const req = new NextRequest("http://localhost/api/cookbook/vote");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userVotes).toEqual({});
  });

  it("filters out malformed userVotes (non-string entryId, bad type)", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const mockDocs = [
      { data: () => ({ entryId: "e1", type: "up" }) },
      { data: () => ({ entryId: 42, type: "up" }) }, // non-string entryId
      { data: () => ({ entryId: "e3", type: "weird" }) }, // bad type
      { data: () => ({ /* no entryId */ type: "down" }) },
    ];
    mockGet.mockResolvedValue({
      forEach: (cb: (doc: { data: () => Record<string, unknown> }) => void) =>
        mockDocs.forEach(cb),
    });

    const req = new NextRequest("http://localhost/api/cookbook/vote");
    const res = await GET(req);
    const body = await res.json();
    expect(body.userVotes).toEqual({ e1: "up" });
  });

  it("returns empty userVotes when outer catch fires (db throws)", async () => {
    (getAdminDb as jest.MockedFunction<typeof getAdminDb>).mockImplementationOnce(() => {
      throw new Error("admin sdk crash");
    });
    const req = new NextRequest("http://localhost/api/cookbook/vote");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userVotes).toEqual({});
  });
});

describe("POST /api/cookbook/vote — additional guards", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 429 with Retry-After when rate-limited", async () => {
    const rate = checkUpstashRateLimit as jest.MockedFunction<typeof checkUpstashRateLimit>;
    rate.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      retryAfter: 45,
      resetTime: Date.now() + 60000,
    } as never);
    const res = await POST(makePostRequest({ entryId: "abc", type: "up" }));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("45");
  });

  it("defaults Retry-After=60 when retryAfter absent", async () => {
    const rate = checkUpstashRateLimit as jest.MockedFunction<typeof checkUpstashRateLimit>;
    rate.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      resetTime: Date.now() + 60000,
    } as never);
    const res = await POST(makePostRequest({ entryId: "abc", type: "up" }));
    expect(res.headers.get("Retry-After")).toBe("60");
  });

  it("returns 500 when admin db is null", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    (getAdminDb as jest.MockedFunction<typeof getAdminDb>).mockReturnValueOnce(null as never);
    const res = await POST(makePostRequest({ entryId: "abc", type: "up" }));
    expect(res.status).toBe(500);
  });

  it("returns 400 when body parse fails", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const req = new NextRequest("http://localhost/api/cookbook/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 500 'Internal server error' on unknown transaction throw", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockRunTransaction.mockRejectedValueOnce(new Error("tx exploded"));
    const res = await POST(makePostRequest({ entryId: "abc", type: "up" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal server error");
  });

  it("removes a down vote when same type is cast again", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const mockTxDelete = jest.fn();
    const mockTxUpdate = jest.fn();
    mockRunTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        get: jest.fn()
          .mockResolvedValueOnce({ exists: true, data: () => ({ upCount: 4, downCount: 2 }) })
          .mockResolvedValueOnce({ exists: true, data: () => ({ type: "down" }) }),
        delete: mockTxDelete,
        update: mockTxUpdate,
      };
      return fn(tx);
    });
    const res = await POST(makePostRequest({ entryId: "entry1", type: "down" }));
    const body = await res.json();
    expect(body.action).toBe("removed");
    expect(body.type).toBe("down");
    expect(body.upCount).toBe(4);
    expect(body.downCount).toBe(1);
  });

  it("switches a vote from down to up", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockRunTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        get: jest.fn()
          .mockResolvedValueOnce({ exists: true, data: () => ({ upCount: 4, downCount: 2 }) })
          .mockResolvedValueOnce({ exists: true, data: () => ({ type: "down" }) }),
        update: jest.fn(),
        set: jest.fn(),
      };
      return fn(tx);
    });
    const res = await POST(makePostRequest({ entryId: "entry1", type: "up" }));
    const body = await res.json();
    expect(body.action).toBe("switched");
    expect(body.previousType).toBe("down");
    expect(body.upCount).toBe(5);
    expect(body.downCount).toBe(1);
  });

  it("adds a new down vote when no prior vote exists", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockRunTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        get: jest.fn()
          .mockResolvedValueOnce({ exists: true, data: () => ({ upCount: 4, downCount: 2 }) })
          .mockResolvedValueOnce({ exists: false }),
        set: jest.fn(),
        update: jest.fn(),
      };
      return fn(tx);
    });
    const res = await POST(makePostRequest({ entryId: "entry1", type: "down" }));
    const body = await res.json();
    expect(body.action).toBe("added");
    expect(body.type).toBe("down");
    expect(body.downCount).toBe(3);
  });

  it("clamps upCount at 0 when removing a vote that started from 0", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockRunTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        get: jest.fn()
          .mockResolvedValueOnce({ exists: true, data: () => ({ upCount: 0, downCount: 0 }) })
          .mockResolvedValueOnce({ exists: true, data: () => ({ type: "up" }) }),
        delete: jest.fn(),
        update: jest.fn(),
      };
      return fn(tx);
    });
    const res = await POST(makePostRequest({ entryId: "entry1", type: "up" }));
    const body = await res.json();
    expect(body.upCount).toBe(0);
  });
});
