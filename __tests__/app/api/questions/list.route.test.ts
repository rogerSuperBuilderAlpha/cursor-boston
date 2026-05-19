/**
 * @jest-environment node
 *
 * OpenSSF Gold coverage push #49 — questions list GET route.
 */
import { NextRequest } from "next/server";
import { GET } from "@/app/api/questions/route";
import { getQuestionsService } from "@/lib/questions/service";
import { checkRateLimit } from "@/lib/rate-limit";

jest.mock("@/lib/questions/service", () => ({
  getQuestionsService: jest.fn(),
}));
jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: jest.fn(),
  getClientIdentifier: jest.fn(() => "client-1"),
}));
jest.mock("@/lib/logger", () => ({
  logger: { logError: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockGetService = getQuestionsService as jest.MockedFunction<typeof getQuestionsService>;
const mockRate = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;

function makeReq(searchParams: Record<string, string> = {}) {
  const url = new URL("https://example.com/api/questions");
  for (const [k, v] of Object.entries(searchParams)) url.searchParams.set(k, v);
  return new NextRequest(url);
}

function fakeService(listImpl: jest.Mock) {
  mockGetService.mockReturnValue({ listQuestions: listImpl } as never);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRate.mockReturnValue({ success: true, remaining: 99, resetTime: Date.now() + 60000 } as never);
});

describe("GET /api/questions", () => {
  it("returns 429 with Retry-After when rate-limited", async () => {
    mockRate.mockReturnValueOnce({
      success: false,
      remaining: 0,
      retryAfter: 45,
      resetTime: Date.now() + 60000,
    } as never);
    const res = await GET(makeReq());
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("45");
  });

  it("defaults Retry-After=60 when rate-limit response lacks retryAfter", async () => {
    mockRate.mockReturnValueOnce({
      success: false,
      remaining: 0,
      resetTime: Date.now() + 60000,
    } as never);
    const res = await GET(makeReq());
    expect(res.headers.get("Retry-After")).toBe("60");
  });

  it("returns 400 when zod query validation fails (limit non-numeric)", async () => {
    const res = await GET(makeReq({ limit: "abc" }));
    expect(res.status).toBe(400);
  });

  it("returns empty list when getQuestionsService() throws (service not configured)", async () => {
    mockGetService.mockImplementation(() => {
      throw new Error("Firebase not initialized");
    });
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ questions: [], nextCursor: null });
  });

  it("defaults sort to 'newest' when not specified", async () => {
    const listSpy = jest.fn().mockResolvedValue({ questions: [], nextCursor: null });
    fakeService(listSpy);
    await GET(makeReq());
    expect(listSpy).toHaveBeenCalledWith(
      expect.objectContaining({ sort: "newest" }),
    );
  });

  it("forwards tag/search/limit/cursor query params to the service", async () => {
    const listSpy = jest.fn().mockResolvedValue({ questions: [{ id: "q1" }], nextCursor: "c1" });
    fakeService(listSpy);
    const res = await GET(
      makeReq({
        sort: "votes",
        tag: "typescript",
        search: "zod",
        limit: "30",
        cursor: "cursor-abc",
      }),
    );
    expect(res.status).toBe(200);
    expect(listSpy).toHaveBeenCalledWith({
      sort: "votes",
      tag: "typescript",
      search: "zod",
      limit: 30,
      cursor: "cursor-abc",
    });
    const body = await res.json();
    expect(body.questions).toEqual([{ id: "q1" }]);
    expect(body.nextCursor).toBe("c1");
  });

  it("clamps limit to a maximum of 50", async () => {
    const listSpy = jest.fn().mockResolvedValue({ questions: [], nextCursor: null });
    fakeService(listSpy);
    await GET(makeReq({ limit: "9999" }));
    expect(listSpy).toHaveBeenCalledWith(expect.objectContaining({ limit: 50 }));
  });

  it("defaults limit to 20 when not specified", async () => {
    const listSpy = jest.fn().mockResolvedValue({ questions: [], nextCursor: null });
    fakeService(listSpy);
    await GET(makeReq());
    expect(listSpy).toHaveBeenCalledWith(expect.objectContaining({ limit: 20 }));
  });

  it("returns empty list when service.listQuestions throws (top-level catch)", async () => {
    const listSpy = jest.fn().mockRejectedValue(new Error("firestore down"));
    fakeService(listSpy);
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ questions: [], nextCursor: null });
  });
});
