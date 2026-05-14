/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/agents/claim/[token]/route";
import { getAgentByClaimToken, claimAgent } from "@/lib/agents";
import { getVerifiedUser } from "@/lib/server-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { checkUpstashRateLimit } from "@/lib/upstash-rate-limit";

jest.mock("@/lib/agents", () => ({
  getAgentByClaimToken: jest.fn(),
  claimAgent: jest.fn(),
}));
jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));
jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(),
}));
jest.mock("@/lib/rate-limit", () => ({
  getClientIdentifier: jest.fn(() => "ip:127.0.0.1"),
}));
jest.mock("@/lib/upstash-rate-limit", () => ({
  checkUpstashRateLimit: jest.fn(),
}));
jest.mock("@/lib/logger", () => ({
  logApiError: jest.fn(),
  logger: { logError: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

const mockGetAgent = getAgentByClaimToken as jest.MockedFunction<typeof getAgentByClaimToken>;
const mockClaim = claimAgent as jest.MockedFunction<typeof claimAgent>;
const mockUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockRateLimit = checkUpstashRateLimit as jest.MockedFunction<typeof checkUpstashRateLimit>;

function makeContext(token: string) {
  return { params: Promise.resolve({ token }) };
}

function claimRequest() {
  return new NextRequest("http://localhost/api/agents/claim/abc", { method: "GET" });
}

function postClaimRequest() {
  return new NextRequest("http://localhost/api/agents/claim/abc", { method: "POST" });
}

function userProfileDoc(data: Record<string, unknown> | null) {
  return {
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn().mockResolvedValue({
          exists: data !== null,
          data: () => data,
        }),
      })),
    })),
  };
}

describe("GET /api/agents/claim/[token]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRateLimit.mockResolvedValue({ success: true } as any);
  });

  it("returns 429 when rate-limited", async () => {
    mockRateLimit.mockResolvedValue({ success: false, retryAfter: 60 } as any);
    const res = await GET(claimRequest(), makeContext("abc"));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
  });

  it("returns 400 when the token param is empty", async () => {
    const res = await GET(claimRequest(), makeContext(""));
    expect(res.status).toBe(400);
  });

  it("returns 404 when the agent token is invalid or expired", async () => {
    mockGetAgent.mockResolvedValue(null);
    const res = await GET(claimRequest(), makeContext("abc"));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toContain("Invalid or expired");
  });

  it("returns agent info and canClaim=false when no user is signed in", async () => {
    mockGetAgent.mockResolvedValue({
      id: "a1",
      name: "Test",
      description: "d",
      status: "pending",
      createdAt: 1,
      claimExpiresAt: 2,
    } as any);
    mockUser.mockResolvedValue(null);

    const res = await GET(claimRequest(), makeContext("abc"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.canClaim).toBeFalsy();
    expect(json.user).toBeNull();
    expect(json.message).toContain("Please log in");
  });

  it("returns canClaim=true when user has displayName and public profile", async () => {
    mockGetAgent.mockResolvedValue({
      id: "a1",
      name: "Test",
      description: "d",
      status: "pending",
      createdAt: 1,
      claimExpiresAt: 2,
    } as any);
    mockUser.mockResolvedValue({ uid: "u1", email: "alice@example.com", name: "Alice" } as any);
    mockAdminDb.mockReturnValue(
      userProfileDoc({
        displayName: "Alice",
        visibility: { isPublic: true },
      }) as any
    );
    const res = await GET(claimRequest(), makeContext("abc"));
    const json = await res.json();
    expect(json.canClaim).toBe(true);
    expect(json.message).toContain("logged in as alice@example.com");
  });

  it("returns a profile-incomplete message when user has no displayName", async () => {
    mockGetAgent.mockResolvedValue({ id: "a1" } as any);
    mockUser.mockResolvedValue({ uid: "u1", email: "alice@example.com", name: "" } as any);
    mockAdminDb.mockReturnValue(
      userProfileDoc({ visibility: { isPublic: true } }) as any
    );
    const res = await GET(claimRequest(), makeContext("abc"));
    const json = await res.json();
    expect(json.canClaim).toBeFalsy();
    expect(json.message).toContain("display name");
  });

  it("returns a profile-must-be-public message when user has displayName but private profile", async () => {
    mockGetAgent.mockResolvedValue({ id: "a1" } as any);
    mockUser.mockResolvedValue({ uid: "u1", email: "alice@example.com", name: "Alice" } as any);
    mockAdminDb.mockReturnValue(
      userProfileDoc({
        displayName: "Alice",
        visibility: { isPublic: false },
      }) as any
    );
    const res = await GET(claimRequest(), makeContext("abc"));
    const json = await res.json();
    expect(json.canClaim).toBeFalsy();
    expect(json.message).toContain("public");
  });

  it("returns 500 when an uncaught error occurs", async () => {
    mockGetAgent.mockRejectedValue(new Error("agents-down"));
    const res = await GET(claimRequest(), makeContext("abc"));
    expect(res.status).toBe(500);
  });
});

