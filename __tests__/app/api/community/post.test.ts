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

jest.mock("@/lib/upstash-rate-limit", () => ({
  checkUpstashRateLimit: jest.fn(async () => ({ success: true, remaining: 9, resetTime: Date.now() + 60000 })),
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
const padContent = (content: string) => `${content} ${"A".repeat(120)}`;

async function expectStoredPostFor(content: string) {
  const res = await POST(makeRequest({ content }));
  expect(res.status).toBe(200);
  return mockSet.mock.calls[mockSet.mock.calls.length - 1]?.[0] as Record<string, unknown>;
}

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
    const { checkUpstashRateLimit } = jest.requireMock("@/lib/upstash-rate-limit") as { checkUpstashRateLimit: jest.Mock };
    checkUpstashRateLimit.mockResolvedValueOnce({ success: false, retryAfter: 30 });
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
        mentions: [],
        authorId: "u1",
        authorName: "Test User",
        likeCount: 0,
        dislikeCount: 0,
        replyCount: 0,
        repostCount: 0,
      })
    );
  });

  it("preserves HTML-like input verbatim (render layer auto-escapes)", async () => {
    // sanitizeText no longer strips angle brackets — JSX expressions
    // auto-escape `<` and `>` at render time, so storing them verbatim is
    // safe and avoids silently dropping legit input like "<Component />".
    const htmlContent = "<b>" + "A".repeat(100) + "</b>" + "B".repeat(50);
    const res = await POST(makeRequest({ content: htmlContent }));
    expect(res.status).toBe(200);
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        content: htmlContent,
      })
    );
  });

  it("stores valid mentions as normalized Firestore-queryable handles", async () => {
    const stored = await expectStoredPostFor(
      padContent("Shipping this with @Alice and @bob_2 for review.")
    );

    expect(stored.mentions).toEqual(["alice", "bob_2"]);
  });

  it("deduplicates repeated mentions case-insensitively", async () => {
    const stored = await expectStoredPostFor(
      padContent("Looping in @ALICE, @alice, and @Alice again for visibility.")
    );

    expect(stored.mentions).toEqual(["alice"]);
  });

  it("ignores invalid mention syntax and email addresses", async () => {
    const stored = await expectStoredPostFor(
      padContent("Invalid handles: @a @bad-handle contact alice@example.com and @ok_name.")
    );

    expect(stored.mentions).toEqual(["ok_name"]);
  });

  it("does not store XSS-looking mention payloads as executable metadata", async () => {
    const stored = await expectStoredPostFor(
      padContent("Heads up @Alice<script>alert(1)</script> @<img src=x onerror=alert(1)>")
    );

    expect(stored.content).toContain("<script>alert(1)</script>");
    expect(stored.mentions).toEqual(["alice"]);
  });

  it("caps stored mention metadata to keep array-contains queries bounded", async () => {
    const handles = Array.from({ length: 30 }, (_, index) => `@user_${index}`);
    const stored = await expectStoredPostFor(padContent(handles.join(" ")));

    expect(stored.mentions).toHaveLength(25);
    expect(stored.mentions).toEqual(handles.slice(0, 25).map((handle) => handle.slice(1)));
  });

  it("stores an empty mentions array when content has no valid handles", async () => {
    const stored = await expectStoredPostFor(validContent);

    expect(stored.mentions).toEqual([]);
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
