/**
 * @jest-environment node
 *
 * Coverage push #54 — lib/game/community.ts. Covers the community-feed
 * event log + the chat collection (create / delete / list).
 */
const mockGetAdminDb = jest.fn();
jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: () => mockGetAdminDb(),
}));

import {
  COMMUNITY_PAGE_SIZE,
  CommunityMessageEmptyError,
  CommunityMessageForbiddenError,
  CommunityMessageNotFoundError,
  CommunityMessageTooLongError,
  CommunityMessageWrongCasteError,
  MAX_MESSAGE_LENGTH,
  createCommunityMessage,
  deleteCommunityMessage,
  listRecentCommunityEvents,
  listRecentCommunityMessages,
  logCommunityEvent,
  logCommunityEventInTx,
  type CommunityEventInput,
} from "@/lib/game/community";

beforeEach(() => {
  mockGetAdminDb.mockReset();
});

describe("constants + error classes", () => {
  it("MAX_MESSAGE_LENGTH and COMMUNITY_PAGE_SIZE expose sensible values", () => {
    expect(MAX_MESSAGE_LENGTH).toBe(500);
    expect(COMMUNITY_PAGE_SIZE).toBe(50);
  });

  it("error classes expose name + message for API mapping", () => {
    expect(new CommunityMessageNotFoundError().name).toBe(
      "CommunityMessageNotFoundError",
    );
    expect(new CommunityMessageForbiddenError().message).toMatch(/admin/);
    expect(new CommunityMessageEmptyError().message).toMatch(/empty/);
    expect(new CommunityMessageTooLongError().message).toContain(String(MAX_MESSAGE_LENGTH));
    expect(new CommunityMessageWrongCasteError().message).toMatch(/caste/);
  });
});

