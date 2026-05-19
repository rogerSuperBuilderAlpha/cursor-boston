/**
 * @jest-environment node
 *
 * OpenSSF Silver coverage — agent claim route GET/POST guards.
 */
import { GET, POST } from "@/app/api/agents/claim/[token]/route";
import { getAgentByClaimToken, claimAgent } from "@/lib/agents";
import { getVerifiedUser } from "@/lib/server-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { makeAuthedRequest, makeRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/rate-limit", () => ({
  getClientIdentifier: jest.fn(() => "test-client"),
}));

jest.mock("@/lib/upstash-rate-limit", () => ({
  checkUpstashRateLimit: jest.fn(async () => ({
    success: true,
    remaining: 9,
    resetTime: Date.now() + 60_000,
  })),
}));

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(),
}));

jest.mock("@/lib/agents", () => ({
  getAgentByClaimToken: jest.fn(),
  claimAgent: jest.fn(),
}));

jest.mock("@/lib/logger", () => ({
  logApiError: jest.fn(),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockGetAgentByClaimToken = getAgentByClaimToken as jest.MockedFunction<
  typeof getAgentByClaimToken
>;
const mockClaimAgent = claimAgent as jest.MockedFunction<typeof claimAgent>;
const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;

const CLAIM_TOKEN = "valid-claim-token";
const BASE_PATH = `/api/agents/claim/${CLAIM_TOKEN}`;

const pendingAgent = {
  id: "agent-1",
  name: "HelperBot",
  description: "A helpful agent",
  status: "pending_claim",
  createdAt: "2026-01-01T00:00:00.000Z",
  claimExpiresAt: "2026-01-08T00:00:00.000Z",
};

const testUser = {
  uid: "u1",
  email: "user@test.com",
  name: "Test User",
  isAdmin: false,
};

const publicProfile = {
  displayName: "Test User",
  visibility: { isPublic: true },
};

function routeContext(token = CLAIM_TOKEN) {
  return { params: Promise.resolve({ token }) };
}

function mockUserDb(profile: Record<string, unknown> | null) {
  mockGetAdminDb.mockReturnValue({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn().mockResolvedValue({
          exists: profile != null,
          data: () => profile ?? undefined,
        }),
      })),
    })),
  } as never);
}

describe("GET /api/agents/claim/[token]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(null);
  });

  it("returns 400 when claim token is missing", async () => {
    const { status, body } = await readJson(
      await GET(makeRequest({ path: "/api/agents/claim/" }), {
        params: Promise.resolve({ token: "" }),
      }),
    );

    expect(status).toBe(400);
    expect(body.success).toBe(false);
  });

  it("returns 404 when claim token is invalid", async () => {
    mockGetAgentByClaimToken.mockResolvedValue(null);

    const { status, body } = await readJson(
      await GET(makeRequest({ path: BASE_PATH }), routeContext()),
    );

    expect(status).toBe(404);
    expect(body.error).toMatch(/invalid or expired/i);
  });

  it("returns agent info for a valid claim token", async () => {
    mockGetAgentByClaimToken.mockResolvedValue(pendingAgent as never);

    const { status, body } = await readJson(
      await GET(makeRequest({ path: BASE_PATH }), routeContext()),
    );

    expect(status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      agent: { id: "agent-1", name: "HelperBot" },
      canClaim: null,
    });
  });
});

describe("POST /api/agents/claim/[token]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(null);
    mockGetAgentByClaimToken.mockResolvedValue(pendingAgent as never);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await POST(makeRequest({ method: "POST", path: BASE_PATH }), routeContext());
    expect(res.status).toBe(401);
  });

  it("returns 400 when profile is not public", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockUserDb({ displayName: "Test User", visibility: { isPublic: false } });

    const { status, body } = await readJson(
      await POST(makeAuthedRequest({ method: "POST", path: BASE_PATH }), routeContext()),
    );

    expect(status).toBe(400);
    expect(body.code).toBe("PROFILE_NOT_PUBLIC");
  });

  it("returns 200 when claim succeeds", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockUserDb(publicProfile);
    mockClaimAgent.mockResolvedValue({
      ...pendingAgent,
      status: "claimed",
      claimedAt: "2026-05-19T12:00:00.000Z",
    } as never);

    const { status, body } = await readJson(
      await POST(makeAuthedRequest({ method: "POST", path: BASE_PATH }), routeContext()),
    );

    expect(status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      message: expect.stringMatching(/claimed successfully/i),
      agent: { id: "agent-1", status: "claimed" },
    });
    expect(mockClaimAgent).toHaveBeenCalledWith(
      CLAIM_TOKEN,
      testUser.uid,
      testUser.email,
      testUser.name,
    );
  });
});
