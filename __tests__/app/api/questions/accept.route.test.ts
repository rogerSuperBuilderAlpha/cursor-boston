/**
 * @jest-environment node
 *
 * OpenSSF Gold coverage push #55 — questions/accept POST route.
 */
import { NextRequest } from "next/server";
import { POST } from "@/app/api/questions/accept/route";
import { getVerifiedUser } from "@/lib/server-auth";
import {
  getQuestionsService,
  QuestionNotFoundError,
  AnswerNotFoundError,
  UnauthorizedError,
} from "@/lib/questions/service";
import { checkRateLimit } from "@/lib/rate-limit";

jest.mock("@/lib/server-auth", () => ({ getVerifiedUser: jest.fn() }));
jest.mock("@/lib/questions/service", () => {
  const actual = jest.requireActual("@/lib/questions/service");
  return {
    ...actual,
    getQuestionsService: jest.fn(),
  };
});
jest.mock("@/lib/rate-limit", () => ({
  ...jest.requireActual("@/lib/rate-limit"),
  checkRateLimit: jest.fn(),
  getClientIdentifier: jest.fn(() => "client-1"),
}));
jest.mock("@/lib/logger", () => ({
  logger: { logError: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockGetService = getQuestionsService as jest.MockedFunction<typeof getQuestionsService>;
const mockRate = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;

const VALID_BODY = { questionId: "q1", answerId: "a1" };

function makeReq(body: unknown = VALID_BODY) {
  return new NextRequest("https://example.com/api/questions/accept", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function fakeService(acceptImpl: jest.Mock = jest.fn().mockResolvedValue(undefined)) {
  mockGetService.mockReturnValue({ acceptAnswer: acceptImpl } as never);
  return acceptImpl;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRate.mockReturnValue({ success: true, remaining: 19, resetTime: Date.now() + 60000 } as never);
  mockUser.mockResolvedValue({ uid: "u1" } as never);
});

describe("POST /api/questions/accept", () => {
  it("returns 429 with Retry-After", async () => {
    mockRate.mockReturnValueOnce({
      success: false,
      remaining: 0,
      retryAfter: 30,
      resetTime: Date.now() + 60000,
    } as never);
    const res = await POST(makeReq());
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
  });

  it("defaults Retry-After=60 when retryAfter absent", async () => {
    mockRate.mockReturnValueOnce({
      success: false,
      remaining: 0,
      resetTime: Date.now() + 60000,
    } as never);
    const res = await POST(makeReq());
    expect(res.headers.get("Retry-After")).toBe("60");
  });

  it("returns 401 when unauthenticated", async () => {
    mockUser.mockResolvedValueOnce(null);
    const res = await POST(makeReq());
    expect(res.status).toBe(401);
  });

  it("returns 400 when body is not valid JSON", async () => {
    const res = await POST(makeReq("not-json"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when schema rejects body", async () => {
    const res = await POST(makeReq({ questionId: "q1" /* no answerId */ }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when sanitizeDocId rejects questionId", async () => {
    const res = await POST(makeReq({ questionId: "../bad", answerId: "a1" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when sanitizeDocId rejects answerId", async () => {
    const res = await POST(makeReq({ questionId: "q1", answerId: "../bad" }));
    expect(res.status).toBe(400);
  });

  it("calls service.acceptAnswer with sanitised IDs on happy path", async () => {
    const acceptSpy = fakeService();
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect(acceptSpy).toHaveBeenCalledWith("q1", "a1", "u1");
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("returns 404 on QuestionNotFoundError", async () => {
    fakeService(jest.fn().mockRejectedValue(new QuestionNotFoundError()));
    const res = await POST(makeReq());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Question not found");
  });

  it("returns 404 on AnswerNotFoundError", async () => {
    fakeService(jest.fn().mockRejectedValue(new AnswerNotFoundError()));
    const res = await POST(makeReq());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Answer not found");
  });

  it("returns 403 on UnauthorizedError", async () => {
    fakeService(jest.fn().mockRejectedValue(new UnauthorizedError("Only the question author can accept")));
    const res = await POST(makeReq());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Only the question author");
  });

  it("returns 500 on unknown service error", async () => {
    fakeService(jest.fn().mockRejectedValue(new Error("firestore down")));
    const res = await POST(makeReq());
    expect(res.status).toBe(500);
  });

  it("returns 500 when getQuestionsService throws (service init failure)", async () => {
    mockGetService.mockImplementation(() => {
      throw new Error("Firebase not initialized");
    });
    const res = await POST(makeReq());
    expect(res.status).toBe(500);
  });
});
