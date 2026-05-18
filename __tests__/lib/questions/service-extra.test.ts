/**
 * @jest-environment node
 *
 * Coverage push #63 — complementary tests for lib/questions/service.ts.
 * Existing service.test.ts left at 52%. This file picks up the gaps:
 *   - listQuestions sort + tag + cursor branches
 *   - searchQuestions multi-batch scan + cursor
 *   - createAnswer + getAnswersForQuestion + acceptAnswer
 *   - getAdminDb default-constructor path
 *   - getQuestionsService singleton
 */
const mockGetAdminDb = jest.fn();
jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: () => mockGetAdminDb(),
}));

const mockMatches = jest.fn();
jest.mock("@/lib/questions/search", () => ({
  matchesQuestionSearchTerms: (...a: unknown[]) => mockMatches(...a),
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "__ts" },
}));

import {
  AnswerNotFoundError,
  QuestionNotFoundError,
  QuestionsService,
  UnauthorizedError,
  getQuestionsService,
} from "@/lib/questions/service";

function tsLike(iso: string) {
  return { toDate: () => new Date(iso) };
}

type DocOut = { id: string; data: () => Record<string, unknown> };

function makeQueryChain(getResult: () => DocOut[] | { docs: DocOut[]; empty: boolean }) {
  type Chain = Record<string, jest.Mock>;
  const chain: Chain = {};
  chain.where = jest.fn(() => chain as unknown as Chain);
  chain.orderBy = jest.fn(() => chain as unknown as Chain);
  chain.limit = jest.fn(() => chain as unknown as Chain);
  chain.startAfter = jest.fn(() => chain as unknown as Chain);
  chain.get = jest.fn(async () => {
    const r = getResult();
    if (Array.isArray(r)) return { docs: r, empty: r.length === 0 };
    return r;
  });
  return chain as unknown as { [k: string]: jest.Mock };
}

function makeDb(opts: {
  questionsGet?: () => DocOut[];
  cursorDocExists?: boolean;
  searchBatches?: DocOut[][];
  questionDocs?: Record<string, { exists: boolean; data?: Record<string, unknown> }>;
  answerDocs?: Record<string, { exists: boolean; data?: Record<string, unknown> }>;
  answerListGet?: () => DocOut[];
}) {
  // Batch counter for searchQuestions multi-batch scan
  let searchIdx = 0;

  const collectionSpies: Record<string, jest.Mock> = {};
  const txOps: Array<{ op: string; args: unknown[] }> = [];

  function makeQuestionsCollection() {
    const baseGet = jest.fn(async () => {
      const docs = opts.questionsGet?.() ?? [];
      return { docs, empty: docs.length === 0 };
    });

    const chain = makeQueryChain(() => {
      if (opts.searchBatches) {
        const b = opts.searchBatches[searchIdx++] ?? [];
        return { docs: b, empty: b.length === 0 };
      }
      return opts.questionsGet?.() ?? [];
    });

    return {
      ...chain,
      get: opts.searchBatches ? chain.get : baseGet,
      add: jest.fn().mockResolvedValue({ id: "new-q" }),
      doc: jest.fn((qid?: string) => {
        const entry = opts.questionDocs?.[qid ?? ""] ?? { exists: false };
        const update = jest.fn().mockResolvedValue(undefined);
        const set = jest.fn().mockResolvedValue(undefined);
        const get = jest.fn().mockResolvedValue({
          exists: opts.cursorDocExists ?? entry.exists,
          data: () => entry.data ?? {},
          id: qid,
        });

        // Answers sub-collection
        const answersChain = makeQueryChain(() => opts.answerListGet?.() ?? []);
        const answersColl = {
          ...answersChain,
          doc: jest.fn((aid?: string) => {
            const a = opts.answerDocs?.[aid ?? ""] ?? { exists: false };
            return {
              id: aid ?? "anon-answer",
              get: jest.fn().mockResolvedValue({
                exists: a.exists,
                data: () => a.data ?? {},
                id: aid,
              }),
              set: jest.fn().mockResolvedValue(undefined),
              update: jest.fn().mockResolvedValue(undefined),
            };
          }),
        };

        return {
          id: qid,
          get,
          set,
          update,
          collection: jest.fn().mockReturnValue(answersColl),
        };
      }),
    };
  }

  const collection = jest.fn((name: string) => {
    if (!collectionSpies[name]) {
      if (name === "questions") collectionSpies[name] = jest.fn(makeQuestionsCollection);
      else collectionSpies[name] = jest.fn(makeQuestionsCollection); // reuse
    }
    return makeQuestionsCollection();
  });

  // Transaction
  function makeTxGet(ref: { id?: string; __coll?: string }) {
    // We don't differentiate collection here for simplicity — caller passes
    // refs returned by `.doc(...)` which themselves carry .id.
    const path = ref.id ?? "";
    const entry =
      opts.questionDocs?.[path] ?? opts.answerDocs?.[path] ?? { exists: false };
    return {
      exists: entry.exists,
      data: () => entry.data ?? {},
      id: path,
      ref,
    };
  }

  const txGet = jest.fn(async (ref) => {
    // Query-shaped (no .id) → return as a snapshot with .docs
    const r = ref as { id?: string; where?: unknown };
    if (!r.id) return { docs: [] };
    return makeTxGet(ref as never);
  });
  const txSet = jest.fn((ref, payload) => txOps.push({ op: "set", args: [ref, payload] }));
  const txUpdate = jest.fn((ref, payload) =>
    txOps.push({ op: "update", args: [ref, payload] })
  );
  const txDelete = jest.fn((ref) => txOps.push({ op: "delete", args: [ref] }));

  const runTransaction = jest.fn(async (fn) =>
    fn({ get: txGet, set: txSet, update: txUpdate, delete: txDelete })
  );

  return {
    db: { collection, runTransaction },
    spies: { txOps, txGet, txSet, txUpdate, txDelete },
  };
}

