/**
 * @jest-environment node
 */

import { NextRequest, NextResponse } from "next/server";
import { DELETE } from "@/app/api/account/route";
import { getVerifiedUser } from "@/lib/server-auth";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { checkUpstashRateLimit } from "@/lib/upstash-rate-limit";
import { deleteUserData } from "@/lib/account-deletion/cascade";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(),
  getAdminAuth: jest.fn(),
}));

jest.mock("@/lib/upstash-rate-limit", () => ({
  checkUpstashRateLimit: jest.fn(),
}));

jest.mock("@/lib/account-deletion/cascade", () => ({
  deleteUserData: jest.fn(),
}));

jest.mock("@/lib/logger", () => ({
  logger: { logError: jest.fn() },
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockGetAdminAuth = getAdminAuth as jest.MockedFunction<typeof getAdminAuth>;
const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockCheckRateLimit = checkUpstashRateLimit as jest.MockedFunction<typeof checkUpstashRateLimit>;
const mockDeleteUserData = deleteUserData as jest.MockedFunction<typeof deleteUserData>;

const mockVerifyIdToken = jest.fn();
const mockRevokeRefreshTokens = jest.fn();
const mockDeleteUser = jest.fn();

function authedRequest(
  body: unknown,
  options: { token?: string; useXHeader?: boolean } = {}
) {
  const { token = "stub-token", useXHeader = false } = options;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) {
    if (useXHeader) {
      headers["x-firebase-id-token"] = token;
    } else {
      headers["authorization"] = `Bearer ${token}`;
    }
  }
  return new NextRequest("http://localhost/api/account", {
    method: "DELETE",
    headers,
    body: JSON.stringify(body),
  });
}

function freshTokenPayload(overrides: Record<string, unknown> = {}) {
  return {
    uid: "user-1",
    auth_time: Math.floor(Date.now() / 1000) - 30, // 30 seconds ago = fresh
    ...overrides,
  };
}

describe("DELETE /api/account", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAdminAuth.mockReturnValue({
      verifyIdToken: mockVerifyIdToken,
      revokeRefreshTokens: mockRevokeRefreshTokens,
      deleteUser: mockDeleteUser,
    } as any);
    mockGetAdminDb.mockReturnValue({} as any);
    mockCheckRateLimit.mockResolvedValue({ success: true } as any);
    mockVerifyIdToken.mockResolvedValue(freshTokenPayload());
    mockRevokeRefreshTokens.mockResolvedValue(undefined);
    mockDeleteUser.mockResolvedValue(undefined);
    mockDeleteUserData.mockResolvedValue({ steps: ["a", "b"], errors: [] } as any);
  });

  it("returns 401 when getVerifiedUser returns null", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await DELETE(authedRequest({ confirmText: "DELETE" }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 500 when admin auth is not configured", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "user-1" } as any);
    mockGetAdminAuth.mockReturnValue(null as any);
    const res = await DELETE(authedRequest({ confirmText: "DELETE" }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Server not configured" });
  });

  it("returns 401 when no bearer token is present in headers", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "user-1" } as any);
    const req = new NextRequest("http://localhost/api/account", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmText: "DELETE" }),
    });
    const res = await DELETE(req);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("accepts the token via x-firebase-id-token header when authorization is absent", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "user-1" } as any);
    const res = await DELETE(
      authedRequest({ confirmText: "DELETE" }, { token: "alt-token", useXHeader: true })
    );
    expect(mockVerifyIdToken).toHaveBeenCalledWith("alt-token", false);
    expect(res.status).toBe(200);
  });

  it("returns 403 when the token's auth_time is older than 5 minutes", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "user-1" } as any);
    mockVerifyIdToken.mockResolvedValue(
      freshTokenPayload({ auth_time: Math.floor(Date.now() / 1000) - 6 * 60 })
    );
    const res = await DELETE(authedRequest({ confirmText: "DELETE" }));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("Recent re-authentication required");
  });

  it("returns 403 when auth_time is missing from the decoded token", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "user-1" } as any);
    mockVerifyIdToken.mockResolvedValue({ uid: "user-1" }); // no auth_time
    const res = await DELETE(authedRequest({ confirmText: "DELETE" }));
    expect(res.status).toBe(403);
  });

  it("returns 429 when the rate limit rejects the request", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "user-1" } as any);
    mockCheckRateLimit.mockResolvedValue({ success: false } as any);
    const res = await DELETE(authedRequest({ confirmText: "DELETE" }));
    expect(res.status).toBe(429);
    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      "account-delete:user-1",
      { windowMs: 24 * 60 * 60 * 1000, maxRequests: 1 }
    );
  });

  it("returns 400 when confirmText is wrong", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "user-1" } as any);
    const res = await DELETE(authedRequest({ confirmText: "delete" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when the body is missing confirmText", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "user-1" } as any);
    const res = await DELETE(authedRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 when the request body is not valid JSON", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "user-1" } as any);
    const req = new NextRequest("http://localhost/api/account", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        authorization: "Bearer stub-token",
      },
      body: "not-json{",
    });
    const res = await DELETE(req);
    expect(res.status).toBe(400);
  });

  it("returns 500 when admin DB is not configured at cascade time", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "user-1" } as any);
    mockGetAdminDb.mockReturnValue(null as any);
    const res = await DELETE(authedRequest({ confirmText: "DELETE" }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Server not configured" });
  });

  it("runs the cascade, revokes refresh tokens, deletes the user, and returns success", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "user-1" } as any);
    const res = await DELETE(authedRequest({ confirmText: "DELETE" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.uid).toBe("user-1");
    expect(json.stepsCompleted).toBe(2);
    expect(json.errors).toBe(0);
    expect(mockDeleteUserData).toHaveBeenCalledWith("user-1", expect.any(Object));
    expect(mockRevokeRefreshTokens).toHaveBeenCalledWith("user-1");
    expect(mockDeleteUser).toHaveBeenCalledWith("user-1");
  });

  it("still returns success when revokeRefreshTokens throws (non-fatal)", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "user-1" } as any);
    mockRevokeRefreshTokens.mockRejectedValue(new Error("upstream-down"));
    const res = await DELETE(authedRequest({ confirmText: "DELETE" }));
    expect(res.status).toBe(200);
    // deleteUser should still have been attempted
    expect(mockDeleteUser).toHaveBeenCalledWith("user-1");
  });

  it("still returns success when deleteUser throws (cascade already ran, purge will retry)", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "user-1" } as any);
    mockDeleteUser.mockRejectedValue(new Error("auth-record-already-gone"));
    const res = await DELETE(authedRequest({ confirmText: "DELETE" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it("returns 500 when the cascade itself throws", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "user-1" } as any);
    mockDeleteUserData.mockRejectedValue(new Error("firestore-down"));
    const res = await DELETE(authedRequest({ confirmText: "DELETE" }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Internal server error" });
  });
});
