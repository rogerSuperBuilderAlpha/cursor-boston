/**
 * @jest-environment node
 *
 * OpenSSF Gold coverage push #1 — full GET + POST coverage for the
 * prophecies index route. Covers happy paths, validation paths, the
 * server-configured / rate-limit / player-not-found branches, and every
 * typed error class that POST translates to a status code.
 */
import { GET, POST } from "@/app/api/game/prophecies/route";
import {
  listPropheciesForSealServer,
  listPropheciesByAuthorServer,
  createProphecyServer,
  ProphecyEmptyError,
  ProphecyTooLongError,
  ProphecyInvalidSealError,
  ProphecySealAlreadyBrokenError,
  MAX_PROPHECY_LENGTH,
} from "@/lib/game/prophecies";
import { getVerifiedUser } from "@/lib/server-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { checkUpstashRateLimit } from "@/lib/upstash-rate-limit";
import {
  makeAuthedRequest,
  makeRequest,
  readJson,
} from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({ getVerifiedUser: jest.fn() }));
jest.mock("@/lib/firebase-admin", () => ({ getAdminDb: jest.fn() }));
jest.mock("@/lib/upstash-rate-limit", () => ({
  checkUpstashRateLimit: jest.fn(),
}));
jest.mock("@/lib/game/prophecies", () => {
  const actual = jest.requireActual("@/lib/game/prophecies");
  return {
    ...actual,
    listPropheciesForSealServer: jest.fn(),
    listPropheciesByAuthorServer: jest.fn(),
    createProphecyServer: jest.fn(),
  };
});

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockRateLimit = checkUpstashRateLimit as jest.MockedFunction<typeof checkUpstashRateLimit>;
const mockListForSeal = listPropheciesForSealServer as jest.MockedFunction<typeof listPropheciesForSealServer>;
const mockListByAuthor = listPropheciesByAuthorServer as jest.MockedFunction<typeof listPropheciesByAuthorServer>;
const mockCreate = createProphecyServer as jest.MockedFunction<typeof createProphecyServer>;

const USER = { uid: "u1", email: "u@test.com", name: "U", isAdmin: false } as never;

function fakeDb(playerDoc: { exists: boolean; data?: () => unknown }) {
  return {
    collection: jest.fn().mockReturnValue({
      doc: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue(playerDoc),
      }),
    }),
  } as never;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockListForSeal.mockResolvedValue([]);
  mockListByAuthor.mockResolvedValue([]);
  mockCreate.mockResolvedValue({ id: "p-1" } as never);
  mockRateLimit.mockResolvedValue({ success: true } as never);
  mockGetAdminDb.mockReturnValue(fakeDb({ exists: false }));
});

