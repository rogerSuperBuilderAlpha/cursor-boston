/**
 * @jest-environment node
 *
 * Tests for the Upstash Redis rate limiter with in-memory fallback.
 *
 * Three scenarios are covered:
 *   1. No credentials → immediate fallback to in-memory limiter (getRedis returns null)
 *   2. Redis transient error → catch-block fallback to in-memory limiter
 *   3. Happy path → Upstash result is returned directly
 */

import { checkRateLimit } from "@/lib/rate-limit";

// ---------------------------------------------------------------------------
// Module mocks (hoisted by Jest before any import)
// ---------------------------------------------------------------------------

jest.mock("@upstash/redis", () => ({
  Redis: jest.fn(() => ({})),
}));

// The mock Ratelimit constructor returns an instance whose `limit` method is
// a shared jest.fn() exposed via __mockLimit so tests can configure it.
jest.mock("@upstash/ratelimit", () => {
  const mockLimit = jest.fn();
  const MockRatelimit = jest
    .fn()
    .mockImplementation(() => ({ limit: mockLimit }));
  MockRatelimit.fixedWindow = jest.fn().mockReturnValue("fw");
  MockRatelimit.__mockLimit = mockLimit;
  return { Ratelimit: MockRatelimit };
});

jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Grab mock references
// ---------------------------------------------------------------------------

 
const { Ratelimit } = jest.requireMock("@upstash/ratelimit") as any;
const mockLimit: jest.Mock = Ratelimit.__mockLimit;
const mockedCheckRateLimit = checkRateLimit as jest.MockedFunction<
  typeof checkRateLimit
>;

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const OPTIONS = { windowMs: 60_000, maxRequests: 10 };
const IDENTIFIER = "test-user-123";

const MEMORY_RESULT = {
  success: true,
  remaining: 9,
  resetTime: Date.now() + 60_000,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("checkUpstashRateLimit", () => {
  const savedUrl = process.env.UPSTASH_REDIS_REST_URL;
  const savedToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedCheckRateLimit.mockReturnValue(MEMORY_RESULT);
  });

  afterAll(() => {
    // Restore any env vars that were deleted during the no-credentials test
    if (savedUrl) process.env.UPSTASH_REDIS_REST_URL = savedUrl;
    else delete process.env.UPSTASH_REDIS_REST_URL;
    if (savedToken) process.env.UPSTASH_REDIS_REST_TOKEN = savedToken;
    else delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  // -------------------------------------------------------------------------
  // 1. No credentials
  // -------------------------------------------------------------------------
  describe("when Upstash credentials are absent", () => {
    it("delegates immediately to the in-memory limiter and returns its result", async () => {
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;

      // Use an isolated module instance so the module-level `redis` cache
      // starts as null regardless of other test execution order.
      let fn: ((id: string, opts: typeof OPTIONS) => Promise<unknown>) | undefined;
      jest.isolateModules(() => {
         
        fn = require("@/lib/upstash-rate-limit").checkUpstashRateLimit;
      });

      const result = await fn!(IDENTIFIER, OPTIONS);

      expect(mockedCheckRateLimit).toHaveBeenCalledTimes(1);
      expect(mockedCheckRateLimit).toHaveBeenCalledWith(IDENTIFIER, OPTIONS);
      expect(result).toEqual(MEMORY_RESULT);
      // Upstash `limit` must never be invoked when there is no client
      expect(mockLimit).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // 2 & 3. Credentials present — import the module once for both sub-cases
  // -------------------------------------------------------------------------
  describe("when Upstash credentials are present", () => {
    // Ensure getRedis() can build a client for these tests
    beforeAll(() => {
      process.env.UPSTASH_REDIS_REST_URL = "https://fake.upstash.io";
      process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token";
    });

    // Lazy import so the module is loaded after env vars are set
     
    let checkUpstashRateLimit: any;
    beforeAll(async () => {
       
      checkUpstashRateLimit = require("@/lib/upstash-rate-limit").checkUpstashRateLimit;
    });

    // 2. Transient Redis failure -------------------------------------------
    describe("when Redis throws a transient error", () => {
      it("catches the error and falls back to the in-memory limiter", async () => {
        mockLimit.mockRejectedValueOnce(new Error("ECONNREFUSED"));

        const result = await checkUpstashRateLimit(IDENTIFIER, OPTIONS);

        expect(mockLimit).toHaveBeenCalledTimes(1);
        expect(mockedCheckRateLimit).toHaveBeenCalledTimes(1);
        expect(mockedCheckRateLimit).toHaveBeenCalledWith(IDENTIFIER, OPTIONS);
        expect(result).toEqual(MEMORY_RESULT);
      });

      it("does not propagate the Redis error to the caller", async () => {
        mockLimit.mockRejectedValueOnce(new Error("Redis timeout"));

        await expect(
          checkUpstashRateLimit(IDENTIFIER, OPTIONS)
        ).resolves.not.toThrow();
      });
    });

    // 3. Happy path --------------------------------------------------------
    describe("when Redis responds successfully", () => {
      const resetAt = Date.now() + 60_000;

      it("returns success with remaining count and resetTime from Upstash", async () => {
        mockLimit.mockResolvedValueOnce({
          success: true,
          remaining: 8,
          reset: resetAt,
        });

        const result = await checkUpstashRateLimit(IDENTIFIER, OPTIONS);

        expect(mockedCheckRateLimit).not.toHaveBeenCalled();
        expect(result).toMatchObject({
          success: true,
          remaining: 8,
          resetTime: resetAt,
          retryAfter: undefined,
        });
      });

      it("includes a retryAfter value when the request is rate-limited", async () => {
        const futureReset = Date.now() + 30_000;
        mockLimit.mockResolvedValueOnce({
          success: false,
          remaining: 0,
          reset: futureReset,
        });

        const result = await checkUpstashRateLimit(IDENTIFIER, OPTIONS);

        expect(mockedCheckRateLimit).not.toHaveBeenCalled();
        expect(result).toMatchObject({ success: false, remaining: 0 });
        expect(typeof (result as { retryAfter: unknown }).retryAfter).toBe("number");
        expect((result as { retryAfter: number }).retryAfter).toBeGreaterThan(0);
      });
    });
  });
});
