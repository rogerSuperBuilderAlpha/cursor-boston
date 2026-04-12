/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import {
  generateApiKey,
  generateClaimToken,
  hashApiKey,
  getClaimExpiry,
  extractApiKey,
  getVerifiedAgent,
  getAgentByClaimToken,
  createAgent,
  claimAgent,
  updateAgentProfile,
  toPublicProfile,
  getAgentsByOwner,
  Agent,
} from "@/lib/agents";
import { getAdminDb } from "@/lib/firebase-admin";
import { Timestamp, FieldValue } from "firebase-admin/firestore";

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(),
}));

jest.mock("firebase-admin/firestore", () => ({
  Timestamp: {
    now: jest.fn(() => ({ toDate: () => new Date(), seconds: 1000, nanoseconds: 0 })),
    fromDate: jest.fn((d: Date) => ({ toDate: () => d, seconds: Math.floor(d.getTime() / 1000), nanoseconds: 0 })),
  },
  FieldValue: {
    delete: jest.fn(() => "__DELETE__"),
    serverTimestamp: jest.fn(() => "__SERVER_TIMESTAMP__"),
  },
}));

const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(authHeader?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (authHeader) headers["authorization"] = authHeader;
  return new NextRequest("http://localhost/api/test", { headers });
}

function makeMockDb(overrides: Record<string, unknown> = {}) {
  const defaultDb = {
    collection: jest.fn(() => ({
      add: jest.fn(async () => ({ id: "new-doc-id" })),
      doc: jest.fn(() => ({
        update: jest.fn(async () => {}),
        get: jest.fn(async () => ({ exists: true, data: () => ({}) })),
      })),
      where: jest.fn(() => ({
        get: jest.fn(async () => ({ empty: true, docs: [] })),
        where: jest.fn(() => ({
          get: jest.fn(async () => ({ empty: true, docs: [] })),
          orderBy: jest.fn(() => ({
            get: jest.fn(async () => ({ empty: true, docs: [] })),
          })),
        })),
        orderBy: jest.fn(() => ({
          get: jest.fn(async () => ({ empty: true, docs: [] })),
        })),
      })),
    })),
    ...overrides,
  };
  return defaultDb;
}

// ---------------------------------------------------------------------------
// Key Generation & Hashing
// ---------------------------------------------------------------------------

