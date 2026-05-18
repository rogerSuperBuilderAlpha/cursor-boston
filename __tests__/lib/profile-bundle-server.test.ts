/**
 * @jest-environment node
 */
const mockGetBaseInput = jest.fn();
const mockBuildStatus = jest.fn();

jest.mock("@/lib/badges/getBadgeEligibilityInput", () => ({
  getBaseBadgeEligibilityInput: (...a: unknown[]) => mockGetBaseInput(...a),
  buildBadgeDataStatus: (...a: unknown[]) => mockBuildStatus(...a),
}));

import { fetchProfileDataBundleJson } from "@/lib/profile-bundle-server";

function tsLike(iso: string) {
  return { toDate: () => new Date(iso) };
}

type DocSnap = { id: string; data: () => Record<string, unknown> };
function makeDoc(id: string, data: Record<string, unknown>): DocSnap {
  return { id, data: () => data };
}

function buildDb(opts: {
  user?: { exists: boolean; data?: Record<string, unknown> };
  registrations?: DocSnap[];
  talks?: DocSnap[];
  mergedPrs?: DocSnap[];
  showcase?: DocSnap[];
  messages?: DocSnap[];
  teams?: DocSnap[];
  pool?: DocSnap[];
  userBadges?: DocSnap[];
}) {
  const userGet = jest.fn().mockResolvedValue({
    exists: opts.user?.exists ?? true,
    data: () => opts.user?.data ?? {},
  });
  const userRef = { get: userGet };

  function chain(docs: DocSnap[]) {
    const get = jest
      .fn()
      .mockResolvedValue({ docs, size: docs.length, empty: docs.length === 0 });
    return {
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get,
    };
  }

  const collection = jest.fn((name: string) => {
    switch (name) {
      case "users":
        return { doc: () => userRef };
      case "eventRegistrations":
        return chain(opts.registrations ?? []);
      case "talkSubmissions":
        return chain(opts.talks ?? []);
      case "pullRequests":
        return chain(opts.mergedPrs ?? []);
      case "showcaseSubmissions":
        return chain(opts.showcase ?? []);
      case "communityMessages":
        return chain(opts.messages ?? []);
      case "hackathonTeams":
        return chain(opts.teams ?? []);
      case "hackathonPool":
        return chain(opts.pool ?? []);
      case "user_badges":
        return chain(opts.userBadges ?? []);
      default:
        throw new Error(`unexpected collection: ${name}`);
    }
  });
  return { db: { collection } as unknown as Parameters<typeof fetchProfileDataBundleJson>[0] };
}

