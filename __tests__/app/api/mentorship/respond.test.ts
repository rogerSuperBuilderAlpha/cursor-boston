/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * @jest-environment node
 *
 * OpenSSF Gold coverage push #151 — app/api/mentorship/respond/route.ts.
 */

import { NextRequest } from "next/server";
import { POST } from "@/app/api/mentorship/respond/route";
import type { VerifiedUser } from "@/lib/server-auth";
import { getVerifiedUser } from "@/lib/server-auth";
import {
  MentorshipRequestAlreadyRespondedError,
  MentorshipRequestNotFoundError,
  MentorshipRequestUnauthorizedError,
} from "@/lib/mentorship/data-server";

jest.mock("@/lib/upstash-rate-limit", () => ({
  checkUpstashRateLimit: jest.fn(async () => ({
    success: true,
    remaining: 9,
    resetTime: Date.now() + 60_000,
  })),
}));

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/mentorship/data-server", () => {
  const actual = jest.requireActual("@/lib/mentorship/data-server");
  return {
    ...actual,
    respondToMentorshipRequestServer: jest.fn(),
  };
});

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const testUser: VerifiedUser = { uid: "u1", name: "Test User" };

function makeRequest(body: unknown, opts: { rawBody?: string } = {}) {
  return new NextRequest("http://localhost/api/mentorship/respond", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: opts.rawBody !== undefined ? opts.rawBody : JSON.stringify(body),
  });
}

const validBody = { requestId: "req-1", action: "accept" };

describe("POST /api/mentorship/respond", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const { respondToMentorshipRequestServer } = jest.requireMock(
      "@/lib/mentorship/data-server",
    ) as { respondToMentorshipRequestServer: jest.Mock };
    respondToMentorshipRequestServer.mockResolvedValue({
      status: "accepted",
      pairingId: "p1",
    });
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate-limited with Retry-After header", async () => {
    const { checkUpstashRateLimit } = jest.requireMock(
      "@/lib/upstash-rate-limit",
    ) as { checkUpstashRateLimit: jest.Mock };
    checkUpstashRateLimit.mockResolvedValueOnce({
      success: false,
      retryAfter: 42,
    });
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("42");
  });

  it("returns 429 without Retry-After header when retryAfter is undefined", async () => {
    const { checkUpstashRateLimit } = jest.requireMock(
      "@/lib/upstash-rate-limit",
    ) as { checkUpstashRateLimit: jest.Mock };
    checkUpstashRateLimit.mockResolvedValueOnce({ success: false });
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeNull();
  });

  it("returns 400 when body is invalid JSON", async () => {
    const res = await POST(makeRequest(undefined, { rawBody: "not-json" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when requestId is missing", async () => {
    const res = await POST(makeRequest({ action: "accept" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when action is not 'accept' or 'decline'", async () => {
    const res = await POST(makeRequest({ requestId: "req-1", action: "maybe" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when requestId is an empty string", async () => {
    const res = await POST(makeRequest({ requestId: "", action: "accept" }));
    expect(res.status).toBe(400);
  });

  it("returns 200 with 'accepted' message on accept happy path", async () => {
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.pairingId).toBe("p1");
    expect(json.message).toMatch(/accepted/);
  });

  it("returns 200 with 'declined' message on decline happy path", async () => {
    const { respondToMentorshipRequestServer } = jest.requireMock(
      "@/lib/mentorship/data-server",
    ) as { respondToMentorshipRequestServer: jest.Mock };
    respondToMentorshipRequestServer.mockResolvedValueOnce({
      status: "declined",
    });
    const res = await POST(
      makeRequest({ requestId: "req-1", action: "decline" }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.message).toMatch(/declined/i);
  });

  it("returns 404 on MentorshipRequestNotFoundError", async () => {
    const { respondToMentorshipRequestServer } = jest.requireMock(
      "@/lib/mentorship/data-server",
    ) as { respondToMentorshipRequestServer: jest.Mock };
    respondToMentorshipRequestServer.mockRejectedValueOnce(
      new MentorshipRequestNotFoundError(),
    );
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(404);
  });

  it("returns 403 on MentorshipRequestUnauthorizedError", async () => {
    const { respondToMentorshipRequestServer } = jest.requireMock(
      "@/lib/mentorship/data-server",
    ) as { respondToMentorshipRequestServer: jest.Mock };
    respondToMentorshipRequestServer.mockRejectedValueOnce(
      new MentorshipRequestUnauthorizedError(),
    );
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(403);
  });

  it("returns 400 on MentorshipRequestAlreadyRespondedError", async () => {
    const { respondToMentorshipRequestServer } = jest.requireMock(
      "@/lib/mentorship/data-server",
    ) as { respondToMentorshipRequestServer: jest.Mock };
    respondToMentorshipRequestServer.mockRejectedValueOnce(
      new MentorshipRequestAlreadyRespondedError(),
    );
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(400);
  });

  it("returns 500 on unexpected error", async () => {
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const { respondToMentorshipRequestServer } = jest.requireMock(
      "@/lib/mentorship/data-server",
    ) as { respondToMentorshipRequestServer: jest.Mock };
    respondToMentorshipRequestServer.mockRejectedValueOnce(new Error("db down"));
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Failed to respond to request");
    consoleErrorSpy.mockRestore();
  });
});