describe("logCommunityEventInTx — extra payload per event kind", () => {
  function buildTx() {
    return { set: jest.fn(), get: jest.fn(), update: jest.fn() };
  }
  const fakeDb = {
    collection: jest.fn().mockReturnValue({
      doc: jest.fn().mockReturnValue({ __ref: "event-ref" }),
    }),
  };
  const baseActor = {
    actorUserId: "u1",
    actorDisplayName: "Alice",
    actorCaste: "white" as const,
  };
  const now = new Date("2026-05-18T00:00:00.000Z");

  const cases: Array<[string, CommunityEventInput, Record<string, unknown>]> = [
    [
      "player_join",
      { ...baseActor, kind: "player_join" },
      {},
    ],
    [
      "caste_pick",
      { ...baseActor, kind: "caste_pick" },
      {},
    ],
    [
      "caste_change",
      { ...baseActor, kind: "caste_change", fromCaste: "blue", toCaste: "red" },
      { fromCaste: "blue", toCaste: "red" },
    ],
    [
      "attack",
      {
        ...baseActor,
        kind: "attack",
        targetUserId: "u2",
        targetDisplayName: "Bob",
        tileId: "t1",
        outcome: "took",
      },
      { targetUserId: "u2", tileId: "t1", outcome: "took" },
    ],
    [
      "milestone_1k_tiles",
      { ...baseActor, kind: "milestone_1k_tiles" },
      {},
    ],
    [
      "seal_broken",
      { ...baseActor, kind: "seal_broken", sealIndex: 4, seasonNumber: 2 },
      { sealIndex: 4, seasonNumber: 2 },
    ],
    [
      "armageddon_started",
      { ...baseActor, kind: "armageddon_started", seasonNumber: 2 },
      { seasonNumber: 2 },
    ],
    [
      "armageddon_completed",
      { ...baseActor, kind: "armageddon_completed", seasonNumber: 2 },
      { seasonNumber: 2 },
    ],
    [
      "armageddon_cast_failed",
      { ...baseActor, kind: "armageddon_cast_failed", seasonNumber: 2 },
      { seasonNumber: 2 },
    ],
    [
      "armageddon_winner",
      {
        ...baseActor,
        kind: "armageddon_winner",
        seasonNumber: 2,
        winnerRank: 3,
        tilesHeld: 100,
        sealsBroken: 7,
        tickets: 700,
      },
      { winnerRank: 3, tickets: 700 },
    ],
    [
      "hero_emerged",
      {
        ...baseActor,
        kind: "hero_emerged",
        tileId: "t1",
        heroId: "h1",
        heroName: "Aragorn",
        heroClass: "military",
        heroSpecialty: "attack",
      },
      { heroId: "h1", heroName: "Aragorn" },
    ],
    [
      "hero_defected",
      {
        ...baseActor,
        kind: "hero_defected",
        tileId: "t1",
        heroId: "h1",
        heroName: "Hero",
        heroClass: "magic",
        heroSpecialty: "armageddon",
        otherUserId: "u9",
        otherDisplayName: "Other",
        otherCaste: "black",
      },
      { otherUserId: "u9" },
    ],
    [
      "hero_slain",
      {
        ...baseActor,
        kind: "hero_slain",
        tileId: "t1",
        heroId: "h1",
        heroName: "Hero",
        heroClass: "farm",
        heroSpecialty: "kingdom-buff",
        otherUserId: "u9",
        otherDisplayName: "Other",
        otherCaste: "blue",
      },
      { otherUserId: "u9" },
    ],
    [
      "pact_broken",
      {
        ...baseActor,
        kind: "pact_broken",
        targetUserId: "u9",
        targetDisplayName: "Other",
        pactId: "p1",
        pactStatement: "we shall not attack",
      },
      { pactId: "p1", pactStatement: "we shall not attack" },
    ],
    [
      "prophecy_fulfilled",
      {
        ...baseActor,
        kind: "prophecy_fulfilled",
        prophecyId: "pr1",
        prophecyPrediction: "the 4th seal breaks at midnight",
        prophecyTargetSealNumber: 4,
      },
      { prophecyId: "pr1", prophecyTargetSealNumber: 4 },
    ],
  ];

  it.each(cases)("%s → writes the right extra payload", (_label, input, expected) => {
    const tx = buildTx();
    logCommunityEventInTx(
      tx as unknown as Parameters<typeof logCommunityEventInTx>[0],
      fakeDb as unknown as Parameters<typeof logCommunityEventInTx>[1],
      input,
      now,
    );
    expect(tx.set).toHaveBeenCalledTimes(1);
    const payload = tx.set.mock.calls[0][1];
    expect(payload.kind).toBe(input.kind);
    expect(payload.actorUserId).toBe("u1");
    expect(payload.createdAt).toBe(now);
    for (const [k, v] of Object.entries(expected)) {
      expect(payload[k]).toEqual(v);
    }
  });
});

