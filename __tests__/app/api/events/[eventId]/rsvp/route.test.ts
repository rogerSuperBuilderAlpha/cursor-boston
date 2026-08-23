/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 *
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { DELETE, GET, POST } from "@/app/api/events/[eventId]/rsvp/route";
import {
  cancelEventRsvp,
  createEventRsvp,
  getEventRsvpSnapshot,
} from "@/lib/event-rsvp";
import { getVerifiedUser } from "@/lib/server-auth";

jest.mock("@/lib/logger", () => ({
  logger: { logError: jest.fn() },
}));

jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: jest.fn(() => ({ success: true })),
  getClientIdentifier: () => "test-client",
}));

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(),
}));

jest.mock("@/lib/event-rsvp", () => ({
  getEventRsvpSnapshot: jest.fn(),
  createEventRsvp: jest.fn(),
  cancelEventRsvp: jest.fn(),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockGetSnapshot = getEventRsvpSnapshot as jest.MockedFunction<typeof getEventRsvpSnapshot>;
const mockCreate = createEventRsvp as jest.MockedFunction<typeof createEventRsvp>;
const mockCancel = cancelEventRsvp as jest.MockedFunction<typeof cancelEventRsvp>;
const { checkRateLimit } = jest.requireMock("@/lib/rate-limit") as {
  checkRateLimit: jest.Mock;
};

const snapshot = {
  capacity: 50,
  confirmedCount: 1,
  waitlistCount: 0,
  remaining: 49,
  myStatus: "confirmed" as const,
  waitlistPosition: null,
};

function makeContext(eventId: string) {
  return { params: Promise.resolve({ eventId }) };
}

function makeRequest(method: string, body?: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/events/cafe-cursor-boston-2026/rsvp", {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("GET /api/events/[eventId]/rsvp", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    checkRateLimit.mockReturnValue({ success: true });
    mockGetVerifiedUser.mockResolvedValue(null);
  });

  it("returns 429 when rate limited", async () => {
    checkRateLimit.mockReturnValue({ success: false, retryAfter: 30 });
    const res = await GET(makeRequest("GET"), makeContext("cafe-cursor-boston-2026"));
    expect(res.status).toBe(429);
  });

  it("returns 400 for an invalid event id", async () => {
    const res = await GET(makeRequest("GET"), makeContext("bad id!"));
    expect(res.status).toBe(400);
  });

  it("returns public counts without auth", async () => {
    mockGetSnapshot.mockResolvedValue({ configured: true, snapshot: { ...snapshot, myStatus: "none" } });
    const res = await GET(makeRequest("GET"), makeContext("cafe-cursor-boston-2026"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.confirmedCount).toBe(1);
    expect(body.myStatus).toBe("none");
  });
});

describe("POST /api/events/[eventId]/rsvp", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    checkRateLimit.mockReturnValue({ success: true });
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await POST(makeRequest("POST", {}), makeContext("cafe-cursor-boston-2026"));
    expect(res.status).toBe(401);
  });

  it("creates an RSVP for the signed-in user", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1" } as never);
    mockCreate.mockResolvedValue({ configured: true, snapshot });
    const res = await POST(makeRequest("POST", {}), makeContext("cafe-cursor-boston-2026"));
    expect(res.status).toBe(200);
    expect(mockCreate).toHaveBeenCalledWith("cafe-cursor-boston-2026", "u1");
    const body = await res.json();
    expect(body.myStatus).toBe("confirmed");
  });
});

describe("DELETE /api/events/[eventId]/rsvp", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    checkRateLimit.mockReturnValue({ success: true });
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await DELETE(makeRequest("DELETE"), makeContext("cafe-cursor-boston-2026"));
    expect(res.status).toBe(401);
  });

  it("cancels an RSVP", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1" } as never);
    mockCancel.mockResolvedValue({
      configured: true,
      snapshot: { ...snapshot, confirmedCount: 0, remaining: 50, myStatus: "none" },
    });
    const res = await DELETE(makeRequest("DELETE"), makeContext("cafe-cursor-boston-2026"));
    expect(res.status).toBe(200);
    expect(mockCancel).toHaveBeenCalledWith("cafe-cursor-boston-2026", "u1");
  });
});
