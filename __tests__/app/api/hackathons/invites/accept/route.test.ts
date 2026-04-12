/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST } from "@/app/api/hackathons/invites/accept/route";
import type { VerifiedUser } from "@/lib/server-auth";
import { getVerifiedUser } from "@/lib/server-auth";

jest.mock("@/lib/logger", () => ({
  logger: { logError: jest.fn() },
}));

const mockCheckRateLimit = jest.fn().mockReturnValue({ success: true });
jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  getClientIdentifier: () => "test-client",
  rateLimitConfigs: { hackathonAction: { windowMs: 60000, maxRequests: 10 } },
}));

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/sanitize", () => ({
  sanitizeDocId: (input: string) => {
    if (!input || typeof input !== "string" || !input.trim()) return null;
    if (!/^[a-zA-Z0-9_-]+$/.test(input.trim())) return null;
    return input.trim();
  },
}));

const mockGet = jest.fn();
const mockUpdate = jest.fn();
const mockRunTransaction = jest.fn();
const mockWhere = jest.fn();

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(() => ({
    collection: (name: string) => ({
      doc: (id: string) => ({
        get: () => mockGet(name, id),
        update: (data: unknown) => mockUpdate(name, id, data),
      }),
      where: (...args: unknown[]) => {
        mockWhere(...args);
        return {
          where: (...args2: unknown[]) => {
            mockWhere(...args2);
            return {
              limit: () => ({
                get: () => mockGet("query", "existingTeam"),
              }),
            };
          },
        };
      },
    }),
    runTransaction: (fn: (tx: unknown) => Promise<unknown>) =>
      mockRunTransaction(fn),
  })),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<
  typeof getVerifiedUser
>;

const testUser: VerifiedUser = { uid: "u1", name: "Test User" };

function makeRequest(body?: Record<string, unknown> | string) {
  return new NextRequest("http://localhost/api/hackathons/invites/accept", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body ?? {}),
  });
}

