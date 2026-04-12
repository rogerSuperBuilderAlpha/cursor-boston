/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { GET, PATCH } from "@/app/api/agents/me/route";
import {
  getVerifiedAgent,
  updateAgentProfile,
  toPublicProfile,
} from "@/lib/agents";

jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: jest.fn(() => ({ success: true })),
  getClientIdentifier: () => "test-client",
}));

jest.mock("@/lib/agents", () => ({
  getVerifiedAgent: jest.fn(),
  updateAgentProfile: jest.fn(),
  toPublicProfile: jest.fn((agent) => ({
    id: agent.id,
    name: agent.name,
    description: agent.description,
    status: agent.status,
    avatarUrl: agent.avatarUrl,
    createdAt: agent.createdAt,
    lastActiveAt: agent.lastActiveAt,
  })),
}));

jest.mock("@/lib/api-response", () => ({
  parseRequestBody: jest.fn(async (req: Request) => {
    try {
      return await req.json();
    } catch {
      const { NextResponse } = require("next/server");
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
  }),
}));

const mockGetVerifiedAgent = getVerifiedAgent as jest.MockedFunction<
  typeof getVerifiedAgent
>;
const mockUpdateAgentProfile = updateAgentProfile as jest.MockedFunction<
  typeof updateAgentProfile
>;
const mockToPublicProfile = toPublicProfile as jest.MockedFunction<
  typeof toPublicProfile
>;

const baseAgent = {
  id: "agent1",
  name: "TestBot",
  description: "A test agent",
  apiKeyHash: "hash",
  apiKeyPrefix: "cb_agent_",
  status: "claimed" as const,
  ownerId: "u1",
  ownerEmail: "test@example.com",
  ownerDisplayName: "Tester",
  claimedAt: { toDate: () => new Date() } as any,
  createdAt: { toDate: () => new Date() } as any,
  lastActiveAt: { toDate: () => new Date() } as any,
  avatarUrl: "https://example.com/avatar.png",
  visibility: { isPublic: true, showOwner: true },
};

function makeGetRequest() {
  return new NextRequest("http://localhost/api/agents/me");
}

function makePatchRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/agents/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ─── GET /api/agents/me ─────────────────────────────────────────────────────

describe("GET /api/agents/me", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when agent is not verified", async () => {
    mockGetVerifiedAgent.mockResolvedValue(null);
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.hint).toContain("Authorization");
  });

  it("returns 429 when rate limited", async () => {
    const { checkRateLimit } = require("@/lib/rate-limit");
    checkRateLimit.mockReturnValueOnce({ success: false, retryAfter: 45 });

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.retryAfterSeconds).toBe(45);
  });

  it("returns full profile for claimed agent", async () => {
    mockGetVerifiedAgent.mockResolvedValue(baseAgent as any);
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.agent.id).toBe("agent1");
    expect(body.agent.name).toBe("TestBot");
    expect(body.agent.owner.id).toBe("u1");
    expect(body.agent.owner.email).toBe("test@example.com");
    expect(body.agent.claimedAt).toBeDefined();
  });

  it("returns pending_claim fields when status is pending_claim", async () => {
    const pendingAgent = {
      ...baseAgent,
      status: "pending_claim" as const,
      claimExpiresAt: { toDate: () => new Date() } as any,
    };
    mockGetVerifiedAgent.mockResolvedValue(pendingAgent as any);
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.agent.claimExpiresAt).toBeDefined();
    expect(body.agent.owner).toBeUndefined();
  });

  it("returns 500 on unexpected error", async () => {
    mockGetVerifiedAgent.mockRejectedValue(new Error("boom"));
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to get profile");
  });
});

// ─── PATCH /api/agents/me ───────────────────────────────────────────────────

describe("PATCH /api/agents/me", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when agent is not verified", async () => {
    mockGetVerifiedAgent.mockResolvedValue(null);
    const res = await PATCH(makePatchRequest({ name: "New" }));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    const { checkRateLimit } = require("@/lib/rate-limit");
    checkRateLimit.mockReturnValueOnce({ success: false, retryAfter: 10 });

    const res = await PATCH(makePatchRequest({ name: "New" }));
    expect(res.status).toBe(429);
  });

  it("returns 400 when no valid fields provided", async () => {
    mockGetVerifiedAgent.mockResolvedValue(baseAgent as any);
    const res = await PATCH(makePatchRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("No valid fields");
  });

  it("validates name is a string", async () => {
    mockGetVerifiedAgent.mockResolvedValue(baseAgent as any);
    const res = await PATCH(makePatchRequest({ name: 123 as any }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Name must be a string");
  });

  it("validates name length between 2 and 50", async () => {
    mockGetVerifiedAgent.mockResolvedValue(baseAgent as any);
    const resShort = await PATCH(makePatchRequest({ name: "A" }));
    expect(resShort.status).toBe(400);

    mockGetVerifiedAgent.mockResolvedValue(baseAgent as any);
    const resLong = await PATCH(makePatchRequest({ name: "A".repeat(51) }));
    expect(resLong.status).toBe(400);
  });

  it("validates name characters", async () => {
    mockGetVerifiedAgent.mockResolvedValue(baseAgent as any);
    const res = await PATCH(makePatchRequest({ name: "Bad<Name>" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("letters, numbers");
  });

  it("validates description length", async () => {
    mockGetVerifiedAgent.mockResolvedValue(baseAgent as any);
    const res = await PATCH(
      makePatchRequest({ description: "x".repeat(501) })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("500 characters");
  });

  it("validates avatarUrl is a valid URL", async () => {
    mockGetVerifiedAgent.mockResolvedValue(baseAgent as any);
    const res = await PATCH(makePatchRequest({ avatarUrl: "not-a-url" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("valid URL");
  });

  it("validates visibility is an object", async () => {
    mockGetVerifiedAgent.mockResolvedValue(baseAgent as any);
    const res = await PATCH(makePatchRequest({ visibility: "bad" as any }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Visibility must be an object");
  });

  it("successfully updates name", async () => {
    mockGetVerifiedAgent.mockResolvedValue(baseAgent as any);
    mockUpdateAgentProfile.mockResolvedValue(undefined);

    const res = await PATCH(makePatchRequest({ name: "NewBot" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockUpdateAgentProfile).toHaveBeenCalledWith("agent1", {
      name: "NewBot",
    });
  });

  it("successfully updates description to null", async () => {
    mockGetVerifiedAgent.mockResolvedValue(baseAgent as any);
    mockUpdateAgentProfile.mockResolvedValue(undefined);

    const res = await PATCH(makePatchRequest({ description: null as any }));
    expect(res.status).toBe(200);
    expect(mockUpdateAgentProfile).toHaveBeenCalledWith("agent1", {
      description: null,
    });
  });

  it("successfully updates visibility", async () => {
    mockGetVerifiedAgent.mockResolvedValue(baseAgent as any);
    mockUpdateAgentProfile.mockResolvedValue(undefined);

    const res = await PATCH(
      makePatchRequest({ visibility: { isPublic: false } })
    );
    expect(res.status).toBe(200);
    expect(mockUpdateAgentProfile).toHaveBeenCalledWith("agent1", {
      visibility: { isPublic: false, showOwner: true },
    });
  });

  it("returns 500 on unexpected error", async () => {
    mockGetVerifiedAgent.mockResolvedValue(baseAgent as any);
    mockUpdateAgentProfile.mockRejectedValue(new Error("db error"));

    const res = await PATCH(makePatchRequest({ name: "NewBot" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to update profile");
  });
});
