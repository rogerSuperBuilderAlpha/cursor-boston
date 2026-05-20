/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment node
 *
 * OpenSSF Gold coverage push #155 — `app/api/maintainers/review-queue/route.ts`
 * (40% / 6 uncovered branches). Covers 429 rate-limited (with and without
 * retryAfter), 401 unauthorized, 403 github-not-connected, 403 not-an-applicant,
 * 500 unexpected throw, and the 200 happy path.
 */
import { NextRequest } from "next/server";

jest.mock("@/lib/server-auth", () => ({ getVerifiedUser: jest.fn() }));
jest.mock("@/lib/maintainer-user", () => ({
  getUserGithubLoginFromFirestore: jest.fn(),
}));
jest.mock("@/lib/maintainer-github-queue", () => ({
  hasMaintainerApplicationPullRequest: jest.fn(),
  fetchMaintainerReviewQueue: jest.fn(),
}));
jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: jest.fn(() => ({ success: true })),
  getClientIdentifier: jest.fn(() => "client-1"),
}));

import { GET } from "@/app/api/maintainers/review-queue/route";
import { getVerifiedUser } from "@/lib/server-auth";
import { getUserGithubLoginFromFirestore } from "@/lib/maintainer-user";
import {
  hasMaintainerApplicationPullRequest,
  fetchMaintainerReviewQueue,
} from "@/lib/maintainer-github-queue";
import { checkRateLimit } from "@/lib/rate-limit";

const mockUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockGithubLogin = getUserGithubLoginFromFirestore as jest.MockedFunction<
  typeof getUserGithubLoginFromFirestore
>;
const mockHasPR = hasMaintainerApplicationPullRequest as jest.MockedFunction<
  typeof hasMaintainerApplicationPullRequest
>;
const mockFetchQueue = fetchMaintainerReviewQueue as jest.MockedFunction<
  typeof fetchMaintainerReviewQueue
>;
const mockRate = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;

function makeReq() {
  return new NextRequest("http://localhost/api/maintainers/review-queue");
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRate.mockReturnValue({ success: true } as never);
});

describe("GET /api/maintainers/review-queue", () => {
  it("returns 429 with Retry-After when rate-limited", async () => {
    mockRate.mockReturnValueOnce({ success: false, retryAfter: 42 } as never);
    const res = await GET(makeReq());
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("42");
  });

  it("falls back to Retry-After=60 when rate-limited without retryAfter", async () => {
    mockRate.mockReturnValueOnce({ success: false } as never);
    const res = await GET(makeReq());
    expect(res.headers.get("Retry-After")).toBe("60");
  });

  it("returns 401 when caller is not authenticated", async () => {
    mockUser.mockResolvedValueOnce(null);
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it("returns 403 when GitHub is not connected on the profile", async () => {
    mockUser.mockResolvedValueOnce({ uid: "u1" } as never);
    mockGithubLogin.mockResolvedValueOnce(null);
    const res = await GET(makeReq());
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/GitHub is not connected/i);
  });

  it("returns 403 when the user has no maintainer application PR", async () => {
    mockUser.mockResolvedValueOnce({ uid: "u1" } as never);
    mockGithubLogin.mockResolvedValueOnce("octocat");
    mockHasPR.mockResolvedValueOnce(false);
    const res = await GET(makeReq());
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/application pull request required/i);
  });

  it("returns 200 with the queue counts on the happy path", async () => {
    mockUser.mockResolvedValueOnce({ uid: "u1" } as never);
    mockGithubLogin.mockResolvedValueOnce("octocat");
    mockHasPR.mockResolvedValueOnce(true);
    mockFetchQueue.mockResolvedValueOnce({
      notApproved: [{ number: 1 }, { number: 2 }],
      notCommented: [{ number: 3 }],
      approvedNotMerged: [{ number: 4 }],
      githubConfigured: true,
    } as never);

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      githubLogin: "octocat",
      notApprovedCount: 2,
      notCommentedCount: 1,
      notApproved: [{ number: 1 }, { number: 2 }],
      notCommented: [{ number: 3 }],
      approvedNotMerged: [{ number: 4 }],
      githubConfigured: true,
    });
    expect(mockFetchQueue).toHaveBeenCalledWith("octocat");
  });

  it("returns 500 when downstream throws", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    mockUser.mockResolvedValueOnce({ uid: "u1" } as never);
    mockGithubLogin.mockResolvedValueOnce("octocat");
    mockHasPR.mockResolvedValueOnce(true);
    mockFetchQueue.mockRejectedValueOnce(new Error("github API down"));
    const res = await GET(makeReq());
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/Failed to load review queue/);
    consoleSpy.mockRestore();
  });
});