describe("GET /api/game/prophecies", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await GET(
      makeRequest({ method: "GET", path: "/api/game/prophecies", searchParams: { seal: "1" } }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 200 + cache header for valid seal=N", async () => {
    mockGetVerifiedUser.mockResolvedValue(USER);
    mockListForSeal.mockResolvedValue([{ id: "p-1" }] as never);
    const res = await GET(
      makeAuthedRequest({ method: "GET", path: "/api/game/prophecies", searchParams: { seal: "3" } }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toContain("private");
    expect(mockListForSeal).toHaveBeenCalledWith(3);
  });

  it.each([
    ["non-integer", "1.5"],
    ["below range", "0"],
    ["above range", "8"],
    ["NaN", "abc"],
  ])("returns 400 for %s seal value (%s)", async (_label, sealValue) => {
    mockGetVerifiedUser.mockResolvedValue(USER);
    const res = await GET(
      makeAuthedRequest({
        method: "GET",
        path: "/api/game/prophecies",
        searchParams: { seal: sealValue },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 200 for authorId list path", async () => {
    mockGetVerifiedUser.mockResolvedValue(USER);
    mockListByAuthor.mockResolvedValue([{ id: "p-2" }] as never);
    const res = await GET(
      makeAuthedRequest({
        method: "GET",
        path: "/api/game/prophecies",
        searchParams: { authorId: "u2" },
      }),
    );
    expect(res.status).toBe(200);
    expect(mockListByAuthor).toHaveBeenCalledWith("u2");
  });

  it("returns 400 when neither seal nor authorId provided", async () => {
    mockGetVerifiedUser.mockResolvedValue(USER);
    const res = await GET(
      makeAuthedRequest({ method: "GET", path: "/api/game/prophecies" }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 500 when the data layer throws an Error", async () => {
    mockGetVerifiedUser.mockResolvedValue(USER);
    mockListForSeal.mockRejectedValue(new Error("firestore down"));
    const { status, body } = await readJson(
      await GET(
        makeAuthedRequest({
          method: "GET",
          path: "/api/game/prophecies",
          searchParams: { seal: "1" },
        }),
      ),
    );
    expect(status).toBe(500);
    expect(body.error.message).toBe("firestore down");
  });

  it("returns 500 with generic 'Server error' for non-Error throw", async () => {
    mockGetVerifiedUser.mockResolvedValue(USER);
    mockListForSeal.mockImplementation(() => {
      throw "boom";
    });
    const { status, body } = await readJson(
      await GET(
        makeAuthedRequest({
          method: "GET",
          path: "/api/game/prophecies",
          searchParams: { seal: "1" },
        }),
      ),
    );
    expect(status).toBe(500);
    expect(body.error.message).toBe("Server error");
  });
});

describe("POST /api/game/prophecies", () => {
  const VALID_BODY = { targetSealNumber: 1, prediction: "The sky is falling" };

  it("returns 401 when unauthenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await POST(
      makeRequest({ method: "POST", path: "/api/game/prophecies", body: VALID_BODY }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 429 when daily rate-limit exceeded (with retryAfter)", async () => {
    mockGetVerifiedUser.mockResolvedValue(USER);
    mockRateLimit.mockResolvedValue({ success: false, retryAfter: 1234 } as never);
    const { status, body } = await readJson(
      await POST(
        makeAuthedRequest({ method: "POST", path: "/api/game/prophecies", body: VALID_BODY }),
      ),
    );
    expect(status).toBe(429);
    expect(body.error.message).toContain("1234");
  });

  it("returns 429 with 3600 fallback when retryAfter missing", async () => {
    mockGetVerifiedUser.mockResolvedValue(USER);
    mockRateLimit.mockResolvedValue({ success: false } as never);
    const { body } = await readJson(
      await POST(
        makeAuthedRequest({ method: "POST", path: "/api/game/prophecies", body: VALID_BODY }),
      ),
    );
    expect(body.error.message).toContain("3600");
  });

  it("returns 400 for invalid JSON body", async () => {
    mockGetVerifiedUser.mockResolvedValue(USER);
    const res = await POST(
      makeRequest({
        method: "POST",
        path: "/api/game/prophecies",
        body: "not-json",
        headers: { "content-type": "text/plain" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 on zod validation failure (too-long prediction)", async () => {
    mockGetVerifiedUser.mockResolvedValue(USER);
    const res = await POST(
      makeAuthedRequest({
        method: "POST",
        path: "/api/game/prophecies",
        body: { targetSealNumber: 1, prediction: "x".repeat(MAX_PROPHECY_LENGTH + 1) },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 on zod validation failure (out-of-range seal)", async () => {
    mockGetVerifiedUser.mockResolvedValue(USER);
    const res = await POST(
      makeAuthedRequest({
        method: "POST",
        path: "/api/game/prophecies",
        body: { targetSealNumber: 99, prediction: "fine" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 500 when admin db is not configured", async () => {
    mockGetVerifiedUser.mockResolvedValue(USER);
    mockGetAdminDb.mockReturnValue(null as never);
    const { status, body } = await readJson(
      await POST(
        makeAuthedRequest({ method: "POST", path: "/api/game/prophecies", body: VALID_BODY }),
      ),
    );
    expect(status).toBe(500);
    expect(body.error.message).toContain("Server not configured");
  });

  it("creates prophecy with 'Unknown general' fallback when player record missing", async () => {
    mockGetVerifiedUser.mockResolvedValue(USER);
    mockGetAdminDb.mockReturnValue(fakeDb({ exists: false }));
    const res = await POST(
      makeAuthedRequest({ method: "POST", path: "/api/game/prophecies", body: VALID_BODY }),
    );
    expect(res.status).toBe(200);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        author: expect.objectContaining({ displayName: "Unknown general", caste: null }),
      }),
    );
  });

  it("uses player.displayName and player.caste when player record exists", async () => {
    mockGetVerifiedUser.mockResolvedValue(USER);
    mockGetAdminDb.mockReturnValue(
      fakeDb({
        exists: true,
        data: () => ({ displayName: "  Lord Tomato  ", caste: "warrior" }),
      }),
    );
    const res = await POST(
      makeAuthedRequest({ method: "POST", path: "/api/game/prophecies", body: VALID_BODY }),
    );
    expect(res.status).toBe(200);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        author: expect.objectContaining({ displayName: "Lord Tomato", caste: "warrior" }),
      }),
    );
  });

  it.each([
    [ProphecyEmptyError, 400],
    [ProphecyTooLongError, 400],
    [ProphecyInvalidSealError, 400],
    [ProphecySealAlreadyBrokenError, 409],
  ])("translates %p to status %i", async (ErrCls, expectedStatus) => {
    mockGetVerifiedUser.mockResolvedValue(USER);
    // These error classes carry their own canonical messages; instantiate
    // with the default constructor signature.
    mockCreate.mockRejectedValue(new (ErrCls as new () => Error)());
    const { status, body } = await readJson(
      await POST(
        makeAuthedRequest({ method: "POST", path: "/api/game/prophecies", body: VALID_BODY }),
      ),
    );
    expect(status).toBe(expectedStatus);
    expect(typeof body.error.message).toBe("string");
  });

  it("returns 500 for an untyped Error", async () => {
    mockGetVerifiedUser.mockResolvedValue(USER);
    mockCreate.mockRejectedValue(new Error("kaboom"));
    const { status, body } = await readJson(
      await POST(
        makeAuthedRequest({ method: "POST", path: "/api/game/prophecies", body: VALID_BODY }),
      ),
    );
    expect(status).toBe(500);
    expect(body.error.message).toBe("kaboom");
  });

  it("returns 500 'Server error' for non-Error throws", async () => {
    mockGetVerifiedUser.mockResolvedValue(USER);
    mockCreate.mockImplementation(() => {
      throw "string-thrown";
    });
    const { status, body } = await readJson(
      await POST(
        makeAuthedRequest({ method: "POST", path: "/api/game/prophecies", body: VALID_BODY }),
      ),
    );
    expect(status).toBe(500);
    expect(body.error.message).toBe("Server error");
  });
});
