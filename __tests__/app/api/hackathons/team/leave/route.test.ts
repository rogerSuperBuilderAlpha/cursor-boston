/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST } from "@/app/api/hackathons/team/leave/route";
import { getVerifiedUser } from "@/lib/server-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { checkRateLimit } from "@/lib/rate-limit";

jest.mock("@/lib/rate-limit", () => {
  const actual = jest.requireActual("@/lib/rate-limit");
  return {
    ...actual,
    getClientIdentifier: jest.fn(() => "test-ip"),
    checkRateLimit: jest.fn(() => ({ success: true, retryAfter: 0 })),
  };
});

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(),
}));

jest.mock("@/lib/sanitize", () => ({
  sanitizeDocId: jest.fn((s: string) => (s && /^[a-zA-Z0-9_-]+$/.test(s) ? s : null)),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockCheckRateLimit = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/hackathons/team/leave", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function buildMockDb({
  teamExists = true,
  teamData = { memberIds: ["u1", "u2", "u3"], hackathonId: "h1" },
  hasSubmission = false,
}: {
  teamExists?: boolean;
  teamData?: Record<string, unknown>;
  hasSubmission?: boolean;
} = {}) {
  const mockDelete = jest.fn();
  const mockUpdate = jest.fn();
  const mockSet = jest.fn();
  const mockTxGet = jest.fn();
  const mockTeamRef = { id: "team1" };
  const mockSubmissionRef = { id: "sub1" };

  const mockRunTransaction = jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
    const submissionDocs = hasSubmission
      ? [{ ref: mockSubmissionRef }]
      : [];
    mockTxGet.mockResolvedValue({
      empty: !hasSubmission,
      docs: submissionDocs,
    });

    const tx = {
      get: mockTxGet,
      delete: mockDelete,
      update: mockUpdate,
      set: mockSet,
    };
    return fn(tx);
  });

  const db = {
    collection: jest.fn((name: string) => {
      if (name === "hackathonTeams") {
        return {
          doc: jest.fn(() => ({
            ...mockTeamRef,
            get: jest.fn().mockResolvedValue({
              exists: teamExists,
              data: () => (teamExists ? teamData : null),
            }),
          })),
        };
      }
      if (name === "hackathonSubmissions") {
        return {
          where: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnThis(),
            }),
          }),
        };
      }
      if (name === "hackathonLeftTeam") {
        return {
          doc: jest.fn(() => ({})),
        };
      }
      return {
        doc: jest.fn(() => ({ get: jest.fn() })),
      };
    }),
    runTransaction: mockRunTransaction,
  };

  return { db, mockDelete, mockUpdate, mockSet, mockTxGet, mockRunTransaction };
}

describe("POST /api/hackathons/team/leave", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ success: true, retryAfter: 0 });
  });

  it("returns 429 when rate limited", async () => {
    mockCheckRateLimit.mockReturnValue({ success: false, retryAfter: 30 });
    const res = await POST(makeRequest({ teamId: "team1" }));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toMatch(/too many/i);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await POST(makeRequest({ teamId: "team1" }));
    expect(res.status).toBe(401);
  });

  it("returns 500 when db is not configured", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u1@test.com" });
    mockGetAdminDb.mockReturnValue(null as never);
    const res = await POST(makeRequest({ teamId: "team1" }));
    expect(res.status).toBe(500);
  });

  it("returns 400 for invalid JSON body", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u1@test.com" });
    const { db } = buildMockDb();
    mockGetAdminDb.mockReturnValue(db as never);

    const req = new NextRequest("http://localhost/api/hackathons/team/leave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid json/i);
  });

  it("returns 400 when teamId is missing", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u1@test.com" });
    const { db } = buildMockDb();
    mockGetAdminDb.mockReturnValue(db as never);

    const res = await POST(makeRequest({ teamId: "" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid teamId/i);
  });

  it("returns 400 when teamId has invalid characters", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u1@test.com" });
    const { db } = buildMockDb();
    mockGetAdminDb.mockReturnValue(db as never);

    const res = await POST(makeRequest({ teamId: "team/../../bad" }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when team does not exist", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u1@test.com" });
    const { db } = buildMockDb({ teamExists: false });
    mockGetAdminDb.mockReturnValue(db as never);

    const res = await POST(makeRequest({ teamId: "team1" }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });

  it("returns 403 when user is not on the team", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "not-a-member", email: "x@test.com" });
    const { db } = buildMockDb({
      teamData: { memberIds: ["u1", "u2"], hackathonId: "h1" },
    });
    mockGetAdminDb.mockReturnValue(db as never);

    const res = await POST(makeRequest({ teamId: "team1" }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/not on this team/i);
  });

  it("successfully leaves a team without submission", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u1@test.com" });
    const { db } = buildMockDb({
      teamData: { memberIds: ["u1", "u2", "u3"], hackathonId: "h1" },
      hasSubmission: false,
    });
    mockGetAdminDb.mockReturnValue(db as never);

    const res = await POST(makeRequest({ teamId: "team1" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.left).toBe(true);
    expect(body.disqualified).toBe(false);
    expect(body.lockoutUntilNextMonth).toBe(false);
  });

  it("leaves team with submission causing disqualification", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u1@test.com" });
    const { db } = buildMockDb({
      teamData: { memberIds: ["u1", "u2", "u3"], hackathonId: "h1" },
      hasSubmission: true,
    });
    mockGetAdminDb.mockReturnValue(db as never);

    const res = await POST(makeRequest({ teamId: "team1" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.left).toBe(true);
    expect(body.disqualified).toBe(true);
    expect(body.lockoutUntilNextMonth).toBe(true);
  });

  it("deletes team when only 1 member would remain", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u1@test.com" });
    const { db, mockDelete } = buildMockDb({
      teamData: { memberIds: ["u1", "u2"], hackathonId: "h1" },
      hasSubmission: false,
    });
    mockGetAdminDb.mockReturnValue(db as never);

    const res = await POST(makeRequest({ teamId: "team1" }));
    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalled();
  });

  it("updates team when more than 1 member remains", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u1@test.com" });
    const { db, mockUpdate } = buildMockDb({
      teamData: { memberIds: ["u1", "u2", "u3"], hackathonId: "h1" },
      hasSubmission: false,
    });
    mockGetAdminDb.mockReturnValue(db as never);

    const res = await POST(makeRequest({ teamId: "team1" }));
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalled();
  });
});
