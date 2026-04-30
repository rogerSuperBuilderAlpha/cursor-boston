/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST } from "@/app/api/questions/accept/route";
import type { VerifiedUser } from "@/lib/server-auth";

const mockAcceptAnswer = jest.fn();

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

jest.mock("@/lib/questions/service", () => {
  class QNF extends Error { constructor() { super("Question not found"); this.name = "QuestionNotFoundError"; } }
  class ANF extends Error { constructor() { super("Answer not found"); this.name = "AnswerNotFoundError"; } }
  class UA extends Error { constructor(m = "Unauthorized") { super(m); this.name = "UnauthorizedError"; } }
  return {
    getQuestionsService: () => ({
      acceptAnswer: mockAcceptAnswer,
    }),
    QuestionNotFoundError: QNF,
    AnswerNotFoundError: ANF,
    UnauthorizedError: UA,
  };
});

const { getVerifiedUser } = jest.requireMock("@/lib/server-auth") as {
  getVerifiedUser: jest.MockedFunction<() => Promise<VerifiedUser | null>>;
};

const testUser: VerifiedUser = { uid: "u1", name: "Test" };

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/questions/accept", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/questions/accept", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    getVerifiedUser.mockResolvedValue(null);
    const res = await POST(makeRequest({ questionId: "q1", answerId: "a1" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when IDs are invalid", async () => {
    getVerifiedUser.mockResolvedValue(testUser);
    const res = await POST(makeRequest({ questionId: "", answerId: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 403 when user is not the question author", async () => {
    getVerifiedUser.mockResolvedValue(testUser);
    const { UnauthorizedError } = jest.requireMock("@/lib/questions/service");
    mockAcceptAnswer.mockRejectedValue(new UnauthorizedError("Only the question author can accept an answer"));

    const res = await POST(makeRequest({ questionId: "q1", answerId: "a1" }));
    expect(res.status).toBe(403);
  });

  it("accepts an answer successfully", async () => {
    getVerifiedUser.mockResolvedValue(testUser);
    mockAcceptAnswer.mockResolvedValue(undefined);

    const res = await POST(makeRequest({ questionId: "q1", answerId: "a1" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });
});
