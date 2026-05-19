/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST, GET } from "@/app/api/questions/vote/route";
import type { VerifiedUser } from "@/lib/server-auth";

const mockVote = jest.fn();
const mockGetUserVotes = jest.fn();

jest.mock("@/lib/logger", () => ({
  logger: { logError: jest.fn() },
}));

jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: () => ({ success: true }),
  getClientIdentifier: () => "test-client",
}));

jest.mock("@/lib/upstash-rate-limit", () => ({
  checkUpstashRateLimit: jest.fn(async () => ({ success: true, remaining: 9, resetTime: Date.now() + 60000 })),
}));

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/questions/service", () => ({
  getQuestionsService: () => ({
    vote: mockVote,
    getUserVotes: mockGetUserVotes,
  }),
  QuestionNotFoundError: class extends Error {
    constructor() { super("Question not found"); this.name = "QuestionNotFoundError"; }
  },
  AnswerNotFoundError: class extends Error {
    constructor() { super("Answer not found"); this.name = "AnswerNotFoundError"; }
  },
  UnauthorizedError: class extends Error {
    constructor(msg = "Unauthorized") {
      super(msg);
      this.name = "UnauthorizedError";
    }
  },
}));

const { getVerifiedUser } = jest.requireMock("@/lib/server-auth") as {
  getVerifiedUser: jest.MockedFunction<() => Promise<VerifiedUser | null>>;
};

const testUser: VerifiedUser = { uid: "u1", name: "Test" };

function makePostRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/questions/vote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/questions/vote", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    getVerifiedUser.mockResolvedValue(null);
    const res = await POST(
      makePostRequest({ targetType: "question", targetId: "q1", type: "up" })
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid targetType", async () => {
    getVerifiedUser.mockResolvedValue(testUser);
    const res = await POST(
      makePostRequest({ targetType: "invalid", targetId: "q1", type: "up" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid type", async () => {
    getVerifiedUser.mockResolvedValue(testUser);
    const res = await POST(
      makePostRequest({ targetType: "question", targetId: "q1", type: "invalid" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when answer vote lacks questionId", async () => {
    getVerifiedUser.mockResolvedValue(testUser);
    const res = await POST(
      makePostRequest({ targetType: "answer", targetId: "a1", type: "up" })
    );
    expect(res.status).toBe(400);
  });

  it("votes on a question successfully", async () => {
    getVerifiedUser.mockResolvedValue(testUser);
    mockVote.mockResolvedValue({
      action: "added", type: "up", upCount: 1, downCount: 0, netScore: 1,
    });

    const res = await POST(
      makePostRequest({ targetType: "question", targetId: "q1", type: "up" })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.action).toBe("added");
    expect(mockVote).toHaveBeenCalledWith("question", "q1", "u1", "up", undefined);
  });

  it("adds a downvote", async () => {
    getVerifiedUser.mockResolvedValue(testUser);
    mockVote.mockResolvedValue({
      action: "added", type: "down", upCount: 0, downCount: 1, netScore: -1,
    });

    const res = await POST(
      makePostRequest({ targetType: "question", targetId: "q1", type: "down" })
    );
    expect(res.status).toBe(200);
    expect((await res.json()).action).toBe("added");
  });

  it("switches vote from up to down", async () => {
    getVerifiedUser.mockResolvedValue(testUser);
    mockVote.mockResolvedValue({
      action: "switched",
      type: "down",
      previousType: "up",
      upCount: 0,
      downCount: 1,
      netScore: -1,
    });

    const res = await POST(
      makePostRequest({ targetType: "question", targetId: "q1", type: "down" })
    );
    const data = await res.json();
    expect(data.action).toBe("switched");
    expect(data.previousType).toBe("up");
  });

  it("removes vote when toggling same type (unvote)", async () => {
    getVerifiedUser.mockResolvedValue(testUser);
    mockVote.mockResolvedValue({
      action: "removed", type: "up", upCount: 0, downCount: 0, netScore: 0,
    });

    const res = await POST(
      makePostRequest({ targetType: "question", targetId: "q1", type: "up" })
    );
    const data = await res.json();
    expect(data.action).toBe("removed");
    expect(data.upCount).toBe(0);
  });

  it("votes on an answer with questionId", async () => {
    getVerifiedUser.mockResolvedValue(testUser);
    mockVote.mockResolvedValue({
      action: "added", type: "up", upCount: 1, downCount: 0, netScore: 1,
    });

    const res = await POST(
      makePostRequest({
        targetType: "answer",
        targetId: "a1",
        questionId: "q1",
        type: "up",
      })
    );
    expect(res.status).toBe(200);
    expect(mockVote).toHaveBeenCalledWith("answer", "a1", "u1", "up", "q1");
  });

  it("returns 404 when question not found", async () => {
    getVerifiedUser.mockResolvedValue(testUser);
    const { QuestionNotFoundError } = jest.requireMock("@/lib/questions/service");
    mockVote.mockRejectedValue(new QuestionNotFoundError());

    const res = await POST(
      makePostRequest({ targetType: "question", targetId: "missing", type: "up" })
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when voting on own content", async () => {
    getVerifiedUser.mockResolvedValue(testUser);
    const { UnauthorizedError } = jest.requireMock("@/lib/questions/service");
    mockVote.mockRejectedValue(
      new UnauthorizedError("You cannot vote on your own content")
    );

    const res = await POST(
      makePostRequest({ targetType: "question", targetId: "q1", type: "up" })
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("You cannot vote on your own content");
  });
});

describe("GET /api/questions/vote", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns empty votes when not authenticated", async () => {
    getVerifiedUser.mockResolvedValue(null);
    const req = new NextRequest("http://localhost/api/questions/vote");
    const res = await GET(req);
    const data = await res.json();
    expect(data.userVotes).toEqual({});
  });

  it("returns user votes when authenticated", async () => {
    getVerifiedUser.mockResolvedValue(testUser);
    mockGetUserVotes.mockResolvedValue({ q1: "up", a1: "down" });

    const req = new NextRequest("http://localhost/api/questions/vote");
    const res = await GET(req);
    const data = await res.json();
    expect(data.userVotes).toEqual({ q1: "up", a1: "down" });
  });
});
