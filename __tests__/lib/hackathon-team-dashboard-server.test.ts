/**
 * @jest-environment node
 */
jest.mock("firebase-admin/firestore", () => ({
  FieldPath: {
    documentId: () => "__name__",
  },
}));

import { loadHackathonTeamDashboard } from "@/lib/hackathon-team-dashboard-server";

type DocSnap = { id: string; data: () => Record<string, unknown> };

function makeDoc(id: string, data: Record<string, unknown>): DocSnap {
  return { id, data: () => data };
}

function tsLike(iso: string) {
  return { toDate: () => new Date(iso) };
}

function buildFakeDb(opts: {
  myTeams?: DocSnap[];
  invites?: DocSnap[];
  users?: DocSnap[];
  submissions?: DocSnap[];
  joinRequests?: DocSnap[];
}) {
  const teamsGet = jest.fn().mockResolvedValue({ docs: opts.myTeams ?? [] });
  const invitesGet = jest.fn().mockResolvedValue({ docs: opts.invites ?? [] });
  const usersGet = jest.fn().mockResolvedValue({ docs: opts.users ?? [] });
  const subGet = jest.fn().mockResolvedValue({ docs: opts.submissions ?? [] });
  const reqGet = jest.fn().mockResolvedValue({ docs: opts.joinRequests ?? [] });

  const teamsChain = {
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    get: teamsGet,
  };
  const invitesChain = {
    where: jest.fn().mockReturnThis(),
    get: invitesGet,
  };
  const usersChain = {
    where: jest.fn().mockReturnThis(),
    get: usersGet,
  };
  const subChain = {
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    get: subGet,
  };
  const reqChain = {
    where: jest.fn().mockReturnThis(),
    get: reqGet,
  };

  const collection = jest.fn((name: string) => {
    switch (name) {
      case "hackathonTeams":
        return teamsChain;
      case "hackathonInvites":
        return invitesChain;
      case "users":
        return usersChain;
      case "hackathonSubmissions":
        return subChain;
      case "hackathonJoinRequests":
        return reqChain;
      default:
        throw new Error(`unexpected: ${name}`);
    }
  });

  return {
    db: { collection } as unknown as Parameters<typeof loadHackathonTeamDashboard>[0],
    spies: { teamsChain, invitesChain, usersChain, subChain, reqChain },
  };
}