describe("logCommunityEvent (out-of-transaction)", () => {
  it("writes the event doc + returns void", async () => {
    const refSet = jest.fn().mockResolvedValue(undefined);
    const db = {
      collection: jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({ set: refSet }),
      }),
    };
    mockGetAdminDb.mockReturnValueOnce(db);
    await logCommunityEvent({
      kind: "player_join",
      actorUserId: "u1",
      actorDisplayName: "Alice",
      actorCaste: null,
    });
    expect(refSet).toHaveBeenCalledTimes(1);
    const payload = refSet.mock.calls[0][0];
    expect(payload.kind).toBe("player_join");
    expect(payload.actorCaste).toBeNull();
  });

  it("includes the typed extra payload for an attack event", async () => {
    const refSet = jest.fn().mockResolvedValue(undefined);
    const db = {
      collection: jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({ set: refSet }),
      }),
    };
    mockGetAdminDb.mockReturnValueOnce(db);
    await logCommunityEvent({
      kind: "attack",
      actorUserId: "u1",
      actorDisplayName: "Alice",
      actorCaste: "white",
      targetUserId: "u9",
      targetDisplayName: "Bob",
      tileId: "t1",
      outcome: "took",
    });
    expect(refSet.mock.calls[0][0].targetUserId).toBe("u9");
  });

  it("includes the typed extra payload for caste_change", async () => {
    const refSet = jest.fn().mockResolvedValue(undefined);
    const db = {
      collection: jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({ set: refSet }),
      }),
    };
    mockGetAdminDb.mockReturnValueOnce(db);
    await logCommunityEvent({
      kind: "caste_change",
      actorUserId: "u1",
      actorDisplayName: "Alice",
      actorCaste: "white",
      fromCaste: "blue",
      toCaste: "white",
    });
    const payload = refSet.mock.calls[0][0];
    expect(payload.fromCaste).toBe("blue");
    expect(payload.toCaste).toBe("white");
  });

  it("includes the typed extra payload for armageddon_winner", async () => {
    const refSet = jest.fn().mockResolvedValue(undefined);
    const db = {
      collection: jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({ set: refSet }),
      }),
    };
    mockGetAdminDb.mockReturnValueOnce(db);
    await logCommunityEvent({
      kind: "armageddon_winner",
      actorUserId: "u1",
      actorDisplayName: "Alice",
      actorCaste: "white",
      seasonNumber: 3,
      winnerRank: 1,
      tilesHeld: 200,
      sealsBroken: 7,
      tickets: 1400,
    });
    expect(refSet.mock.calls[0][0].winnerRank).toBe(1);
  });

  it("includes the hero_defected extra payload", async () => {
    const refSet = jest.fn().mockResolvedValue(undefined);
    const db = {
      collection: jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({ set: refSet }),
      }),
    };
    mockGetAdminDb.mockReturnValueOnce(db);
    await logCommunityEvent({
      kind: "hero_defected",
      actorUserId: "u1",
      actorDisplayName: "Alice",
      actorCaste: "white",
      tileId: "t1",
      heroId: "h1",
      heroName: "Hero",
      heroClass: "military",
      heroSpecialty: "attack",
      otherUserId: "u9",
      otherDisplayName: "Bob",
      otherCaste: "black",
    });
    expect(refSet.mock.calls[0][0].otherUserId).toBe("u9");
  });

  it("includes the pact_broken extra payload", async () => {
    const refSet = jest.fn().mockResolvedValue(undefined);
    const db = {
      collection: jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({ set: refSet }),
      }),
    };
    mockGetAdminDb.mockReturnValueOnce(db);
    await logCommunityEvent({
      kind: "pact_broken",
      actorUserId: "u1",
      actorDisplayName: "Alice",
      actorCaste: "white",
      targetUserId: "u9",
      targetDisplayName: "Bob",
      pactId: "p1",
      pactStatement: "we shall not attack",
    });
    expect(refSet.mock.calls[0][0].pactId).toBe("p1");
  });

  it("includes the prophecy_fulfilled extra payload", async () => {
    const refSet = jest.fn().mockResolvedValue(undefined);
    const db = {
      collection: jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({ set: refSet }),
      }),
    };
    mockGetAdminDb.mockReturnValueOnce(db);
    await logCommunityEvent({
      kind: "prophecy_fulfilled",
      actorUserId: "u1",
      actorDisplayName: "Alice",
      actorCaste: "white",
      prophecyId: "pr1",
      prophecyPrediction: "the world ends",
      prophecyTargetSealNumber: 7,
    });
    expect(refSet.mock.calls[0][0].prophecyId).toBe("pr1");
  });

  it("throws when admin db is unavailable", async () => {
    mockGetAdminDb.mockReturnValueOnce(null);
    await expect(
      logCommunityEvent({
        kind: "player_join",
        actorUserId: "u1",
        actorDisplayName: "x",
        actorCaste: null,
      }),
    ).rejects.toThrow("Firebase Admin not initialized");
  });
});

