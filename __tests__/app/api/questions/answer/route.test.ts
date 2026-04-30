/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST } from "@/app/api/questions/answer/route";
import type { VerifiedUser } from "@/lib/server-auth";

const mockCreateAnswer = jest.fn();

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
    createAnswer: mockCreateAnswer,
  }),
  QuestionNotFoundError: class extends Error {
    constructor() { super("Question not found"); this.name = "QuestionNotFoundError"; }
  },
}));

const { getVerifiedUser } = jest.requireMock("@/lib/server-auth") as {
  getVerifiedUser: jest.MockedFunction<() => Promise<VerifiedUser | null>>;
};

const testUser: VerifiedUser = { uid: "u1", name: "Test User" };

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/questions/answer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/questions/answer", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    getVerifiedUser.mockResolvedValue(null);
    const res = await POST(makeRequest({ questionId: "q1", body: "An answer" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when questionId is invalid", async () => {
    getVerifiedUser.mockResolvedValue(testUser);
    const res = await POST(makeRequest({ questionId: "", body: "A long enough answer body here." }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when answer body is too short", async () => {
    getVerifiedUser.mockResolvedValue(testUser);
    const res = await POST(makeRequest({ questionId: "q1", body: "Short" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/answer/i);
  });

  it("creates an answer on valid input", async () => {
    getVerifiedUser.mockResolvedValue(testUser);
    mockCreateAnswer.mockResolvedValue("a1");

    const res = await POST(
      makeRequest({
        questionId: "q1",
        body: "Here is a detailed answer to your question about Cursor rules.",
      })
    );

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.answerId).toBe("a1");
  });
});
