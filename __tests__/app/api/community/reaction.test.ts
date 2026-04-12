/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST } from "@/app/api/community/reaction/route";
import type { VerifiedUser } from "@/lib/server-auth";
import { getVerifiedUser } from "@/lib/server-auth";

jest.mock("@/lib/logger", () => ({
  logger: { error: jest.fn(), logError: jest.fn() },
}));

jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: jest.fn(() => ({ success: true })),
  getClientIdentifier: () => "test-client",
}));

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

const mockTxGet = jest.fn();
const mockTxSet = jest.fn();
const mockTxUpdate = jest.fn();
const mockTxDelete = jest.fn();
const mockRunTransaction = jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
  return fn({
    get: mockTxGet,
    set: mockTxSet,
    update: mockTxUpdate,
    delete: mockTxDelete,
  });
});

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(() => ({
    collection: () => ({
      doc: () => ({}),
    }),
    runTransaction: mockRunTransaction,
  })),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const testUser: VerifiedUser = { uid: "u1", name: "Test" };

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/community/reaction", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/community/reaction", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(testUser);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await POST(makeRequest({ messageId: "msg-1", type: "like" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid messageId", async () => {
    const res = await POST(makeRequest({ messageId: "bad/id", type: "like" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid type", async () => {
    const res = await POST(makeRequest({ messageId: "msg-1", type: "love" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing fields", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 404 when message does not exist", async () => {
    mockTxGet.mockResolvedValueOnce({ exists: false }).mockResolvedValueOnce({ exists: false });
    const res = await POST(makeRequest({ messageId: "msg-1", type: "like" }));
    expect(res.status).toBe(404);
  });

  it("adds a new reaction", async () => {
    mockTxGet
      .mockResolvedValueOnce({ exists: true, data: () => ({ likeCount: 0, dislikeCount: 0 }) })
      .mockResolvedValueOnce({ exists: false });
    const res = await POST(makeRequest({ messageId: "msg-1", type: "like" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.action).toBe("added");
    expect(body.type).toBe("like");
    expect(mockTxSet).toHaveBeenCalled();
  });

  it("removes reaction when toggling same type", async () => {
    mockTxGet
      .mockResolvedValueOnce({ exists: true, data: () => ({ likeCount: 1, dislikeCount: 0 }) })
      .mockResolvedValueOnce({ exists: true, data: () => ({ type: "like" }) });
    const res = await POST(makeRequest({ messageId: "msg-1", type: "like" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.action).toBe("removed");
    expect(mockTxDelete).toHaveBeenCalled();
  });

  it("switches reaction when toggling different type", async () => {
    mockTxGet
      .mockResolvedValueOnce({ exists: true, data: () => ({ likeCount: 1, dislikeCount: 0 }) })
      .mockResolvedValueOnce({ exists: true, data: () => ({ type: "like" }) });
    const res = await POST(makeRequest({ messageId: "msg-1", type: "dislike" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.action).toBe("switched");
    expect(body.type).toBe("dislike");
    expect(body.previousType).toBe("like");
    expect(mockTxUpdate).toHaveBeenCalled();
  });
});
