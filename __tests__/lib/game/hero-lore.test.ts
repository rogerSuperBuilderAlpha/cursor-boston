/**
 * @jest-environment node
 *
 * Coverage push #55 — lib/game/hero-lore.ts. Drives all 5 error classes,
 * chapter creation + listing + delete + approve, and epitaph creation +
 * listing + delete. Validates owner-auto-approval vs pending and the
 * fallen-hero gate on epitaphs.
 */
const mockGetAdminDb = jest.fn();
jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: () => mockGetAdminDb(),
}));

jest.mock("node:crypto", () => ({
  randomUUID: () => "uuid-1",
}));

import {
  HeroLoreEmptyError,
  HeroLoreForbiddenError,
  HeroLoreNotFoundError,
  HeroLoreTooLongError,
  HeroNotFoundError,
  MAX_CHAPTER_LENGTH,
  MAX_EPITAPH_LENGTH,
  approveHeroChapterServer,
  createHeroChapterServer,
  createHeroEpitaphServer,
  deleteHeroChapterServer,
  deleteHeroEpitaphServer,
  listHeroChaptersServer,
  listHeroEpitaphsServer,
} from "@/lib/game/hero-lore";

type ChapterRecord = Record<string, unknown> & { id: string };

function makeDb(opts: {
  heroExists?: boolean;
  hero?: Record<string, unknown>;
  chaptersInOrder?: ChapterRecord[];
  epitaphsInOrder?: ChapterRecord[];
  chapterByIdExists?: boolean;
  chapterById?: Record<string, unknown>;
  epitaphByIdExists?: boolean;
  epitaphById?: Record<string, unknown>;
}) {
  const heroGet = jest.fn().mockResolvedValue({
    exists: opts.heroExists ?? true,
    data: () => opts.hero ?? { currentOwnerId: "owner-1" },
  });

  const chaptersOrderBy = jest.fn().mockReturnThis();
  const chaptersGetAll = jest.fn().mockResolvedValue({
    docs: (opts.chaptersInOrder ?? []).map((c) => ({ data: () => c })),
  });
  const chaptersCollection: {
    doc: jest.Mock;
    orderBy: jest.Mock;
    get: jest.Mock;
  } = {
    doc: jest.fn(),
    orderBy: chaptersOrderBy,
    get: chaptersGetAll,
  };

  const epitaphsOrderBy = jest.fn().mockReturnThis();
  const epitaphsGetAll = jest.fn().mockResolvedValue({
    docs: (opts.epitaphsInOrder ?? []).map((e) => ({ data: () => e })),
  });
  const epitaphsCollection: {
    doc: jest.Mock;
    orderBy: jest.Mock;
    get: jest.Mock;
  } = {
    doc: jest.fn(),
    orderBy: epitaphsOrderBy,
    get: epitaphsGetAll,
  };

  const chapterDocGet = jest.fn().mockResolvedValue({
    exists: opts.chapterByIdExists ?? true,
    data: () => opts.chapterById ?? { authorId: "owner-1" },
  });
  const chapterDocSet = jest.fn().mockResolvedValue(undefined);
  const chapterDocUpdate = jest.fn().mockResolvedValue(undefined);
  const chapterDocRef = {
    get: chapterDocGet,
    set: chapterDocSet,
    update: chapterDocUpdate,
  };
  chaptersCollection.doc.mockReturnValue(chapterDocRef);

  const epitaphDocGet = jest.fn().mockResolvedValue({
    exists: opts.epitaphByIdExists ?? true,
    data: () => opts.epitaphById ?? { authorId: "owner-1" },
  });
  const epitaphDocSet = jest.fn().mockResolvedValue(undefined);
  const epitaphDocUpdate = jest.fn().mockResolvedValue(undefined);
  const epitaphDocRef = {
    get: epitaphDocGet,
    set: epitaphDocSet,
    update: epitaphDocUpdate,
  };
  epitaphsCollection.doc.mockReturnValue(epitaphDocRef);

  const heroDocCollection = jest.fn((name: string) => {
    if (name === "chapters") return chaptersCollection;
    if (name === "epitaphs") return epitaphsCollection;
    throw new Error(`Unknown sub-collection: ${name}`);
  });

  const heroDocRef = {
    get: heroGet,
    collection: heroDocCollection,
  };

  const heroesCollection = {
    doc: jest.fn().mockReturnValue(heroDocRef),
  };

  const collection = jest.fn((name: string) => {
    if (name === "game_heroes") return heroesCollection;
    throw new Error(`Unknown root collection: ${name}`);
  });

  return {
    db: { collection },
    spies: {
      heroGet,
      chaptersOrderBy,
      chaptersGetAll,
      epitaphsOrderBy,
      epitaphsGetAll,
      chapterDocSet,
      chapterDocUpdate,
      chapterDocGet,
      epitaphDocSet,
      epitaphDocUpdate,
      epitaphDocGet,
    },
  };
}

