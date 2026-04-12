/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST } from "@/app/api/hackathons/submissions/register/route";
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
const mockSet = jest.fn();
const mockUpdate = jest.fn();
const mockWhere = jest.fn();
const mockLimit = jest.fn();
const mockDocRef = { get: mockGet, set: mockSet, update: mockUpdate };

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
    doc: jest.fn(() => mockDocRef),
  })),
};

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(() => mockDb),
}));

jest.mock("@/lib/hackathons", () => ({
  getCurrentVirtualHackathonId: () => "virtual-2026-04",
  isVirtualHackathonId: (id: string) => /^virtual-\d{4}-\d{2}$/.test(id),
  getVirtualMonthStartEndUtc: (id: string) => {
    const match = id.match(/^virtual-(\d{4})-(\d{2})$/);
    if (!match) return null;
    const year = parseInt(match[1], 10);
    const month0 = parseInt(match[2], 10) - 1;
    return {
      start: new Date(Date.UTC(year, month0, 1, 0, 0, 0, 0)),
      end: new Date(Date.UTC(year, month0 + 1, 0, 23, 59, 59, 999)),
    };
  },
}));

// Mock global fetch for GitHub API calls
const mockFetch = jest.fn();
global.fetch = mockFetch;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockCheckRateLimit = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;
const testUser: VerifiedUser = { uid: "user-1", name: "Test User" };

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/hackathons/submissions/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("POST /api/hackathons/submissions/register", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ success: true });
  });

  it("returns 429 when rate limited", async () => {
    mockCheckRateLimit.mockReturnValue({ success: false, retryAfter: 30 });
    const res = await POST(makeRequest({ repoUrl: "https://github.com/a/b" }));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("Too many requests");
    expect(res.headers.get("Retry-After")).toBe("30");
  });

  it("returns 401 when not authenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await POST(makeRequest({ repoUrl: "https://github.com/a/b" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid JSON body", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const req = new NextRequest("http://localhost/api/hackathons/submissions/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid JSON in request body");
  });

  it("returns 400 when repoUrl is missing", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("repoUrl required");
  });

  it("returns 400 when repoUrl is empty string", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const res = await POST(makeRequest({ repoUrl: "   " }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("repoUrl required");
  });

  it("returns 400 for non-GitHub URLs", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const res = await POST(makeRequest({ repoUrl: "https://gitlab.com/a/b" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Invalid GitHub repo URL/);
  });

  it("returns 400 for malformed URLs", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const res = await POST(makeRequest({ repoUrl: "not-a-url" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Invalid GitHub repo URL/);
  });

  it("returns 400 for GitHub URL without owner/repo", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const res = await POST(makeRequest({ repoUrl: "https://github.com/" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when hackathonId is not a virtual ID", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const res = await POST(makeRequest({ repoUrl: "https://github.com/a/b", hackathonId: "in-person-2026" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/virtual/i);
  });

  it("returns 403 when user is not on a team", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockGet.mockResolvedValueOnce({ empty: true, docs: [] });

    const res = await POST(makeRequest({ repoUrl: "https://github.com/a/b" }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/not on a team/i);
  });

  it("returns 400 when GitHub repo is not found (404)", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockGet.mockResolvedValueOnce({
      empty: false,
      docs: [{ id: "team-1" }],
    });
    mockFetch.mockResolvedValueOnce({ status: 404, ok: false });

    const res = await POST(makeRequest({ repoUrl: "https://github.com/a/b" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/not found or it is private/i);
  });

  it("returns 502 when GitHub API returns a non-OK, non-404 status", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockGet.mockResolvedValueOnce({
      empty: false,
      docs: [{ id: "team-1" }],
    });
    mockFetch.mockResolvedValueOnce({ status: 500, ok: false });

    const res = await POST(makeRequest({ repoUrl: "https://github.com/a/b" }));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toMatch(/Could not verify repo/i);
  });

  it("returns 400 when repo is private", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockGet.mockResolvedValueOnce({
      empty: false,
      docs: [{ id: "team-1" }],
    });
    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: async () => ({ private: true, created_at: "2026-04-10T00:00:00Z" }),
    });

    const res = await POST(makeRequest({ repoUrl: "https://github.com/a/b" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Repo must be public");
  });

  it("returns 400 when repo was created before the hackathon month", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockGet.mockResolvedValueOnce({
      empty: false,
      docs: [{ id: "team-1" }],
    });
    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: async () => ({ private: false, created_at: "2025-01-01T00:00:00Z" }),
    });

    const res = await POST(makeRequest({ repoUrl: "https://github.com/a/b" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/created during the hackathon month/);
  });

  it("returns 400 when repo was created after the hackathon month", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockGet.mockResolvedValueOnce({
      empty: false,
      docs: [{ id: "team-1" }],
    });
    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: async () => ({ private: false, created_at: "2026-05-15T00:00:00Z" }),
    });

    const res = await POST(makeRequest({ repoUrl: "https://github.com/a/b" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/created during the hackathon month/);
  });

  it("creates a new submission when none exists", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    // Team query
    mockGet.mockResolvedValueOnce({
      empty: false,
      docs: [{ id: "team-1" }],
    });
    // GitHub API
    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: async () => ({ private: false, created_at: "2026-04-10T00:00:00Z" }),
    });
    // Existing submission check
    mockGet.mockResolvedValueOnce({ exists: false });
    mockSet.mockResolvedValueOnce(undefined);

    const res = await POST(makeRequest({ repoUrl: "https://github.com/owner/repo" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.registered).toBe(true);
    expect(body.submissionId).toBe("virtual-2026-04_team-1");
    expect(body.repoUrl).toBe("https://github.com/owner/repo");
    expect(mockSet).toHaveBeenCalled();
  });

  it("updates an existing submission", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockGet.mockResolvedValueOnce({
      empty: false,
      docs: [{ id: "team-1" }],
    });
    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: async () => ({ private: false, created_at: "2026-04-10T00:00:00Z" }),
    });
    // Existing submission exists
    mockGet.mockResolvedValueOnce({ exists: true });
    mockUpdate.mockResolvedValueOnce(undefined);

    const res = await POST(makeRequest({ repoUrl: "https://github.com/owner/repo" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.registered).toBe(true);
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("strips .git suffix from repo URL", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockGet.mockResolvedValueOnce({
      empty: false,
      docs: [{ id: "team-1" }],
    });
    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: async () => ({ private: false, created_at: "2026-04-10T00:00:00Z" }),
    });
    mockGet.mockResolvedValueOnce({ exists: false });
    mockSet.mockResolvedValueOnce(undefined);

    const res = await POST(makeRequest({ repoUrl: "https://github.com/owner/repo.git" }));
    expect(res.status).toBe(200);
    // The fetch call should use the parsed owner/repo (without .git)
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.github.com/repos/owner/repo",
      expect.any(Object)
    );
  });

  it("defaults to current virtual hackathon when no hackathonId is provided", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockGet.mockResolvedValueOnce({
      empty: false,
      docs: [{ id: "team-1" }],
    });
    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: async () => ({ private: false, created_at: "2026-04-10T00:00:00Z" }),
    });
    mockGet.mockResolvedValueOnce({ exists: false });
    mockSet.mockResolvedValueOnce(undefined);

    const res = await POST(makeRequest({ repoUrl: "https://github.com/a/b" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.submissionId).toContain("virtual-2026-04");
  });

  it("returns 500 when an unexpected error occurs", async () => {
    mockGetVerifiedUser.mockRejectedValue(new Error("boom"));
    const res = await POST(makeRequest({ repoUrl: "https://github.com/a/b" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to register repo");
  });
});
