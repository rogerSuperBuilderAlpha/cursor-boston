/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import {
  POST,
  DELETE,
} from "@/app/api/hackathons/events/[eventId]/confirm-attendance/route";
import { getVerifiedUser } from "@/lib/server-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { refreshSnapshot } from "@/lib/hackathon-leaderboard-snapshot";

jest.mock("@/lib/rate-limit", () => {
  const actual = jest.requireActual("@/lib/rate-limit");
  return {
    ...actual,
    getClientIdentifier: jest.fn(() => "test-ip"),
    checkRateLimit: jest.fn(() => ({ success: true, retryAfter: 0 })),
  };
});

jest.mock("@/lib/upstash-rate-limit", () => ({
  checkUpstashRateLimit: jest.fn(async () => ({
    success: true,
    remaining: 9,
    resetTime: Date.now() + 60000,
  })),
}));

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(),
}));

jest.mock("@/lib/hackathon-leaderboard-snapshot", () => ({
  refreshSnapshot: jest.fn(async () => ({
    entries: [],
    totalCount: 0,
    websiteSignupCount: 0,
    creditTopN: 119,
    confirmedAttendeeCount: 0,
    attendanceLimit: 200,
    generatedAt: new Date().toISOString(),
  })),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<
  typeof getVerifiedUser
>;
const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockRefreshSnapshot = refreshSnapshot as jest.MockedFunction<
  typeof refreshSnapshot
>;
const { checkUpstashRateLimit } = jest.requireMock(
  "@/lib/upstash-rate-limit"
) as { checkUpstashRateLimit: jest.Mock };

const VALID_EVENT_ID = "sports-hack-2026";

function makeContext(eventId: string) {
  return { params: Promise.resolve({ eventId }) };
}

function makeRequest(method: "POST" | "DELETE") {
  return new NextRequest(
    `http://localhost/api/hackathons/events/${VALID_EVENT_ID}/confirm-attendance`,
    { method }
  );
}

function makeMockSignupDoc(data: Record<string, unknown> | null) {
  const update = jest.fn(async () => undefined);
  return {
    update,
    snap: {
      exists: data !== null,
      data: () => data,
    },
  };
}

describe("POST /api/hackathons/events/[eventId]/confirm-attendance", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRefreshSnapshot.mockResolvedValue({
      entries: [
        {
          rank: 1,
          userId: "user-1",
          displayName: "User One",
          githubLogin: null,
          mergedPrCount: 0,
          signedUpAt: "2026-01-01T00:00:00.000Z",
          creditEligible: false,
          status: "waitlisted",
          checkedIn: false,
          willBeLate: false,
          queuingForSpot: false,
          lumaRegistered: false,
          isCohort1: false,
          attendingConfirmed: true,
          attendingConfirmedAt: "2026-05-23T00:00:00.000Z",
          attendanceRank: 1,
        },
      ],
      totalCount: 1,
      websiteSignupCount: 1,
      creditTopN: 119,
      confirmedAttendeeCount: 1,
      attendanceLimit: 200,
      generatedAt: new Date().toISOString(),
    });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await POST(makeRequest("POST"), makeContext(VALID_EVENT_ID));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate-limited", async () => {
    checkUpstashRateLimit.mockResolvedValueOnce({
      success: false,
      retryAfter: 30,
    });
    const res = await POST(makeRequest("POST"), makeContext(VALID_EVENT_ID));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
  });

  it("returns 404 for unknown event ID", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "user-1", email: "u@test.com" });
    const res = await POST(makeRequest("POST"), makeContext("bogus-event"));
    expect(res.status).toBe(404);
  });

  it("returns 500 when db is not configured", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "user-1", email: "u@test.com" });
    mockGetAdminDb.mockReturnValue(null as never);
    const res = await POST(makeRequest("POST"), makeContext(VALID_EVENT_ID));
    expect(res.status).toBe(500);
  });

  it("returns 404 when the user has not signed up", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "user-1", email: "u@test.com" });
    const mock = makeMockSignupDoc(null);
    mockGetAdminDb.mockReturnValue({
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: jest.fn(async () => mock.snap),
          update: mock.update,
        })),
      })),
    } as never);
    const res = await POST(makeRequest("POST"), makeContext(VALID_EVENT_ID));
    expect(res.status).toBe(404);
    expect(mock.update).not.toHaveBeenCalled();
  });

  it("sets attendingConfirmedAt and returns 200", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "user-1", email: "u@test.com" });
    const mock = makeMockSignupDoc({
      userId: "user-1",
      signedUpAt: new Date("2026-05-20"),
    });
    mockGetAdminDb.mockReturnValue({
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: jest.fn(async () => mock.snap),
          update: mock.update,
        })),
      })),
    } as never);
    const res = await POST(makeRequest("POST"), makeContext(VALID_EVENT_ID));
    expect(res.status).toBe(200);
    expect(mock.update).toHaveBeenCalledTimes(1);
    const callArg = mock.update.mock.calls[0][0] as Record<string, unknown>;
    // Writes attendingConfirmedAt AND attendingConfirmedBy together (provenance
    // tag distinguishes user clicks from admin door check-ins under the
    // three-tier ranking model). DELETE mirrors with FieldValue.delete() on both.
    expect(Object.keys(callArg).sort()).toEqual(
      ["attendingConfirmedAt", "attendingConfirmedBy"].sort()
    );
    expect(mockRefreshSnapshot).toHaveBeenCalledWith(VALID_EVENT_ID);
    const body = await res.json();
    expect(body).toMatchObject({
      ok: true,
      attendingConfirmed: true,
      confirmedAttendeeCount: 1,
      attendanceLimit: 200,
    });
  });

  it("is idempotent: skips the update when already confirmed", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "user-1", email: "u@test.com" });
    const mock = makeMockSignupDoc({
      userId: "user-1",
      signedUpAt: new Date("2026-05-20"),
      attendingConfirmedAt: new Date("2026-05-21"),
    });
    mockGetAdminDb.mockReturnValue({
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: jest.fn(async () => mock.snap),
          update: mock.update,
        })),
      })),
    } as never);
    const res = await POST(makeRequest("POST"), makeContext(VALID_EVENT_ID));
    expect(res.status).toBe(200);
    expect(mock.update).not.toHaveBeenCalled();
    expect(mockRefreshSnapshot).toHaveBeenCalledWith(VALID_EVENT_ID);
  });
});

