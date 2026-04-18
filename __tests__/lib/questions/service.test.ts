/**
 * @jest-environment node
 */

import {
  QuestionsService,
  QuestionNotFoundError,
  AnswerNotFoundError,
  UnauthorizedError,
} from "@/lib/questions/service";

const mockAdd = jest.fn();
const mockDocGet = jest.fn();
const mockDocUpdate = jest.fn();
const mockDocSet = jest.fn();
const mockDocDelete = jest.fn();
const mockQueryGet = jest.fn();
const mockRunTransaction = jest.fn();
const mockWhere = jest.fn();
const mockOrderBy = jest.fn();
const mockLimit = jest.fn();
const mockStartAfter = jest.fn();

function createMockQuery() {
  const q: Record<string, jest.Mock> = {};
  q.where = jest.fn().mockReturnValue(q);
  q.orderBy = jest.fn().mockReturnValue(q);
  q.limit = jest.fn().mockReturnValue(q);
  q.startAfter = jest.fn().mockReturnValue(q);
  q.get = mockQueryGet;
  return q;
}

const mockSubCollection = jest.fn();

function createMockDocRef() {
  return {
    get: mockDocGet,
    set: mockDocSet,
    update: mockDocUpdate,
    delete: mockDocDelete,
    collection: mockSubCollection,
    id: "mock-doc-id",
  };
}

const mockQuery = createMockQuery();

const mockDb = {
  collection: jest.fn().mockReturnValue({
    add: mockAdd,
    doc: jest.fn().mockReturnValue(createMockDocRef()),
    where: mockQuery.where,
    orderBy: mockQuery.orderBy,
    limit: mockQuery.limit,
    startAfter: mockQuery.startAfter,
    get: mockQueryGet,
  }),
  runTransaction: mockRunTransaction,
} as unknown as FirebaseFirestore.Firestore;

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(() => mockDb),
}));

