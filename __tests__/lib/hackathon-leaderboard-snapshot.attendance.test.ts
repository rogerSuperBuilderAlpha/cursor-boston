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
        makeSignupDoc("u1", { attendingConfirmedAt: new Date("2026-05-20") }),
        makeSignupDoc("u2"), // claimed, not confirmed
        makeSignupDoc("u3", { attendingConfirmedAt: new Date("2026-05-21") }),
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
        }),
        makeSignupDoc("second", {
          signedUpAt: new Date("2026-05-11"),
          attendingConfirmedAt: new Date("2026-05-20"), // confirmed FIRST
        }),
        makeSignupDoc("third", {
          signedUpAt: new Date("2026-05-12"),
          attendingConfirmedAt: new Date("2026-05-21"), // confirmed MIDDLE
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
        }),
        makeSignupDoc("not-confirmed"),
        makeSignupDoc("confirmed-2", {
          attendingConfirmedAt: new Date("2026-05-21"),
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
