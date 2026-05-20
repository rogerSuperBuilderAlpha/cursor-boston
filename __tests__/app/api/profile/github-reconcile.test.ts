/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment node
 *
 * OpenSSF Gold coverage — `app/api/profile/github/reconcile/route.ts`
 * (25% / 15 uncovered branches). Covers 429 rate-limit, 401 unauth,
 * 500 db-unavailable, 404 profile-not-found, 400 github-not-connected
 * (missing, non-object, empty string, whitespace), happy path, and 500
 * on thrown error.
 */

import { NextRequest } from "next/server";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(),
}));

jest.mock("@/lib/rate-limit", () => ({
  getClientIdentifier: jest.fn(() => "test-ip"),
  checkRateLimit: jest.fn(() => ({ success: true })),
}));

jest.mock("@/lib/github-merged-pr-reconcile", () => ({
  reconcileMergedPrCreditForUser: jest.fn(),
}));

import { POST } from "@/app/api/profile/github/reconcile/route";
import { getVerifiedUser } from "@/lib/server-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { reconcileMergedPrCreditForUser } from "@/lib/github-merged-pr-reconcile";

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockCheckRateLimit = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;
const mockReconcile = reconcileMergedPrCreditForUser as jest.MockedFunction<typeof reconcileMergedPrCreditForUser>;

function makeRequest() {
  return new NextRequest("http://localhost/api/profile/github/reconcile", { method: "POST" });
}

function mockUserDoc(data: Record<string, unknown> | null) {
  mockGetAdminDb.mockReturnValue({
    collection: () => ({
      doc: () => ({
        get: async () => ({
          exists: data !== null,
          data: () => data ?? undefined,
        }),
      }),
    }),
  } as never);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCheckRateLimit.mockReturnValue({ success: true, retryAfter: 0 } as never);
});

describe("POST /api/profile/github/reconcile", () => {
  it("returns 429 when rate-limited", async () => {
    mockCheckRateLimit.mockReturnValueOnce({ success: false, retryAfter: 30 } as never);
    const res = await POST(makeRequest());
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
  });

  it("falls back to Retry-After=60 when retryAfter is missing", async () => {
    mockCheckRateLimit.mockReturnValueOnce({ success: false } as never);
    const res = await POST(makeRequest());
    expect(res.headers.get("Retry-After")).toBe("60");
  });

  it("returns 401 when not authenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 500 when admin db is null", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1" });
    mockGetAdminDb.mockReturnValueOnce(null as never);
    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
  });

  it("returns 404 when user doc does not exist", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1" });
    mockUserDoc(null);
    const res = await POST(makeRequest());
    expect(res.status).toBe(404);
  });

  it("returns 400 when github field is missing", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1" });
    mockUserDoc({ name: "X" });
    const res = await POST(makeRequest());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/GitHub is not connected/);
  });

  it("returns 400 when github is not an object", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1" });
    mockUserDoc({ github: "not-an-object" });
    const res = await POST(makeRequest());
    expect(res.status).toBe(400);
  });

  it("returns 400 when github.login is missing", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1" });
    mockUserDoc({ github: {} });
    const res = await POST(makeRequest());
    expect(res.status).toBe(400);
  });

  it("returns 400 when github.login is whitespace-only", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1" });
    mockUserDoc({ github: { login: "   " } });
    const res = await POST(makeRequest());
    expect(res.status).toBe(400);
  });

  it("returns 200 with reconciled PR counts on success", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1" });
    mockUserDoc({ github: { login: "octocat" } });
    mockReconcile.mockResolvedValue({ mergedPrCount: 5, syncedPrCount: 3 } as never);
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      success: true,
      githubLogin: "octocat",
      mergedPrCount: 5,
      syncedPrCount: 3,
    });
    expect(mockReconcile).toHaveBeenCalledWith("u1", "octocat");
  });

  it("trims surrounding whitespace from github.login", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1" });
    mockUserDoc({ github: { login: "  trimmed  " } });
    mockReconcile.mockResolvedValue({ mergedPrCount: 0, syncedPrCount: 0 } as never);
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(mockReconcile).toHaveBeenCalledWith("u1", "trimmed");
  });

  it("returns 500 on unexpected throw", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1" });
    mockUserDoc({ github: { login: "octocat" } });
    mockReconcile.mockRejectedValue(new Error("github API down"));
    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/Failed to reconcile/);
    consoleSpy.mockRestore();
  });
});
