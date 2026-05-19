/**
 * @jest-environment node
 *
 * OpenSSF Gold coverage push #59 — game/community/chat route.
 */
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/game/community/chat/route";
import { getVerifiedUser } from "@/lib/server-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  CommunityMessageEmptyError,
  CommunityMessageTooLongError,
  CommunityMessageWrongCasteError,
  createCommunityMessage,
  listRecentCommunityMessages,
} from "@/lib/game/community";
import { checkUpstashRateLimit } from "@/lib/upstash-rate-limit";

jest.mock("@/lib/server-auth", () => ({ getVerifiedUser: jest.fn() }));
jest.mock("@/lib/firebase-admin", () => ({ getAdminDb: jest.fn() }));
jest.mock("@/lib/game/community", () => {
  const actual = jest.requireActual("@/lib/game/community");
  return {
    ...actual,
    createCommunityMessage: jest.fn(),
    listRecentCommunityMessages: jest.fn(),
  };
});
jest.mock("@/lib/upstash-rate-limit", () => ({
  checkUpstashRateLimit: jest.fn(),
}));
jest.mock("@/lib/logger", () => ({
  logger: { logError: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockList = listRecentCommunityMessages as jest.MockedFunction<
  typeof listRecentCommunityMessages
>;
const mockCreate = createCommunityMessage as jest.MockedFunction<typeof createCommunityMessage>;
const mockRate = checkUpstashRateLimit as jest.MockedFunction<typeof checkUpstashRateLimit>;

function makeReq(opts: {
  method?: "GET" | "POST";
  scope?: string;
  body?: unknown;
} = {}) {
  const url = new URL("https://example.com/api/game/community/chat");
  if (opts.scope) url.searchParams.set("scope", opts.scope);
  return new NextRequest(url, {
    method: opts.method ?? "GET",
    headers: { "content-type": "application/json" },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

function setupPlayerDb(player: Record<string, unknown> | null) {
  mockDb.mockReturnValue({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn().mockResolvedValue({
          exists: player !== null,
          data: () => player,
        }),
      })),
    })),
  } as never);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRate.mockResolvedValue({ success: true } as never);
  mockUser.mockResolvedValue({ uid: "u1", email: "u@x" } as never);
  mockList.mockResolvedValue([] as never);
  mockCreate.mockResolvedValue({ id: "m1" } as never);
});

describe("GET /api/game/community/chat", () => {
  it("returns 401 unauthenticated", async () => {
    mockUser.mockResolvedValueOnce(null);
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it("defaults scope to 'global' when no query param", async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    expect(mockList).toHaveBeenCalledWith(expect.any(Number), "global");
    const body = await res.json();
    expect(body.scope).toBe("global");
  });

  it("defaults scope to 'global' for malformed query value", async () => {
    await GET(makeReq({ scope: "not-a-valid-scope" }));
    expect(mockList).toHaveBeenCalledWith(expect.any(Number), "global");
  });

  it("accepts caste:white as a valid scope", async () => {
    const res = await GET(makeReq({ scope: "caste:white" }));
    expect(res.status).toBe(200);
    expect(mockList).toHaveBeenCalledWith(expect.any(Number), "caste:white");
    const body = await res.json();
    expect(body.scope).toBe("caste:white");
  });

  it("sets Cache-Control private max-age=10", async () => {
    const res = await GET(makeReq());
    expect(res.headers.get("Cache-Control")).toBe(
      "private, max-age=10, must-revalidate",
    );
  });

  it("returns 500 with Error message when list throws", async () => {
    mockList.mockRejectedValueOnce(new Error("firestore down"));
    const res = await GET(makeReq());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.message).toBe("firestore down");
  });

  it("returns 500 'Server error' when non-Error throws", async () => {
    mockList.mockRejectedValueOnce("plain-string");
    const res = await GET(makeReq());
    const body = await res.json();
    expect(body.error.message).toBe("Server error");
  });
});