describe("listRecentCommunityEvents", () => {
  it("queries by createdAt desc + clamps limit into [1, 200]", async () => {
    const get = jest.fn().mockResolvedValue({
      docs: [
        { data: () => ({ id: "e1", kind: "player_join" }) },
        { data: () => ({ id: "e2", kind: "attack" }) },
      ],
    });
    const limit = jest.fn().mockReturnValue({ get });
    const orderBy = jest.fn().mockReturnValue({ limit });
    const db = {
      collection: jest.fn().mockReturnValue({ orderBy }),
    };
    mockGetAdminDb.mockReturnValueOnce(db);
    const out = await listRecentCommunityEvents(99999);
    expect(out).toHaveLength(2);
    expect(limit).toHaveBeenCalledWith(200);
    expect(orderBy).toHaveBeenCalledWith("createdAt", "desc");
  });

  it("clamps zero/negative limit up to 1", async () => {
    const get = jest.fn().mockResolvedValue({ docs: [] });
    const db = {
      collection: jest.fn().mockReturnValue({
        orderBy: jest.fn().mockReturnValue({ limit: jest.fn().mockReturnValue({ get }) }),
      }),
    };
    mockGetAdminDb.mockReturnValueOnce(db);
    await listRecentCommunityEvents(0);
    // Limit was called somewhere — check the inner mock
    const limitMock = (db.collection("game_community_events").orderBy as jest.Mock).mock.results[0]
      .value.limit;
    expect(limitMock).toHaveBeenCalledWith(1);
  });
});

describe("createCommunityMessage", () => {
  function buildDb() {
    const setSpy = jest.fn().mockResolvedValue(undefined);
    const db = {
      collection: jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({ set: setSpy }),
      }),
    };
    return { db, setSpy };
  }

  it("throws CommunityMessageEmptyError on empty/whitespace body", async () => {
    await expect(
      createCommunityMessage({
        userId: "u1",
        displayName: "A",
        caste: null,
        body: "   ",
      }),
    ).rejects.toBeInstanceOf(CommunityMessageEmptyError);
  });

  it("throws CommunityMessageTooLongError when body > MAX_MESSAGE_LENGTH", async () => {
    await expect(
      createCommunityMessage({
        userId: "u1",
        displayName: "A",
        caste: null,
        body: "a".repeat(MAX_MESSAGE_LENGTH + 1),
      }),
    ).rejects.toBeInstanceOf(CommunityMessageTooLongError);
  });

  it("throws CommunityMessageWrongCasteError when scope=caste:X and user isn't X", async () => {
    await expect(
      createCommunityMessage({
        userId: "u1",
        displayName: "A",
        caste: "blue",
        body: "hello",
        scope: "caste:red",
      }),
    ).rejects.toBeInstanceOf(CommunityMessageWrongCasteError);
  });

  it("creates the message + writes to Firestore on the happy path (global default)", async () => {
    const { db, setSpy } = buildDb();
    mockGetAdminDb.mockReturnValueOnce(db);
    const out = await createCommunityMessage({
      userId: "u1",
      displayName: "Alice",
      caste: "white",
      body: "  hello world  ",
    });
    expect(out.body).toBe("hello world"); // trimmed
    expect(out.scope).toBe("global");
    expect(setSpy).toHaveBeenCalledTimes(1);
  });

  it("creates caste-scoped messages when the user matches the scope's caste", async () => {
    const { db, setSpy } = buildDb();
    mockGetAdminDb.mockReturnValueOnce(db);
    const out = await createCommunityMessage({
      userId: "u1",
      displayName: "Alice",
      caste: "white",
      body: "hello",
      scope: "caste:white",
    });
    expect(out.scope).toBe("caste:white");
    expect(setSpy).toHaveBeenCalled();
  });
});

