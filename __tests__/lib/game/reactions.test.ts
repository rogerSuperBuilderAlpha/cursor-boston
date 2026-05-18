/**
 * @jest-environment node
 *
 * Coverage push #52 — lib/game/reactions.ts. Drives toggleReactionServer
 * + listUserReactionsServer + the 4 ReactionError classes.
 */
const mockGetAdminDb = jest.fn();
jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: () => mockGetAdminDb(),
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    increment: (n: number) => ({ __increment: n }),
  },
}));

import {
  ReactionInvalidEmojiError,
  ReactionInvalidScopeError,
  ReactionMissingHeroIdError,
  ReactionTargetNotFoundError,
  listUserReactionsServer,
  toggleReactionServer,
} from "@/lib/game/reactions";

function buildDb(opts: {
  targetExists?: boolean;
  targetData?: Record<string, unknown>;
  trackerExists?: boolean;
}) {
  const targetGet = jest.fn().mockResolvedValue({
    exists: opts.targetExists ?? true,
    data: () => opts.targetData ?? {},
  });
  const trackerGet = jest.fn().mockResolvedValue({
    exists: opts.trackerExists ?? false,
    data: () => undefined,
  });

  const refByCollection = new Map<string, { __coll: string; __id: string }>();

  function refFor(coll: string, id: string) {
    const key = `${coll}|${id}`;
    if (!refByCollection.has(key)) {
      refByCollection.set(key, { __coll: coll, __id: id });
    }
    return refByCollection.get(key)!;
  }

  const txGet = jest.fn(async (ref: { __coll: string }) => {
    if (ref.__coll === "game_reactions") {
      return { exists: opts.trackerExists ?? false, data: () => undefined };
    }
    return {
      exists: opts.targetExists ?? true,
      data: () => opts.targetData ?? {},
    };
  });
  const txSet = jest.fn();
  const txUpdate = jest.fn();
  const txDelete = jest.fn();

  const runTransaction = jest.fn(async (fn: (tx: unknown) => unknown) =>
    fn({ get: txGet, set: txSet, update: txUpdate, delete: txDelete }),
  );

  function makeCollection(name: string) {
    return {
      doc: (id: string) => {
        if (name === "game_heroes") {
          // Sub-collection: events
          return {
            collection: () => ({
              doc: (eventId: string) => {
                const ref = refFor(`game_heroes/${id}/events`, eventId);
                return Object.assign(ref, {
                  get: targetGet,
                });
              },
            }),
          };
        }
        const ref = refFor(name, id);
        return Object.assign(ref, {
          get: name === "game_reactions" ? trackerGet : targetGet,
        });
      },
    };
  }

  const collection = jest.fn((name: string) => makeCollection(name));

  const getAll = jest.fn(async (...refs: Array<{ __coll: string; __id: string }>) =>
    refs.map((r) => {
      // For listUserReactionsServer testing: only return a tracker for
      // a specific id pattern set by the test.
      const exists = (opts as { trackerIdsExist?: Set<string> }).trackerIdsExist?.has(r.__id) ?? false;
      return {
        exists,
        data: () => ({
          userId: "u1",
          scope: "chat",
          docId: r.__id.split("_")[2] ?? "doc",
          reaction: ["⚔️", "🛡️", "📜"][
            Number(r.__id.split("_").pop()) || 0
          ] as "⚔️" | "🛡️" | "📜",
        }),
      };
    }),
  );

  return {
    db: { collection, runTransaction, getAll } as unknown as Parameters<typeof toggleReactionServer>[0] extends { db?: infer D } ? D : never,
    spies: { txSet, txUpdate, txDelete, targetGet, trackerGet, runTransaction, getAll },
  };
}

