/**
 * @jest-environment node
 */

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

import { computeAnalyticsSummary } from "@/lib/analytics-snapshot-compute";
import type { Firestore } from "firebase-admin/firestore";

function makeSnap(docs: Record<string, unknown>[]) {
  return {
    size: docs.length,
    forEach: (cb: (doc: { data: () => Record<string, unknown> }) => void) =>
      docs.forEach((d) => cb({ data: () => d })),
  };
}

function makeDb(overrides: Record<string, Record<string, unknown>[]> = {}) {
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
      { createdAt: recentDate, userId: "u1" },
      { createdAt: recentDate, userId: "u1", parentId: "p1" },
      { createdAt: oldDate, userId: "u2" },
    ],
    ...overrides,
  };

  return {
    collection: jest.fn((name: string) => {
      if (name === "communityMessages") {
        return {
          where: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          get: jest.fn(() => Promise.resolve(makeSnap(defaults.communityMessages ?? []))),
        };
      }
      return {
        get: jest.fn(() => Promise.resolve(makeSnap(defaults[name] ?? []))),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
      };
    }),
  } as unknown as Firestore;
}

describe("computeAnalyticsSummary", () => {
  it("computes totalShowcaseInteractions as upCount + downCount", async () => {
    const db = makeDb({ showcaseProjects: [{ upCount: 10, downCount: 3 }] });
    const summary = await computeAnalyticsSummary(db);
    expect(summary.totalShowcaseInteractions).toBe(13);
  });

  it("computes teamsAsPercentOfMembers correctly", async () => {
    const db = makeDb({
      users: [{ createdAt: null }, { createdAt: null }, { createdAt: null }, { createdAt: null }],
      hackathonTeams: [{}],
    });
    const summary = await computeAnalyticsSummary(db);
    expect(summary.hackathonStats.teamsAsPercentOfMembers).toBe(25);
  });

  it("returns 0% teamsAsPercentOfMembers when no members", async () => {
    const db = makeDb({ users: [], hackathonTeams: [{}] });
    const summary = await computeAnalyticsSummary(db);
    expect(summary.hackathonStats.teamsAsPercentOfMembers).toBe(0);
  });

  it("normalizes and deduplicates skills", async () => {
    const db = makeDb({
      pair_profiles: [
        { skillsCanTeach: ["TypeScript", "  typescript  "], skillsWantToLearn: ["TYPESCRIPT"] },
      ],
    });
    const summary = await computeAnalyticsSummary(db);
    const tsSkill = summary.skillDistribution.find((s) => s.skill === "typescript");
    expect(tsSkill).toBeDefined();
    expect(tsSkill!.count).toBe(3);
  });

  it("counts community posts and replies separately", async () => {
    const now = new Date();
    const recentDate = { toDate: () => new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000) };

    const db = makeDb({
      communityMessages: [
        { createdAt: recentDate, userId: "u1" },
        { createdAt: recentDate, userId: "u1", parentId: "msg1" },
        { createdAt: recentDate, userId: "u2", parentId: "msg1" },
      ],
    });
    const summary = await computeAnalyticsSummary(db);
    const totalPosts = summary.communityActivity.reduce((s, w) => s + w.posts, 0);
    const totalReplies = summary.communityActivity.reduce((s, w) => s + w.replies, 0);
    expect(totalPosts).toBe(1);
    expect(totalReplies).toBe(2);
  });

  it("computes returning members correctly", async () => {
    const now = new Date();
    const recent = { toDate: () => new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000) };
    const old = { toDate: () => new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000) };

    const db = makeDb({
      eventRegistrations: [
        { eventId: "e1", userId: "u1", registeredAt: recent },
        { eventId: "e2", userId: "u1", registeredAt: old },
        { eventId: "e3", userId: "u2", registeredAt: recent },
      ],
      communityMessages: [],
    });
    const summary = await computeAnalyticsSummary(db);
    expect(summary.platformHealth.returningMembers).toBe(1);
    expect(summary.platformHealth.activeThisMonth).toBe(2);
  });

  it("derives totalShowcaseProjects from static JSON, not Firestore", async () => {
    const db = makeDb({ showcaseProjects: [{ upCount: 0, downCount: 0 }] });
    const summary = await computeAnalyticsSummary(db);
    expect(summary.totalShowcaseProjects).toBe(2);
  });

  it("buckets community activity by Monday UTC week boundaries", async () => {
    const mon = { toDate: () => new Date("2025-01-06T10:00:00Z") };
    const tue = { toDate: () => new Date("2025-01-07T10:00:00Z") };
    const nextMon = { toDate: () => new Date("2025-01-13T10:00:00Z") };

    const db = makeDb({
      communityMessages: [
        { createdAt: mon, userId: "u1" },
        { createdAt: tue, userId: "u2" },
        { createdAt: nextMon, userId: "u3" },
      ],
    });
    const summary = await computeAnalyticsSummary(db);
    const weeks = summary.communityActivity.map((w) => w.week);
    expect(weeks).toContain("2025-01-06");
    expect(weeks).toContain("2025-01-13");
    const weekJan6 = summary.communityActivity.find((w) => w.week === "2025-01-06");
    expect(weekJan6!.posts).toBe(2);
    expect(weekJan6!.replies).toBe(0);
  });

  it("returns all required fields in the summary", async () => {
    const db = makeDb();
    const body = await computeAnalyticsSummary(db);
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
