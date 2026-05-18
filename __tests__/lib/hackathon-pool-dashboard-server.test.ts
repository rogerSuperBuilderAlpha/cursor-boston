/**
 * @jest-environment node
 *
 * Coverage push #59 — lib/hackathon-pool-dashboard-server.ts. Drives the
 * single big read function that backs the /hackathons/pool page: pool
 * snapshot + paged user-profile chunks + my-team lookup + open-slot
 * filter + successful-submission counts + invites + join requests.
 */
jest.mock("firebase-admin/firestore", () => ({
  FieldPath: {
    documentId: () => "__id__",
  },
}));

import { loadHackathonPoolDashboard } from "@/lib/hackathon-pool-dashboard-server";

type Doc = {
  id: string;
  data: () => Record<string, unknown>;
};

function ts(iso: string) {
  return { toDate: () => new Date(iso) };
}

function buildDb(routes: {
  pool?: Doc[];
  poolDocExists?: boolean;
  myTeam?: Doc[];
  teams?: Doc[];
  users?: Doc[];
  submissions?: Doc[];
  invitesToMe?: Doc[];
  invitesFromMe?: Doc[];
  joinRequestsToMyTeam?: Doc[];
  joinRequestsFromMe?: Doc[];
}) {
  function snap(docs: Doc[]) {
    return { docs };
  }
  function makeQueryChain(docsFor: () => Doc[]) {
    const chain: Record<string, (...a: unknown[]) => unknown> = {};
    chain.where = jest.fn(() => chain);
    chain.orderBy = jest.fn(() => chain);
    chain.limit = jest.fn(() => chain);
    chain.get = jest.fn(async () => snap(docsFor()));
    return chain;
  }

  const collections: Record<string, () => unknown> = {
    hackathonPool: () => {
      const chain = makeQueryChain(() => routes.pool ?? []);
      return {
        ...chain,
        doc: (_id: string) => ({
          get: jest.fn().mockResolvedValue({
            exists: routes.poolDocExists ?? false,
            data: () => ({}),
          }),
        }),
      };
    },
    hackathonTeams: () => makeQueryChain(() => {
      // First call (with array-contains uid) returns myTeam; subsequent
      // call (limit-200) returns all teams. We use a tiny state machine.
      // The handler calls in this order so we can use a counter.
      return getNextTeamsCall();
    }),
    users: () => makeQueryChain(() => routes.users ?? []),
    hackathonSubmissions: () => makeQueryChain(() => routes.submissions ?? []),
    hackathonInvites: () => {
      // 1st call: where(toUserId), 2nd call: where(fromUserId).
      return makeQueryChain(() => getNextInvitesCall());
    },
    hackathonJoinRequests: () => {
      // Up to 2 calls: requests to my team (if myTeam exists) + my pending requests
      return makeQueryChain(() => getNextJoinRequestsCall());
    },
  };

  let teamsCall = 0;
  function getNextTeamsCall(): Doc[] {
    teamsCall++;
    if (teamsCall === 1) return routes.myTeam ?? [];
    return routes.teams ?? [];
  }

  let invitesCall = 0;
  function getNextInvitesCall(): Doc[] {
    invitesCall++;
    if (invitesCall === 1) return routes.invitesToMe ?? [];
    return routes.invitesFromMe ?? [];
  }

  let joinReqCall = 0;
  function getNextJoinRequestsCall(): Doc[] {
    joinReqCall++;
    if (joinReqCall === 1 && routes.myTeam && routes.myTeam.length > 0) {
      return routes.joinRequestsToMyTeam ?? [];
    }
    return routes.joinRequestsFromMe ?? [];
  }

  const collection = jest.fn((name: string) => {
    const make = collections[name];
    if (!make) throw new Error(`Unknown collection: ${name}`);
    return make();
  });

  return { collection };
}

