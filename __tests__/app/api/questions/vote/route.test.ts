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