describe("POST /api/game/community/chat", () => {
  const VALID_BODY = { body: "Hello caste!" };

  it("returns 401 unauthenticated", async () => {
    mockUser.mockResolvedValueOnce(null);
    const res = await POST(makeReq({ method: "POST", body: VALID_BODY }));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limit (10/60s) hits, with retryAfter", async () => {
    mockRate.mockResolvedValueOnce({ success: false, retryAfter: 25 } as never);
    const res = await POST(makeReq({ method: "POST", body: VALID_BODY }));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error.message).toContain("25");
  });

  it("falls back to retryAfter=30 default when not provided", async () => {
    mockRate.mockResolvedValueOnce({ success: false } as never);
    const res = await POST(makeReq({ method: "POST", body: VALID_BODY }));
    const body = await res.json();
    expect(body.error.message).toContain("30");
  });

  it("returns 400 when body is not valid JSON", async () => {
    const req = new NextRequest("https://example.com/api/game/community/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when schema rejects body (empty)", async () => {
    const res = await POST(makeReq({ method: "POST", body: { body: "" } }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when scope is invalid", async () => {
    const res = await POST(
      makeReq({ method: "POST", body: { ...VALID_BODY, scope: "bad-scope" } }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 500 when admin db is null", async () => {
    mockDb.mockReturnValueOnce(null as never);
    const res = await POST(makeReq({ method: "POST", body: VALID_BODY }));
    expect(res.status).toBe(500);
  });

  it("denormalises trimmed author from player doc on happy path", async () => {
    setupPlayerDb({ displayName: "  Alice  ", caste: "blue" });
    const res = await POST(
      makeReq({ method: "POST", body: { body: "Hi", scope: "caste:blue" } }),
    );
    expect(res.status).toBe(200);
    expect(mockCreate).toHaveBeenCalledWith({
      userId: "u1",
      displayName: "Alice",
      caste: "blue",
      body: "Hi",
      scope: "caste:blue",
    });
  });

  it("falls back to 'Unknown general' when no player doc exists", async () => {
    setupPlayerDb(null);
    await POST(makeReq({ method: "POST", body: VALID_BODY }));
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        displayName: "Unknown general",
        caste: null,
      }),
    );
  });

  it("returns 400 on CommunityMessageEmptyError", async () => {
    setupPlayerDb({ displayName: "x", caste: "white" });
    mockCreate.mockRejectedValueOnce(new CommunityMessageEmptyError());
    const res = await POST(makeReq({ method: "POST", body: VALID_BODY }));
    expect(res.status).toBe(400);
  });

  it("returns 400 on CommunityMessageTooLongError", async () => {
    setupPlayerDb({ displayName: "x", caste: "white" });
    mockCreate.mockRejectedValueOnce(new CommunityMessageTooLongError(500));
    const res = await POST(makeReq({ method: "POST", body: VALID_BODY }));
    expect(res.status).toBe(400);
  });

  it("returns 403 on CommunityMessageWrongCasteError", async () => {
    setupPlayerDb({ displayName: "x", caste: "white" });
    mockCreate.mockRejectedValueOnce(new CommunityMessageWrongCasteError("white", "blue"));
    const res = await POST(makeReq({ method: "POST", body: VALID_BODY }));
    expect(res.status).toBe(403);
  });

  it("returns 500 with message on unknown Error", async () => {
    setupPlayerDb({ displayName: "x", caste: "white" });
    mockCreate.mockRejectedValueOnce(new Error("boom"));
    const res = await POST(makeReq({ method: "POST", body: VALID_BODY }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.message).toBe("boom");
  });

  it("returns 500 'Server error' on non-Error throw", async () => {
    setupPlayerDb({ displayName: "x", caste: "white" });
    mockCreate.mockRejectedValueOnce("plain-string");
    const res = await POST(makeReq({ method: "POST", body: VALID_BODY }));
    const body = await res.json();
    expect(body.error.message).toBe("Server error");
  });
});
