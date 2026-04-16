/**
 * @jest-environment node
 */

// Mock firebase-admin before importing the route
jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(),
}));

// Mock rate-limit to always allow
jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: jest.fn(() => ({ success: true, remaining: 59 })),
  getClientIdentifier: jest.fn(() => "test-ip"),
}));

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: { logError: jest.fn() },
}));

import { GET } from "@/app/api/analytics/summary/route";
import { getAdminDb } from "@/lib/firebase-admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { NextRequest } from "next/server";

const mockGetAdminDb = getAdminDb as jest.Mock;
const mockCheckRateLimit = checkRateLimit as jest.Mock;

function makeRequest() {
  return new NextRequest("http://localhost/api/analytics/summary");
}

function snapshotDb(summary: Record<string, unknown>, expiresAt: { toDate: () => Date } | null) {
  return {
    collection: jest.fn((name: string) => {
      if (name !== "analytics_snapshots") throw new Error(`unexpected collection ${name}`);
      return {
        doc: jest.fn((id: string) => {
          if (id !== "latest") throw new Error(`unexpected doc ${id}`);
          return {
            get: jest.fn(() =>
              Promise.resolve({
                exists: true,
                data: () => ({ summary, expiresAt }),
              })
            ),
          };
        }),
      };
    }),
  };
}

describe("GET /api/analytics/summary", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns 429 when rate limit exceeded", async () => {
    mockCheckRateLimit.mockReturnValueOnce({ success: false, retryAfter: 30 });
    mockGetAdminDb.mockReturnValue(null);

    const res = await GET(makeRequest());
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("Too many requests");
    expect(body.retryAfterSeconds).toBe(30);
  });

  it("returns EMPTY_SUMMARY when firebase init throws", async () => {
    mockGetAdminDb.mockImplementation(() => {
      throw new Error("Firebase init failed");
    });

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.totalMembers).toBe(0);
    expect(body.generatedAt).toBeDefined();
  });

  it("returns EMPTY_SUMMARY when db is null", async () => {
    mockGetAdminDb.mockReturnValue(null);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.totalMembers).toBe(0);
  });

  it("returns summary from analytics_snapshots/latest when present and valid", async () => {
    const cachedSummary = {
      totalMembers: 99,
      generatedAt: new Date().toISOString(),
      totalEventRegistrations: 0,
      totalShowcaseProjects: 0,
      totalShowcaseInteractions: 0,
      memberGrowth: [],
      eventAttendance: [],
      skillDistribution: [],
      hackathonStats: { teamsFormed: 0, projectsSubmitted: 0, teamsAsPercentOfMembers: 0 },
      communityActivity: [],
      platformHealth: { returningMembers: 0, activeThisMonth: 0 },
      showcaseOverTime: [],
    };
    const futureExpiry = { toDate: () => new Date(Date.now() + 60 * 60 * 1000) };
    mockGetAdminDb.mockReturnValue(snapshotDb(cachedSummary, futureExpiry));

    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.totalMembers).toBe(99);
  });

  it("adds stale header when snapshot TTL is expired", async () => {
    const cachedSummary = {
      totalMembers: 5,
      generatedAt: new Date().toISOString(),
      totalEventRegistrations: 0,
      totalShowcaseProjects: 0,
      totalShowcaseInteractions: 0,
      memberGrowth: [],
      eventAttendance: [],
      skillDistribution: [],
      hackathonStats: { teamsFormed: 0, projectsSubmitted: 0, teamsAsPercentOfMembers: 0 },
      communityActivity: [],
      platformHealth: { returningMembers: 0, activeThisMonth: 0 },
      showcaseOverTime: [],
    };
    const expiredExpiry = { toDate: () => new Date(Date.now() - 1000) };
    mockGetAdminDb.mockReturnValue(snapshotDb(cachedSummary, expiredExpiry));

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Analytics-Snapshot-Stale")).toBe("true");
    const body = await res.json();
    expect(body.totalMembers).toBe(5);
  });

  it("returns EMPTY_SUMMARY when snapshot doc is missing", async () => {
    const mockDb = {
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: jest.fn(() => Promise.resolve({ exists: false })),
        })),
      })),
    };
    mockGetAdminDb.mockReturnValue(mockDb);

    const res = await GET(makeRequest());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.totalMembers).toBe(0);
  });

  it("returns EMPTY_SUMMARY when snapshot payload is malformed", async () => {
    const mockDb = {
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: jest.fn(() =>
            Promise.resolve({
              exists: true,
              data: () => ({ summary: null, expiresAt: { toDate: () => new Date() } }),
            })
          ),
        })),
      })),
    };
    mockGetAdminDb.mockReturnValue(mockDb);

    const res = await GET(makeRequest());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.totalMembers).toBe(0);
  });
});