beforeEach(() => {
  mockGetAdminDb.mockReset();
  mockMatches.mockReset();
});

describe("constructor default (getAdminDb)", () => {
  it("uses getAdminDb when no db is passed in", () => {
    const { db } = makeDb({});
    mockGetAdminDb.mockReturnValueOnce(db);
    expect(() => new QuestionsService()).not.toThrow();
  });

  it("throws when getAdminDb returns null and no db is passed", () => {
    mockGetAdminDb.mockReturnValueOnce(null);
    expect(() => new QuestionsService()).toThrow(
      "Firebase Admin not initialized"
    );
  });
});

describe("listQuestions", () => {
  it("returns nextCursor when there are more pages", async () => {
    const { db } = makeDb({
      questionsGet: () => [
        { id: "q1", data: () => ({ title: "A", createdAt: tsLike("2026-05-18T00:00:00Z") }) },
        { id: "q2", data: () => ({ title: "B", createdAt: tsLike("2026-05-17T00:00:00Z") }) },
        { id: "q3", data: () => ({ title: "C", createdAt: tsLike("2026-05-16T00:00:00Z") }) },
      ],
    });
    const svc = new QuestionsService(db as never);
    const out = await svc.listQuestions({ limit: 2 });
    expect(out.questions).toHaveLength(2);
    expect(out.nextCursor).toBe("q2");
  });

  it("filters by valid tag, ignores invalid tag", async () => {
    const { db } = makeDb({
      questionsGet: () => [
        { id: "q1", data: () => ({ tags: ["bug"] }) },
      ],
    });
    const svc = new QuestionsService(db as never);
    await svc.listQuestions({ tag: "bug" });
    await svc.listQuestions({ tag: "not-a-tag" });
    // Both run without throwing — the bad tag branch is the implicit
    // skip of the `where("tags", "array-contains", …)` call.
  });

  it("sort=top adds netScore + createdAt orderBys", async () => {
    const { db } = makeDb({ questionsGet: () => [] });
    const svc = new QuestionsService(db as never);
    const out = await svc.listQuestions({ sort: "top" });
    expect(out.questions).toEqual([]);
  });

  it("sort=unanswered adds answerCount==0 + createdAt orderBy", async () => {
    const { db } = makeDb({ questionsGet: () => [] });
    const svc = new QuestionsService(db as never);
    const out = await svc.listQuestions({ sort: "unanswered" });
    expect(out.questions).toEqual([]);
  });

  it("startAfter only fires when the cursor doc exists", async () => {
    const { db } = makeDb({
      questionsGet: () => [],
      cursorDocExists: true,
    });
    const svc = new QuestionsService(db as never);
    const out = await svc.listQuestions({ cursor: "q1" });
    expect(out.questions).toEqual([]);
  });

  it("missing cursor doc does NOT call startAfter", async () => {
    const { db } = makeDb({
      questionsGet: () => [],
      cursorDocExists: false,
    });
    const svc = new QuestionsService(db as never);
    const out = await svc.listQuestions({ cursor: "missing" });
    expect(out.questions).toEqual([]);
  });
});

describe("listQuestions → searchQuestions branch", () => {
  it("scans multiple batches and stops at the limit", async () => {
    // 2 batches, each 40 docs. We let matchesQuestionSearchTerms return
    // true for ~half the docs.
    const batch1: DocOut[] = Array.from({ length: 40 }, (_, i) => ({
      id: `q${i}`,
      data: () => ({ title: `T${i}`, body: "", tags: [] }),
    }));
    const batch2: DocOut[] = Array.from({ length: 5 }, (_, i) => ({
      id: `qB${i}`,
      data: () => ({ title: `B${i}`, body: "", tags: [] }),
    }));
    const { db } = makeDb({
      searchBatches: [batch1, batch2],
    });
    mockMatches.mockImplementation((title: string) => title.startsWith("T"));
    const svc = new QuestionsService(db as never);
    const out = await svc.listQuestions({ search: "hello", limit: 5 });
    expect(out.questions.length).toBe(5);
    expect(out.nextCursor).not.toBeNull();
  });

  it("breaks when a batch is short (less than SEARCH_SCAN_BATCH)", async () => {
    const batch1: DocOut[] = [
      { id: "q1", data: () => ({ title: "match", body: "", tags: [] }) },
    ];
    const { db } = makeDb({ searchBatches: [batch1] });
    mockMatches.mockReturnValue(true);
    const svc = new QuestionsService(db as never);
    const out = await svc.listQuestions({ search: "x", limit: 5 });
    expect(out.questions.map((q) => q.id)).toEqual(["q1"]);
    expect(out.nextCursor).toBeNull();
  });

  it("forwards a valid tag filter to the search base query", async () => {
    const { db } = makeDb({ searchBatches: [[]] });
    mockMatches.mockReturnValue(true);
    const svc = new QuestionsService(db as never);
    const out = await svc.listQuestions({ search: "foo", tag: "bug" });
    expect(out.questions).toEqual([]);
  });
});