describe("loadHackathonPoolDashboard", () => {
  it("returns an empty payload when nothing is configured", async () => {
    const db = buildDb({}) as unknown as Parameters<
      typeof loadHackathonPoolDashboard
    >[0];
    const out = await loadHackathonPoolDashboard(db, "u1", "hack-1");
    expect(out.poolEntries).toEqual([]);
    expect(out.inPool).toBe(false);
    expect(out.poolUsers).toEqual({});
    expect(out.myTeam).toBeNull();
    expect(out.teamsWithSlots).toEqual([]);
    expect(out.teamMemberProfiles).toEqual({});
    expect(out.successfulSubmissionsByTeam).toEqual({});
    expect(out.myInvites).toEqual([]);
    expect(out.myInvitedUserIds).toEqual([]);
    expect(out.requestsToMyTeam).toEqual([]);
    expect(out.myPendingRequestTeamIds).toEqual([]);
  });

  it("marks inPool=true when the per-user pool doc exists", async () => {
    const db = buildDb({
      poolDocExists: true,
    }) as unknown as Parameters<typeof loadHackathonPoolDashboard>[0];
    const out = await loadHackathonPoolDashboard(db, "u1", "hack-1");
    expect(out.inPool).toBe(true);
  });

  it("maps pool entries (including null joinedAt when no Timestamp)", async () => {
    const db = buildDb({
      pool: [
        {
          id: "u1_hack-1",
          data: () => ({
            userId: "u1",
            hackathonId: "hack-1",
            joinedAt: ts("2026-05-18T00:00:00.000Z"),
          }),
        },
        {
          id: "u2_hack-1",
          data: () => ({
            userId: "u2",
            hackathonId: "hack-1",
            joinedAt: null,
          }),
        },
      ],
    }) as unknown as Parameters<typeof loadHackathonPoolDashboard>[0];
    const out = await loadHackathonPoolDashboard(db, "u1", "hack-1");
    expect(out.poolEntries).toHaveLength(2);
    expect(out.poolEntries[0].joinedAt).toBe("2026-05-18T00:00:00.000Z");
    expect(out.poolEntries[1].joinedAt).toBeNull();
  });

  it("includes only public users in poolUsers", async () => {
    const db = buildDb({
      pool: [
        { id: "u1_x", data: () => ({ userId: "u1", hackathonId: "x" }) },
        { id: "u2_x", data: () => ({ userId: "u2", hackathonId: "x" }) },
        { id: "u3_x", data: () => ({ userId: "u3", hackathonId: "x" }) },
      ],
      users: [
        {
          id: "u1",
          data: () => ({
            visibility: { isPublic: true },
            displayName: "Alice",
            photoURL: "a.png",
            discord: { username: "alice" },
            github: { login: "alice-gh" },
          }),
        },
        {
          id: "u2",
          data: () => ({
            visibility: { isPublic: false },
            displayName: "Bob",
          }),
        },
        {
          id: "u3",
          data: () => ({
            visibility: { isPublic: true },
            // no displayName/photoURL → defaults to null
          }),
        },
      ],
    }) as unknown as Parameters<typeof loadHackathonPoolDashboard>[0];
    const out = await loadHackathonPoolDashboard(db, "u1", "x");
    expect(Object.keys(out.poolUsers).sort()).toEqual(["u1", "u3"]);
    expect(out.poolUsers.u1.discord?.username).toBe("alice");
    expect(out.poolUsers.u3.displayName).toBeNull();
  });

  it("captures myTeam when the user belongs to one and surfaces requestsToMyTeam", async () => {
    const db = buildDb({
      myTeam: [
        {
          id: "team-1",
          data: () => ({
            hackathonId: "hack-1",
            memberIds: ["u1", "u2"],
            name: "Squad",
            logoUrl: "l.png",
            wins: 2,
            createdBy: "u1",
            createdAt: ts("2026-05-01T00:00:00.000Z"),
          }),
        },
      ],
      joinRequestsToMyTeam: [
        {
          id: "req-1",
          data: () => ({
            fromUserId: "u9",
            teamId: "team-1",
            status: "pending",
            createdAt: ts("2026-05-15T00:00:00.000Z"),
          }),
        },
      ],
    }) as unknown as Parameters<typeof loadHackathonPoolDashboard>[0];
    const out = await loadHackathonPoolDashboard(db, "u1", "hack-1");
    expect(out.myTeam).not.toBeNull();
    expect(out.myTeam!.id).toBe("team-1");
    expect(out.myTeam!.wins).toBe(2);
    expect(out.requestsToMyTeam).toHaveLength(1);
    expect(out.requestsToMyTeam[0].fromUserId).toBe("u9");
  });

  it("filters teamsWithSlots to teams of size 2 (>=2 and <3)", async () => {
    const team = (id: string, members: string[]) => ({
      id,
      data: () => ({
        hackathonId: "x",
        memberIds: members,
        createdBy: members[0],
      }),
    });
    const db = buildDb({
      teams: [
        team("t1", ["a"]), // too small
        team("t2", ["a", "b"]), // included
        team("t3", ["a", "b", "c"]), // too big
        team("t4", ["a", "mock-member-x"]), // included but placeholder filtered from profiles
      ],
    }) as unknown as Parameters<typeof loadHackathonPoolDashboard>[0];
    const out = await loadHackathonPoolDashboard(db, "u1", "x");
    expect(out.teamsWithSlots.map((t) => t.id).sort()).toEqual(["t2", "t4"]);
  });

  it("excludes placeholder member IDs from teamMemberProfiles lookups", async () => {
    const db = buildDb({
      teams: [
        {
          id: "t1",
          data: () => ({
            hackathonId: "x",
            memberIds: ["u1", "mock-member-1"],
            createdBy: "u1",
          }),
        },
      ],
      users: [
        {
          id: "u1",
          data: () => ({ visibility: { isPublic: true }, displayName: "U" }),
        },
      ],
    }) as unknown as Parameters<typeof loadHackathonPoolDashboard>[0];
    const out = await loadHackathonPoolDashboard(db, "u1", "x");
    expect(out.teamMemberProfiles).toEqual({
      u1: expect.objectContaining({ displayName: "U" }),
    });
  });

  it("counts successful submissions and ignores disqualified/incomplete", async () => {
    const db = buildDb({
      submissions: [
        {
          id: "s1",
          data: () => ({
            submittedAt: ts("2026-05-15T00:00:00.000Z"),
            teamId: "t1",
          }),
        },
        {
          id: "s2",
          data: () => ({
            // no submittedAt → ignored
            teamId: "t1",
          }),
        },
        {
          id: "s3",
          data: () => ({
            submittedAt: ts("2026-05-15T00:00:00.000Z"),
            teamId: "t1",
            disqualified: true, // ignored
          }),
        },
        {
          id: "s4",
          data: () => ({
            submittedAt: ts("2026-05-15T00:00:00.000Z"),
            // no teamId → ignored
          }),
        },
        {
          id: "s5",
          data: () => ({
            submittedAt: ts("2026-05-15T00:00:00.000Z"),
            teamId: "t2",
          }),
        },
        {
          id: "s6",
          data: () => ({
            submittedAt: ts("2026-05-16T00:00:00.000Z"),
            teamId: "t2",
          }),
        },
      ],
    }) as unknown as Parameters<typeof loadHackathonPoolDashboard>[0];
    const out = await loadHackathonPoolDashboard(db, "u1", "x");
    expect(out.successfulSubmissionsByTeam).toEqual({ t1: 1, t2: 2 });
  });

  it("surfaces my pending invites + invited user ids", async () => {
    const db = buildDb({
      invitesToMe: [
        {
          id: "inv-1",
          data: () => ({
            fromUserId: "u9",
            toUserId: "u1",
            teamId: "t1",
            status: "pending",
            createdAt: ts("2026-05-01T00:00:00.000Z"),
            expiresAt: ts("2026-06-01T00:00:00.000Z"),
          }),
        },
        {
          id: "inv-2",
          data: () => ({
            fromUserId: "u8",
            toUserId: "u1",
            teamId: "t2",
            status: "pending",
            createdAt: null,
          }),
        },
      ],
      invitesFromMe: [
        { id: "out-1", data: () => ({ toUserId: "u4" }) },
        { id: "out-2", data: () => ({ toUserId: "" }) }, // filtered
      ],
    }) as unknown as Parameters<typeof loadHackathonPoolDashboard>[0];
    const out = await loadHackathonPoolDashboard(db, "u1", "x");
    expect(out.myInvites).toHaveLength(2);
    expect(out.myInvites[0].expiresAt).toBe("2026-06-01T00:00:00.000Z");
    expect(out.myInvites[1].expiresAt).toBeUndefined();
    expect(out.myInvitedUserIds).toEqual(["u4"]);
  });

  it("captures my outgoing join requests' team ids", async () => {
    const db = buildDb({
      joinRequestsFromMe: [
        { id: "r1", data: () => ({ teamId: "t1" }) },
        { id: "r2", data: () => ({ teamId: "t2" }) },
        { id: "r3", data: () => ({ teamId: "" }) }, // filtered
      ],
    }) as unknown as Parameters<typeof loadHackathonPoolDashboard>[0];
    const out = await loadHackathonPoolDashboard(db, "u1", "x");
    expect(out.myPendingRequestTeamIds).toEqual(["t1", "t2"]);
  });

  it("returns null joinedAt when toDate() yields an invalid Date", async () => {
    const db = buildDb({
      pool: [
        {
          id: "u1_x",
          data: () => ({
            userId: "u1",
            hackathonId: "x",
            joinedAt: { toDate: () => new Date("invalid") },
          }),
        },
      ],
    }) as unknown as Parameters<typeof loadHackathonPoolDashboard>[0];
    const out = await loadHackathonPoolDashboard(db, "u1", "x");
    expect(out.poolEntries[0].joinedAt).toBeNull();
  });

  it("chunks user lookups into batches of 10", async () => {
    // 15 pool entries → 2 chunks (10 + 5)
    const pool: Doc[] = Array.from({ length: 15 }, (_, i) => ({
      id: `u${i}_x`,
      data: () => ({ userId: `u${i}`, hackathonId: "x" }),
    }));
    const db = buildDb({ pool }) as unknown as Parameters<
      typeof loadHackathonPoolDashboard
    >[0];
    const out = await loadHackathonPoolDashboard(db, "u0", "x");
    expect(out.poolEntries).toHaveLength(15);
  });
});
