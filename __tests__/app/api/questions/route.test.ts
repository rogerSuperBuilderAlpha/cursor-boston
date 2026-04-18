/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { GET } from "@/app/api/questions/route";

const mockListQuestions = jest.fn();

jest.mock("@/lib/logger", () => ({
  logger: { logError: jest.fn() },
}));

jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: () => ({ success: true }),
  getClientIdentifier: () => "test-client",
}));

jest.mock("@/lib/questions/service", () => ({
  getQuestionsService: () => ({
    listQuestions: mockListQuestions,
  }),
}));

describe("GET /api/questions", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns questions list", async () => {
    mockListQuestions.mockResolvedValue({
      questions: [{ id: "q1", title: "Test" }],
      nextCursor: null,
    });

    const req = new NextRequest("http://localhost/api/questions?sort=newest&limit=10");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.questions).toHaveLength(1);
    expect(mockListQuestions).toHaveBeenCalledWith(
      expect.objectContaining({ sort: "newest", limit: 10 })
    );
  });

  it("passes search and tag params", async () => {
    mockListQuestions.mockResolvedValue({ questions: [], nextCursor: null });

    const req = new NextRequest("http://localhost/api/questions?search=debug&tag=debugging");
    await GET(req);

    expect(mockListQuestions).toHaveBeenCalledWith(
      expect.objectContaining({ search: "debug", tag: "debugging" })
    );
  });

  it("clamps limit to 50", async () => {
    mockListQuestions.mockResolvedValue({ questions: [], nextCursor: null });

    const req = new NextRequest("http://localhost/api/questions?limit=999");
    await GET(req);

    expect(mockListQuestions).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 50 })
    );
  });
});
