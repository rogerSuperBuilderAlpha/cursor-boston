/**
 * @jest-environment node
 */
jest.mock("firebase-admin/firestore", () => ({
  FieldPath: {
    documentId: () => "__name__",
  },
}));

import { loadHackathonTeamsBoard } from "@/lib/hackathon-teams-board-server";

type DocSnap = { id: string; data: () => Record<string, unknown>; exists?: boolean };

function makeDoc(id: string, data: Record<string, unknown>): DocSnap {
  return { id, data: () => data, exists: true };
}

function tsLike(iso: string) {
  return { toDate: () => new Date(iso) };
}

function buildFakeDb(opts: {
  teams?: DocSnap[];
  users?: DocSnap[];
  submissions?: DocSnap[];
  poolExists?: boolean;
  joinRequests?: DocSnap[];
}) {
  const teamsGet = jest.fn().mockResolvedValue({ docs: opts.teams ?? [] });
  const usersGet = jest.fn().mockResolvedValue({ docs: opts.users ?? [] });
  const subGet = jest.fn().mockResolvedValue({ docs: opts.submissions ?? [] });
  const poolGet = jest.fn().mockResolvedValue({ exists: !!opts.poolExists });
  const reqGet = jest.fn().mockResolvedValue({ docs: opts.joinRequests ?? [] });

  const teamsChain = {
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    get: teamsGet,
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
  const poolDoc = { get: poolGet };
  const poolChain = { doc: jest.fn().mockReturnValue(poolDoc) };
  const reqChain = {
    where: jest.fn().mockReturnThis(),
    get: reqGet,
  };

  const collection = jest.fn((name: string) => {
    if (name === "hackathonTeams") return teamsChain;
    if (name === "users") return usersChain;
    if (name === "hackathonSubmissions") return subChain;
    if (name === "hackathonPool") return poolChain;
    if (name === "hackathonJoinRequests") return reqChain;
    throw new Error(`unexpected collection: ${name}`);
  });

  return {
    db: { collection } as unknown as Parameters<typeof loadHackathonTeamsBoard>[0],
    teamsChain,
    usersChain,
    subChain,
    poolChain,
    reqChain,
    teamsGet,
    usersGet,
  };
}

describe("lib/hackathon-teams-board-server", () => {
  it("returns empty payload when no teams + uid=null", async () => {
    const { db } = buildFakeDb({});
    const out = await loadHackathonTeamsBoard(db, null, "h1");
    expect(out).toEqual({
      teams: [],
      memberProfiles: {},
      successfulSubmissionsByTeam: {},
      myTeamId: null,
      inPool: false,
      myPendingRequestTeamIds: [],
    });
  });

  it("queries hackathonTeams with the right where + limit", async () => {
    const { db, teamsChain } = buildFakeDb({});
    await loadHackathonTeamsBoard(db, null, "hack-x");
    expect(teamsChain.where).toHaveBeenCalledWith("hackathonId", "==", "hack-x");
    expect(teamsChain.limit).toHaveBeenCalledWith(200);
  });

  it("maps teams with createdAt Timestamp → ISO string", async () => {
    const { db } = buildFakeDb({
      teams: [
        makeDoc("team-1", {
          hackathonId: "h1",
          memberIds: ["u1", "u2"],
          name: "Team One",
          logoUrl: "https://example.com/logo.png",
          wins: 2,
          createdBy: "u1",
          createdAt: tsLike("2026-05-01T10:00:00.000Z"),
        }),
      ],
    });
    const out = await loadHackathonTeamsBoard(db, null, "h1");
    expect(out.teams).toHaveLength(1);
    expect(out.teams[0]).toEqual({
      id: "team-1",
      hackathonId: "h1",
      memberIds: ["u1", "u2"],
      name: "Team One",
      logoUrl: "https://example.com/logo.png",
      wins: 2,
      createdBy: "u1",
      createdAt: "2026-05-01T10:00:00.000Z",
    });
  });

  it("treats invalid/missing createdAt as null", async () => {
    const { db } = buildFakeDb({
      teams: [
        makeDoc("team-no-ts", {
          hackathonId: "h1",
          memberIds: [],
          createdBy: "u1",
        }),
        makeDoc("team-bad-ts", {
          hackathonId: "h1",
          memberIds: [],
          createdBy: "u1",
          createdAt: { toDate: () => new Date(NaN) },
        }),
      ],
    });
    const out = await loadHackathonTeamsBoard(db, null, "h1");
    expect(out.teams[0]?.createdAt).toBeNull();
    expect(out.teams[1]?.createdAt).toBeNull();
  });

  it("hydrates public user profiles for real (non-placeholder) member ids", async () => {
    const { db, usersChain } = buildFakeDb({
      teams: [
        makeDoc("team-1", {
          hackathonId: "h1",
          memberIds: ["u1", "u2", "mock-member-x"],
          createdBy: "u1",
        }),
      ],
      users: [
        makeDoc("u1", {
          displayName: "Alice",
          photoURL: "https://example.com/a.png",
          visibility: { isPublic: true },
        }),
        makeDoc("u2", {
          displayName: "Bob",
          photoURL: null,
          visibility: { isPublic: false },
        }),
      ],
    });
    const out = await loadHackathonTeamsBoard(db, null, "h1");
    expect(usersChain.where).toHaveBeenCalledWith(
      "__name__",
      "in",
      ["u1", "u2"],
    );
    expect(out.memberProfiles).toEqual({
      u1: { uid: "u1", displayName: "Alice", photoURL: "https://example.com/a.png" },
    });
  });

  it("falls back to null displayName/photoURL when fields are missing", async () => {
    const { db } = buildFakeDb({
      teams: [makeDoc("team-1", { hackathonId: "h1", memberIds: ["u1"], createdBy: "u1" })],
      users: [makeDoc("u1", { visibility: { isPublic: true } })],
    });
    const out = await loadHackathonTeamsBoard(db, null, "h1");
    expect(out.memberProfiles.u1).toEqual({
      uid: "u1",
      displayName: null,
      photoURL: null,
    });
  });

  it("filters out mock-* placeholder ids before fetching users", async () => {
    const { db, usersChain } = buildFakeDb({
      teams: [
        makeDoc("team-1", {
          hackathonId: "h1",
          memberIds: ["mock-member-1", "mock-foo"],
          createdBy: "mock-foo",
        }),
      ],
    });
    await loadHackathonTeamsBoard(db, null, "h1");
    // No real members → no users query at all (every chunk is empty).
    expect(usersChain.where).not.toHaveBeenCalled();
  });

  it("chunks member ids into batches of 10 for the 'in' query", async () => {
    const ids = Array.from({ length: 23 }, (_, i) => `u${i}`);
    const { db, usersChain } = buildFakeDb({
      teams: [
        makeDoc("team-1", { hackathonId: "h1", memberIds: ids, createdBy: "u0" }),
      ],
    });
    await loadHackathonTeamsBoard(db, null, "h1");
    // 23 ids → 3 chunks: 10, 10, 3
    expect(usersChain.where).toHaveBeenCalledTimes(3);
    expect(usersChain.where.mock.calls[0][2]).toHaveLength(10);
    expect(usersChain.where.mock.calls[1][2]).toHaveLength(10);
    expect(usersChain.where.mock.calls[2][2]).toHaveLength(3);
  });

  it("tallies successful (non-disqualified, submittedAt set) submissions per team", async () => {
    const { db } = buildFakeDb({
      submissions: [
        makeDoc("s1", { teamId: "team-a", submittedAt: tsLike("2026-05-01T00:00:00Z") }),
        makeDoc("s2", { teamId: "team-a", submittedAt: tsLike("2026-05-02T00:00:00Z") }),
        makeDoc("s3", { teamId: "team-b", submittedAt: tsLike("2026-05-01T00:00:00Z") }),
        makeDoc("s4", { teamId: "team-b", submittedAt: tsLike("2026-05-02T00:00:00Z"), disqualified: true }),
        makeDoc("s5", { teamId: "team-c" /* no submittedAt */ }),
        makeDoc("s6", { submittedAt: tsLike("2026-05-01T00:00:00Z") /* no teamId */ }),
      ],
    });
    const out = await loadHackathonTeamsBoard(db, null, "h1");
    expect(out.successfulSubmissionsByTeam).toEqual({
      "team-a": 2,
      "team-b": 1,
    });
  });

  it("resolves myTeamId when uid is a member of a team", async () => {
    const { db } = buildFakeDb({
      teams: [
        makeDoc("team-a", {
          hackathonId: "h1",
          memberIds: ["alice"],
          createdBy: "alice",
        }),
        makeDoc("team-b", {
          hackathonId: "h1",
          memberIds: ["bob", "carol"],
          createdBy: "bob",
        }),
      ],
    });
    const out = await loadHackathonTeamsBoard(db, "carol", "h1");
    expect(out.myTeamId).toBe("team-b");
  });

  it("returns myTeamId=null when uid is not on any team", async () => {
    const { db } = buildFakeDb({
      teams: [
        makeDoc("team-a", { hackathonId: "h1", memberIds: ["alice"], createdBy: "alice" }),
      ],
    });
    const out = await loadHackathonTeamsBoard(db, "stranger", "h1");
    expect(out.myTeamId).toBeNull();
  });

  it("reads inPool from hackathonPool/{uid}_{hackathonId}", async () => {
    const { db, poolChain } = buildFakeDb({ poolExists: true });
    const out = await loadHackathonTeamsBoard(db, "alice", "hack-x");
    expect(poolChain.doc).toHaveBeenCalledWith("alice_hack-x");
    expect(out.inPool).toBe(true);
  });

  it("returns pending join request team ids when uid is provided", async () => {
    const { db, reqChain } = buildFakeDb({
      joinRequests: [
        makeDoc("r1", { teamId: "team-x" }),
        makeDoc("r2", { teamId: "team-y" }),
        makeDoc("r3", { /* no teamId */ }),
      ],
    });
    const out = await loadHackathonTeamsBoard(db, "alice", "h1");
    expect(reqChain.where).toHaveBeenCalledWith("fromUserId", "==", "alice");
    expect(reqChain.where).toHaveBeenCalledWith("status", "==", "pending");
    expect(out.myPendingRequestTeamIds).toEqual(["team-x", "team-y"]);
  });

  it("does not call uid-scoped queries when uid is null", async () => {
    const { db, poolChain, reqChain } = buildFakeDb({});
    await loadHackathonTeamsBoard(db, null, "h1");
    expect(poolChain.doc).not.toHaveBeenCalled();
    expect(reqChain.where).not.toHaveBeenCalled();
  });

  it("dedupes member ids across teams before fetching users", async () => {
    const { db, usersChain } = buildFakeDb({
      teams: [
        makeDoc("t1", { hackathonId: "h1", memberIds: ["u1", "u2"], createdBy: "u1" }),
        makeDoc("t2", { hackathonId: "h1", memberIds: ["u1", "u3"], createdBy: "u1" }),
      ],
    });
    await loadHackathonTeamsBoard(db, null, "h1");
    expect(usersChain.where).toHaveBeenCalledTimes(1);
    const idsArg = usersChain.where.mock.calls[0][2];
    expect(new Set(idsArg)).toEqual(new Set(["u1", "u2", "u3"]));
  });
});
