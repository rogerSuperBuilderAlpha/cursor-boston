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

// Mock static JSON so tests are not coupled to the real file contents
jest.mock("@/content/showcase.json", () => ({
  projects: [
    { id: "p1", submittedDate: "2025-01" },
    { id: "p2", submittedDate: "2025-02" },
  ],
}));
jest.mock("@/content/events.json", () => ({
  upcoming: [{ id: "evt1", title: "Event One" }],
  past: [],
  oldEvents: [],
}));

import { GET } from "@/app/api/analytics/summary/route";
import { getAdminDb } from "@/lib/firebase-admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { NextRequest } from "next/server";

const mockGetAdminDb = getAdminDb as jest.Mock;
const mockCheckRateLimit = checkRateLimit as jest.Mock;

function makeSnap(docs: Record<string, unknown>[]) {
  return {
    size: docs.length,
    forEach: (cb: (doc: { data: () => Record<string, unknown> }) => void) =>
      docs.forEach((d) => cb({ data: () => d })),
  };
}

function makeRequest() {
  return new NextRequest("http://localhost/api/analytics/summary");
}

function makeDb(overrides: Record<string, Record<string, unknown>[]> = {}, cacheExists = false) {
  const now = new Date();
  const recentDate = { toDate: () => new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000) };
  const oldDate = { toDate: () => new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000) };

  const defaults: Record<string, Record<string, unknown>[]> = {
    users: [{ createdAt: recentDate, displayName: "Alice" }],
    eventRegistrations: [
      { eventId: "evt1", userId: "u1", registeredAt: recentDate },
      { eventId: "evt2", userId: "u2", registeredAt: oldDate },
    ],
    showcaseProjects: [{ upCount: 5, downCount: 2 }],
    pair_profiles: [
      { skillsCanTeach: ["TypeScript"], skillsWantToLearn: ["Python"] },
      { skillsCanTeach: ["React", "  TypeScript  "], skillsWantToLearn: [] },
    ],
    hackathonTeams: [{}],
    hackathonSubmissions: [{}],
    communityMessages: [
      { createdAt: recentDate, userId: "u1" },           // recent post
      { createdAt: recentDate, userId: "u1", parentId: "p1" }, // recent reply
      { createdAt: oldDate, userId: "u2" },              // old post (prior activity)
    ],
    ...overrides,
  };

  return {
    collection: jest.fn((name: string) => ({
      get: jest.fn(() => makeSnap(defaults[name] ?? [])),
      doc: jest.fn(() => ({
        get: jest.fn(() =>
          cacheExists
            ? { exists: false }
            : { exists: false }
        ),
        set: jest.fn(),
      })),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
    })),
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

  it("returns cached summary when cache is valid", async () => {
    const cachedSummary = { totalMembers: 99, generatedAt: new Date().toISOString() };
    const futureExpiry = { toDate: () => new Date(Date.now() + 60 * 60 * 1000) };

    const mockDb = {
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: jest.fn(() => ({
            exists: true,
            data: () => ({ summary: cachedSummary, expiresAt: futureExpiry }),
          })),
        })),
      })),
    };

    mockGetAdminDb.mockReturnValue(mockDb);

    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.totalMembers).toBe(99);
  });

  it("falls through cache when it is expired", async () => {
    const expiredExpiry = { toDate: () => new Date(Date.now() - 1000) };
    const db = makeDb();
    // Override the analytics_snapshots doc to return an expired cache
    const originalCollection = db.collection;
    db.collection = jest.fn((name: string) => {
      if (name === "analytics_snapshots") {
        return {
          doc: jest.fn(() => ({
            get: jest.fn(() => ({
              exists: true,
              data: () => ({ summary: { totalMembers: 0 }, expiresAt: expiredExpiry }),
            })),
            set: jest.fn(),
          })),
          where: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          get: jest.fn(() => makeSnap([])),
        };
      }
      return originalCollection(name);
    });

    mockGetAdminDb.mockReturnValue(db);

    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.totalMembers).toBe(1); // from makeDb defaults
  });

  it("computes totalShowcaseInteractions as upCount + downCount", async () => {
    mockGetAdminDb.mockReturnValue(makeDb({ showcaseProjects: [{ upCount: 10, downCount: 3 }] }));

    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.totalShowcaseInteractions).toBe(13);
  });

  it("computes teamsAsPercentOfMembers correctly", async () => {
    mockGetAdminDb.mockReturnValue(makeDb({
      users: [{ createdAt: null }, { createdAt: null }, { createdAt: null }, { createdAt: null }],
      hackathonTeams: [{}],
    }));

    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.hackathonStats.teamsAsPercentOfMembers).toBe(25); // 1 team / 4 members
  });

  it("returns 0% teamsAsPercentOfMembers when no members", async () => {
    mockGetAdminDb.mockReturnValue(makeDb({ users: [], hackathonTeams: [{}] }));

    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.hackathonStats.teamsAsPercentOfMembers).toBe(0);
  });

  it("normalizes and deduplicates skills", async () => {
    mockGetAdminDb.mockReturnValue(makeDb({
      pair_profiles: [
        { skillsCanTeach: ["TypeScript", "  typescript  "], skillsWantToLearn: ["TYPESCRIPT"] },
      ],
    }));

    const res = await GET(makeRequest());
    const body = await res.json();
    const tsSkill = body.skillDistribution.find((s: { skill: string }) => s.skill === "typescript");
    expect(tsSkill).toBeDefined();
    expect(tsSkill.count).toBe(3); // all three normalize to "typescript"
  });

  it("counts community posts and replies separately", async () => {
    const now = new Date();
    const recentDate = { toDate: () => new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000) };

    mockGetAdminDb.mockReturnValue(makeDb({
      communityMessages: [
        { createdAt: recentDate, userId: "u1" },                        // post
        { createdAt: recentDate, userId: "u1", parentId: "msg1" },     // reply
        { createdAt: recentDate, userId: "u2", parentId: "msg1" },     // reply
      ],
    }));

    const res = await GET(makeRequest());
    const body = await res.json();

    const totalPosts = body.communityActivity.reduce((s: number, w: { posts: number }) => s + w.posts, 0);
    const totalReplies = body.communityActivity.reduce((s: number, w: { replies: number }) => s + w.replies, 0);
    expect(totalPosts).toBe(1);
    expect(totalReplies).toBe(2);
  });

  it("computes returning members correctly", async () => {
    const now = new Date();
    const recent = { toDate: () => new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000) };
    const old = { toDate: () => new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000) };

    mockGetAdminDb.mockReturnValue(makeDb({
      // u1 has both recent and old activity => returning
      eventRegistrations: [
        { eventId: "e1", userId: "u1", registeredAt: recent },
        { eventId: "e2", userId: "u1", registeredAt: old },
        { eventId: "e3", userId: "u2", registeredAt: recent }, // u2 only recent, not returning
      ],
      communityMessages: [],
    }));

    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.platformHealth.returningMembers).toBe(1);
    expect(body.platformHealth.activeThisMonth).toBe(2);
  });

  it("derives totalShowcaseProjects from static JSON, not Firestore", async () => {
    // Firestore has 1 showcase doc; static JSON mock has 2
    mockGetAdminDb.mockReturnValue(makeDb({ showcaseProjects: [{ upCount: 0, downCount: 0 }] }));

    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.totalShowcaseProjects).toBe(2);
  });

  it("buckets community activity by Monday UTC week boundaries", async () => {
    // Monday 2025-01-06 and Tuesday 2025-01-07 → same bucket "2025-01-06"
    // Monday 2025-01-13 → next bucket "2025-01-13"
    const mon   = { toDate: () => new Date("2025-01-06T10:00:00Z") };
    const tue   = { toDate: () => new Date("2025-01-07T10:00:00Z") };
    const nextMon = { toDate: () => new Date("2025-01-13T10:00:00Z") };

    mockGetAdminDb.mockReturnValue(makeDb({
      communityMessages: [
        { createdAt: mon, userId: "u1" },
        { createdAt: tue, userId: "u2" },
        { createdAt: nextMon, userId: "u3" },
      ],
    }));

    const res = await GET(makeRequest());
    const body = await res.json();

    const weeks = body.communityActivity.map((w: { week: string }) => w.week);
    expect(weeks).toContain("2025-01-06");
    expect(weeks).toContain("2025-01-13");

    const weekJan6 = body.communityActivity.find((w: { week: string }) => w.week === "2025-01-06");
    // mon and tue are top-level posts (no parentId); both in same bucket
    expect(weekJan6.posts).toBe(2);
    expect(weekJan6.replies).toBe(0);
  });

  it("returns all required fields in the summary", async () => {
    mockGetAdminDb.mockReturnValue(makeDb());

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body).toHaveProperty("totalMembers");
    expect(body).toHaveProperty("totalEventRegistrations");
    expect(body).toHaveProperty("totalShowcaseInteractions");
    expect(body).toHaveProperty("totalShowcaseProjects");
    expect(body).toHaveProperty("memberGrowth");
    expect(body).toHaveProperty("eventAttendance");
    expect(body).toHaveProperty("skillDistribution");
    expect(body).toHaveProperty("hackathonStats");
    expect(body.hackathonStats).toHaveProperty("teamsAsPercentOfMembers");
    expect(body).toHaveProperty("communityActivity");
    expect(body).toHaveProperty("platformHealth");
    expect(body).toHaveProperty("showcaseOverTime");
    expect(body).toHaveProperty("generatedAt");
  });
});