describe("lib/hackathon-team-dashboard-server", () => {
  it("returns empty dashboard when user is on no team", async () => {
    const { db } = buildFakeDb({});
    const out = await loadHackathonTeamDashboard(db, "alice", "h1");
    expect(out).toEqual({
      myTeam: null,
      memberProfiles: {},
      submission: null,
      myInvites: [],
      requestsToMyTeam: [],
    });
  });

  it("queries hackathonTeams scoped to this hackathon AND member uid", async () => {
    const { db, spies } = buildFakeDb({});
    await loadHackathonTeamDashboard(db, "alice", "hack-x");
    expect(spies.teamsChain.where).toHaveBeenCalledWith("hackathonId", "==", "hack-x");
    expect(spies.teamsChain.where).toHaveBeenCalledWith(
      "memberIds",
      "array-contains",
      "alice",
    );
    expect(spies.teamsChain.limit).toHaveBeenCalledWith(1);
  });

  it("maps myTeam doc into PoolDashboardTeam (Timestamp → ISO)", async () => {
    const { db } = buildFakeDb({
      myTeams: [
        makeDoc("team-x", {
          hackathonId: "h1",
          memberIds: ["alice"],
          name: "Team X",
          logoUrl: "https://x/l.png",
          wins: 3,
          createdBy: "alice",
          createdAt: tsLike("2026-05-01T00:00:00.000Z"),
        }),
      ],
    });
    const out = await loadHackathonTeamDashboard(db, "alice", "h1");
    expect(out.myTeam).toEqual({
      id: "team-x",
      hackathonId: "h1",
      memberIds: ["alice"],
      name: "Team X",
      logoUrl: "https://x/l.png",
      wins: 3,
      createdBy: "alice",
      createdAt: "2026-05-01T00:00:00.000Z",
    });
  });

  it("maps pending invites with optional expiresAt (Timestamp or omitted)", async () => {
    const { db } = buildFakeDb({
      invites: [
        makeDoc("inv-1", {
          fromUserId: "bob",
          toUserId: "alice",
          teamId: "team-x",
          status: "pending",
          createdAt: tsLike("2026-05-01T10:00:00.000Z"),
          expiresAt: tsLike("2026-05-10T10:00:00.000Z"),
        }),
        makeDoc("inv-2", {
          fromUserId: "carol",
          toUserId: "alice",
          teamId: "team-y",
          status: "pending",
          createdAt: tsLike("2026-05-02T10:00:00.000Z"),
        }),
      ],
    });
    const out = await loadHackathonTeamDashboard(db, "alice", "h1");
    expect(out.myInvites).toEqual([
      {
        id: "inv-1",
        fromUserId: "bob",
        toUserId: "alice",
        teamId: "team-x",
        status: "pending",
        createdAt: "2026-05-01T10:00:00.000Z",
        expiresAt: "2026-05-10T10:00:00.000Z",
      },
      {
        id: "inv-2",
        fromUserId: "carol",
        toUserId: "alice",
        teamId: "team-y",
        status: "pending",
        createdAt: "2026-05-02T10:00:00.000Z",
        expiresAt: undefined,
      },
    ]);
  });

  it("hydrates member profiles in chunks of 10", async () => {
    const memberIds = Array.from({ length: 17 }, (_, i) => `u${i}`);
    const { db, spies } = buildFakeDb({
      myTeams: [
        makeDoc("team-x", {
          hackathonId: "h1",
          memberIds,
          createdBy: "u0",
        }),
      ],
      users: [
        makeDoc("u0", {
          displayName: "U0",
          photoURL: "https://x/0",
          discord: { id: "d0" },
          github: { login: "u0" },
        }),
        makeDoc("u1", {
          discord: undefined,
          github: undefined,
        }),
      ],
    });
    const out = await loadHackathonTeamDashboard(db, "u0", "h1");
    // 17 ids → 2 chunks: 10 + 7
    expect(spies.usersChain.where).toHaveBeenCalledTimes(2);
    expect(spies.usersChain.where.mock.calls[0][2]).toHaveLength(10);
    expect(spies.usersChain.where.mock.calls[1][2]).toHaveLength(7);
    // Profile mapping respects displayName/photoURL null fallbacks
    expect(out.memberProfiles.u0).toEqual({
      uid: "u0",
      displayName: "U0",
      photoURL: "https://x/0",
      discord: { id: "d0" },
      github: { login: "u0" },
    });
    expect(out.memberProfiles.u1).toEqual({
      uid: "u1",
      displayName: null,
      photoURL: null,
      discord: undefined,
      github: undefined,
    });
  });

  it("loads team submission when one exists, mapping every optional timestamp", async () => {
    const { db } = buildFakeDb({
      myTeams: [
        makeDoc("team-x", {
          hackathonId: "h1",
          memberIds: ["alice"],
          createdBy: "alice",
        }),
      ],
      submissions: [
        makeDoc("sub-1", {
          hackathonId: "h1",
          teamId: "team-x",
          repoUrl: "https://github.com/x/y",
          registeredBy: "alice",
          registeredAt: tsLike("2026-05-01T00:00:00.000Z"),
          submittedAt: tsLike("2026-05-02T00:00:00.000Z"),
          cutoffAt: tsLike("2026-05-03T00:00:00.000Z"),
          disqualified: false,
        }),
      ],
    });
    const out = await loadHackathonTeamDashboard(db, "alice", "h1");
    expect(out.submission).toEqual({
      id: "sub-1",
      hackathonId: "h1",
      teamId: "team-x",
      repoUrl: "https://github.com/x/y",
      registeredBy: "alice",
      registeredAt: "2026-05-01T00:00:00.000Z",
      submittedAt: "2026-05-02T00:00:00.000Z",
      cutoffAt: "2026-05-03T00:00:00.000Z",
      disqualified: false,
      disqualifiedReason: undefined,
    });
  });

  it("submission omits optional submittedAt/cutoffAt when their Timestamps are missing", async () => {
    const { db } = buildFakeDb({
      myTeams: [
        makeDoc("team-x", {
          hackathonId: "h1",
          memberIds: ["alice"],
          createdBy: "alice",
        }),
      ],
      submissions: [
        makeDoc("sub-2", {
          hackathonId: "h1",
          teamId: "team-x",
          repoUrl: "https://github.com/x/y",
          registeredBy: "alice",
          registeredAt: tsLike("2026-05-01T00:00:00.000Z"),
        }),
      ],
    });
    const out = await loadHackathonTeamDashboard(db, "alice", "h1");
    expect(out.submission?.submittedAt).toBeUndefined();
    expect(out.submission?.cutoffAt).toBeUndefined();
  });

  it("submission is null when no submission doc matches", async () => {
    const { db } = buildFakeDb({
      myTeams: [
        makeDoc("team-x", {
          hackathonId: "h1",
          memberIds: ["alice"],
          createdBy: "alice",
        }),
      ],
    });
    const out = await loadHackathonTeamDashboard(db, "alice", "h1");
    expect(out.submission).toBeNull();
  });

  it("loads pending join requests into requestsToMyTeam", async () => {
    const { db } = buildFakeDb({
      myTeams: [
        makeDoc("team-x", {
          hackathonId: "h1",
          memberIds: ["alice"],
          createdBy: "alice",
        }),
      ],
      joinRequests: [
        makeDoc("req-1", {
          fromUserId: "bob",
          teamId: "team-x",
          status: "pending",
          createdAt: tsLike("2026-05-04T00:00:00.000Z"),
        }),
      ],
    });
    const out = await loadHackathonTeamDashboard(db, "alice", "h1");
    expect(out.requestsToMyTeam).toEqual([
      {
        id: "req-1",
        fromUserId: "bob",
        teamId: "team-x",
        status: "pending",
        createdAt: "2026-05-04T00:00:00.000Z",
      },
    ]);
  });

  it("treats invalid Timestamps (NaN dates) as null in tsIso", async () => {
    const badTs = { toDate: () => new Date(NaN) };
    const { db } = buildFakeDb({
      myTeams: [
        makeDoc("team-x", {
          hackathonId: "h1",
          memberIds: ["alice"],
          createdBy: "alice",
          createdAt: badTs,
        }),
      ],
    });
    const out = await loadHackathonTeamDashboard(db, "alice", "h1");
    expect(out.myTeam?.createdAt).toBeNull();
  });
});
