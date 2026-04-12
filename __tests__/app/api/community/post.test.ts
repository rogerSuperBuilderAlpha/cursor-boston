/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST } from "@/app/api/community/post/route";
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

jest.mock("@/lib/utils", () => ({
  getDisplayName: (user: { name?: string }) => user.name || "Anonymous",
}));

const mockSet = jest.fn().mockResolvedValue(undefined);
const mockDoc = jest.fn(() => ({ id: "msg-123", set: mockSet }));

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(() => ({
    collection: () => ({ doc: mockDoc }),
  })),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const { checkRateLimit } = jest.requireMock("@/lib/rate-limit");

const testUser: VerifiedUser = { uid: "u1", name: "Test User" };

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/community/post", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validContent = "A".repeat(150);

describe("POST /api/community/post", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(testUser);
    (checkRateLimit as jest.Mock).mockReturnValue({ success: true });
  });

  it("returns 401 when user is not authenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await POST(makeRequest({ content: validContent }));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    (checkRateLimit as jest.Mock).mockReturnValue({ success: false, retryAfter: 30 });
    const res = await POST(makeRequest({ content: validContent }));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.retryAfterSeconds).toBe(30);
  });

  it("returns 400 for content that is too short", async () => {
    const res = await POST(makeRequest({ content: "too short" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/between 100 and 500/);
  });

  it("returns 400 for content that is too long", async () => {
    const res = await POST(makeRequest({ content: "A".repeat(501) }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing content", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("creates a message and returns messageId on success", async () => {
    const res = await POST(makeRequest({ content: validContent }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.messageId).toBe("msg-123");
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        content: validContent,
        authorId: "u1",
        authorName: "Test User",
        likeCount: 0,
        dislikeCount: 0,
        replyCount: 0,
        repostCount: 0,
      })
    );
  });

  it("sanitizes HTML from content", async () => {
    const htmlContent = "<b>" + "A".repeat(100) + "</b>" + "B".repeat(50);
    const res = await POST(makeRequest({ content: htmlContent }));
    expect(res.status).toBe(200);
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.not.stringContaining("<b>"),
      })
    );
  });

  it("returns 400 for malformed JSON", async () => {
    const req = new NextRequest("http://localhost/api/community/post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
