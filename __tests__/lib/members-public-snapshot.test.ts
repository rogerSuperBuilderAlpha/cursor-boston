/**
 * @jest-environment node
 */
import {
  MEMBERS_SNAPSHOT_CACHE_TTL_MS,
  computePublicMembersSnapshot,
} from "@/lib/members-public-snapshot";

type DocLike = { id: string; data: () => Record<string, unknown> };

function buildFakeDb(usersDocs: DocLike[], agentsDocs: DocLike[]) {
  // Build query chains that ignore filter args and return the docs.
  const usersGet = jest.fn().mockResolvedValue({ docs: usersDocs });
  const agentsGet = jest.fn().mockResolvedValue({ docs: agentsDocs });

  const usersChain = {
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    get: usersGet,
  };
  const agentsChain = {
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    get: agentsGet,
  };

  const collection = jest.fn((name: string) => {
    if (name === "users") return usersChain;
    if (name === "agents") return agentsChain;
    throw new Error(`unexpected collection: ${name}`);
  });

  return {
    db: { collection } as unknown as Parameters<typeof computePublicMembersSnapshot>[0],
    usersChain,
    agentsChain,
    collection,
  };
}

function doc(id: string, data: Record<string, unknown>): DocLike {
  return { id, data: () => data };
}

function tsLike(iso: string) {
  return { toDate: () => new Date(iso) };
}

