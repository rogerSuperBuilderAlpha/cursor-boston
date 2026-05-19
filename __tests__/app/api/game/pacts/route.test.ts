/**
 * @jest-environment node
 *
 * OpenSSF Silver coverage — game pacts route validation + rate limit.
 */
import { GET, POST } from "@/app/api/game/pacts/route";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  PactSelfTargetError,
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
});