describe("lib/profile-bundle-server", () => {
  beforeEach(() => {
    mockGetBaseInput.mockReset();
    mockBuildStatus.mockReset();
    mockGetBaseInput.mockImplementation((input: Record<string, unknown>) => ({
      ...input,
      __base: true,
    }));
    mockBuildStatus.mockImplementation((s: Record<string, string>) => ({
      __status: true,
      sources: s,
    }));
  });

  it("returns a zero-shaped bundle for a non-existent user with no related docs", async () => {
    const { db } = buildDb({
      user: { exists: false },
    });
    const out = await fetchProfileDataBundleJson(db, "uX");
    expect(out.stats).toEqual({
      eventsRegistered: 0,
      eventsAttended: 0,
      talksSubmitted: 0,
      talksGiven: 0,
      pullRequestsCount: 0,
    });
    expect(out.registrations).toEqual([]);
    expect(out.talks).toEqual([]);
    expect(out.userBadgeMap).toEqual({});
    expect(mockGetBaseInput).toHaveBeenCalledWith({
      displayName: null,
      visibility: null,
      bio: null,
      photoURL: null,
      discord: undefined,
      github: undefined,
    });
  });

  it("passes user profile fields into getBaseBadgeEligibilityInput", async () => {
    const { db } = buildDb({
      user: {
        exists: true,
        data: {
          displayName: "Alice",
          visibility: { isPublic: true },
          bio: "hi",
          photoURL: "https://x/a.png",
          discord: { id: "d1" },
          github: { login: "alice" },
        },
      },
    });
    await fetchProfileDataBundleJson(db, "u1");
    expect(mockGetBaseInput).toHaveBeenCalledWith({
      displayName: "Alice",
      visibility: { isPublic: true },
      bio: "hi",
      photoURL: "https://x/a.png",
      discord: { id: "d1" },
      github: { login: "alice" },
    });
  });

  it("maps registrations and computes registered/attended counts", async () => {
    const { db } = buildDb({
      registrations: [
        makeDoc("r1", {
          eventId: "e1",
          eventTitle: "E1",
          userId: "u1",
          userEmail: "u@x.com",
          status: "attended",
          registeredAt: tsLike("2026-05-01T00:00:00.000Z"),
          source: "luma",
        }),
        makeDoc("r2", {
          eventId: "e2",
          eventTitle: "E2",
          userId: "u1",
          userEmail: "u@x.com",
          status: "registered",
          createdAt: tsLike("2026-05-02T00:00:00.000Z"),
          source: "form",
        }),
      ],
    });
    const out = await fetchProfileDataBundleJson(db, "u1");
    expect(out.stats.eventsRegistered).toBe(2);
    expect(out.stats.eventsAttended).toBe(1);
    expect(out.registrations[0]?.registeredAt).toBe("2026-05-01T00:00:00.000Z");
    // r2 uses createdAt fallback when registeredAt is missing
    expect(out.registrations[1]?.registeredAt).toBe("2026-05-02T00:00:00.000Z");
  });

  it("uses doc.id when registration data.id is missing", async () => {
    const { db } = buildDb({
      registrations: [
        makeDoc("doc-r1", {
          eventId: "e",
          eventTitle: "E",
          userId: "u",
          userEmail: "u@x",
        }),
      ],
    });
    const out = await fetchProfileDataBundleJson(db, "u1");
    expect(out.registrations[0]?.id).toBe("doc-r1");
  });

  it("counts talksSubmitted/talksGiven and maps talks with status='completed'", async () => {
    const { db } = buildDb({
      talks: [
        makeDoc("t1", {
          title: "T1",
          status: "completed",
          submittedAt: tsLike("2026-04-01T00:00:00.000Z"),
        }),
        makeDoc("t2", { title: "T2", status: "submitted" }),
        makeDoc("t3", { status: "completed" }),
      ],
    });
    const out = await fetchProfileDataBundleJson(db, "u1");
    expect(out.stats.talksSubmitted).toBe(3);
    expect(out.stats.talksGiven).toBe(2);
    expect(out.talks[0]).toEqual({
      id: "t1",
      title: "T1",
      status: "completed",
      submittedAt: "2026-04-01T00:00:00.000Z",
    });
    // talk 3 has no title → falls back to ""
    expect(out.talks[2]?.title).toBe("");
  });

  it("counts mergedPrSnap → stats.pullRequestsCount", async () => {
    const { db } = buildDb({
      mergedPrs: [makeDoc("p1", {}), makeDoc("p2", {}), makeDoc("p3", {})],
    });
    const out = await fetchProfileDataBundleJson(db, "u1");
    expect(out.stats.pullRequestsCount).toBe(3);
  });

  it("filters showcase submissions to status='approved' for badge input", async () => {
    const baseInput: Record<string, unknown> = {};
    mockGetBaseInput.mockReturnValueOnce(baseInput);
    const { db } = buildDb({
      showcase: [
        makeDoc("s1", { status: "approved" }),
        makeDoc("s2", { status: "pending" }),
        makeDoc("s3", { status: "approved" }),
      ],
    });
    await fetchProfileDataBundleJson(db, "u1");
    expect(baseInput.showcaseSubmissionsCount).toBe(2);
  });

  it("counts communityMessagesCount + filters posts (no parentId)", async () => {
    const baseInput: Record<string, unknown> = {};
    mockGetBaseInput.mockReturnValueOnce(baseInput);
    const { db } = buildDb({
      messages: [
        makeDoc("m1", { parentId: null }),
        makeDoc("m2", { parentId: "p" }),
        makeDoc("m3", { parentId: null }),
      ],
    });
    await fetchProfileDataBundleJson(db, "u1");
    expect(baseInput.communityMessagesCount).toBe(3);
    expect(baseInput.communityPostsCount).toBe(2);
  });

  it("hackathonParticipationCount = max(teamsSnap.size, poolSnap.size)", async () => {
    const baseInput: Record<string, unknown> = {};
    mockGetBaseInput.mockReturnValueOnce(baseInput);
    const { db } = buildDb({
      teams: [makeDoc("t1", {}), makeDoc("t2", {})],
      pool: [makeDoc("p1", {}), makeDoc("p2", {}), makeDoc("p3", {})],
    });
    await fetchProfileDataBundleJson(db, "u1");
    expect(baseInput.hackathonParticipationCount).toBe(3);
  });

  it("parses trusted user_badges into userBadgeMap keyed by badgeId", async () => {
    const { db } = buildDb({
      userBadges: [
        makeDoc("ub-1", {
          id: "ub-1",
          userId: "u1",
          badgeId: "registered",
          awardSource: "system",
          awardedAt: "2026-05-01T00:00:00.000Z",
          awardedBy: "admin",
        }),
        makeDoc("ub-2", {
          id: "ub-2",
          userId: "u1",
          badgeId: "displayName",
          awardSource: "manual",
          awardedAt: tsLike("2026-05-02T00:00:00.000Z"),
        }),
      ],
    });
    const out = await fetchProfileDataBundleJson(db, "u1");
    expect(out.userBadgeMap.registered).toMatchObject({
      id: "ub-1",
      userId: "u1",
      badgeId: "registered",
      awardSource: "system",
      awardedAt: "2026-05-01T00:00:00.000Z",
      awardedBy: "admin",
    });
    expect(out.userBadgeMap.displayName?.awardedAt).toBe(
      "2026-05-02T00:00:00.000Z",
    );
  });

  it("parses user_badges with Timestamp-with-seconds awardedAt", async () => {
    const { db } = buildDb({
      userBadges: [
        makeDoc("ub-3", {
          userId: "u1",
          badgeId: "bio",
          awardSource: "migration",
          awardedAt: { seconds: 1717000000 },
        }),
      ],
    });
    const out = await fetchProfileDataBundleJson(db, "u1");
    expect(out.userBadgeMap.bio?.awardedAt).toBe(
      new Date(1717000000 * 1000).toISOString(),
    );
  });

  it("drops untrusted-source badges from userBadgeMap", async () => {
    const { db } = buildDb({
      userBadges: [
        makeDoc("ub-1", {
          userId: "u1",
          badgeId: "registered",
          awardSource: "self-claim",
          awardedAt: "2026-05-01T00:00:00.000Z",
        }),
      ],
    });
    const out = await fetchProfileDataBundleJson(db, "u1");
    expect(out.userBadgeMap).toEqual({});
  });

  it("drops badges missing required fields (userId / badgeId / awardSource / awardedAt)", async () => {
    const { db } = buildDb({
      userBadges: [
        makeDoc("ub-1", {
          badgeId: "registered",
          awardSource: "system",
          awardedAt: "2026-05-01T00:00:00.000Z",
        }), // missing userId
        makeDoc("ub-2", {
          userId: "u1",
          awardSource: "system",
          awardedAt: "2026-05-01T00:00:00.000Z",
        }), // missing badgeId
        makeDoc("ub-3", {
          userId: "u1",
          badgeId: "registered",
          awardSource: "system",
        }), // missing awardedAt
        makeDoc("ub-4", {
          userId: "u1",
          badgeId: "registered",
          awardedAt: "2026-05-01T00:00:00.000Z",
        }), // missing awardSource
      ],
    });
    const out = await fetchProfileDataBundleJson(db, "u1");
    expect(out.userBadgeMap).toEqual({});
  });

  it("uses badge doc.id when data.id is missing", async () => {
    const { db } = buildDb({
      userBadges: [
        makeDoc("doc-id-only", {
          userId: "u1",
          badgeId: "registered",
          awardSource: "system",
          awardedAt: "2026-05-01T00:00:00.000Z",
        }),
      ],
    });
    const out = await fetchProfileDataBundleJson(db, "u1");
    expect(out.userBadgeMap.registered?.id).toBe("doc-id-only");
  });

  it("calls buildBadgeDataStatus with all five source states set to 'ok' on happy path", async () => {
    const { db } = buildDb({});
    await fetchProfileDataBundleJson(db, "u1");
    expect(mockBuildStatus).toHaveBeenCalledTimes(1);
    expect(mockBuildStatus.mock.calls[0][0]).toEqual({
      stats: "ok",
      showcaseSubmissions: "ok",
      communityMessages: "ok",
      pullRequests: "ok",
      hackathonParticipation: "ok",
    });
  });
});