describe("error classes", () => {
  it("HeroLoreNotFoundError carries name + message", () => {
    const e = new HeroLoreNotFoundError();
    expect(e.name).toBe("HeroLoreNotFoundError");
    expect(e.message).toBe("Lore entry not found");
  });

  it("HeroLoreEmptyError", () => {
    const e = new HeroLoreEmptyError();
    expect(e.name).toBe("HeroLoreEmptyError");
    expect(e.message).toBe("Body cannot be empty");
  });

  it("HeroLoreTooLongError interpolates the limit", () => {
    const e = new HeroLoreTooLongError(280);
    expect(e.name).toBe("HeroLoreTooLongError");
    expect(e.message).toBe("Body exceeds 280 characters");
  });

  it("HeroLoreForbiddenError forwards the reason", () => {
    const e = new HeroLoreForbiddenError("nope");
    expect(e.name).toBe("HeroLoreForbiddenError");
    expect(e.message).toBe("nope");
  });

  it("HeroNotFoundError", () => {
    const e = new HeroNotFoundError();
    expect(e.name).toBe("HeroNotFoundError");
    expect(e.message).toBe("Hero not found");
  });
});

describe("createHeroChapterServer", () => {
  beforeEach(() => {
    mockGetAdminDb.mockReset();
  });

  it("rejects an empty body after sanitization", async () => {
    await expect(
      createHeroChapterServer({
        heroId: "h1",
        authorId: "u1",
        authorDisplayName: "U",
        authorCaste: null,
        rawBody: "   ",
      })
    ).rejects.toBeInstanceOf(HeroLoreEmptyError);
  });

  it("rejects bodies > MAX_CHAPTER_LENGTH", async () => {
    await expect(
      createHeroChapterServer({
        heroId: "h1",
        authorId: "u1",
        authorDisplayName: "U",
        authorCaste: null,
        rawBody: "x".repeat(MAX_CHAPTER_LENGTH + 1),
      })
    ).rejects.toBeInstanceOf(HeroLoreTooLongError);
  });

  it("throws when admin db is missing", async () => {
    mockGetAdminDb.mockReturnValueOnce(null);
    await expect(
      createHeroChapterServer({
        heroId: "h1",
        authorId: "u1",
        authorDisplayName: "U",
        authorCaste: null,
        rawBody: "Once upon a time",
      })
    ).rejects.toThrow("Firebase Admin not initialized");
  });

  it("throws HeroNotFoundError when the hero doc is missing", async () => {
    const { db } = makeDb({ heroExists: false });
    mockGetAdminDb.mockReturnValueOnce(db);
    await expect(
      createHeroChapterServer({
        heroId: "h1",
        authorId: "u1",
        authorDisplayName: "U",
        authorCaste: null,
        rawBody: "Once",
      })
    ).rejects.toBeInstanceOf(HeroNotFoundError);
  });

  it("auto-approves chapters from the current owner", async () => {
    const { db, spies } = makeDb({
      hero: { currentOwnerId: "u1" },
    });
    mockGetAdminDb.mockReturnValueOnce(db);
    const now = new Date("2026-05-18T00:00:00.000Z");
    const out = await createHeroChapterServer({
      heroId: "h1",
      authorId: "u1",
      authorDisplayName: "Owner",
      authorCaste: "warrior",
      rawBody: "Owner's tale",
      now,
    });
    expect(out.status).toBe("approved");
    expect(out.approvedAt).toBe(now);
    expect(out.approvedBy).toBe("u1");
    expect(spies.chapterDocSet).toHaveBeenCalledTimes(1);
  });

  it("marks chapters from non-owners as pending", async () => {
    const { db } = makeDb({
      hero: { currentOwnerId: "owner-1" },
    });
    mockGetAdminDb.mockReturnValueOnce(db);
    const out = await createHeroChapterServer({
      heroId: "h1",
      authorId: "stranger",
      authorDisplayName: "Stranger",
      authorCaste: "mage",
      rawBody: "Tale",
    });
    expect(out.status).toBe("pending");
    expect(out.approvedAt).toBeUndefined();
  });
});

