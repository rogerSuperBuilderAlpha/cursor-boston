/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * @jest-environment node
 *
 * Coverage for the second-step "Confirm attendance" fields on the leaderboard
 * snapshot: attendingConfirmed / attendingConfirmedAt / attendanceRank per
 * entry plus confirmedAttendeeCount / attendanceLimit at the payload level.
 *
 * The legacy confirmedAt / status / creditEligible paths are untouched — see
 * hackathon-leaderboard-snapshot.test.ts for the regression suite.
 */

import { buildLeaderboardPayload } from "@/lib/hackathon-leaderboard-snapshot";
import { getAdminDb } from "@/lib/firebase-admin";

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(),
}));

jest.mock("@/lib/github-merged-pr-count", () => ({
  fetchMergedPrCountsForLogins: jest.fn(async () => new Map()),
}));

jest.mock("@/lib/github-recent-merged-prs", () => ({
  getGithubRepoPair: jest.fn(() => ({ owner: "test", repo: "repo" })),
}));

jest.mock("@/lib/sports-hack-2026-submission-prs", () => ({
  fetchSportsHack2026SubmissionAuthors: jest.fn(async () => new Set<string>()),
  SPORTS_HACK_2026_SUBMISSION_AUTHORS_CACHE_TAG:
    "sports-hack-2026-submission-authors",
}));

jest.mock("@/lib/summer-cohort", () => ({
  SUMMER_COHORT_COLLECTION: "summer_cohort_applications",
}));

const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;

const SPORTS = "sports-hack-2026";
const OTHER = "hack-a-sprint-2026";

function makeSignupDoc(
  userId: string,
  data: Record<string, unknown> = {}
): { id: string; data: () => Record<string, unknown> } {
  return {
    id: `${SPORTS}__${userId}`,
    data: () => ({
      userId,
      eventId: SPORTS,
      signedUpAt: new Date("2026-05-15"),
      ...data,
    }),
  };
}

function makeUserDoc(
  userId: string,
  data: Record<string, unknown> = {}
): { exists: true; id: string; data: () => Record<string, unknown> } {
  return {
    exists: true,
    id: userId,
    data: () => ({
      displayName: `User ${userId}`,
      email: `${userId}@test.com`,
      ...data,
    }),
  };
}

function installDbMock(opts: {
  signups: Array<{ id: string; data: () => Record<string, unknown> }>;
  users: Array<{ exists: true; id: string; data: () => Record<string, unknown> }>;
}) {
  const signupsCol = {
    where: jest.fn().mockReturnThis(),
    get: jest.fn(async () => ({ docs: opts.signups })),
  };
  const lumaCol = {
    where: jest.fn().mockReturnThis(),
    get: jest.fn(async () => ({ docs: [] })),
  };
  const prCol = {
    where: jest.fn().mockReturnThis(),
    get: jest.fn(async () => ({ docs: [] })),
  };
  const cohortAppsCol = {
    get: jest.fn(async () => ({ docs: [] })),
  };
  const usersCol = {
    doc: jest.fn((id: string) =>
      opts.users.find((u) => u.id === id) ?? { exists: false, id, data: () => ({}) }
    ),
  };
  mockGetAdminDb.mockReturnValue({
    collection: jest.fn((name: string) => {
      if (name === "hackathonEventSignups") return signupsCol;
      if (name === "hackathonLumaRegistrants") return lumaCol;
      if (name === "pullRequests") return prCol;
      if (name === "users") return usersCol;
      if (name === "summer_cohort_applications") return cohortAppsCol;
      return { where: jest.fn().mockReturnThis(), get: jest.fn(async () => ({ docs: [] })) };
    }),
    getAll: jest.fn(async (...refs: { id: string }[]) =>
      refs.map((r) => opts.users.find((u) => u.id === r.id) ?? { exists: false, id: r.id, data: () => ({}) })
    ),
  } as never);
}