describe("generateApiKey", () => {
  it("returns an object with apiKey, apiKeyHash, and apiKeyPrefix", () => {
    const result = generateApiKey();
    expect(result).toHaveProperty("apiKey");
    expect(result).toHaveProperty("apiKeyHash");
    expect(result).toHaveProperty("apiKeyPrefix");
  });

  it("apiKey starts with the cb_agent_ prefix", () => {
    const { apiKey } = generateApiKey();
    expect(apiKey).toMatch(/^cb_agent_[a-f0-9]{32}$/);
  });

  it("apiKeyPrefix is always cb_agent_", () => {
    const { apiKeyPrefix } = generateApiKey();
    expect(apiKeyPrefix).toBe("cb_agent_");
  });

  it("apiKeyHash is a valid SHA-256 hex digest", () => {
    const { apiKeyHash } = generateApiKey();
    expect(apiKeyHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("generates unique keys on each call", () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.apiKey).not.toBe(b.apiKey);
    expect(a.apiKeyHash).not.toBe(b.apiKeyHash);
  });
});

describe("generateClaimToken", () => {
  it("returns a 32-character hex string", () => {
    const token = generateClaimToken();
    expect(token).toMatch(/^[a-f0-9]{32}$/);
  });

  it("generates unique tokens", () => {
    const a = generateClaimToken();
    const b = generateClaimToken();
    expect(a).not.toBe(b);
  });
});

describe("hashApiKey", () => {
  it("produces a consistent 64-char hex hash for the same input", () => {
    const hash1 = hashApiKey("cb_agent_test123");
    const hash2 = hashApiKey("cb_agent_test123");
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  it("produces different hashes for different inputs", () => {
    const h1 = hashApiKey("key_a");
    const h2 = hashApiKey("key_b");
    expect(h1).not.toBe(h2);
  });
});

describe("getClaimExpiry", () => {
  it("returns a Timestamp roughly 7 days in the future", () => {
    const result = getClaimExpiry();
    const expiryDate = result.toDate();
    const now = new Date();
    const diffDays = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThan(6.9);
    expect(diffDays).toBeLessThan(7.1);
  });
});

// ---------------------------------------------------------------------------
// extractApiKey
// ---------------------------------------------------------------------------

describe("extractApiKey", () => {
  it("extracts key from Bearer header", () => {
    const req = makeRequest("Bearer cb_agent_abc123");
    expect(extractApiKey(req)).toBe("cb_agent_abc123");
  });

  it("extracts key when sent directly (no Bearer)", () => {
    const req = makeRequest("cb_agent_abc123");
    expect(extractApiKey(req)).toBe("cb_agent_abc123");
  });

  it("returns null for missing authorization header", () => {
    const req = makeRequest();
    expect(extractApiKey(req)).toBeNull();
  });

  it("returns null for Bearer token without cb_agent_ prefix", () => {
    const req = makeRequest("Bearer some-other-token");
    expect(extractApiKey(req)).toBeNull();
  });

  it("returns null for non-matching header value", () => {
    const req = makeRequest("Basic dXNlcjpwYXNz");
    expect(extractApiKey(req)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getVerifiedAgent
// ---------------------------------------------------------------------------

describe("getVerifiedAgent", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns null when no API key in request", async () => {
    const req = makeRequest();
    const result = await getVerifiedAgent(req);
    expect(result).toBeNull();
  });

  it("throws when Firebase Admin is not configured", async () => {
    mockGetAdminDb.mockReturnValue(null as never);
    const req = makeRequest("Bearer cb_agent_abc123def456abc123def456");
    await expect(getVerifiedAgent(req)).rejects.toThrow("Firebase Admin is not configured");
  });

  it("returns null when no matching agent found", async () => {
    const mockWhere = jest.fn(() => ({
      get: jest.fn(async () => ({ empty: true, docs: [] })),
    }));
    mockGetAdminDb.mockReturnValue({
      collection: jest.fn(() => ({ where: mockWhere })),
    } as never);

    const req = makeRequest("Bearer cb_agent_abc123def456abc123def456");
    const result = await getVerifiedAgent(req);
    expect(result).toBeNull();
  });

  it("returns null for suspended agents", async () => {
    const agentData = { status: "suspended", name: "TestBot" };
    const mockUpdate = jest.fn(async () => {});
    const mockWhere = jest.fn(() => ({
      get: jest.fn(async () => ({
        empty: false,
        docs: [{ id: "agent-1", data: () => agentData, ref: { update: mockUpdate } }],
      })),
    }));
    mockGetAdminDb.mockReturnValue({
      collection: jest.fn(() => ({ where: mockWhere })),
    } as never);

    const req = makeRequest("Bearer cb_agent_abc123def456abc123def456");
    const result = await getVerifiedAgent(req);
    expect(result).toBeNull();
  });

  it("returns agent and updates lastActiveAt for valid key", async () => {
    const agentData = { status: "claimed", name: "TestBot", apiKeyHash: "abc" };
    const mockUpdate = jest.fn(async () => {});
    const mockWhere = jest.fn(() => ({
      get: jest.fn(async () => ({
        empty: false,
        docs: [{ id: "agent-1", data: () => agentData, ref: { update: mockUpdate } }],
      })),
    }));
    mockGetAdminDb.mockReturnValue({
      collection: jest.fn(() => ({ where: mockWhere })),
    } as never);

    const req = makeRequest("Bearer cb_agent_abc123def456abc123def456");
    const result = await getVerifiedAgent(req);
    expect(result).not.toBeNull();
    expect(result?.id).toBe("agent-1");
    expect(result?.name).toBe("TestBot");
    expect(mockUpdate).toHaveBeenCalledWith({ lastActiveAt: expect.anything() });
  });
});

// ---------------------------------------------------------------------------
// getAgentByClaimToken
// ---------------------------------------------------------------------------

describe("getAgentByClaimToken", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns null for empty/invalid token formats", async () => {
    expect(await getAgentByClaimToken("")).toBeNull();
    expect(await getAgentByClaimToken("short")).toBeNull();
    expect(await getAgentByClaimToken("ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ")).toBeNull(); // not hex
  });

  it("throws when Firebase Admin is not configured", async () => {
    mockGetAdminDb.mockReturnValue(null as never);
    const token = "abcdef0123456789abcdef0123456789";
    await expect(getAgentByClaimToken(token)).rejects.toThrow("Firebase Admin is not configured");
  });

  it("returns null when no matching pending agent found", async () => {
    const mockWhere = jest.fn(() => ({
      where: jest.fn(() => ({
        get: jest.fn(async () => ({ empty: true, docs: [] })),
      })),
    }));
    mockGetAdminDb.mockReturnValue({
      collection: jest.fn(() => ({ where: mockWhere })),
    } as never);

    const token = "abcdef0123456789abcdef0123456789";
    const result = await getAgentByClaimToken(token);
    expect(result).toBeNull();
  });

  it("returns null when claim has expired", async () => {
    const pastDate = new Date(Date.now() - 1000 * 60 * 60 * 24); // 1 day ago
    const agentData = {
      name: "TestBot",
      status: "pending_claim",
      claimExpiresAt: { toDate: () => pastDate },
    };
    const mockWhere = jest.fn(() => ({
      where: jest.fn(() => ({
        get: jest.fn(async () => ({
          empty: false,
          docs: [{ id: "agent-1", data: () => agentData }],
        })),
      })),
    }));
    mockGetAdminDb.mockReturnValue({
      collection: jest.fn(() => ({ where: mockWhere })),
    } as never);

    const token = "abcdef0123456789abcdef0123456789";
    const result = await getAgentByClaimToken(token);
    expect(result).toBeNull();
  });

  it("returns agent when claim token is valid and not expired", async () => {
    const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
    const agentData = {
      name: "TestBot",
      status: "pending_claim",
      claimExpiresAt: { toDate: () => futureDate },
    };
    const mockWhere = jest.fn(() => ({
      where: jest.fn(() => ({
        get: jest.fn(async () => ({
          empty: false,
          docs: [{ id: "agent-1", data: () => agentData }],
        })),
      })),
    }));
    mockGetAdminDb.mockReturnValue({
      collection: jest.fn(() => ({ where: mockWhere })),
    } as never);

    const token = "abcdef0123456789abcdef0123456789";
    const result = await getAgentByClaimToken(token);
    expect(result).not.toBeNull();
    expect(result?.id).toBe("agent-1");
  });
});

// ---------------------------------------------------------------------------
// createAgent
// ---------------------------------------------------------------------------

describe("createAgent", () => {
  beforeEach(() => jest.clearAllMocks());

  it("throws when Firebase Admin is not configured", async () => {
    mockGetAdminDb.mockReturnValue(null as never);
    await expect(createAgent("TestBot")).rejects.toThrow("Firebase Admin is not configured");
  });

  it("creates an agent and returns apiKey + claimUrl", async () => {
    const mockAdd = jest.fn(async () => ({ id: "new-agent-id" }));
    mockGetAdminDb.mockReturnValue({
      collection: jest.fn(() => ({ add: mockAdd })),
    } as never);

    const result = await createAgent("TestBot", "A test agent");
    expect(result.agent.id).toBe("new-agent-id");
    expect(result.agent.name).toBe("TestBot");
    expect(result.agent.description).toBe("A test agent");
    expect(result.agent.status).toBe("pending_claim");
    expect(result.apiKey).toMatch(/^cb_agent_/);
    expect(result.claimUrl).toContain("/agents/claim/");
    expect(mockAdd).toHaveBeenCalledTimes(1);
  });

  it("creates agent without description", async () => {
    const mockAdd = jest.fn(async () => ({ id: "agent-2" }));
    mockGetAdminDb.mockReturnValue({
      collection: jest.fn(() => ({ add: mockAdd })),
    } as never);

    const result = await createAgent("MinimalBot");
    expect(result.agent.name).toBe("MinimalBot");
    expect(result.agent.description).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// claimAgent
// ---------------------------------------------------------------------------

describe("claimAgent", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns null when claim token is invalid", async () => {
    const result = await claimAgent("invalid", "owner-1");
    expect(result).toBeNull();
  });

  it("claims agent and updates Firestore", async () => {
    const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
    const agentData = {
      name: "TestBot",
      status: "pending_claim",
      claimExpiresAt: { toDate: () => futureDate },
    };

    const mockUpdate = jest.fn(async () => {});
    const mockDoc = jest.fn(() => ({ update: mockUpdate }));
    const mockWhere = jest.fn(() => ({
      where: jest.fn(() => ({
        get: jest.fn(async () => ({
          empty: false,
          docs: [{ id: "agent-1", data: () => agentData }],
        })),
      })),
    }));

    mockGetAdminDb.mockReturnValue({
      collection: jest.fn(() => ({
        where: mockWhere,
        doc: mockDoc,
      })),
    } as never);

    const token = "abcdef0123456789abcdef0123456789";
    const result = await claimAgent(token, "owner-1", "owner@example.com", "Owner");

    expect(result).not.toBeNull();
    expect(result?.status).toBe("claimed");
    expect(result?.ownerId).toBe("owner-1");
    expect(result?.ownerEmail).toBe("owner@example.com");
    expect(result?.ownerDisplayName).toBe("Owner");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "claimed",
        ownerId: "owner-1",
        ownerEmail: "owner@example.com",
        ownerDisplayName: "Owner",
      })
    );
  });
});

