/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST, GET } from "@/app/api/cookbook/vote/route";
import type { VerifiedUser } from "@/lib/server-auth";
import { getVerifiedUser } from "@/lib/server-auth";

jest.mock("@/lib/logger", () => ({
  logger: { logError: jest.fn() },
}));

jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: () => ({ success: true }),
  getClientIdentifier: () => "test-client",
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
});
