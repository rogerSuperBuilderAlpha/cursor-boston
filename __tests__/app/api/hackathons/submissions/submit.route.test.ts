/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST } from "@/app/api/hackathons/submissions/submit/route";
import type { VerifiedUser } from "@/lib/server-auth";
import { getVerifiedUser } from "@/lib/server-auth";
import { checkRateLimit } from "@/lib/rate-limit";

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

jest.mock("@/lib/logger", () => ({
  logger: { error: jest.fn(), logError: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: jest.fn(() => ({ success: true })),
  getClientIdentifier: () => "test-client",
  rateLimitConfigs: { hackathonMutation: { windowMs: 60000, maxRequests: 10 } },
}));

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

const mockGet = jest.fn();
const mockUpdate = jest.fn();
const mockWhere = jest.fn();
const mockLimit = jest.fn();

const mockDb = {
  collection: jest.fn(() => ({
    where: (...args: unknown[]) => {
      mockWhere(...args);
      return {
        where: (...args2: unknown[]) => {
          mockWhere(...args2);
          return {
            limit: (n: number) => {
              mockLimit(n);
              return { get: mockGet };
            },
          };
        },
      };
    },
    doc: jest.fn(() => ({
      get: mockGet,
      update: mockUpdate,
    })),
  })),
};

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(() => mockDb),
}));

// Mock hackathons helpers to produce predictable values
jest.mock("@/lib/hackathons", () => ({
  getCurrentVirtualHackathonId: () => "virtual-2026-04",
  isVirtualHackathonId: (id: string) => /^virtual-\d{4}-\d{2}$/.test(id),
  getSubmissionCutoffForMonth: () => new Date("2099-05-01T04:00:00Z"), // far future = not expired
}));

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockCheckRateLimit = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;
const testUser: VerifiedUser = { uid: "user-1", name: "Test User" };

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/hackathons/submissions/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("POST /api/hackathons/submissions/submit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ success: true });
  });

  it("returns 429 when rate limited", async () => {
    mockCheckRateLimit.mockReturnValue({ success: false, retryAfter: 30 });
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("Too many requests");
    expect(res.headers.get("Retry-After")).toBe("30");
  });

  it("returns 401 when not authenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 400 for invalid JSON body", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const req = new NextRequest("http://localhost/api/hackathons/submissions/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid JSON in request body");
  });

  it("returns 400 when hackathonId is not a virtual ID", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const res = await POST(makeRequest({ hackathonId: "in-person-2026" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/virtual/i);
  });

  it("returns 400 when submission period has ended", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);

    // Override cutoff to a past date for this test
    const hackathons = jest.requireMock("@/lib/hackathons");
    hackathons.getSubmissionCutoffForMonth = () => new Date("2020-01-01T00:00:00Z");

    const res = await POST(makeRequest({ hackathonId: "virtual-2026-04" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/ended/i);

    // Restore
    hackathons.getSubmissionCutoffForMonth = () => new Date("2099-05-01T04:00:00Z");
  });

  it("returns 403 when user is not on a team", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockGet.mockResolvedValueOnce({ empty: true, docs: [] });

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/not on a team/i);
  });

  it("returns 400 when no submission doc exists (no repo registered)", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    // Team query
    mockGet.mockResolvedValueOnce({
      empty: false,
      docs: [{ id: "team-1" }],
    });
    // Submission doc
    mockGet.mockResolvedValueOnce({ exists: false, data: () => undefined });

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/register a repo/i);
  });

  it("returns 400 when submission doc exists but data() returns undefined", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockGet.mockResolvedValueOnce({
      empty: false,
      docs: [{ id: "team-1" }],
    });
    mockGet.mockResolvedValueOnce({ exists: true, data: () => undefined });

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/register a repo/i);
  });

  it("returns 409 when already submitted", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockGet.mockResolvedValueOnce({
      empty: false,
      docs: [{ id: "team-1" }],
    });
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ submittedAt: "2026-04-10T00:00:00Z", repoUrl: "https://github.com/a/b" }),
    });

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("Already submitted");
    expect(body.submittedAt).toBeDefined();
  });

  it("returns success on valid first-time submission", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockGet.mockResolvedValueOnce({
      empty: false,
      docs: [{ id: "team-1" }],
    });
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ repoUrl: "https://github.com/a/b" }),
    });
    mockUpdate.mockResolvedValueOnce(undefined);

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.submitted).toBe(true);
    expect(body.submissionId).toBe("virtual-2026-04_team-1");
    expect(body.cutoffAt).toBeDefined();
  });

  it("defaults to current virtual hackathon when no hackathonId is provided", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockGet.mockResolvedValueOnce({
      empty: false,
      docs: [{ id: "team-1" }],
    });
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ repoUrl: "https://github.com/a/b" }),
    });
    mockUpdate.mockResolvedValueOnce(undefined);

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.submissionId).toContain("virtual-2026-04");
  });

  it("returns 500 when an unexpected error occurs", async () => {
    mockGetVerifiedUser.mockRejectedValue(new Error("boom"));
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to submit");
  });
});