// ---------------------------------------------------------------------------
// updateAgentProfile
// ---------------------------------------------------------------------------

describe("updateAgentProfile", () => {
  beforeEach(() => jest.clearAllMocks());

  it("throws when Firebase Admin is not configured", async () => {
    mockGetAdminDb.mockReturnValue(null as never);
    await expect(updateAgentProfile("agent-1", { name: "NewName" })).rejects.toThrow(
      "Firebase Admin is not configured"
    );
  });

  it("calls update on the correct document", async () => {
    const mockUpdate = jest.fn(async () => {});
    const mockDoc = jest.fn(() => ({ update: mockUpdate }));
    mockGetAdminDb.mockReturnValue({
      collection: jest.fn(() => ({ doc: mockDoc })),
    } as never);

    await updateAgentProfile("agent-1", { name: "NewName", description: "Updated" });
    expect(mockDoc).toHaveBeenCalledWith("agent-1");
    expect(mockUpdate).toHaveBeenCalledWith({ name: "NewName", description: "Updated" });
  });
});

// ---------------------------------------------------------------------------
// toPublicProfile
// ---------------------------------------------------------------------------

describe("toPublicProfile", () => {
  const baseAgent: Agent = {
    id: "agent-1",
    name: "TestBot",
    description: "A test bot",
    apiKeyHash: "hash",
    apiKeyPrefix: "cb_agent_",
    status: "claimed",
    ownerId: "owner-1",
    ownerEmail: "owner@example.com",
    ownerDisplayName: "Owner",
    createdAt: Timestamp.now(),
    visibility: { isPublic: true, showOwner: true },
  };

  it("includes owner info when visibility.showOwner is true and status is claimed", () => {
    const profile = toPublicProfile(baseAgent);
    expect(profile.owner).toEqual({
      displayName: "Owner",
      email: "owner@example.com",
    });
    expect(profile.id).toBe("agent-1");
    expect(profile.name).toBe("TestBot");
  });

  it("excludes owner info when visibility.showOwner is false", () => {
    const agent = { ...baseAgent, visibility: { isPublic: true, showOwner: false } };
    const profile = toPublicProfile(agent);
    expect(profile.owner).toBeUndefined();
  });

  it("excludes owner info when status is not claimed", () => {
    const agent = { ...baseAgent, status: "pending_claim" as const };
    const profile = toPublicProfile(agent);
    expect(profile.owner).toBeUndefined();
  });

  it("never exposes apiKeyHash or claimToken", () => {
    const profile = toPublicProfile(baseAgent);
    expect(profile).not.toHaveProperty("apiKeyHash");
    expect(profile).not.toHaveProperty("claimToken");
    expect(profile).not.toHaveProperty("apiKeyPrefix");
  });
});

