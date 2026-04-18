/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST } from "@/app/api/questions/post/route";
import type { VerifiedUser } from "@/lib/server-auth";

const mockCreateQuestion = jest.fn();

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
    createQuestion: mockCreateQuestion,
  }),
}));

const { getVerifiedUser } = jest.requireMock("@/lib/server-auth") as {
  getVerifiedUser: jest.MockedFunction<() => Promise<VerifiedUser | null>>;
};

const testUser: VerifiedUser = { uid: "u1", name: "Test User" };

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/questions/post", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/questions/post", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    getVerifiedUser.mockResolvedValue(null);
    const res = await POST(makeRequest({ title: "Test", body: "Body here", tags: [] }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when title is too short", async () => {
    getVerifiedUser.mockResolvedValue(testUser);
    const res = await POST(makeRequest({ title: "Short", body: "This body is long enough for validation.", tags: [] }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/title/i);
  });

  it("returns 400 when body is too short", async () => {
    getVerifiedUser.mockResolvedValue(testUser);
    const res = await POST(makeRequest({ title: "A valid question title here", body: "Short", tags: [] }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/body/i);
  });

  it("creates a question on valid input", async () => {
    getVerifiedUser.mockResolvedValue(testUser);
    mockCreateQuestion.mockResolvedValue("new-q-id");

    const res = await POST(
      makeRequest({
        title: "How do I configure Cursor rules?",
        body: "I need help setting up rules for my project. Can someone explain?",
        tags: ["cursor-rules", "workflows"],
      })
    );

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.questionId).toBe("new-q-id");
    expect(mockCreateQuestion).toHaveBeenCalledWith(
      "u1",
      "Test User",
      null,
      expect.objectContaining({
        tags: ["cursor-rules", "workflows"],
      })
    );
  });

  it("filters out invalid tags", async () => {
    getVerifiedUser.mockResolvedValue(testUser);
    mockCreateQuestion.mockResolvedValue("q-id");

    await POST(
      makeRequest({
        title: "A valid question title here",
        body: "This body is long enough to pass validation requirements.",
        tags: ["debugging", "not-a-real-tag"],
      })
    );

    expect(mockCreateQuestion).toHaveBeenCalledWith(
      "u1",
      "Test User",
      null,
      expect.objectContaining({
        tags: ["debugging"],
      })
    );
  });
});
