/**
 * @jest-environment node
 *
 * OpenSSF Gold coverage push #54 — questions/answer POST route.
 */
import { NextRequest } from "next/server";
import { POST } from "@/app/api/questions/answer/route";
import { getVerifiedUser } from "@/lib/server-auth";
import { getQuestionsService, QuestionNotFoundError } from "@/lib/questions/service";
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
jest.mock("@/lib/utils", () => ({
  ...jest.requireActual("@/lib/utils"),
  getDisplayName: (user: { name?: string }) => user?.name || "Anon",
}));

const mockUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockGetService = getQuestionsService as jest.MockedFunction<typeof getQuestionsService>;
const mockRate = checkUpstashRateLimit as jest.MockedFunction<typeof checkUpstashRateLimit>;

const VALID_BODY = {
  questionId: "q1",
  body: "Here's a detailed answer that's long enough to pass length validation.",
};

function makeReq(body: unknown = VALID_BODY) {
  return new NextRequest("https://example.com/api/questions/answer", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function fakeService(createImpl: jest.Mock = jest.fn().mockResolvedValue("new-answer-id")) {
  mockGetService.mockReturnValue({ createAnswer: createImpl } as never);
  return createImpl;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRate.mockResolvedValue({ success: true, remaining: 19, resetTime: Date.now() + 60000 } as never);
  mockUser.mockResolvedValue({ uid: "u1", name: "Alice", picture: "https://x/a.png" } as never);
});

describe("POST /api/questions/answer", () => {
  it("returns 429 with Retry-After", async () => {
    mockRate.mockResolvedValueOnce({
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
    mockRate.mockResolvedValueOnce({
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
    const res = await POST(makeReq({ questionId: "q1" /* no body */ }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when sanitizeDocId rejects questionId", async () => {
    const res = await POST(makeReq({ ...VALID_BODY, questionId: "../bad" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when body is too short (after sanitisation)", async () => {
    const res = await POST(makeReq({ ...VALID_BODY, body: "tooshort" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when body is too long (>5000)", async () => {
    const res = await POST(makeReq({ ...VALID_BODY, body: "A".repeat(5001) }));
    expect(res.status).toBe(400);
  });

  it("creates the answer and returns 201 with id on happy path", async () => {
    const createSpy = fakeService();
    const res = await POST(makeReq());
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.answerId).toBe("new-answer-id");
    expect(createSpy).toHaveBeenCalledWith(
      "q1",
      "u1",
      "Alice",
      "https://x/a.png",
      expect.any(String),
    );
  });

  it("uses null picture when user.picture is absent", async () => {
    mockUser.mockResolvedValue({ uid: "u2", name: "Bob" } as never);
    const createSpy = fakeService();
    await POST(makeReq());
    expect(createSpy).toHaveBeenCalledWith("q1", "u2", "Bob", null, expect.any(String));
  });

  it("returns 404 when service throws QuestionNotFoundError", async () => {
    fakeService(jest.fn().mockRejectedValue(new QuestionNotFoundError()));
    const res = await POST(makeReq());
    expect(res.status).toBe(404);
  });

  it("returns 500 when service.createAnswer throws unknown error", async () => {
    fakeService(jest.fn().mockRejectedValue(new Error("firestore down")));
    const res = await POST(makeReq());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal server error");
  });

  it("returns 500 when getQuestionsService throws (service init failure)", async () => {
    mockGetService.mockImplementation(() => {
      throw new Error("Firebase not initialized");
    });
    const res = await POST(makeReq());
    expect(res.status).toBe(500);
  });
});