describe("DELETE /api/hackathons/events/[eventId]/confirm-attendance", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRefreshSnapshot.mockResolvedValue({
      entries: [],
      totalCount: 0,
      websiteSignupCount: 0,
      creditTopN: 119,
      confirmedAttendeeCount: 0,
      attendanceLimit: 200,
      generatedAt: new Date().toISOString(),
    });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await DELETE(makeRequest("DELETE"), makeContext(VALID_EVENT_ID));
    expect(res.status).toBe(401);
  });

  it("returns 404 when not signed up", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "user-1", email: "u@test.com" });
    const mock = makeMockSignupDoc(null);
    mockGetAdminDb.mockReturnValue({
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: jest.fn(async () => mock.snap),
          update: mock.update,
        })),
      })),
    } as never);
    const res = await DELETE(makeRequest("DELETE"), makeContext(VALID_EVENT_ID));
    expect(res.status).toBe(404);
    expect(mock.update).not.toHaveBeenCalled();
  });

  it("clears attendingConfirmedAt and returns 200", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "user-1", email: "u@test.com" });
    const mock = makeMockSignupDoc({
      userId: "user-1",
      signedUpAt: new Date("2026-05-20"),
      attendingConfirmedAt: new Date("2026-05-21"),
    });
    mockGetAdminDb.mockReturnValue({
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: jest.fn(async () => mock.snap),
          update: mock.update,
        })),
      })),
    } as never);
    const res = await DELETE(makeRequest("DELETE"), makeContext(VALID_EVENT_ID));
    expect(res.status).toBe(200);
    expect(mock.update).toHaveBeenCalledTimes(1);
    const callArg = mock.update.mock.calls[0][0] as Record<string, unknown>;
    // Writes attendingConfirmedAt AND attendingConfirmedBy together (provenance
    // tag distinguishes user clicks from admin door check-ins under the
    // three-tier ranking model). DELETE mirrors with FieldValue.delete() on both.
    expect(Object.keys(callArg).sort()).toEqual(
      ["attendingConfirmedAt", "attendingConfirmedBy"].sort()
    );
    expect(mockRefreshSnapshot).toHaveBeenCalledWith(VALID_EVENT_ID);
  });

  it("is idempotent: skips the update when not currently confirmed", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "user-1", email: "u@test.com" });
    const mock = makeMockSignupDoc({
      userId: "user-1",
      signedUpAt: new Date("2026-05-20"),
    });
    mockGetAdminDb.mockReturnValue({
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: jest.fn(async () => mock.snap),
          update: mock.update,
        })),
      })),
    } as never);
    const res = await DELETE(makeRequest("DELETE"), makeContext(VALID_EVENT_ID));
    expect(res.status).toBe(200);
    expect(mock.update).not.toHaveBeenCalled();
  });
});
