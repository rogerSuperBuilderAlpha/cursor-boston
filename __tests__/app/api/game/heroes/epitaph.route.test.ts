/**
 * @jest-environment node
 *
 * OpenSSF Gold coverage push #58 — game/heroes/[heroId]/epitaph route.
 */
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/game/heroes/[heroId]/epitaph/route";
import { getVerifiedUser } from "@/lib/server-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  HeroLoreEmptyError,
  HeroLoreForbiddenError,
  HeroLoreTooLongError,
  HeroNotFoundError,
  createHeroEpitaphServer,
  listHeroEpitaphsServer,
} from "@/lib/game/hero-lore";
import { checkUpstashRateLimit } from "@/lib/upstash-rate-limit";

jest.mock("@/lib/server-auth", () => ({ getVerifiedUser: jest.fn() }));
jest.mock("@/lib/firebase-admin", () => ({ getAdminDb: jest.fn() }));
jest.mock("@/lib/game/hero-lore", () => {
  const actual = jest.requireActual("@/lib/game/hero-lore");
  return {
    ...actual,
    createHeroEpitaphServer: jest.fn(),
    listHeroEpitaphsServer: jest.fn(),
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
const mockList = listHeroEpitaphsServer as jest.MockedFunction<typeof listHeroEpitaphsServer>;
const mockCreate = createHeroEpitaphServer as jest.MockedFunction<typeof createHeroEpitaphServer>;
const mockRate = checkUpstashRateLimit as jest.MockedFunction<typeof checkUpstashRateLimit>;

function makeReq(opts: { method?: "GET" | "POST"; body?: unknown } = {}) {
  return new NextRequest("https://example.com/api/game/heroes/h1/epitaph", {
    method: opts.method ?? "GET",
    headers: { "content-type": "application/json" },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

function withParams(heroId: string) {
  return { params: Promise.resolve({ heroId }) };
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
  mockCreate.mockResolvedValue({ id: "ep1" } as never);
});

describe("GET /api/game/heroes/[heroId]/epitaph", () => {
  it("returns 401 unauthenticated", async () => {
    mockUser.mockResolvedValueOnce(null);
    const res = await GET(makeReq(), withParams("h1"));
    expect(res.status).toBe(401);
  });

  it("returns 400 when heroId is empty", async () => {
    const res = await GET(makeReq(), withParams(""));
    expect(res.status).toBe(400);
  });

  it("returns the epitaphs with Cache-Control header on happy path", async () => {
    mockList.mockResolvedValueOnce([{ id: "e1" }] as never);
    const res = await GET(makeReq(), withParams("h1"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=30, must-revalidate");
    const body = await res.json();
    expect(body.epitaphs).toEqual([{ id: "e1" }]);
  });

  it("returns 500 with error message on Error throw", async () => {
    mockList.mockRejectedValueOnce(new Error("firestore down"));
    const res = await GET(makeReq(), withParams("h1"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.message).toBe("firestore down");
  });

  it("returns 500 'Server error' on non-Error throw", async () => {
    mockList.mockRejectedValueOnce("plain-string");
    const res = await GET(makeReq(), withParams("h1"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.message).toBe("Server error");
  });
});

describe("POST /api/game/heroes/[heroId]/epitaph", () => {
  const VALID_BODY = { body: "A tribute to a great hero, gone but not forgotten." };

  it("returns 401 unauthenticated", async () => {
    mockUser.mockResolvedValueOnce(null);
    const res = await POST(makeReq({ method: "POST", body: VALID_BODY }), withParams("h1"));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limit (5/day) is hit", async () => {
    mockRate.mockResolvedValueOnce({
      success: false,
      retryAfter: 5400,
    } as never);
    const res = await POST(makeReq({ method: "POST", body: VALID_BODY }), withParams("h1"));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error.message).toContain("5/day");
    expect(body.error.message).toContain("5400");
  });

  it("returns 400 when heroId is empty", async () => {
    const res = await POST(makeReq({ method: "POST", body: VALID_BODY }), withParams(""));
    expect(res.status).toBe(400);
  });

  it("returns 400 when body is not valid JSON", async () => {
    const req = new NextRequest("https://example.com/api/game/heroes/h1/epitaph", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    });
    const res = await POST(req, withParams("h1"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when schema rejects body (empty)", async () => {
    const res = await POST(
      makeReq({ method: "POST", body: { body: "" } }),
      withParams("h1"),
    );
    expect(res.status).toBe(400);
  });

  it("returns 500 when admin db is null", async () => {
    mockDb.mockReturnValueOnce(null as never);
    const res = await POST(makeReq({ method: "POST", body: VALID_BODY }), withParams("h1"));
    expect(res.status).toBe(500);
  });

  it("forwards trimmed author info from player doc on happy path", async () => {
    setupPlayerDb({ displayName: "  Captain Gamma  ", caste: "black" });
    const res = await POST(makeReq({ method: "POST", body: VALID_BODY }), withParams("h1"));
    expect(res.status).toBe(200);
    expect(mockCreate).toHaveBeenCalledWith({
      heroId: "h1",
      authorId: "u1",
      authorDisplayName: "Captain Gamma",
      authorCaste: "black",
      rawBody: VALID_BODY.body,
    });
  });

  it("falls back to 'Unknown general' when no player doc exists", async () => {
    setupPlayerDb(null);
    await POST(makeReq({ method: "POST", body: VALID_BODY }), withParams("h1"));
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        authorDisplayName: "Unknown general",
        authorCaste: null,
      }),
    );
  });

  it("returns 404 on HeroNotFoundError", async () => {
    setupPlayerDb({ displayName: "Test" });
    mockCreate.mockRejectedValueOnce(new HeroNotFoundError("h1"));
    const res = await POST(makeReq({ method: "POST", body: VALID_BODY }), withParams("h1"));
    expect(res.status).toBe(404);
  });

  it("returns 400 on HeroLoreEmptyError", async () => {
    setupPlayerDb({ displayName: "Test" });
    mockCreate.mockRejectedValueOnce(new HeroLoreEmptyError());
    const res = await POST(makeReq({ method: "POST", body: VALID_BODY }), withParams("h1"));
    expect(res.status).toBe(400);
  });

  it("returns 400 on HeroLoreTooLongError", async () => {
    setupPlayerDb({ displayName: "Test" });
    mockCreate.mockRejectedValueOnce(new HeroLoreTooLongError(500));
    const res = await POST(makeReq({ method: "POST", body: VALID_BODY }), withParams("h1"));
    expect(res.status).toBe(400);
  });

  it("returns 400 on HeroLoreForbiddenError (different from chapter route)", async () => {
    setupPlayerDb({ displayName: "Test" });
    mockCreate.mockRejectedValueOnce(new HeroLoreForbiddenError("alive hero"));
    const res = await POST(makeReq({ method: "POST", body: VALID_BODY }), withParams("h1"));
    expect(res.status).toBe(400);
  });

  it("returns 500 with message on unknown Error", async () => {
    setupPlayerDb({ displayName: "Test" });
    mockCreate.mockRejectedValueOnce(new Error("write conflict"));
    const res = await POST(makeReq({ method: "POST", body: VALID_BODY }), withParams("h1"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.message).toBe("write conflict");
  });

  it("returns 500 'Server error' on non-Error throw", async () => {
    setupPlayerDb({ displayName: "Test" });
    mockCreate.mockRejectedValueOnce("plain-string");
    const res = await POST(makeReq({ method: "POST", body: VALID_BODY }), withParams("h1"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.message).toBe("Server error");
  });
});
