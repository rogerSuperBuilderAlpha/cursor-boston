/**
 * @jest-environment node
 *
 * OpenSSF Silver coverage — game pacts route validation + rate limit.
 */
import { GET, POST } from "@/app/api/game/pacts/route";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  PactSelfTargetError,
  PactEmptyError,
  PactTooLongError,
  PactTargetNotFoundError,
  createPactServer,
  listPactsForPlayerServer,
} from "@/lib/game/pacts";
import { checkUpstashRateLimit } from "@/lib/upstash-rate-limit";
import { getVerifiedUser } from "@/lib/server-auth";
import { makeAuthedRequest, makeRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(),
}));

jest.mock("@/lib/upstash-rate-limit", () => ({
  checkUpstashRateLimit: jest.fn(),
}));

jest.mock("@/lib/game/pacts", () => {
  const actual = jest.requireActual<typeof import("@/lib/game/pacts")>("@/lib/game/pacts");
  return {
    ...actual,
    listPactsForPlayerServer: jest.fn(),
    createPactServer: jest.fn(),
  };
});

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockCheckRateLimit = checkUpstashRateLimit as jest.MockedFunction<
  typeof checkUpstashRateLimit
>;
const mockListPacts = listPactsForPlayerServer as jest.MockedFunction<
  typeof listPactsForPlayerServer
>;
const mockCreatePact = createPactServer as jest.MockedFunction<typeof createPactServer>;

describe("GET /api/game/pacts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(null);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await GET(makeRequest({ path: "/api/game/pacts" }));
    expect(res.status).toBe(401);
  });

  it("returns pacts for the caller", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    mockListPacts.mockResolvedValue([{ id: "pact-1" }] as never);

    const { status, body } = await readJson(
      await GET(makeAuthedRequest({ path: "/api/game/pacts" })),
    );

    expect(status).toBe(200);
    expect(body).toMatchObject({ success: true, pacts: [{ id: "pact-1" }] });
    expect(mockListPacts).toHaveBeenCalledWith("u1");
  });
});