describe("POST /api/agents/claim/[token]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRateLimit.mockResolvedValue({ success: true } as any);
  });

  it("returns 429 when rate-limited", async () => {
    mockRateLimit.mockResolvedValue({ success: false, retryAfter: 60 } as any);
    const res = await POST(postClaimRequest(), makeContext("abc"));
    expect(res.status).toBe(429);
  });

  it("returns 400 when the token param is empty", async () => {
    const res = await POST(postClaimRequest(), makeContext(""));
    expect(res.status).toBe(400);
  });

  it("returns 401 when unauthenticated", async () => {
    mockUser.mockResolvedValue(null);
    const res = await POST(postClaimRequest(), makeContext("abc"));
    expect(res.status).toBe(401);
  });

  it("returns 400 PROFILE_INCOMPLETE when display name is missing", async () => {
    mockUser.mockResolvedValue({ uid: "u1", email: "a@b.com", name: "" } as any);
    mockAdminDb.mockReturnValue(
      userProfileDoc({ visibility: { isPublic: true } }) as any
    );
    const res = await POST(postClaimRequest(), makeContext("abc"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("PROFILE_INCOMPLETE");
  });

  it("returns 400 PROFILE_NOT_PUBLIC when profile is private", async () => {
    mockUser.mockResolvedValue({ uid: "u1", email: "a@b.com", name: "Alice" } as any);
    mockAdminDb.mockReturnValue(
      userProfileDoc({ displayName: "Alice", visibility: { isPublic: false } }) as any
    );
    const res = await POST(postClaimRequest(), makeContext("abc"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("PROFILE_NOT_PUBLIC");
  });

  it("returns 404 when claimAgent returns null (invalid/expired)", async () => {
    mockUser.mockResolvedValue({ uid: "u1", email: "a@b.com", name: "Alice" } as any);
    mockAdminDb.mockReturnValue(
      userProfileDoc({ displayName: "Alice", visibility: { isPublic: true } }) as any
    );
    mockClaim.mockResolvedValue(null as any);
    const res = await POST(postClaimRequest(), makeContext("abc"));
    expect(res.status).toBe(404);
  });

  it("claims the agent and returns the success payload", async () => {
    mockUser.mockResolvedValue({ uid: "u1", email: "a@b.com", name: "Alice" } as any);
    mockAdminDb.mockReturnValue(
      userProfileDoc({ displayName: "Alice", visibility: { isPublic: true } }) as any
    );
    mockClaim.mockResolvedValue({
      id: "a1",
      name: "Test Agent",
      description: "d",
      status: "claimed",
      claimedAt: 123,
    } as any);
    const res = await POST(postClaimRequest(), makeContext("abc"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.agent.id).toBe("a1");
    expect(mockClaim).toHaveBeenCalledWith("abc", "u1", "a@b.com", "Alice");
  });
});
