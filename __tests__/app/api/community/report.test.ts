/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST } from "@/app/api/community/report/route";
import type { VerifiedUser } from "@/lib/server-auth";
import { getVerifiedUser } from "@/lib/server-auth";

jest.mock("@/lib/logger", () => ({
  logger: { error: jest.fn(), logError: jest.fn() },
}));

jest.mock("@/lib/upstash-rate-limit", () => ({
  checkUpstashRateLimit: jest.fn(async () => ({ success: true, remaining: 9, resetTime: Date.now() + 3600_000 })),
}));

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

const mockReportSet = jest.fn().mockResolvedValue(undefined);
const mockReportRef = { id: "rep-123", set: mockReportSet };
const mockReportDoc = jest.fn(() => mockReportRef);

const mockMessageGet = jest.fn();
const mockMessageDoc = jest.fn(() => ({ get: mockMessageGet }));

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(() => ({
    collection: (name: string) => {
      if (name === "communityReports") return { doc: mockReportDoc };
      if (name === "communityMessages") return { doc: mockMessageDoc };
      throw new Error(`unexpected collection: ${name}`);
    },
  })),
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: () => "__SERVER_TIMESTAMP__",
  },
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const testUser: VerifiedUser = { uid: "u1", name: "Reporter" };

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/community/report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/community/report", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockMessageGet.mockResolvedValue({
      exists: true,
      data: () => ({ authorId: "u2", content: "hello" }),
    });
  });

  const validBody = {
    targetMessageId: "msg-abc",
    reason: "harassment",
    notes: "name-calling in a reply",
  };

  it("returns 401 when unauthenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate-limited", async () => {
    const { checkUpstashRateLimit } = jest.requireMock("@/lib/upstash-rate-limit") as {
      checkUpstashRateLimit: jest.Mock;
    };
    checkUpstashRateLimit.mockResolvedValueOnce({ success: false, retryAfter: 600 });
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(429);
  });

  it("returns 400 for an unknown reason", async () => {
    const res = await POST(makeRequest({ ...validBody, reason: "potato" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/spam|harassment|hate/);
  });

  it("returns 400 for missing targetMessageId", async () => {
    const { targetMessageId: _omit, ...rest } = validBody;
    const res = await POST(makeRequest(rest));
    expect(res.status).toBe(400);
  });

  it("returns 404 when target message does not exist", async () => {
    mockMessageGet.mockResolvedValueOnce({ exists: false, data: () => undefined });
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(404);
  });

  it("creates a report and returns reportId on success", async () => {
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reportId).toBe("rep-123");
    expect(mockReportSet).toHaveBeenCalledWith(
      expect.objectContaining({
        reporterUid: "u1",
        targetMessageId: "msg-abc",
        targetAuthorId: "u2",
        reason: "harassment",
        notes: "name-calling in a reply",
        status: "open",
      })
    );
  });

  it("truncates oversized notes to 500 chars", async () => {
    const longNotes = "x".repeat(1000);
    await POST(makeRequest({ ...validBody, notes: longNotes }));
    expect(mockReportSet).toHaveBeenCalledWith(
      expect.objectContaining({ notes: "x".repeat(500) })
    );
  });
});