describe("lib/members-public-snapshot", () => {
  it("exports a 6-hour cache TTL constant", () => {
    expect(MEMBERS_SNAPSHOT_CACHE_TTL_MS).toBe(6 * 60 * 60 * 1000);
  });

  it("returns an empty array when both collections are empty", async () => {
    const { db } = buildFakeDb([], []);
    const out = await computePublicMembersSnapshot(db);
    expect(out).toEqual([]);
  });

  it("queries users by visibility.isPublic and agents by isPublic+claimed", async () => {
    const { db, usersChain, agentsChain, collection } = buildFakeDb([], []);
    await computePublicMembersSnapshot(db);
    expect(collection).toHaveBeenCalledWith("users");
    expect(collection).toHaveBeenCalledWith("agents");
    expect(usersChain.where).toHaveBeenCalledWith(
      "visibility.isPublic",
      "==",
      true,
    );
    expect(usersChain.orderBy).toHaveBeenCalledWith("createdAt", "desc");
    expect(agentsChain.where).toHaveBeenCalledWith(
      "visibility.isPublic",
      "==",
      true,
    );
    expect(agentsChain.where).toHaveBeenCalledWith("status", "==", "claimed");
  });

  it("maps human users with uid + memberType='human' and serializes Timestamp createdAt to ISO", async () => {
    const ts = tsLike("2026-05-01T10:00:00.000Z");
    const { db } = buildFakeDb(
      [doc("u1", { displayName: "Alice", createdAt: ts, visibility: { isPublic: true } })],
      [],
    );
    const out = await computePublicMembersSnapshot(db);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      uid: "u1",
      memberType: "human",
      displayName: "Alice",
      createdAt: "2026-05-01T10:00:00.000Z",
    });
  });

  it("maps agents into a normalized shape (name→displayName, description→bio, avatarUrl→photoURL)", async () => {
    const ts = tsLike("2026-05-02T10:00:00.000Z");
    const { db } = buildFakeDb(
      [],
      [
        doc("a1", {
          name: "GPT-Sage",
          avatarUrl: "https://example.com/a.png",
          description: "An AI helper",
          createdAt: ts,
          visibility: { isPublic: true, showOwner: false },
          ownerDisplayName: "Bob",
          ownerEmail: "bob@example.com",
        }),
      ],
    );
    const out = await computePublicMembersSnapshot(db);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      uid: "a1",
      memberType: "agent",
      displayName: "GPT-Sage",
      photoURL: "https://example.com/a.png",
      bio: "An AI helper",
      visibility: { isPublic: true, showOwner: false, showBio: true, showMemberSince: true },
      createdAt: "2026-05-02T10:00:00.000Z",
    });
    // owner hidden when showOwner is falsy
    expect((out[0] as Record<string, unknown>).owner).toBeUndefined();
  });

  it("includes agent owner block only when visibility.showOwner is truthy", async () => {
    const ts = tsLike("2026-05-02T10:00:00.000Z");
    const { db } = buildFakeDb(
      [],
      [
        doc("a2", {
          name: "ClaudePilot",
          avatarUrl: null,
          description: "Pilot agent",
          createdAt: ts,
          visibility: { isPublic: true, showOwner: true },
          ownerDisplayName: "Carol",
          ownerEmail: "carol@example.com",
        }),
      ],
    );
    const out = await computePublicMembersSnapshot(db);
    expect((out[0] as Record<string, unknown>).owner).toEqual({
      displayName: "Carol",
      email: "carol@example.com",
    });
  });

  it("falls back to photoURL=null when agent has no avatarUrl", async () => {
    const { db } = buildFakeDb(
      [],
      [
        doc("a3", {
          name: "X",
          description: "x",
          createdAt: tsLike("2026-05-02T10:00:00.000Z"),
          visibility: { isPublic: true },
        }),
      ],
    );
    const out = await computePublicMembersSnapshot(db);
    expect(out[0]?.photoURL).toBeNull();
  });

  it("sorts the merged result by createdAt descending across humans + agents", async () => {
    const { db } = buildFakeDb(
      [
        doc("u-old", {
          displayName: "Old Human",
          createdAt: tsLike("2026-01-01T00:00:00.000Z"),
          visibility: { isPublic: true },
        }),
        doc("u-mid", {
          displayName: "Mid Human",
          // ISO-string createdAt path
          createdAt: "2026-03-01T00:00:00.000Z",
          visibility: { isPublic: true },
        }),
      ],
      [
        doc("a-new", {
          name: "New Agent",
          description: "newest",
          createdAt: tsLike("2026-04-01T00:00:00.000Z"),
          visibility: { isPublic: true },
        }),
      ],
    );
    const out = await computePublicMembersSnapshot(db);
    expect(out.map((m) => m.uid)).toEqual(["a-new", "u-mid", "u-old"]);
  });

  it("treats invalid Timestamps (NaN dates) as null in the output", async () => {
    const badTs = { toDate: () => new Date(NaN) };
    const { db } = buildFakeDb(
      [
        doc("u-bad", {
          displayName: "Bad Date",
          createdAt: badTs,
          visibility: { isPublic: true },
        }),
      ],
      [],
    );
    const out = await computePublicMembersSnapshot(db);
    expect(out[0]?.createdAt).toBeNull();
  });

  it("recursively serializes nested Timestamps inside the visibility blob", async () => {
    const { db } = buildFakeDb(
      [
        doc("u-nest", {
          displayName: "Nest",
          createdAt: tsLike("2026-05-01T00:00:00.000Z"),
          visibility: {
            isPublic: true,
            verifiedAt: tsLike("2026-04-01T00:00:00.000Z"),
            tags: ["a", "b"],
          },
        }),
      ],
      [],
    );
    const out = await computePublicMembersSnapshot(db);
    const v = (out[0] as Record<string, unknown>).visibility as Record<string, unknown>;
    expect(v.verifiedAt).toBe("2026-04-01T00:00:00.000Z");
    expect(v.tags).toEqual(["a", "b"]);
  });

  it("preserves null and undefined leaf values verbatim", async () => {
    const { db } = buildFakeDb(
      [
        doc("u-null", {
          displayName: null,
          bio: undefined,
          createdAt: tsLike("2026-05-01T00:00:00.000Z"),
          visibility: { isPublic: true },
        }),
      ],
      [],
    );
    const out = await computePublicMembersSnapshot(db);
    expect(out[0]?.displayName).toBeNull();
    expect((out[0] as Record<string, unknown>).bio).toBeUndefined();
  });

  it("sorts humans missing a usable createdAt to the bottom (treated as epoch 0)", async () => {
    const { db } = buildFakeDb(
      [
        doc("u-no-ts", {
          displayName: "No TS Human",
          visibility: { isPublic: true },
        }),
        doc("u-new", {
          displayName: "New Human",
          createdAt: tsLike("2026-04-01T00:00:00.000Z"),
          visibility: { isPublic: true },
        }),
      ],
      [],
    );
    const out = await computePublicMembersSnapshot(db);
    expect(out.map((m) => m.uid)).toEqual(["u-new", "u-no-ts"]);
  });

  it("sorts agents missing a usable createdAt to the bottom (treated as epoch 0)", async () => {
    const { db } = buildFakeDb(
      [],
      [
        doc("a-no-ts", {
          name: "No TS",
          description: "no createdAt at all",
          visibility: { isPublic: true },
        }),
        doc("a-new", {
          name: "New",
          description: "new",
          createdAt: tsLike("2026-04-01T00:00:00.000Z"),
          visibility: { isPublic: true },
        }),
      ],
    );
    const out = await computePublicMembersSnapshot(db);
    expect(out.map((m) => m.uid)).toEqual(["a-new", "a-no-ts"]);
  });
});
