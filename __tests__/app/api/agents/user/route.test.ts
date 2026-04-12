/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { GET } from "@/app/api/agents/user/route";
import { getVerifiedUser } from "@/lib/server-auth";
import { getAgentsByOwner } from "@/lib/agents";

jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: jest.fn(() => ({ success: true })),
  getClientIdentifier: () => "test-client",
}));

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/agents", () => ({
  getAgentsByOwner: jest.fn(),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<
  typeof getVerifiedUser
>;
const mockGetAgentsByOwner = getAgentsByOwner as jest.MockedFunction<
  typeof getAgentsByOwner
>;

function makeRequest() {
  return new NextRequest("http://localhost/api/agents/user");
}

describe("GET /api/agents/user", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when getVerifiedUser throws", async () => {
    mockGetVerifiedUser.mockRejectedValue(new Error("unauth"));
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe("Authentication required");
  });

  it("returns 401 when getVerifiedUser returns null", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it("returns 429 when rate limited", async () => {
    const { checkRateLimit } = require("@/lib/rate-limit");
    checkRateLimit.mockReturnValueOnce({ success: false, retryAfter: 30 });

    const res = await GET(makeRequest());
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("Too many requests");
    expect(body.retryAfterSeconds).toBe(30);
    expect(res.headers.get("Retry-After")).toBe("30");
  });

  it("returns agents owned by authenticated user", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", name: "Test" });
    mockGetAgentsByOwner.mockResolvedValue([
      {
        id: "agent1",
        name: "Bot One",
        description: "A test bot",
        avatarUrl: "https://example.com/avatar.png",
        status: "claimed",
        claimedAt: { toDate: () => new Date() } as any,
        lastActiveAt: { toDate: () => new Date() } as any,
        visibility: { isPublic: true, showOwner: true },
        apiKeyHash: "hash",
        apiKeyPrefix: "cb_agent_",
        createdAt: { toDate: () => new Date() } as any,
        ownerId: "u1",
      },
    ]);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.agents).toHaveLength(1);
    expect(body.agents[0].id).toBe("agent1");
    expect(body.agents[0].name).toBe("Bot One");
    expect(body.agents[0].description).toBe("A test bot");
    // Ensure sensitive fields are not leaked
    expect(body.agents[0].apiKeyHash).toBeUndefined();
    expect(body.agents[0].ownerId).toBeUndefined();
  });

  it("returns empty array when user has no agents", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u2", name: "Test2" });
    mockGetAgentsByOwner.mockResolvedValue([]);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.agents).toEqual([]);
  });

  it("returns 500 when getAgentsByOwner throws", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", name: "Test" });
    mockGetAgentsByOwner.mockRejectedValue(new Error("db error"));

    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe("Failed to fetch agents");
  });
});