// ---------------------------------------------------------------------------
// getAgentsByOwner
// ---------------------------------------------------------------------------

describe("getAgentsByOwner", () => {
  beforeEach(() => jest.clearAllMocks());

  it("throws when Firebase Admin is not configured", async () => {
    mockGetAdminDb.mockReturnValue(null as never);
    await expect(getAgentsByOwner("owner-1")).rejects.toThrow("Firebase Admin is not configured");
  });

  it("returns agents ordered by claimedAt desc", async () => {
    const agents = [
      { id: "a1", data: () => ({ name: "Bot1" }) },
      { id: "a2", data: () => ({ name: "Bot2" }) },
    ];
    const mockGet = jest.fn(async () => ({ docs: agents }));
    const mockOrderBy = jest.fn(() => ({ get: mockGet }));
    const mockWhereStatus = jest.fn(() => ({ orderBy: mockOrderBy }));
    const mockWhereOwner = jest.fn(() => ({ where: mockWhereStatus }));

    mockGetAdminDb.mockReturnValue({
      collection: jest.fn(() => ({ where: mockWhereOwner })),
    } as never);

    const result = await getAgentsByOwner("owner-1");
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("a1");
    expect(result[1].id).toBe("a2");
    expect(mockWhereOwner).toHaveBeenCalledWith("ownerId", "==", "owner-1");
    expect(mockWhereStatus).toHaveBeenCalledWith("status", "==", "claimed");
    expect(mockOrderBy).toHaveBeenCalledWith("claimedAt", "desc");
  });

  it("returns empty array when owner has no agents", async () => {
    const mockGet = jest.fn(async () => ({ docs: [] }));
    const mockOrderBy = jest.fn(() => ({ get: mockGet }));
    const mockWhereStatus = jest.fn(() => ({ orderBy: mockOrderBy }));
    const mockWhereOwner = jest.fn(() => ({ where: mockWhereStatus }));

    mockGetAdminDb.mockReturnValue({
      collection: jest.fn(() => ({ where: mockWhereOwner })),
    } as never);

    const result = await getAgentsByOwner("owner-none");
    expect(result).toHaveLength(0);
  });
});