describe("POST /api/game/pacts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(null);
    mockCheckRateLimit.mockResolvedValue({ success: true, remaining: 0, resetTime: 0 });
    mockGetAdminDb.mockReturnValue({
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({ displayName: "General A", caste: "red" }),
          }),
        })),
      })),
    } as never);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await POST(
      makeRequest({
        method: "POST",
        path: "/api/game/pacts",
        body: { targetId: "u2", statement: "No raids this week." },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 429 when daily pact limit is exceeded", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    mockCheckRateLimit.mockResolvedValue({
      success: false,
      remaining: 0,
      resetTime: Date.now() + 3600_000,
      retryAfter: 3600,
    });

    const res = await POST(
      makeAuthedRequest({
        method: "POST",
        path: "/api/game/pacts",
        body: { targetId: "u2", statement: "No raids this week." },
      }),
    );
    expect(res.status).toBe(429);
  });

  it("returns 400 for empty statement", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    const res = await POST(
      makeAuthedRequest({
        method: "POST",
        path: "/api/game/pacts",
        body: { targetId: "u2", statement: "" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when targeting yourself", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    mockCreatePact.mockRejectedValue(new PactSelfTargetError());

    const res = await POST(
      makeAuthedRequest({
        method: "POST",
        path: "/api/game/pacts",
        body: { targetId: "u1", statement: "Peace with myself." },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 200 when pact is created", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    mockCreatePact.mockResolvedValue({ id: "pact-new" } as never);

    const { status, body } = await readJson(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/game/pacts",
          body: { targetId: "u2", statement: "No raids this week." },
        }),
      ),
    );

    expect(status).toBe(200);
    expect(body).toMatchObject({ success: true, pact: { id: "pact-new" } });
  });

  it("returns 500 when admin db is null", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    mockGetAdminDb.mockReturnValueOnce(null as never);
    const res = await POST(
      makeAuthedRequest({
        method: "POST",
        path: "/api/game/pacts",
        body: { targetId: "u2", statement: "No raids this week." },
      }),
    );
    expect(res.status).toBe(500);
  });

  it("returns 400 PactEmptyError", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    mockCreatePact.mockRejectedValue(new PactEmptyError());
    const res = await POST(
      makeAuthedRequest({
        method: "POST",
        path: "/api/game/pacts",
        body: { targetId: "u2", statement: "Looks ok before sanitisation." },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 PactTooLongError", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    mockCreatePact.mockRejectedValue(new PactTooLongError(500));
    const res = await POST(
      makeAuthedRequest({
        method: "POST",
        path: "/api/game/pacts",
        body: { targetId: "u2", statement: "Looks fine." },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 PactTargetNotFoundError", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    mockCreatePact.mockRejectedValue(new PactTargetNotFoundError("ghost"));
    const res = await POST(
      makeAuthedRequest({
        method: "POST",
        path: "/api/game/pacts",
        body: { targetId: "ghost", statement: "Hello." },
      }),
    );
    expect(res.status).toBe(404);
  });

  it("returns 500 with Error message on unknown Error throw", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    mockCreatePact.mockRejectedValue(new Error("boom"));
    const res = await POST(
      makeAuthedRequest({
        method: "POST",
        path: "/api/game/pacts",
        body: { targetId: "u2", statement: "Statement." },
      }),
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.message).toBe("boom");
  });

  it("returns 500 'Server error' on non-Error throw", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    mockCreatePact.mockRejectedValue("plain-string");
    const res = await POST(
      makeAuthedRequest({
        method: "POST",
        path: "/api/game/pacts",
        body: { targetId: "u2", statement: "Statement." },
      }),
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.message).toBe("Server error");
  });

  it("forwards durationDays as durationMs to createPactServer", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    mockCreatePact.mockResolvedValue({ id: "pact-x" } as never);
    await POST(
      makeAuthedRequest({
        method: "POST",
        path: "/api/game/pacts",
        body: { targetId: "u2", statement: "Truce.", durationDays: 7 },
      }),
    );
    expect(mockCreatePact).toHaveBeenCalledWith(
      expect.objectContaining({ durationMs: 7 * 24 * 60 * 60 * 1000 }),
    );
  });

  it("uses 'Unknown general' fallback when no player doc exists", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    mockGetAdminDb.mockReturnValue({
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({ exists: false }),
        })),
      })),
    } as never);
    mockCreatePact.mockResolvedValue({ id: "pact-y" } as never);
    await POST(
      makeAuthedRequest({
        method: "POST",
        path: "/api/game/pacts",
        body: { targetId: "u2", statement: "Hello." },
      }),
    );
    expect(mockCreatePact).toHaveBeenCalledWith(
      expect.objectContaining({
        author: expect.objectContaining({
          displayName: "Unknown general",
          caste: null,
        }),
      }),
    );
  });
});

describe("GET /api/game/pacts — extras", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uses ?playerId= query param when provided", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    mockListPacts.mockResolvedValue([] as never);
    await GET(
      makeAuthedRequest({ path: "/api/game/pacts", searchParams: { playerId: "other-uid" } }),
    );
    expect(mockListPacts).toHaveBeenCalledWith("other-uid");
  });

  it("sets Cache-Control private max-age=30", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    mockListPacts.mockResolvedValue([] as never);
    const res = await GET(makeAuthedRequest({ path: "/api/game/pacts" }));
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=30, must-revalidate");
  });

  it("returns 500 with Error message when listPactsForPlayerServer throws", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    mockListPacts.mockRejectedValueOnce(new Error("firestore down"));
    const res = await GET(makeAuthedRequest({ path: "/api/game/pacts" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.message).toBe("firestore down");
  });

  it("returns 500 'Server error' on non-Error throw", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@test.com", name: "User" });
    mockListPacts.mockRejectedValueOnce("plain-string");
    const res = await GET(makeAuthedRequest({ path: "/api/game/pacts" }));
    const body = await res.json();
    expect(body.error.message).toBe("Server error");
  });
});
