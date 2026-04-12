/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST } from "@/app/api/community/delete/route";
import type { VerifiedUser } from "@/lib/server-auth";
import { getVerifiedUser } from "@/lib/server-auth";

jest.mock("@/lib/logger", () => ({
  logger: { error: jest.fn(), logError: jest.fn() },
}));

jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: jest.fn(() => ({ success: true })),
  getClientIdentifier: () => "test-client",
}));

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

const mockDelete = jest.fn().mockResolvedValue(undefined);
const mockGet = jest.fn();
const mockDoc = jest.fn(() => ({
  get: mockGet,
  delete: mockDelete,
}));

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(() => ({
    collection: () => ({ doc: mockDoc }),
  })),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;

const testUser: VerifiedUser = { uid: "u1", name: "Test" };

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/community/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/community/delete", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(testUser);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await POST(makeRequest({ messageId: "msg-1" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid messageId format", async () => {
    const res = await POST(makeRequest({ messageId: "invalid/path" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Invalid messageId/);
  });

  it("returns 400 for missing messageId", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 404 when message does not exist", async () => {
    mockGet.mockResolvedValue({ exists: false });
    const res = await POST(makeRequest({ messageId: "msg-1" }));
    expect(res.status).toBe(404);
  });

  it("returns 403 when user is not the author", async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ authorId: "other-user" }),
    });
    const res = await POST(makeRequest({ messageId: "msg-1" }));
    expect(res.status).toBe(403);
  });

  it("deletes the message when user is the author", async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ authorId: "u1" }),
    });
    const res = await POST(makeRequest({ messageId: "msg-1" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockDelete).toHaveBeenCalled();
  });
});