describe("deleteCommunityMessage", () => {
  function buildDb(messageData: Record<string, unknown> | undefined) {
    const update = jest.fn().mockResolvedValue(undefined);
    const get = jest.fn().mockResolvedValue({
      exists: messageData !== undefined,
      data: () => messageData,
    });
    const db = {
      collection: jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({ get, update }),
      }),
    };
    return { db, update };
  }

  it("throws CommunityMessageNotFoundError when doc missing", async () => {
    const { db } = buildDb(undefined);
    mockGetAdminDb.mockReturnValueOnce(db);
    await expect(
      deleteCommunityMessage({
        messageId: "m1",
        callerUserId: "u1",
        callerIsAdmin: false,
      }),
    ).rejects.toBeInstanceOf(CommunityMessageNotFoundError);
  });

  it("throws CommunityMessageForbiddenError when caller isn't author and isn't admin", async () => {
    const { db } = buildDb({ userId: "u-author" });
    mockGetAdminDb.mockReturnValueOnce(db);
    await expect(
      deleteCommunityMessage({
        messageId: "m1",
        callerUserId: "u-stranger",
        callerIsAdmin: false,
      }),
    ).rejects.toBeInstanceOf(CommunityMessageForbiddenError);
  });

  it("author deleting own message → deletedByAdmin: false", async () => {
    const { db, update } = buildDb({ userId: "u1", body: "hi" });
    mockGetAdminDb.mockReturnValueOnce(db);
    const out = await deleteCommunityMessage({
      messageId: "m1",
      callerUserId: "u1",
      callerIsAdmin: false,
    });
    expect(update).toHaveBeenCalled();
    expect(out.deletedByAdmin).toBe(false);
    expect(out.deletedAt).toBeDefined();
  });

  it("admin deleting someone-else's message → deletedByAdmin: true", async () => {
    const { db, update } = buildDb({ userId: "u-author", body: "hi" });
    mockGetAdminDb.mockReturnValueOnce(db);
    const out = await deleteCommunityMessage({
      messageId: "m1",
      callerUserId: "admin-1",
      callerIsAdmin: true,
    });
    expect(update).toHaveBeenCalled();
    expect(out.deletedByAdmin).toBe(true);
  });

  it("admin deleting their own message → deletedByAdmin: false", async () => {
    const { db } = buildDb({ userId: "admin-1", body: "hi" });
    mockGetAdminDb.mockReturnValueOnce(db);
    const out = await deleteCommunityMessage({
      messageId: "m1",
      callerUserId: "admin-1",
      callerIsAdmin: true,
    });
    expect(out.deletedByAdmin).toBe(false);
  });
});

describe("listRecentCommunityMessages", () => {
  function buildSnap(docs: Array<Record<string, unknown>>) {
    return { docs: docs.map((data) => ({ data: () => data })) };
  }

  function buildDb(docs: Array<Record<string, unknown>>, scopedDocs?: Array<Record<string, unknown>>) {
    const globalGet = jest.fn().mockResolvedValue(buildSnap(docs));
    const scopedGet = jest.fn().mockResolvedValue(buildSnap(scopedDocs ?? docs));
    const globalChain = {
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get: globalGet,
      where: jest.fn(),
    };
    globalChain.where.mockReturnValue({
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get: scopedGet,
    });
    const db = {
      collection: jest.fn().mockReturnValue(globalChain),
    };
    return { db };
  }

  it("global scope: filters in-memory to docScope='global' or absent, skips deleted", async () => {
    const { db } = buildDb([
      { id: "m1", scope: "global", body: "g1" },
      { id: "m2", scope: undefined, body: "legacy" }, // legacy: treated as global
      { id: "m3", scope: "caste:red", body: "in caste" },
      { id: "m4", scope: "global", deletedAt: new Date(), body: "deleted" },
    ]);
    mockGetAdminDb.mockReturnValueOnce(db);
    const out = await listRecentCommunityMessages(50, "global");
    expect(out.map((m) => m.id)).toEqual(["m1", "m2"]);
  });

  it("global scope: respects the limit (stops once limit is reached)", async () => {
    const docs = Array.from({ length: 50 }, (_, i) => ({
      id: `m${i}`,
      scope: "global",
    }));
    const { db } = buildDb(docs);
    mockGetAdminDb.mockReturnValueOnce(db);
    const out = await listRecentCommunityMessages(10, "global");
    expect(out).toHaveLength(10);
  });

  it("caste scope: uses where('scope', '==', scope) and skips deleted", async () => {
    const { db } = buildDb([], [
      { id: "m1", scope: "caste:red", body: "r1" },
      { id: "m2", scope: "caste:red", deletedAt: new Date() },
      { id: "m3", scope: "caste:red", body: "r2" },
    ]);
    mockGetAdminDb.mockReturnValueOnce(db);
    const out = await listRecentCommunityMessages(50, "caste:red");
    expect(out.map((m) => m.id)).toEqual(["m1", "m3"]);
  });
});