describe("buildLeaderboardPayload — attendance-confirmation fields", () => {
  beforeEach(() => jest.clearAllMocks());

  it("emits attendanceLimit = 200 for sports-hack-2026, 0 for other events", async () => {
    installDbMock({ signups: [], users: [] });
    const sports = await buildLeaderboardPayload(SPORTS);
    expect(sports.attendanceLimit).toBe(200);
    expect(sports.confirmedAttendeeCount).toBe(0);

    installDbMock({ signups: [], users: [] });
    const hackASprint = await buildLeaderboardPayload(OTHER);
    expect(hackASprint.attendanceLimit).toBe(0);
    expect(hackASprint.confirmedAttendeeCount).toBe(0);
  });

  it("counts only entries with attendingConfirmedAt toward confirmedAttendeeCount", async () => {
    installDbMock({
      signups: [
        // attendingConfirmedBy="user" → Tier A under the three-tier model used
        // by sports-hack-2026. Without it, the row is Tier B and does NOT
        // contribute to confirmedAttendeeCount or attendanceRank.
        makeSignupDoc("u1", {
          attendingConfirmedAt: new Date("2026-05-20"),
          attendingConfirmedBy: "user",
        }),
        makeSignupDoc("u2"), // claimed, not confirmed
        makeSignupDoc("u3", {
          attendingConfirmedAt: new Date("2026-05-21"),
          attendingConfirmedBy: "user",
        }),
      ],
      users: [makeUserDoc("u1"), makeUserDoc("u2"), makeUserDoc("u3")],
    });
    const payload = await buildLeaderboardPayload(SPORTS);

    expect(payload.confirmedAttendeeCount).toBe(2);
    const u1 = payload.entries.find((e) => e.userId === "u1")!;
    const u2 = payload.entries.find((e) => e.userId === "u2")!;
    const u3 = payload.entries.find((e) => e.userId === "u3")!;
    expect(u1.attendingConfirmed).toBe(true);
    expect(u1.attendingConfirmedAt).not.toBeNull();
    expect(u2.attendingConfirmed).toBe(false);
    expect(u2.attendingConfirmedAt).toBeNull();
    expect(u3.attendingConfirmed).toBe(true);
  });

  it("preserves existing rank order in attendanceRank (does NOT re-sort by confirm time)", async () => {
    // Signed up in this order, with confirm times in REVERSE order. The
    // existing leaderboard sorts by mergedPrCount desc, then signedUpAt asc.
    // Without PRs, ordering is by signedUpAt. We test that attendanceRank
    // tracks rank order, NOT the order users clicked Confirm.
    installDbMock({
      signups: [
        makeSignupDoc("first", {
          signedUpAt: new Date("2026-05-10"),
          attendingConfirmedAt: new Date("2026-05-22"), // confirmed LAST
          attendingConfirmedBy: "user",
        }),
        makeSignupDoc("second", {
          signedUpAt: new Date("2026-05-11"),
          attendingConfirmedAt: new Date("2026-05-20"), // confirmed FIRST
          attendingConfirmedBy: "user",
        }),
        makeSignupDoc("third", {
          signedUpAt: new Date("2026-05-12"),
          attendingConfirmedAt: new Date("2026-05-21"), // confirmed MIDDLE
          attendingConfirmedBy: "user",
        }),
      ],
      users: [
        makeUserDoc("first"),
        makeUserDoc("second"),
        makeUserDoc("third"),
      ],
    });
    const payload = await buildLeaderboardPayload(SPORTS);

    const first = payload.entries.find((e) => e.userId === "first")!;
    const second = payload.entries.find((e) => e.userId === "second")!;
    const third = payload.entries.find((e) => e.userId === "third")!;
    // Rank by existing leaderboard order (earliest signup wins, no PRs):
    expect(first.rank).toBe(1);
    expect(second.rank).toBe(2);
    expect(third.rank).toBe(3);
    // attendanceRank should mirror that — NOT the confirm-time order:
    expect(first.attendanceRank).toBe(1);
    expect(second.attendanceRank).toBe(2);
    expect(third.attendanceRank).toBe(3);
  });

  it("skips attendanceRank for entries that have not confirmed", async () => {
    installDbMock({
      signups: [
        makeSignupDoc("confirmed-1", {
          attendingConfirmedAt: new Date("2026-05-20"),
          attendingConfirmedBy: "user",
        }),
        makeSignupDoc("not-confirmed"),
        makeSignupDoc("confirmed-2", {
          attendingConfirmedAt: new Date("2026-05-21"),
          attendingConfirmedBy: "user",
          signedUpAt: new Date("2026-05-16"),
        }),
      ],
      users: [
        makeUserDoc("confirmed-1"),
        makeUserDoc("not-confirmed"),
        makeUserDoc("confirmed-2"),
      ],
    });
    const payload = await buildLeaderboardPayload(SPORTS);

    const c1 = payload.entries.find((e) => e.userId === "confirmed-1")!;
    const nc = payload.entries.find((e) => e.userId === "not-confirmed")!;
    const c2 = payload.entries.find((e) => e.userId === "confirmed-2")!;

    expect(c1.attendanceRank).toBe(1); // first confirmed entry in rank order
    expect(nc.attendanceRank).toBeNull();
    expect(c2.attendanceRank).toBe(2); // second confirmed entry
    expect(payload.confirmedAttendeeCount).toBe(2);
  });

  it("emits inert attendance fields for events without the flow (attendanceLimit=0)", async () => {
    installDbMock({
      signups: [
        // Even with attendingConfirmedAt set, an event with attendanceLimit=0
        // should not surface it on entries — the field is gated by feature.
        {
          id: `${OTHER}__u1`,
          data: () => ({
            userId: "u1",
            eventId: OTHER,
            signedUpAt: new Date("2026-05-10"),
            attendingConfirmedAt: new Date("2026-05-20"),
          }),
        },
      ],
      users: [makeUserDoc("u1")],
    });
    const payload = await buildLeaderboardPayload(OTHER);

    const u1 = payload.entries.find((e) => e.userId === "u1")!;
    expect(payload.attendanceLimit).toBe(0);
    expect(payload.confirmedAttendeeCount).toBe(0);
    expect(u1.attendingConfirmed).toBe(false);
    expect(u1.attendingConfirmedAt).toBeNull();
    expect(u1.attendanceRank).toBeNull();
  });
});