describe("listHeroChaptersServer", () => {
  beforeEach(() => {
    mockGetAdminDb.mockReset();
  });

  it("returns only approved + non-deleted chapters by default", async () => {
    const { db } = makeDb({
      chaptersInOrder: [
        { id: "c1", status: "approved", body: "A" },
        { id: "c2", status: "pending", body: "B" },
        { id: "c3", status: "approved", body: "C", deletedAt: new Date() },
      ],
    });
    mockGetAdminDb.mockReturnValueOnce(db);
    const out = await listHeroChaptersServer({ heroId: "h1" });
    expect(out.map((c) => c.id)).toEqual(["c1"]);
  });

  it("includes pending chapters when includePending: true", async () => {
    const { db } = makeDb({
      chaptersInOrder: [
        { id: "c1", status: "approved", body: "A" },
        { id: "c2", status: "pending", body: "B" },
      ],
    });
    mockGetAdminDb.mockReturnValueOnce(db);
    const out = await listHeroChaptersServer({
      heroId: "h1",
      includePending: true,
    });
    expect(out.map((c) => c.id)).toEqual(["c1", "c2"]);
  });
});

describe("deleteHeroChapterServer", () => {
  beforeEach(() => {
    mockGetAdminDb.mockReset();
  });

  it("throws HeroLoreNotFoundError when the chapter is missing", async () => {
    const { db } = makeDb({ chapterByIdExists: false });
    mockGetAdminDb.mockReturnValueOnce(db);
    await expect(
      deleteHeroChapterServer({
        heroId: "h1",
        chapterId: "missing",
        callerUserId: "u1",
        callerIsAdmin: false,
      })
    ).rejects.toBeInstanceOf(HeroLoreNotFoundError);
  });

  it("throws HeroLoreForbiddenError for non-author non-admin", async () => {
    const { db } = makeDb({
      chapterById: { authorId: "other" },
    });
    mockGetAdminDb.mockReturnValueOnce(db);
    await expect(
      deleteHeroChapterServer({
        heroId: "h1",
        chapterId: "c1",
        callerUserId: "u1",
        callerIsAdmin: false,
      })
    ).rejects.toBeInstanceOf(HeroLoreForbiddenError);
  });

  it("lets the author delete their own (deletedByAdmin=false)", async () => {
    const { db, spies } = makeDb({
      chapterById: { authorId: "u1", body: "mine" },
    });
    mockGetAdminDb.mockReturnValueOnce(db);
    const out = await deleteHeroChapterServer({
      heroId: "h1",
      chapterId: "c1",
      callerUserId: "u1",
      callerIsAdmin: false,
    });
    expect(out.deletedByAdmin).toBe(false);
    expect(spies.chapterDocUpdate).toHaveBeenCalledTimes(1);
  });

  it("lets an admin delete someone else's (deletedByAdmin=true)", async () => {
    const { db } = makeDb({
      chapterById: { authorId: "stranger", body: "x" },
    });
    mockGetAdminDb.mockReturnValueOnce(db);
    const out = await deleteHeroChapterServer({
      heroId: "h1",
      chapterId: "c1",
      callerUserId: "admin",
      callerIsAdmin: true,
    });
    expect(out.deletedByAdmin).toBe(true);
  });

  it("when admin deletes their OWN chapter, deletedByAdmin is false", async () => {
    const { db } = makeDb({
      chapterById: { authorId: "admin", body: "mine" },
    });
    mockGetAdminDb.mockReturnValueOnce(db);
    const out = await deleteHeroChapterServer({
      heroId: "h1",
      chapterId: "c1",
      callerUserId: "admin",
      callerIsAdmin: true,
    });
    expect(out.deletedByAdmin).toBe(false);
  });
});

describe("approveHeroChapterServer", () => {
  beforeEach(() => {
    mockGetAdminDb.mockReset();
  });

  it("throws HeroLoreNotFoundError when the chapter is missing", async () => {
    const { db } = makeDb({ chapterByIdExists: false });
    mockGetAdminDb.mockReturnValueOnce(db);
    await expect(
      approveHeroChapterServer({
        heroId: "h1",
        chapterId: "missing",
        approverUserId: "admin",
      })
    ).rejects.toBeInstanceOf(HeroLoreNotFoundError);
  });

  it("stamps status=approved + approvedBy + approvedAt", async () => {
    const { db, spies } = makeDb({
      chapterById: {
        id: "c1",
        authorId: "u1",
        status: "pending",
        body: "pending",
      },
    });
    mockGetAdminDb.mockReturnValueOnce(db);
    const now = new Date("2026-05-18T01:00:00.000Z");
    const out = await approveHeroChapterServer({
      heroId: "h1",
      chapterId: "c1",
      approverUserId: "admin",
      now,
    });
    expect(out.status).toBe("approved");
    expect(out.approvedBy).toBe("admin");
    expect(out.approvedAt).toBe(now);
    expect(spies.chapterDocUpdate).toHaveBeenCalledTimes(1);
  });
});

