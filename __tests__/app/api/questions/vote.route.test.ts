/**
 * @jest-environment node
 *
 * OpenSSF Gold coverage push #53 — questions/vote POST + GET route.
 */
import { NextRequest } from "next/server";
import { POST, GET } from "@/app/api/questions/vote/route";
import { getVerifiedUser } from "@/lib/server-auth";
import {
  getQuestionsService,
  QuestionNotFoundError,
  AnswerNotFoundError,
  UnauthorizedError,
} from "@/lib/questions/service";
import { checkUpstashRateLimit } from "@/lib/upstash-rate-limit";

jest.mock("@/lib/server-auth", () => ({ getVerifiedUser: jest.fn() }));
jest.mock("@/lib/questions/service", () => {
  const actual = jest.requireActual("@/lib/questions/service");
  return {
    ...actual,
    getQuestionsService: jest.fn(),
  };
});
jest.mock("@/lib/upstash-rate-limit", () => ({
  checkUpstashRateLimit: jest.fn(),
}));
jest.mock("@/lib/rate-limit", () => ({
  ...jest.requireActual("@/lib/rate-limit"),
  getClientIdentifier: jest.fn(() => "client-1"),
}));
jest.mock("@/lib/logger", () => ({
  logger: { logError: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockGetService = getQuestionsService as jest.MockedFunction<typeof getQuestionsService>;
const mockRate = checkUpstashRateLimit as jest.MockedFunction<typeof checkUpstashRateLimit>;

function makeReq(body: unknown, method: "GET" | "POST" = "POST") {
  return new NextRequest("https://example.com/api/questions/vote", {
    method,
    headers: { "content-type": "application/json" },
    body: method === "POST"
      ? (typeof body === "string" ? body : JSON.stringify(body))
      : undefined,
  });
}

function fakeService(opts: {
  voteImpl?: jest.Mock;
  userVotesImpl?: jest.Mock;
}) {
  const vote = opts.voteImpl ?? jest.fn().mockResolvedValue({ ok: true, newScore: 5 });
  const getUserVotes = opts.userVotesImpl ?? jest.fn().mockResolvedValue({ "q1": "up" });
  mockGetService.mockReturnValue({ vote, getUserVotes } as never);
  return { vote, getUserVotes };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRate.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 } as never);
  mockUser.mockResolvedValue({ uid: "u1", email: "u@x" } as never);
});

describe("POST /api/questions/vote", () => {
  it("returns 429 with Retry-After", async () => {
    mockRate.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      retryAfter: 20,
      resetTime: Date.now() + 60000,
    } as never);
    const res = await POST(makeReq({ targetType: "question", targetId: "q1", type: "up" }));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("20");
  });

  it("defaults Retry-After=60 when retryAfter absent", async () => {
    mockRate.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      resetTime: Date.now() + 60000,
    } as never);
    const res = await POST(makeReq({ targetType: "question", targetId: "q1", type: "up" }));
    expect(res.headers.get("Retry-After")).toBe("60");
  });

  it("returns 401 when unauthenticated", async () => {
    mockUser.mockResolvedValueOnce(null);
    const res = await POST(makeReq({ targetType: "question", targetId: "q1", type: "up" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when body is not valid JSON", async () => {
    const res = await POST(makeReq("not-json"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid JSON");
  });

  it("returns 400 when schema rejects body", async () => {
    const res = await POST(makeReq({ targetType: "question" /* missing targetId, type */ }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when sanitizeDocId rejects targetId", async () => {
    const res = await POST(
      makeReq({ targetType: "question", targetId: "../bad", type: "up" }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when answer vote is missing questionId", async () => {
    const res = await POST(
      makeReq({ targetType: "answer", targetId: "a1", type: "up" /* no questionId */ }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("questionId required");
  });

  it("returns 400 when answer vote's questionId is invalid", async () => {
    const res = await POST(
      makeReq({ targetType: "answer", targetId: "a1", type: "up", questionId: "../bad" }),
    );
    expect(res.status).toBe(400);
  });

  it("calls service.vote with sanitised IDs on question vote happy path", async () => {
    const { vote } = fakeService({});
    const res = await POST(
      makeReq({ targetType: "question", targetId: "q1", type: "up" }),
    );
    expect(res.status).toBe(200);
    expect(vote).toHaveBeenCalledWith("question", "q1", "u1", "up", undefined);
    const body = await res.json();
    expect(body).toEqual({ ok: true, newScore: 5 });
  });

  it("calls service.vote with both targetId + questionId on answer vote", async () => {
    const { vote } = fakeService({});
    await POST(
      makeReq({ targetType: "answer", targetId: "a1", type: "down", questionId: "q1" }),
    );
    expect(vote).toHaveBeenCalledWith("answer", "a1", "u1", "down", "q1");
  });

  it("returns 404 when service throws QuestionNotFoundError", async () => {
    fakeService({
      voteImpl: jest.fn().mockRejectedValue(new QuestionNotFoundError()),
    });
    const res = await POST(makeReq({ targetType: "question", targetId: "q1", type: "up" }));
    expect(res.status).toBe(404);
  });

  it("returns 404 when service throws AnswerNotFoundError", async () => {
    fakeService({
      voteImpl: jest.fn().mockRejectedValue(new AnswerNotFoundError()),
    });
    const res = await POST(
      makeReq({ targetType: "answer", targetId: "a1", type: "up", questionId: "q1" }),
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when service throws UnauthorizedError", async () => {
    fakeService({
      voteImpl: jest.fn().mockRejectedValue(new UnauthorizedError("Cannot vote on own post")),
    });
    const res = await POST(makeReq({ targetType: "question", targetId: "q1", type: "up" }));
    expect(res.status).toBe(403);
  });

  it("returns 500 when service.vote throws an unknown error", async () => {
    fakeService({
      voteImpl: jest.fn().mockRejectedValue(new Error("firestore down")),
    });
    const res = await POST(makeReq({ targetType: "question", targetId: "q1", type: "up" }));
    expect(res.status).toBe(500);
  });
});

describe("GET /api/questions/vote", () => {
  it("returns empty userVotes when unauthenticated", async () => {
    mockUser.mockResolvedValueOnce(null);
    const res = await GET(makeReq({}, "GET"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ userVotes: {} });
  });

  it("returns the user's votes on happy path", async () => {
    fakeService({});
    const res = await GET(makeReq({}, "GET"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userVotes).toEqual({ q1: "up" });
  });

  it("returns empty map when service throws", async () => {
    fakeService({
      userVotesImpl: jest.fn().mockRejectedValue(new Error("firestore down")),
    });
    const res = await GET(makeReq({}, "GET"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ userVotes: {} });
  });
});
