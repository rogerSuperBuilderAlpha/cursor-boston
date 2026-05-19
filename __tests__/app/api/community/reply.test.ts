/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST } from "@/app/api/community/reply/route";
import type { VerifiedUser } from "@/lib/server-auth";
import { getVerifiedUser } from "@/lib/server-auth";
import { checkUpstashRateLimit } from "@/lib/upstash-rate-limit";
import { getAdminDb } from "@/lib/firebase-admin";

jest.mock("@/lib/logger", () => ({
  logger: { error: jest.fn(), logError: jest.fn() },
}));

jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: jest.fn(() => ({ success: true })),
  getClientIdentifier: () => "test-client",
}));

jest.mock("@/lib/upstash-rate-limit", () => ({
  checkUpstashRateLimit: jest.fn(async () => ({ success: true, remaining: 9, resetTime: Date.now() + 60000 })),
}));

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/utils", () => ({
  getDisplayName: (user: { name?: string }) => user.name || "Anonymous",
}));

const mockTxGet = jest.fn();
const mockTxSet = jest.fn();
const mockTxUpdate = jest.fn();
const mockRunTransaction = jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
  return fn({ get: mockTxGet, set: mockTxSet, update: mockTxUpdate });
});

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(() => ({
    collection: () => ({ doc: jest.fn(() => ({ id: "reply-123" })) }),
    runTransaction: mockRunTransaction,
  })),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const testUser: VerifiedUser = { uid: "u1", name: "Test" };
const validContent = "A".repeat(150);

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/community/reply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/community/reply", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(testUser);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await POST(makeRequest({ parentId: "msg-1", content: validContent }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid parentId", async () => {
    const res = await POST(makeRequest({ parentId: "bad/id", content: validContent }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for content too short", async () => {
    const res = await POST(makeRequest({ parentId: "msg-1", content: "short" }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when parent message not found", async () => {
    mockTxGet.mockResolvedValue({ exists: false });
    const res = await POST(makeRequest({ parentId: "msg-1", content: validContent }));
    expect(res.status).toBe(404);
  });

  it("creates reply and increments parent replyCount", async () => {
    mockTxGet.mockResolvedValue({
      exists: true,
      data: () => ({ replyCount: 2 }),
    });
    const res = await POST(makeRequest({ parentId: "msg-1", content: validContent }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.replyId).toBe("reply-123");
    expect(mockTxSet).toHaveBeenCalled();
    expect(mockTxUpdate).toHaveBeenCalled();
  });

  it("returns 429 when rate limit denies, with Retry-After", async () => {
    const mockRate = checkUpstashRateLimit as jest.MockedFunction<typeof checkUpstashRateLimit>;
    mockRate.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      retryAfter: 20,
      resetTime: Date.now() + 60000,
    } as never);
    const res = await POST(makeRequest({ parentId: "msg-1", content: validContent }));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("20");
  });

  it("returns 429 with default Retry-After=60 when retryAfter absent", async () => {
    const mockRate = checkUpstashRateLimit as jest.MockedFunction<typeof checkUpstashRateLimit>;
    mockRate.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      resetTime: Date.now() + 60000,
    } as never);
    const res = await POST(makeRequest({ parentId: "msg-1", content: validContent }));
    expect(res.headers.get("Retry-After")).toBe("60");
  });

  it("returns 500 when admin db is null", async () => {
    const mockDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
    mockDb.mockReturnValueOnce(null as never);
    const res = await POST(makeRequest({ parentId: "msg-1", content: validContent }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Server not configured");
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new NextRequest("http://localhost/api/community/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid JSON");
  });

  it("returns 400 for content too long (>500 chars)", async () => {
    const res = await POST(
      makeRequest({ parentId: "msg-1", content: "A".repeat(501) }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when zod schema rejects the body shape", async () => {
    const res = await POST(makeRequest({ parentId: 123, content: 456 }));
    expect(res.status).toBe(400);
  });

  it("returns 500 'Internal server error' when transaction throws", async () => {
    mockRunTransaction.mockRejectedValueOnce(new Error("tx died"));
    const res = await POST(makeRequest({ parentId: "msg-1", content: validContent }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal server error");
  });
});
