/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST } from "@/app/api/mentorship/request/route";
import type { VerifiedUser } from "@/lib/server-auth";
import { getVerifiedUser } from "@/lib/server-auth";

jest.mock("@/lib/upstash-rate-limit", () => ({
  checkUpstashRateLimit: jest.fn(async () => ({
    success: true,
    remaining: 4,
    resetTime: Date.now() + 3600_000,
  })),
}));

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/mentorship/data-server", () => ({
  createMentorshipRequestServer: jest.fn(async () => "req-123"),
  getMentorshipRequestsForUserServer: jest.fn(async () => []),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const testUser: VerifiedUser = { uid: "u1", name: "Test User" };

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/mentorship/request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  toUserId: "u2",
  goals: ["Learn TypeScript"],
  message: "Hi, would you mentor me on TS?",
  consentToShareProfile: true,
};

describe("POST /api/mentorship/request", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(testUser);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate-limited", async () => {
    const { checkUpstashRateLimit } = jest.requireMock("@/lib/upstash-rate-limit") as {
      checkUpstashRateLimit: jest.Mock;
    };
    checkUpstashRateLimit.mockResolvedValueOnce({ success: false, retryAfter: 1800 });
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("1800");
  });

  it("returns 400 when consentToShareProfile is missing", async () => {
    const { consentToShareProfile: _omit, ...body } = validBody;
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/consentToShareProfile/);
  });

  it("returns 400 when consentToShareProfile is false", async () => {
    const res = await POST(makeRequest({ ...validBody, consentToShareProfile: false }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when consentToShareProfile is non-boolean truthy", async () => {
    // Specifically rejects "true" string — must be the literal boolean true.
    const res = await POST(makeRequest({ ...validBody, consentToShareProfile: "true" }));
    expect(res.status).toBe(400);
  });

  it("returns 200 and creates the request when consent is true", async () => {
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.requestId).toBe("req-123");
    const { createMentorshipRequestServer } = jest.requireMock("@/lib/mentorship/data-server") as {
      createMentorshipRequestServer: jest.Mock;
    };
    expect(createMentorshipRequestServer).toHaveBeenCalledWith(
      expect.objectContaining({
        fromUserId: "u1",
        toUserId: "u2",
        goals: ["Learn TypeScript"],
      })
    );
  });

  it("returns 400 when sender = recipient", async () => {
    const res = await POST(makeRequest({ ...validBody, toUserId: "u1" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when goals array is empty", async () => {
    const res = await POST(makeRequest({ ...validBody, goals: [] }));
    expect(res.status).toBe(400);
  });
});