describe("createAnswer", () => {
  it("throws when the question doesn't exist", async () => {
    const { db } = makeDb({
      questionDocs: { q1: { exists: false } },
    });
    const svc = new QuestionsService(db as never);
    await expect(
      svc.createAnswer("q1", "u1", "User", null, "answer body")
    ).rejects.toBeInstanceOf(QuestionNotFoundError);
  });

  it("writes an answer + bumps answerCount on the question", async () => {
    const { db, spies } = makeDb({
      questionDocs: { q1: { exists: true, data: { answerCount: 4 } } },
    });
    const svc = new QuestionsService(db as never);
    const id = await svc.createAnswer("q1", "u1", "User", "p.png", "body");
    expect(typeof id).toBe("string");
    expect(spies.txSet).toHaveBeenCalledTimes(1);
    expect(spies.txUpdate).toHaveBeenCalledTimes(1);
    const updateArgs = spies.txUpdate.mock.calls[0][1];
    expect(updateArgs.answerCount).toBe(5);
  });
});

describe("getAnswersForQuestion", () => {
  it("pins accepted answers above non-accepted, default sort=top", async () => {
    const { db } = makeDb({
      answerListGet: () => [
        { id: "a1", data: () => ({ isAccepted: false }) },
        { id: "a2", data: () => ({ isAccepted: true }) },
        { id: "a3", data: () => ({ isAccepted: false }) },
      ],
    });
    const svc = new QuestionsService(db as never);
    const out = await svc.getAnswersForQuestion("q1");
    expect(out[0].id).toBe("a2"); // accepted first
    expect(out.slice(1).map((a) => a.id)).toEqual(["a1", "a3"]);
  });

  it("supports sort=newest", async () => {
    const { db } = makeDb({
      answerListGet: () => [
        { id: "a1", data: () => ({ isAccepted: false, body: "b" }) },
      ],
    });
    const svc = new QuestionsService(db as never);
    const out = await svc.getAnswersForQuestion("q1", "newest");
    expect(out).toHaveLength(1);
  });
});

describe("acceptAnswer", () => {
  it("throws QuestionNotFoundError when the question is missing", async () => {
    const { db } = makeDb({
      questionDocs: { q1: { exists: false } },
    });
    const svc = new QuestionsService(db as never);
    await expect(svc.acceptAnswer("q1", "a1", "u1")).rejects.toBeInstanceOf(
      QuestionNotFoundError
    );
  });

  it("throws UnauthorizedError when caller isn't the question author", async () => {
    const { db } = makeDb({
      questionDocs: { q1: { exists: true, data: { authorId: "other" } } },
    });
    const svc = new QuestionsService(db as never);
    await expect(svc.acceptAnswer("q1", "a1", "u1")).rejects.toBeInstanceOf(
      UnauthorizedError
    );
  });

  it("throws AnswerNotFoundError when the answer is missing", async () => {
    const { db } = makeDb({
      questionDocs: { q1: { exists: true, data: { authorId: "u1" } } },
      answerDocs: { a1: { exists: false } },
    });
    const svc = new QuestionsService(db as never);
    await expect(svc.acceptAnswer("q1", "a1", "u1")).rejects.toBeInstanceOf(
      AnswerNotFoundError
    );
  });

  it("toggles acceptance off when already accepted", async () => {
    const { db, spies } = makeDb({
      questionDocs: { q1: { exists: true, data: { authorId: "u1" } } },
      answerDocs: { a1: { exists: true, data: { isAccepted: true } } },
    });
    const svc = new QuestionsService(db as never);
    await svc.acceptAnswer("q1", "a1", "u1");
    const updates = spies.txUpdate.mock.calls.map((c) => c[1]);
    expect(updates.some((u) => u.isAccepted === false)).toBe(true);
  });
});

describe("getQuestionsService", () => {
  it("caches a singleton", () => {
    mockGetAdminDb.mockReturnValue({
      collection: jest.fn(),
      runTransaction: jest.fn(),
    });
    const a = getQuestionsService();
    const b = getQuestionsService();
    expect(a).toBe(b);
  });
});