describe("buildLeaderboardPayload — three-tier ranking (sports-hack-2026)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("orders Tier A > Tier B > Tier C even when PR counts would invert the order", async () => {
    // tier-a-zero has 0 PRs but is user-confirmed (Tier A).
    // tier-b-fifty has 50 PRs but only claimed (Tier B).
    // Under the new model Tier A always outranks Tier B regardless of PR count.
    installDbMock({
      signups: [
        makeSignupDoc("tier-a-zero", {
          signedUpAt: new Date("2026-05-15"),
          attendingConfirmedAt: new Date("2026-05-20"),
          attendingConfirmedBy: "user",
        }),
        makeSignupDoc("tier-b-fifty", {
          signedUpAt: new Date("2026-05-10"),
        }),
      ],
      users: [makeUserDoc("tier-a-zero"), makeUserDoc("tier-b-fifty")],
    });
    // Override the PR-count mock so tier-b-fifty has 50 merged PRs.
    const ghMod = jest.requireMock("@/lib/github-merged-pr-count");
    ghMod.fetchMergedPrCountsForLogins = jest.fn(async () => new Map());
    // Inject Firestore PR counts via the per-user fallback (countMergedCommunityPrsByUserIds
    // reads from `pullRequests`). Easier to override the GitHub map directly by
    // setting githubLogin on the users.
    const usersWithGh = [
      {
        exists: true as const,
        id: "tier-a-zero",
        data: () => ({
          displayName: "tier-a-zero",
          email: "tier-a-zero@test.com",
          github: { login: "tier-a-zero" },
        }),
      },
      {
        exists: true as const,
        id: "tier-b-fifty",
        data: () => ({
          displayName: "tier-b-fifty",
          email: "tier-b-fifty@test.com",
          github: { login: "tier-b-fifty" },
        }),
      },
    ];
    installDbMock({
      signups: [
        {
          id: `${SPORTS}__tier-a-zero`,
          data: () => ({
            userId: "tier-a-zero",
            eventId: SPORTS,
            signedUpAt: new Date("2026-05-15"),
            attendingConfirmedAt: new Date("2026-05-20"),
            attendingConfirmedBy: "user",
          }),
        },
        {
          id: `${SPORTS}__tier-b-fifty`,
          data: () => ({
            userId: "tier-b-fifty",
            eventId: SPORTS,
            signedUpAt: new Date("2026-05-10"),
          }),
        },
      ],
      users: usersWithGh,
    });
    ghMod.fetchMergedPrCountsForLogins = jest.fn(async () =>
      new Map<string, number>([["tier-b-fifty", 50]])
    );

    const payload = await buildLeaderboardPayload(SPORTS);

    const a = payload.entries.find((e) => e.userId === "tier-a-zero")!;
    const b = payload.entries.find((e) => e.userId === "tier-b-fifty")!;
    expect(a.tier).toBe("A");
    expect(b.tier).toBe("B");
    expect(a.rank).toBe(1);
    expect(b.rank).toBe(2);
    // Both inside the credit cap (119) and attendance cap (200) at small N.
    expect(a.inCreditBand).toBe(true);
    expect(a.inAttendanceBand).toBe(true);
    expect(b.inCreditBand).toBe(true);
    expect(b.inAttendanceBand).toBe(true);
    // hasSubmission defaults false until PR 2 wires the GitHub lookup.
    expect(a.hasSubmission).toBe(false);
    expect(a.creditEligible).toBe(false); // gated on hasSubmission
  });

  it("admin-only attendingConfirmedBy keeps the row in Tier B (not Tier A)", async () => {
    installDbMock({
      signups: [
        makeSignupDoc("user-confirmed", {
          attendingConfirmedAt: new Date("2026-05-20"),
          attendingConfirmedBy: "user",
        }),
        makeSignupDoc("admin-checked-in", {
          attendingConfirmedAt: new Date("2026-05-26"),
          attendingConfirmedBy: "admin",
        }),
      ],
      users: [makeUserDoc("user-confirmed"), makeUserDoc("admin-checked-in")],
    });
    const payload = await buildLeaderboardPayload(SPORTS);

    const u = payload.entries.find((e) => e.userId === "user-confirmed")!;
    const a = payload.entries.find((e) => e.userId === "admin-checked-in")!;
    expect(u.tier).toBe("A");
    expect(a.tier).toBe("B");
    // confirmedAttendeeCount tracks Tier A only — the public "X/200" is the
    // pre-event headcount goal, not door check-in throughput.
    expect(payload.confirmedAttendeeCount).toBe(1);
    expect(u.attendanceRank).toBe(1);
    expect(a.attendanceRank).toBeNull();
    // But the row IS still flagged attendingConfirmed (attendingConfirmedAt is
    // set) for downstream consumers that want to know "did this person get
    // confirmed somehow" without caring about tier.
    expect(a.attendingConfirmed).toBe(true);
  });

  it("sets hasSubmission for github logins in the submission-authors set", async () => {
    const subsMod = jest.requireMock("@/lib/sports-hack-2026-submission-prs");
    subsMod.fetchSportsHack2026SubmissionAuthors = jest.fn(
      async () => new Set<string>(["submitter"])
    );
    installDbMock({
      signups: [
        makeSignupDoc("submitter", {
          attendingConfirmedAt: new Date("2026-05-20"),
          attendingConfirmedBy: "user",
        }),
        makeSignupDoc("non-submitter", {
          attendingConfirmedAt: new Date("2026-05-21"),
          attendingConfirmedBy: "user",
        }),
      ],
      users: [
        {
          exists: true,
          id: "submitter",
          data: () => ({
            displayName: "submitter",
            email: "submitter@test.com",
            github: { login: "submitter" },
          }),
        },
        {
          exists: true,
          id: "non-submitter",
          data: () => ({
            displayName: "non-submitter",
            email: "non-submitter@test.com",
            github: { login: "non-submitter" },
          }),
        },
      ],
    });

    const payload = await buildLeaderboardPayload(SPORTS);
    const s = payload.entries.find((e) => e.userId === "submitter")!;
    const n = payload.entries.find((e) => e.userId === "non-submitter")!;
    expect(s.hasSubmission).toBe(true);
    expect(n.hasSubmission).toBe(false);
    // Credit eligibility = inCreditBand && hasSubmission. Both are Tier A and
    // inside the cap at small N, so only the submitter is credit-eligible.
    expect(s.creditEligible).toBe(true);
    expect(n.creditEligible).toBe(false);
  });

  it("freeze-model events ignore the three-tier fields", async () => {
    installDbMock({
      signups: [
        {
          id: `${OTHER}__u1`,
          data: () => ({
            userId: "u1",
            eventId: OTHER,
            signedUpAt: new Date("2026-05-10"),
            attendingConfirmedAt: new Date("2026-05-20"),
            attendingConfirmedBy: "user",
          }),
        },
      ],
      users: [makeUserDoc("u1")],
    });
    const payload = await buildLeaderboardPayload(OTHER);

    const u1 = payload.entries.find((e) => e.userId === "u1")!;
    // tier is null on freeze-model events; bands default false.
    expect(u1.tier).toBeNull();
    expect(u1.inAttendanceBand).toBe(false);
    expect(u1.inCreditBand).toBe(false);
  });
});