describe("QuestionsService", () => {
  let service: QuestionsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new QuestionsService(mockDb);
  });

  describe("createQuestion", () => {
    it("creates a question and returns the doc id", async () => {
      mockAdd.mockResolvedValue({ id: "q1" });

      const id = await service.createQuestion("u1", "User One", null, {
        title: "How to debug?",
        body: "I need help debugging.",
        tags: ["debugging"],
      });

      expect(id).toBe("q1");
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "How to debug?",
          body: "I need help debugging.",
          tags: ["debugging"],
          authorId: "u1",
          authorName: "User One",
          upCount: 0,
          downCount: 0,
          netScore: 0,
          answerCount: 0,
        })
      );
    });

    it("filters invalid tags", async () => {
      mockAdd.mockResolvedValue({ id: "q2" });

      await service.createQuestion("u1", "User", null, {
        title: "Question",
        body: "Body",
        tags: ["debugging", "invalid-tag" as never],
      });

      const callArgs = mockAdd.mock.calls[0][0];
      expect(callArgs.tags).toEqual(["debugging"]);
    });
  });

  describe("getQuestion", () => {
    it("returns null when question does not exist", async () => {
      mockDocGet.mockResolvedValue({ exists: false });
      const result = await service.getQuestion("nonexistent");
      expect(result).toBeNull();
    });

    it("returns a question when it exists", async () => {
      const createdAt = { toDate: () => new Date("2026-01-01") };
      mockDocGet.mockResolvedValue({
        exists: true,
        id: "q1",
        data: () => ({
          title: "Test Q",
          body: "Test body",
          tags: ["debugging"],
          authorId: "u1",
          authorName: "User",
          authorPhoto: null,
          createdAt,
          updatedAt: createdAt,
          upCount: 5,
          downCount: 1,
          netScore: 4,
          answerCount: 2,
        }),
      });

      const result = await service.getQuestion("q1");
      expect(result).not.toBeNull();
      expect(result?.title).toBe("Test Q");
      expect(result?.netScore).toBe(4);
    });
  });

  describe("listQuestions", () => {
    it("returns paginated questions", async () => {
      const createdAt = { toDate: () => new Date("2026-01-01") };
      mockQueryGet.mockResolvedValue({
        docs: [
          {
            id: "q1",
            data: () => ({
              title: "Q1", body: "B1", tags: [], authorId: "u1", authorName: "U1",
              authorPhoto: null, createdAt, updatedAt: createdAt,
              upCount: 0, downCount: 0, netScore: 0, answerCount: 0,
            }),
          },
        ],
        empty: false,
      });

      const result = await service.listQuestions({ sort: "newest", limit: 20 });
      expect(result.questions).toHaveLength(1);
      expect(result.questions[0].title).toBe("Q1");
      expect(result.nextCursor).toBeNull();
    });
  });

  describe("vote", () => {
    it("adds a new vote via transaction", async () => {
      mockRunTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          get: jest.fn()
            .mockResolvedValueOnce({
              exists: true,
              data: () => ({ upCount: 0, downCount: 0 }),
            })
            .mockResolvedValueOnce({ exists: false }),
          set: jest.fn(),
          update: jest.fn(),
        };
        return fn(tx);
      });

      const result = await service.vote("question", "q1", "u1", "up");
      expect(result.action).toBe("added");
      expect(result.type).toBe("up");
      expect(result.upCount).toBe(1);
      expect(result.downCount).toBe(0);
    });

    it("removes a vote when toggling same type", async () => {
      mockRunTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          get: jest.fn()
            .mockResolvedValueOnce({
              exists: true,
              data: () => ({ upCount: 1, downCount: 0 }),
            })
            .mockResolvedValueOnce({
              exists: true,
              data: () => ({ type: "up" }),
            }),
          delete: jest.fn(),
          update: jest.fn(),
        };
        return fn(tx);
      });

      const result = await service.vote("question", "q1", "u1", "up");
      expect(result.action).toBe("removed");
      expect(result.upCount).toBe(0);
    });

    it("switches a vote", async () => {
      mockRunTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          get: jest.fn()
            .mockResolvedValueOnce({
              exists: true,
              data: () => ({ upCount: 1, downCount: 0 }),
            })
            .mockResolvedValueOnce({
              exists: true,
              data: () => ({ type: "up" }),
            }),
          update: jest.fn(),
        };
        return fn(tx);
      });

      const result = await service.vote("question", "q1", "u1", "down");
      expect(result.action).toBe("switched");
      expect(result.type).toBe("down");
      expect(result.previousType).toBe("up");
      expect(result.upCount).toBe(0);
      expect(result.downCount).toBe(1);
    });

    it("throws QuestionNotFoundError when target does not exist", async () => {
      mockRunTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          get: jest.fn()
            .mockResolvedValueOnce({ exists: false })
            .mockResolvedValueOnce({ exists: false }),
        };
        return fn(tx);
      });

      await expect(service.vote("question", "missing", "u1", "up")).rejects.toThrow(
        QuestionNotFoundError
      );
    });
  });

  describe("getUserVotes", () => {
    it("returns combined question and answer votes", async () => {
      mockQueryGet
        .mockResolvedValueOnce({
          docs: [{ data: () => ({ targetId: "q1", type: "up" }) }],
        })
        .mockResolvedValueOnce({
          docs: [{ data: () => ({ targetId: "a1", type: "down" }) }],
        });

      const votes = await service.getUserVotes("u1");
      expect(votes).toEqual({ q1: "up", a1: "down" });
    });
  });

  describe("error classes", () => {
    it("QuestionNotFoundError has correct name", () => {
      const err = new QuestionNotFoundError();
      expect(err.name).toBe("QuestionNotFoundError");
      expect(err.message).toBe("Question not found");
    });

    it("AnswerNotFoundError has correct name", () => {
      const err = new AnswerNotFoundError();
      expect(err.name).toBe("AnswerNotFoundError");
    });

    it("UnauthorizedError has correct name", () => {
      const err = new UnauthorizedError("Custom msg");
      expect(err.name).toBe("UnauthorizedError");
      expect(err.message).toBe("Custom msg");
    });
  });
});