describe("createHeroEpitaphServer", () => {
  beforeEach(() => {
    mockGetAdminDb.mockReset();
  });

  it("rejects an empty body", async () => {
    await expect(
      createHeroEpitaphServer({
        heroId: "h1",
        authorId: "u1",
        authorDisplayName: "U",
        authorCaste: null,
        rawBody: "  ",
      })
    ).rejects.toBeInstanceOf(HeroLoreEmptyError);
  });

  it("rejects bodies > MAX_EPITAPH_LENGTH", async () => {
    await expect(
      createHeroEpitaphServer({
        heroId: "h1",
        authorId: "u1",
        authorDisplayName: "U",
        authorCaste: null,
        rawBody: "x".repeat(MAX_EPITAPH_LENGTH + 1),
      })
    ).rejects.toBeInstanceOf(HeroLoreTooLongError);
  });

  it("forbids epitaphs for living heroes", async () => {
    const { db } = makeDb({
      hero: { isDeceased: false, awaitingResurrection: false },
    });
    mockGetAdminDb.mockReturnValueOnce(db);
    await expect(
      createHeroEpitaphServer({
        heroId: "h1",
        authorId: "u1",
        authorDisplayName: "U",
        authorCaste: null,
        rawBody: "Gone too soon",
      })
    ).rejects.toBeInstanceOf(HeroLoreForbiddenError);
  });

  it("allows epitaphs for deceased heroes", async () => {
    const { db, spies } = makeDb({
      hero: { isDeceased: true },
    });
    mockGetAdminDb.mockReturnValueOnce(db);
    const now = new Date("2026-05-18T02:00:00.000Z");
    const out = await createHeroEpitaphServer({
      heroId: "h1",
      authorId: "u1",
      authorDisplayName: "U",
      authorCaste: "scholar",
      rawBody: "Rest in code",
      now,
    });
    expect(out.body).toBe("Rest in code");
    expect(out.createdAt).toBe(now);
    expect(spies.epitaphDocSet).toHaveBeenCalledTimes(1);
  });

  it("allows epitaphs for awaiting-resurrection heroes", async () => {
    const { db } = makeDb({
      hero: { awaitingResurrection: true },
    });
    mockGetAdminDb.mockReturnValueOnce(db);
    const out = await createHeroEpitaphServer({
      heroId: "h1",
      authorId: "u1",
      authorDisplayName: "U",
      authorCaste: null,
      rawBody: "Awaiting",
    });
    expect(out.heroId).toBe("h1");
  });
});

describe("listHeroEpitaphsServer", () => {
  beforeEach(() => {
    mockGetAdminDb.mockReset();
  });

  it("filters out deleted epitaphs", async () => {
    const { db } = makeDb({
      epitaphsInOrder: [
        { id: "e1", body: "first" },
        { id: "e2", body: "deleted", deletedAt: new Date() },
        { id: "e3", body: "kept" },
      ],
    });
    mockGetAdminDb.mockReturnValueOnce(db);
    const out = await listHeroEpitaphsServer("h1");
    expect(out.map((e) => e.id)).toEqual(["e1", "e3"]);
  });
});

describe("deleteHeroEpitaphServer", () => {
  beforeEach(() => {
    mockGetAdminDb.mockReset();
  });

  it("throws HeroLoreNotFoundError when missing", async () => {
    const { db } = makeDb({ epitaphByIdExists: false });
    mockGetAdminDb.mockReturnValueOnce(db);
    await expect(
      deleteHeroEpitaphServer({
        heroId: "h1",
        epitaphId: "missing",
        callerUserId: "u1",
        callerIsAdmin: false,
      })
    ).rejects.toBeInstanceOf(HeroLoreNotFoundError);
  });

  it("forbids non-author non-admin", async () => {
    const { db } = makeDb({
      epitaphById: { authorId: "other" },
    });
    mockGetAdminDb.mockReturnValueOnce(db);
    await expect(
      deleteHeroEpitaphServer({
        heroId: "h1",
        epitaphId: "e1",
        callerUserId: "u1",
        callerIsAdmin: false,
      })
    ).rejects.toBeInstanceOf(HeroLoreForbiddenError);
  });

  it("lets author delete their own (not deletedByAdmin)", async () => {
    const { db } = makeDb({
      epitaphById: { authorId: "u1" },
    });
    mockGetAdminDb.mockReturnValueOnce(db);
    const out = await deleteHeroEpitaphServer({
      heroId: "h1",
      epitaphId: "e1",
      callerUserId: "u1",
      callerIsAdmin: false,
    });
    expect(out.deletedByAdmin).toBe(false);
  });

  it("admin deleting someone else flips deletedByAdmin=true", async () => {
    const { db } = makeDb({
      epitaphById: { authorId: "stranger" },
    });
    mockGetAdminDb.mockReturnValueOnce(db);
    const out = await deleteHeroEpitaphServer({
      heroId: "h1",
      epitaphId: "e1",
      callerUserId: "admin",
      callerIsAdmin: true,
    });
    expect(out.deletedByAdmin).toBe(true);
  });
});
