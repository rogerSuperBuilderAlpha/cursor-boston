/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST } from "@/app/api/hackathons/requests/accept/route";
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
const mockBatchUpdate = jest.fn();
const mockBatchCommit = jest.fn();
const mockWhere = jest.fn();

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(() => ({
    collection: (name: string) => ({
      doc: (id: string) => {
        const ref = {
          get: () => mockGet(name, id),
          update: (data: unknown) => mockUpdate(name, id, data),
          ref: `${name}/${id}`,
        };
        return ref;
      },
      where: (...args: unknown[]) => {
        mockWhere(...args);
        return {
          where: (...args2: unknown[]) => {
            mockWhere(...args2);
            return {
              limit: () => ({
                get: () => mockGet("query-existing-team", "check"),
              }),
              get: () => mockGet("query-pending-requests", "check"),
            };
          },
        };
      },
    }),
    runTransaction: (fn: (tx: unknown) => Promise<unknown>) =>
      mockRunTransaction(fn),
    batch: () => ({
      update: mockBatchUpdate,
      commit: mockBatchCommit,
    }),
  })),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<
  typeof getVerifiedUser
>;

const testUser: VerifiedUser = { uid: "u1", name: "Test User" };

function makeRequest(body?: Record<string, unknown> | string) {
  return new NextRequest("http://localhost/api/hackathons/requests/accept", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body ?? {}),
  });
}

describe("POST /api/hackathons/requests/accept", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ success: true });
  });

  it("returns 429 when rate limited", async () => {
    mockCheckRateLimit.mockReturnValue({ success: false, retryAfter: 30 });
    const res = await POST(makeRequest({ requestId: "req1" }));
    expect(res.status).toBe(429);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await POST(makeRequest({ requestId: "req1" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid JSON body", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const req = new NextRequest(
      "http://localhost/api/hackathons/requests/accept",
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

  it("returns 400 when requestId is missing", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid requestId format");
  });

  it("returns 400 when requestId has invalid characters", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const res = await POST(makeRequest({ requestId: "req/../evil" }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when request not found", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockGet.mockImplementation((collection: string) => {
      if (collection === "hackathonJoinRequests")
        return { exists: false, data: () => null };
      return { exists: false, data: () => null };
    });
    const res = await POST(makeRequest({ requestId: "req1" }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Request not found");
  });

  it("returns 400 when request already handled", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockGet.mockImplementation((collection: string) => {
      if (collection === "hackathonJoinRequests")
        return {
          exists: true,
          data: () => ({
            fromUserId: "requester1",
            teamId: "t1",
            status: "accepted",
          }),
        };
      return { exists: false, data: () => null };
    });
    const res = await POST(makeRequest({ requestId: "req1" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Request already handled");
  });

  it("returns 404 when team not found", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockGet.mockImplementation((collection: string) => {
      if (collection === "hackathonJoinRequests")
        return {
          exists: true,
          data: () => ({
            fromUserId: "requester1",
            teamId: "t1",
            status: "pending",
          }),
        };
      if (collection === "hackathonTeams")
        return { exists: false, data: () => null };
      return { exists: false, data: () => null };
    });
    const res = await POST(makeRequest({ requestId: "req1" }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Team not found");
  });

  it("returns 403 when current user is not a team member", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockGet.mockImplementation((collection: string) => {
      if (collection === "hackathonJoinRequests")
        return {
          exists: true,
          data: () => ({
            fromUserId: "requester1",
            teamId: "t1",
            status: "pending",
          }),
        };
      if (collection === "hackathonTeams")
        return {
          exists: true,
          data: () => ({
            memberIds: ["other-user"],
            hackathonId: "2026-04",
          }),
        };
      return { exists: false, data: () => null };
    });
    const res = await POST(makeRequest({ requestId: "req1" }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("You are not a member of this team");
  });

  it("returns 400 when team is full", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockGet.mockImplementation((collection: string) => {
      if (collection === "hackathonJoinRequests")
        return {
          exists: true,
          data: () => ({
            fromUserId: "requester1",
            teamId: "t1",
            status: "pending",
          }),
        };
      if (collection === "hackathonTeams")
        return {
          exists: true,
          data: () => ({
            memberIds: ["u1", "b", "c"],
            hackathonId: "2026-04",
          }),
        };
      return { exists: false, data: () => null };
    });
    const res = await POST(makeRequest({ requestId: "req1" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Team is full");
  });

  it("returns 200 and marks accepted when requester already on team", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockGet.mockImplementation((collection: string) => {
      if (collection === "hackathonJoinRequests")
        return {
          exists: true,
          data: () => ({
            fromUserId: "requester1",
            teamId: "t1",
            status: "pending",
          }),
        };
      if (collection === "hackathonTeams")
        return {
          exists: true,
          data: () => ({
            memberIds: ["u1", "requester1"],
            hackathonId: "2026-04",
          }),
        };
      return { exists: false, data: () => null };
    });
    const res = await POST(makeRequest({ requestId: "req1" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.accepted).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(
      "hackathonJoinRequests",
      "req1",
      { status: "accepted" }
    );
  });

  it("returns 400 when requester is already on another team", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockGet.mockImplementation((collection: string) => {
      if (collection === "hackathonJoinRequests")
        return {
          exists: true,
          data: () => ({
            fromUserId: "requester1",
            teamId: "t1",
            status: "pending",
          }),
        };
      if (collection === "hackathonTeams")
        return {
          exists: true,
          data: () => ({
            memberIds: ["u1"],
            hackathonId: "2026-04",
          }),
        };
      if (collection === "query-existing-team")
        return { empty: false };
      return { exists: false, data: () => null };
    });
    const res = await POST(makeRequest({ requestId: "req1" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe(
      "That user is already on a team for this hackathon"
    );
  });

  it("returns 200 on successful accept with transaction and batch cleanup", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockGet.mockImplementation((collection: string) => {
      if (collection === "hackathonJoinRequests")
        return {
          exists: true,
          data: () => ({
            fromUserId: "requester1",
            teamId: "t1",
            status: "pending",
          }),
        };
      if (collection === "hackathonTeams")
        return {
          exists: true,
          data: () => ({
            memberIds: ["u1"],
            hackathonId: "2026-04",
          }),
        };
      if (collection === "query-existing-team") return { empty: true };
      if (collection === "query-pending-requests")
        return {
          empty: false,
          docs: [
            {
              id: "req1",
              ref: "hackathonJoinRequests/req1",
            },
            {
              id: "req2",
              ref: "hackathonJoinRequests/req2",
            },
          ],
        };
      return { exists: false, data: () => null };
    });
    mockRunTransaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = { update: jest.fn() };
        return fn(tx);
      }
    );
    mockBatchCommit.mockResolvedValue(undefined);

    const res = await POST(makeRequest({ requestId: "req1" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.accepted).toBe(true);
    expect(mockRunTransaction).toHaveBeenCalled();
    // Should withdraw other pending requests (req2, not req1)
    expect(mockBatchUpdate).toHaveBeenCalledWith(
      "hackathonJoinRequests/req2",
      { status: "withdrawn" }
    );
    expect(mockBatchCommit).toHaveBeenCalled();
  });
});