describe("POST /api/hackathons/invites/accept", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ success: true });
  });

  it("returns 429 when rate limited", async () => {
    mockCheckRateLimit.mockReturnValue({ success: false, retryAfter: 30 });
    const res = await POST(makeRequest({ inviteId: "inv1" }));
    expect(res.status).toBe(429);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await POST(makeRequest({ inviteId: "inv1" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid JSON body", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const req = new NextRequest(
      "http://localhost/api/hackathons/invites/accept",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "bad-json",
      }
    );
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid JSON in request body");
  });

  it("returns 400 when inviteId is missing", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid inviteId format");
  });

  it("returns 400 when inviteId has invalid characters", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const res = await POST(makeRequest({ inviteId: "inv/../bad" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid inviteId format");
  });

  it("returns 404 when invite not found", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockGet.mockImplementation((collection: string) => {
      if (collection === "hackathonInvites")
        return { exists: false, data: () => null };
      return { exists: false, data: () => null };
    });
    const res = await POST(makeRequest({ inviteId: "inv1" }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Invite not found");
  });

  it("returns 403 when invite belongs to another user", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockGet.mockImplementation((collection: string) => {
      if (collection === "hackathonInvites")
        return {
          exists: true,
          data: () => ({
            toUserId: "other-user",
            status: "pending",
            teamId: "t1",
          }),
        };
      return { exists: false, data: () => null };
    });
    const res = await POST(makeRequest({ inviteId: "inv1" }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Not your invite");
  });

  it("returns 400 when invite already handled", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockGet.mockImplementation((collection: string) => {
      if (collection === "hackathonInvites")
        return {
          exists: true,
          data: () => ({
            toUserId: "u1",
            status: "accepted",
            teamId: "t1",
          }),
        };
      return { exists: false, data: () => null };
    });
    const res = await POST(makeRequest({ inviteId: "inv1" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invite already handled");
  });

  it("returns 404 when team not found", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockGet.mockImplementation((collection: string) => {
      if (collection === "hackathonInvites")
        return {
          exists: true,
          data: () => ({
            toUserId: "u1",
            status: "pending",
            teamId: "t1",
          }),
        };
      if (collection === "hackathonTeams")
        return { exists: false, data: () => null };
      return { exists: false, data: () => null };
    });
    const res = await POST(makeRequest({ inviteId: "inv1" }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Team not found");
  });

  it("returns 400 when team is full", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockGet.mockImplementation((collection: string) => {
      if (collection === "hackathonInvites")
        return {
          exists: true,
          data: () => ({
            toUserId: "u1",
            status: "pending",
            teamId: "t1",
          }),
        };
      if (collection === "hackathonTeams")
        return {
          exists: true,
          data: () => ({
            memberIds: ["a", "b", "c"],
            hackathonId: "2026-04",
          }),
        };
      return { exists: false, data: () => null };
    });
    const res = await POST(makeRequest({ inviteId: "inv1" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Team is full");
  });

  it("returns 200 and marks accepted when user already on team", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockGet.mockImplementation((collection: string) => {
      if (collection === "hackathonInvites")
        return {
          exists: true,
          data: () => ({
            toUserId: "u1",
            status: "pending",
            teamId: "t1",
          }),
        };
      if (collection === "hackathonTeams")
        return {
          exists: true,
          data: () => ({
            memberIds: ["u1", "b"],
            hackathonId: "2026-04",
          }),
        };
      return { exists: false, data: () => null };
    });
    const res = await POST(makeRequest({ inviteId: "inv1" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.accepted).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(
      "hackathonInvites",
      "inv1",
      { status: "accepted" }
    );
  });

  it("returns 200 on successful accept via transaction", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockGet.mockImplementation((collection: string) => {
      if (collection === "hackathonInvites")
        return {
          exists: true,
          data: () => ({
            toUserId: "u1",
            status: "pending",
            teamId: "t1",
          }),
        };
      if (collection === "hackathonTeams")
        return {
          exists: true,
          data: () => ({
            memberIds: ["owner1"],
            hackathonId: "2026-04",
          }),
        };
      // query for existing team
      if (collection === "query") return { empty: true };
      return { exists: false, data: () => null };
    });
    mockRunTransaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          get: jest.fn().mockResolvedValue({
            data: () => ({ memberIds: ["owner1"], hackathonId: "2026-04" }),
          }),
          update: jest.fn(),
        };
        return fn(tx);
      }
    );
    const res = await POST(makeRequest({ inviteId: "inv1" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.accepted).toBe(true);
  });

  it("returns 400 when user already on another team (ALREADY_ON_TEAM)", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockGet.mockImplementation((collection: string) => {
      if (collection === "hackathonInvites")
        return {
          exists: true,
          data: () => ({
            toUserId: "u1",
            status: "pending",
            teamId: "t1",
          }),
        };
      if (collection === "hackathonTeams")
        return {
          exists: true,
          data: () => ({
            memberIds: ["owner1"],
            hackathonId: "2026-04",
          }),
        };
      if (collection === "query") return { empty: true };
      return { exists: false, data: () => null };
    });
    mockRunTransaction.mockImplementation(async () => {
      throw new Error("ALREADY_ON_TEAM");
    });
    const res = await POST(makeRequest({ inviteId: "inv1" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("You are already on a team for this hackathon");
  });

  it("returns 400 when team fills up during transaction (TEAM_FULL)", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockGet.mockImplementation((collection: string) => {
      if (collection === "hackathonInvites")
        return {
          exists: true,
          data: () => ({
            toUserId: "u1",
            status: "pending",
            teamId: "t1",
          }),
        };
      if (collection === "hackathonTeams")
        return {
          exists: true,
          data: () => ({
            memberIds: ["owner1"],
            hackathonId: "2026-04",
          }),
        };
      if (collection === "query") return { empty: true };
      return { exists: false, data: () => null };
    });
    mockRunTransaction.mockImplementation(async () => {
      throw new Error("TEAM_FULL");
    });
    const res = await POST(makeRequest({ inviteId: "inv1" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Team is full");
  });
});
