/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST, DELETE } from "@/app/api/community/block/route";
import { getVerifiedUser } from "@/lib/server-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { checkUpstashRateLimit } from "@/lib/upstash-rate-limit";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));
jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(),
}));
jest.mock("@/lib/upstash-rate-limit", () => ({
  checkUpstashRateLimit: jest.fn(),
}));
jest.mock("@/lib/logger", () => ({
  logger: { logError: jest.fn() },
}));
jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: jest.fn(() => ({ __serverTimestamp: true })),
  },
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockRateLimit = checkUpstashRateLimit as jest.MockedFunction<typeof checkUpstashRateLimit>;

function postRequest(body: unknown) {
  return new NextRequest("http://localhost/api/community/block", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function deleteRequest(targetUid: string | null) {
  const url = new URL("http://localhost/api/community/block");
  if (targetUid !== null) url.searchParams.set("targetUid", targetUid);
  return new NextRequest(url, { method: "DELETE" });
}

function buildDb() {
  const targetDoc = {
    set: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
  };
  const blockedCol = {
    doc: jest.fn(() => targetDoc),
  };
  const ownerDoc = {
    collection: jest.fn(() => blockedCol),
  };
  const userBlocksCol = {
    doc: jest.fn(() => ownerDoc),
  };
  const db: any = {
    collection: jest.fn(() => userBlocksCol),
  };
  return { db, targetDoc };
}

describe("POST /api/community/block", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRateLimit.mockResolvedValue({ success: true } as any);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await POST(postRequest({ targetUid: "u2" }));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate-limited", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1" } as any);
    mockRateLimit.mockResolvedValue({ success: false } as any);
    const res = await POST(postRequest({ targetUid: "u2" }));
    expect(res.status).toBe(429);
    expect(mockRateLimit).toHaveBeenCalledWith(
      "community-block:u1",
      { windowMs: 60_000, maxRequests: 30 }
    );
  });

  it("returns 400 for malformed JSON", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1" } as any);
    const res = await POST(postRequest("not-json{"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid JSON in request body" });
  });

  it("returns 400 when targetUid is missing", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1" } as any);
    const res = await POST(postRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 when targetUid equals the caller's uid (self-block prevented)", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1" } as any);
    const res = await POST(postRequest({ targetUid: "u1" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid targetUid" });
  });

  it("returns 500 when admin DB is not configured", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1" } as any);
    mockGetAdminDb.mockReturnValue(null as any);
    const res = await POST(postRequest({ targetUid: "u2" }));
    expect(res.status).toBe(500);
  });

  it("writes the block doc on success", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1" } as any);
    const { db, targetDoc } = buildDb();
    mockGetAdminDb.mockReturnValue(db);
    const res = await POST(postRequest({ targetUid: "u2" }));
    expect(res.status).toBe(200);
    expect(targetDoc.set).toHaveBeenCalledWith({
      targetUid: "u2",
      blockedAt: { __serverTimestamp: true },
    });
  });

  it("returns 500 on uncaught throw during the Firestore write", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1" } as any);
    const { db, targetDoc } = buildDb();
    targetDoc.set.mockRejectedValue(new Error("firestore-down"));
    mockGetAdminDb.mockReturnValue(db);
    const res = await POST(postRequest({ targetUid: "u2" }));
    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/community/block", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await DELETE(deleteRequest("u2"));
    expect(res.status).toBe(401);
  });

  it("returns 400 when targetUid query param is missing", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1" } as any);
    const res = await DELETE(deleteRequest(null));
    expect(res.status).toBe(400);
  });

  it("returns 500 when admin DB is not configured", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1" } as any);
    mockGetAdminDb.mockReturnValue(null as any);
    const res = await DELETE(deleteRequest("u2"));
    expect(res.status).toBe(500);
  });

  it("deletes the block doc on success", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1" } as any);
    const { db, targetDoc } = buildDb();
    mockGetAdminDb.mockReturnValue(db);
    const res = await DELETE(deleteRequest("u2"));
    expect(res.status).toBe(200);
    expect(targetDoc.delete).toHaveBeenCalled();
  });

  it("returns 500 on uncaught throw during the Firestore delete", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1" } as any);
    const { db, targetDoc } = buildDb();
    targetDoc.delete.mockRejectedValue(new Error("firestore-down"));
    mockGetAdminDb.mockReturnValue(db);
    const res = await DELETE(deleteRequest("u2"));
    expect(res.status).toBe(500);
  });
});
