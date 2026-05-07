/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST, GET } from "@/app/api/community/moderate/route";
import type { VerifiedUser } from "@/lib/server-auth";
import { getVerifiedUser } from "@/lib/server-auth";

jest.mock("@/lib/logger", () => ({
  logger: { error: jest.fn(), logError: jest.fn() },
}));

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

const mockBatchUpdate = jest.fn();
const mockBatchCommit = jest.fn().mockResolvedValue(undefined);
const mockBatch = jest.fn(() => ({ update: mockBatchUpdate, commit: mockBatchCommit }));

const mockReportRef = { path: "communityReports/r1" };
const mockMessageRef = { path: "communityMessages/m1" };
const mockUserRef = { path: "users/u-author" };

const mockReportGet = jest.fn();
const mockReportDoc = jest.fn(() => ({ ...mockReportRef, get: mockReportGet }));
const mockMessageDoc = jest.fn(() => mockMessageRef);
const mockUserDoc = jest.fn(() => mockUserRef);

const mockListSnap = { docs: [] as { id: string; data: () => Record<string, unknown> }[] };
const mockOrderBy = jest.fn(() => ({
  where: jest.fn().mockReturnThis(),
  limit: jest.fn(() => ({ get: jest.fn(async () => mockListSnap) })),
}));

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(() => ({
    collection: (name: string) => {
      if (name === "communityReports") return { doc: mockReportDoc, orderBy: mockOrderBy };
      if (name === "communityMessages") return { doc: mockMessageDoc };
      if (name === "users") return { doc: mockUserDoc };
      throw new Error(`unexpected collection: ${name}`);
    },
    batch: mockBatch,
  })),
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "__SERVER_TIMESTAMP__" },
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const adminUser: VerifiedUser = { uid: "admin1", name: "Admin", isAdmin: true };
const regularUser: VerifiedUser = { uid: "u1", name: "Reg", isAdmin: false };

function makePostRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/community/moderate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
function makeGetRequest(query = "") {
  return new NextRequest(`http://localhost/api/community/moderate${query}`, { method: "GET" });
}

describe("POST /api/community/moderate (admin actions)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(adminUser);
    mockReportGet.mockResolvedValue({
      exists: true,
      data: () => ({ targetMessageId: "m1", targetAuthorId: "u-author", reason: "spam" }),
    });
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await POST(makePostRequest({ reportId: "r1", action: "dismiss" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    mockGetVerifiedUser.mockResolvedValue(regularUser);
    const res = await POST(makePostRequest({ reportId: "r1", action: "dismiss" }));
    expect(res.status).toBe(403);
  });

  it("returns 400 for unknown action", async () => {
    const res = await POST(makePostRequest({ reportId: "r1", action: "yeet" }));
    expect(res.status).toBe(400);
  });

  it("dismiss only updates the report doc", async () => {
    const res = await POST(makePostRequest({ reportId: "r1", action: "dismiss" }));
    expect(res.status).toBe(200);
    expect(mockBatchUpdate).toHaveBeenCalledTimes(1);
    expect(mockBatchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ path: "communityReports/r1" }),
      expect.objectContaining({ status: "dismissed", action: "dismiss" })
    );
  });

  it("hide updates report and message", async () => {
    const res = await POST(makePostRequest({ reportId: "r1", action: "hide" }));
    expect(res.status).toBe(200);
    expect(mockBatchUpdate).toHaveBeenCalledTimes(2);
    expect(mockBatchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ path: "communityMessages/m1" }),
      expect.objectContaining({ hidden: true })
    );
  });

  it("suspend updates report and user", async () => {
    const res = await POST(makePostRequest({ reportId: "r1", action: "suspend" }));
    expect(res.status).toBe(200);
    expect(mockBatchUpdate).toHaveBeenCalledTimes(2);
    expect(mockBatchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ path: "users/u-author" }),
      expect.objectContaining({ suspended: true })
    );
  });

  it("returns 400 for suspend when report has no targetAuthorId", async () => {
    mockReportGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ targetMessageId: "m1", targetAuthorId: null, reason: "spam" }),
    });
    const res = await POST(makePostRequest({ reportId: "r1", action: "suspend" }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when report does not exist", async () => {
    mockReportGet.mockResolvedValueOnce({ exists: false, data: () => undefined });
    const res = await POST(makePostRequest({ reportId: "r1", action: "dismiss" }));
    expect(res.status).toBe(404);
  });
});

describe("GET /api/community/moderate (admin listing)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(adminUser);
    mockListSnap.docs = [
      {
        id: "r1",
        data: () => ({
          reporterUid: "u1",
          reporterDisplayName: "Reg",
          targetMessageId: "m1",
          targetAuthorId: "u2",
          reason: "spam",
          notes: "",
          status: "open",
          createdAt: { toDate: () => new Date(0) },
        }),
      },
    ];
  });

  it("returns 403 for non-admin", async () => {
    mockGetVerifiedUser.mockResolvedValue(regularUser);
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(403);
  });

  it("returns the open reports list", async () => {
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reports).toHaveLength(1);
    expect(body.reports[0]).toMatchObject({ reportId: "r1", reason: "spam" });
  });
});
