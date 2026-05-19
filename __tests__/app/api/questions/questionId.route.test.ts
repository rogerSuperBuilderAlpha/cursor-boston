/**
 * @jest-environment node
 *
 * OpenSSF Gold coverage push #51 — questions/[questionId] GET route.
 */
import { NextRequest } from "next/server";
import { GET } from "@/app/api/questions/[questionId]/route";
import { getQuestionsService } from "@/lib/questions/service";
import { checkRateLimit } from "@/lib/rate-limit";

jest.mock("@/lib/questions/service", () => ({
  getQuestionsService: jest.fn(),
}));
jest.mock("@/lib/rate-limit", () => ({
  ...jest.requireActual("@/lib/rate-limit"),
  checkRateLimit: jest.fn(),
  getClientIdentifier: jest.fn(() => "client-1"),
}));
jest.mock("@/lib/logger", () => ({
  logger: { logError: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockGetService = getQuestionsService as jest.MockedFunction<typeof getQuestionsService>;
const mockRate = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;

function makeReq() {
  return new NextRequest("https://example.com/api/questions/q1");
}

function withParams(questionId: string) {
  return { params: Promise.resolve({ questionId }) };
}

function fakeService(opts: {
  question?: unknown;
  answers?: unknown[];
  related?: unknown[];
  getQuestionThrows?: boolean;
}) {
  const getQuestion = opts.getQuestionThrows
    ? jest.fn().mockRejectedValue(new Error("service failed"))
    : jest.fn().mockResolvedValue(opts.question ?? null);
  const getAnswersForQuestion = jest.fn().mockResolvedValue(opts.answers ?? []);
  const getRelatedCookbookEntries = jest.fn().mockResolvedValue(opts.related ?? []);
  mockGetService.mockReturnValue({
    getQuestion,
    getAnswersForQuestion,
    getRelatedCookbookEntries,
  } as never);
  return { getQuestion, getAnswersForQuestion, getRelatedCookbookEntries };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRate.mockReturnValue({ success: true, remaining: 99, resetTime: Date.now() + 60000 } as never);
});

describe("GET /api/questions/[questionId]", () => {
  it("returns 429 with Retry-After when rate-limited", async () => {
    mockRate.mockReturnValueOnce({
      success: false,
      remaining: 0,
      retryAfter: 30,
      resetTime: Date.now() + 60000,
    } as never);
    const res = await GET(makeReq(), withParams("q1"));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
  });

  it("defaults Retry-After=60 when rate-limit lacks retryAfter", async () => {
    mockRate.mockReturnValueOnce({
      success: false,
      remaining: 0,
      resetTime: Date.now() + 60000,
    } as never);
    const res = await GET(makeReq(), withParams("q1"));
    expect(res.headers.get("Retry-After")).toBe("60");
  });

  it("returns 400 when zod path param validation fails (empty string)", async () => {
    const res = await GET(makeReq(), withParams(""));
    expect(res.status).toBe(400);
  });

  it("returns 400 when sanitizeDocId rejects path traversal", async () => {
    const res = await GET(makeReq(), withParams("../../bad"));
    expect(res.status).toBe(400);
  });

  it("returns 404 when service.getQuestion returns null", async () => {
    fakeService({ question: null });
    const res = await GET(makeReq(), withParams("q1"));
    expect(res.status).toBe(404);
  });

  it("returns the question, top answers, and related cookbook on happy path", async () => {
    const { getRelatedCookbookEntries } = fakeService({
      question: { id: "q1", tags: ["ts", "next"] },
      answers: [{ id: "a1" }],
      related: [{ id: "cb1" }],
    });
    const res = await GET(makeReq(), withParams("q1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.question).toEqual({ id: "q1", tags: ["ts", "next"] });
    expect(body.answers).toEqual([{ id: "a1" }]);
    expect(body.relatedCookbook).toEqual([{ id: "cb1" }]);
    expect(getRelatedCookbookEntries).toHaveBeenCalledWith(["ts", "next"]);
  });

  it("returns 500 'Internal server error' when service.getQuestion throws", async () => {
    fakeService({ getQuestionThrows: true });
    const res = await GET(makeReq(), withParams("q1"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal server error");
  });

  it("returns 500 when getQuestionsService() throws (service init failure)", async () => {
    mockGetService.mockImplementation(() => {
      throw new Error("Firebase not initialized");
    });
    const res = await GET(makeReq(), withParams("q1"));
    expect(res.status).toBe(500);
  });
});