describe("toggleReactionServer", () => {
  beforeEach(() => {
    mockGetAdminDb.mockReset();
  });

  it("throws ReactionInvalidEmojiError for unknown emoji", async () => {
    await expect(
      toggleReactionServer({
        userId: "u1",
        scope: "chat",
        docId: "m1",
        emoji: "🚀" as unknown as "⚔️",
      }),
    ).rejects.toBeInstanceOf(ReactionInvalidEmojiError);
  });

  it("throws ReactionInvalidScopeError for unknown scope", async () => {
    await expect(
      toggleReactionServer({
        userId: "u1",
        scope: "unknown" as unknown as "chat",
        docId: "m1",
        emoji: "⚔️",
      }),
    ).rejects.toBeInstanceOf(ReactionInvalidScopeError);
  });

  it("throws ReactionTargetNotFoundError when the target doc is missing", async () => {
    const { db } = buildDb({ targetExists: false });
    mockGetAdminDb.mockReturnValueOnce(db);
    await expect(
      toggleReactionServer({
        userId: "u1",
        scope: "chat",
        docId: "missing",
        emoji: "⚔️",
      }),
    ).rejects.toBeInstanceOf(ReactionTargetNotFoundError);
  });

  it("turns the reaction ON when no tracker exists yet", async () => {
    const { db, spies } = buildDb({
      targetExists: true,
      targetData: { reactions: {} },
      trackerExists: false,
    });
    mockGetAdminDb.mockReturnValueOnce(db);
    const out = await toggleReactionServer({
      userId: "u1",
      scope: "chat",
      docId: "m1",
      emoji: "⚔️",
    });
    expect(out.active).toBe(true);
    expect(out.reactions).toEqual({ "⚔️": 1 });
    // Wrote the tracker doc + incremented the counter
    expect(spies.txSet).toHaveBeenCalledTimes(1);
    expect(spies.txUpdate).toHaveBeenCalledWith(
      expect.anything(),
      { "reactions.⚔️": { __increment: 1 } },
    );
  });

  it("turns the reaction OFF when a tracker already exists", async () => {
    const { db, spies } = buildDb({
      targetExists: true,
      targetData: { reactions: { "⚔️": 3 } },
      trackerExists: true,
    });
    mockGetAdminDb.mockReturnValueOnce(db);
    const out = await toggleReactionServer({
      userId: "u1",
      scope: "feed",
      docId: "e1",
      emoji: "⚔️",
    });
    expect(out.active).toBe(false);
    expect(out.reactions).toEqual({ "⚔️": 2 });
    expect(spies.txDelete).toHaveBeenCalledTimes(1);
    expect(spies.txUpdate).toHaveBeenCalledWith(
      expect.anything(),
      { "reactions.⚔️": { __increment: -1 } },
    );
  });

  it("removes the emoji key from the reactions map when the count drops to zero", async () => {
    const { db } = buildDb({
      targetExists: true,
      targetData: { reactions: { "⚔️": 1 } },
      trackerExists: true,
    });
    mockGetAdminDb.mockReturnValueOnce(db);
    const out = await toggleReactionServer({
      userId: "u1",
      scope: "feed",
      docId: "e1",
      emoji: "⚔️",
    });
    expect(out.reactions).toEqual({}); // ⚔️ removed
  });

  it("requires heroId when scope is hero_event", async () => {
    const { db } = buildDb({});
    mockGetAdminDb.mockReturnValueOnce(db);
    await expect(
      toggleReactionServer({
        userId: "u1",
        scope: "hero_event",
        docId: "ev1",
        emoji: "📜",
      }),
    ).rejects.toBeInstanceOf(ReactionMissingHeroIdError);
  });

  it("routes hero_event scope into game_heroes/{heroId}/events", async () => {
    const { db, spies } = buildDb({
      targetExists: true,
      targetData: { reactions: {} },
    });
    mockGetAdminDb.mockReturnValueOnce(db);
    const out = await toggleReactionServer({
      userId: "u1",
      scope: "hero_event",
      docId: "ev1",
      emoji: "📜",
      heroId: "h1",
    });
    expect(out.active).toBe(true);
    expect(spies.txSet).toHaveBeenCalledTimes(1);
  });

  it("accepts an optional `now` for deterministic timestamps", async () => {
    const { db, spies } = buildDb({
      targetExists: true,
      targetData: { reactions: {} },
    });
    mockGetAdminDb.mockReturnValueOnce(db);
    const fixedNow = new Date("2026-05-18T00:00:00.000Z");
    await toggleReactionServer({
      userId: "u1",
      scope: "chat",
      docId: "m1",
      emoji: "⚔️",
      now: fixedNow,
    });
    const trackerPayload = spies.txSet.mock.calls[0][1];
    expect(trackerPayload.createdAt).toBe(fixedNow);
  });

  it("propagates ReactionError classes' name + message for the API mapper", () => {
    const e1 = new ReactionInvalidEmojiError();
    expect(e1.name).toBe("ReactionInvalidEmojiError");
    expect(e1.message).toBe("Invalid reaction emoji");
    const e2 = new ReactionInvalidScopeError();
    expect(e2.name).toBe("ReactionInvalidScopeError");
    const e3 = new ReactionTargetNotFoundError();
    expect(e3.name).toBe("ReactionTargetNotFoundError");
    const e4 = new ReactionMissingHeroIdError();
    expect(e4.name).toBe("ReactionMissingHeroIdError");
  });
});

describe("listUserReactionsServer", () => {
  it("returns an empty set when no targets are given", async () => {
    const out = await listUserReactionsServer({ userId: "u1", targets: [] });
    expect(out).toEqual(new Set());
  });

  it("returns reaction keys for trackers that exist", async () => {
    // Have one tracker exist by id pattern
    const trackerIdsExist = new Set([
      "u1_chat_m1_0", // user=u1, scope=chat, docId=m1, emoji[0]
    ]);
    const { db } = buildDb({});
    (db as unknown as { getAll: jest.Mock }).getAll = jest.fn(async (...refs: Array<{ __id: string }>) =>
      refs.map((r) => ({
        exists: trackerIdsExist.has(r.__id),
        data: () => {
          const parts = r.__id.split("_");
          const idx = Number(parts[parts.length - 1]);
          return {
            userId: parts[0],
            scope: parts[1],
            docId: parts[2],
            reaction: ["⚔️", "🛡️", "📜"][idx],
          };
        },
      })),
    );
    mockGetAdminDb.mockReturnValueOnce(db);
    const out = await listUserReactionsServer({
      userId: "u1",
      targets: [
        { scope: "chat", docId: "m1" },
        { scope: "feed", docId: "e1" },
      ],
    });
    // Only the ⚔️ tracker exists for chat/m1
    expect(out.size).toBe(1);
    expect(out.has("chat|m1|0")).toBe(true);
  });

  it("chunks getAll calls in groups of 100", async () => {
    // 50 targets × 3 emojis = 150 refs → 2 chunks (100 + 50)
    const targets = Array.from({ length: 50 }, (_, i) => ({
      scope: "chat" as const,
      docId: `m${i}`,
    }));
    const { db } = buildDb({});
    const getAllMock = jest.fn(async (...refs: unknown[]) =>
      refs.map(() => ({ exists: false, data: () => undefined })),
    );
    (db as unknown as { getAll: jest.Mock }).getAll = getAllMock;
    mockGetAdminDb.mockReturnValueOnce(db);
    await listUserReactionsServer({ userId: "u1", targets });
    expect(getAllMock).toHaveBeenCalledTimes(2);
    expect(getAllMock.mock.calls[0]).toHaveLength(100);
    expect(getAllMock.mock.calls[1]).toHaveLength(50);
  });
});
