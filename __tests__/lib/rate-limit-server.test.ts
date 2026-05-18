/**
 * @jest-environment node
 */
jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(),
}));

jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: jest.fn(),
  getClientIdentifier: jest.fn(),
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock("firebase-admin/firestore", () => ({
  Timestamp: {
    now: () => ({ __ts: "now" }),
    fromMillis: (ms: number) => ({ __ts: ms }),
  },
}));

import {
  buildRateLimitHeaders,
  checkServerRateLimit,
  type ServerRateLimitResult,
} from "@/lib/rate-limit-server";

import { getAdminDb } from "@/lib/firebase-admin";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

const getAdminDbMock = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const checkRateLimitMock = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;
const getClientIdentifierMock = getClientIdentifier as jest.MockedFunction<typeof getClientIdentifier>;
const loggerWarn = (logger as unknown as { warn: jest.Mock }).warn;
const loggerInfo = (logger as unknown as { info: jest.Mock }).info;

function buildAllowingTx() {
  return jest.fn().mockImplementation(async (fn) => {
    const tx = {
      get: jest.fn().mockResolvedValue({ exists: false, data: () => undefined }),
      set: jest.fn(),
    };
    return fn(tx);
  });
}

function buildExistingTx(currentCount: number) {
  return jest.fn().mockImplementation(async (fn) => {
    const tx = {
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({ count: currentCount }),
      }),
      set: jest.fn(),
    };
    return fn(tx);
  });
}

function buildThrowingTx(err: unknown) {
  return jest.fn().mockRejectedValue(err);
}

function makeRequest(): Request {
  return new Request("https://example.com/api/x");
}

describe("lib/rate-limit-server", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getClientIdentifierMock.mockReturnValue("client-A");
    checkRateLimitMock.mockReturnValue({
      success: true,
      remaining: 5,
      resetTime: 999_999,
    });
  });

  describe("buildRateLimitHeaders", () => {
    it("emits the four canonical X-RateLimit headers", () => {
      const result: ServerRateLimitResult = {
        success: true,
        remaining: 4,
        resetTime: 1000,
        source: "firestore",
      };
      expect(buildRateLimitHeaders(result, 10)).toEqual({
        "X-RateLimit-Limit": "10",
        "X-RateLimit-Remaining": "4",
        "X-RateLimit-Reset": "1000",
        "X-RateLimit-Source": "firestore",
      });
    });

    it("appends Retry-After when retryAfter is set", () => {
      const result: ServerRateLimitResult = {
        success: false,
        remaining: 0,
        resetTime: 1000,
        retryAfter: 30,
        source: "firestore",
      };
      expect(buildRateLimitHeaders(result, 10)["Retry-After"]).toBe("30");
    });

    it("does NOT append Retry-After when retryAfter is missing or 0", () => {
      const result: ServerRateLimitResult = {
        success: true,
        remaining: 4,
        resetTime: 1000,
        source: "memory-fallback",
      };
      expect(buildRateLimitHeaders(result, 10)).not.toHaveProperty("Retry-After");
    });
  });

  describe("checkServerRateLimit — no admin db", () => {
    beforeEach(() => {
      getAdminDbMock.mockReturnValue(null as unknown as ReturnType<typeof getAdminDb>);
    });

    it("falls back to memory and logs an observation with reason='admin_db_unavailable'", async () => {
      checkRateLimitMock.mockReturnValueOnce({
        success: true,
        remaining: 9,
        resetTime: 5000,
      });
      const res = await checkServerRateLimit(makeRequest(), {
        scope: "foo",
        windowMs: 60_000,
        maxRequests: 10,
      });
      expect(res).toMatchObject({
        success: true,
        remaining: 9,
        source: "memory-fallback",
      });
      expect(loggerWarn).toHaveBeenCalledWith(
        "rate_limit_observation",
        expect.objectContaining({ reason: "admin_db_unavailable" }),
      );
    });

    it("with fallbackMode='deny' returns fail-closed 503 result", async () => {
      const res = await checkServerRateLimit(makeRequest(), {
        scope: "foo",
        windowMs: 60_000,
        maxRequests: 10,
        fallbackMode: "deny",
      });
      expect(res.source).toBe("fail-closed");
      expect(res.statusCode).toBe(503);
      expect(res.success).toBe(false);
      expect(res.retryAfter).toBeGreaterThanOrEqual(1);
    });

    it("uses tighter limits under 'strict-memory' fallback (min(max,10))", async () => {
      await checkServerRateLimit(makeRequest(), {
        scope: "foo",
        windowMs: 60_000,
        maxRequests: 100, // strict-memory clamps to 10
      });
      const args = checkRateLimitMock.mock.calls[0][1];
      expect(args.maxRequests).toBe(10);
    });

    it("respects an explicit fallbackMaxRequests override", async () => {
      await checkServerRateLimit(makeRequest(), {
        scope: "foo",
        windowMs: 60_000,
        maxRequests: 100,
        fallbackMaxRequests: 25,
      });
      const args = checkRateLimitMock.mock.calls[0][1];
      expect(args.maxRequests).toBe(25);
    });

    it("uses full max under 'memory' fallback mode", async () => {
      await checkServerRateLimit(makeRequest(), {
        scope: "foo",
        windowMs: 60_000,
        maxRequests: 50,
        fallbackMode: "memory",
      });
      const args = checkRateLimitMock.mock.calls[0][1];
      expect(args.maxRequests).toBe(50);
    });

    it("uses explicit options.identifier when provided", async () => {
      await checkServerRateLimit(makeRequest(), {
        scope: "foo",
        windowMs: 60_000,
        maxRequests: 10,
        identifier: "explicit-id",
      });
      expect(getClientIdentifierMock).not.toHaveBeenCalled();
      const key = checkRateLimitMock.mock.calls[0][0];
      expect(key).toContain("explicit-id");
    });

    it("falls back to 'unknown' identifier when no header + no override", async () => {
      getClientIdentifierMock.mockReturnValueOnce("");
      await checkServerRateLimit(makeRequest(), {
        scope: "foo",
        windowMs: 60_000,
        maxRequests: 10,
      });
      const key = checkRateLimitMock.mock.calls[0][0];
      expect(key).toContain("unknown");
    });
  });

  describe("checkServerRateLimit — firestore happy path", () => {
    it("allows the request, writes count=1 + metadata on new bucket", async () => {
      const tx = buildAllowingTx();
      const setSpy = jest.fn();
      tx.mockImplementationOnce(async (fn) => {
        const txObj = {
          get: jest.fn().mockResolvedValue({ exists: false, data: () => undefined }),
          set: setSpy,
        };
        return fn(txObj);
      });
      getAdminDbMock.mockReturnValueOnce({
        collection: () => ({ doc: () => ({}) }),
        runTransaction: tx,
      } as unknown as ReturnType<typeof getAdminDb>);
      const res = await checkServerRateLimit(makeRequest(), {
        scope: "foo",
        windowMs: 60_000,
        maxRequests: 10,
      });
      expect(res.success).toBe(true);
      expect(res.source).toBe("firestore");
      expect(res.remaining).toBe(9);
      const payload = setSpy.mock.calls[0][1];
      expect(payload).toMatchObject({
        count: 1,
        scope: "foo",
        windowMs: 60_000,
      });
    });

    it("allows the request, writes count++ only when bucket already exists", async () => {
      const setSpy = jest.fn();
      const tx = jest.fn().mockImplementation(async (fn) => {
        const txObj = {
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({ count: 3 }),
          }),
          set: setSpy,
        };
        return fn(txObj);
      });
      getAdminDbMock.mockReturnValueOnce({
        collection: () => ({ doc: () => ({}) }),
        runTransaction: tx,
      } as unknown as ReturnType<typeof getAdminDb>);
      const res = await checkServerRateLimit(makeRequest(), {
        scope: "foo",
        windowMs: 60_000,
        maxRequests: 10,
      });
      expect(res.success).toBe(true);
      expect(res.remaining).toBe(6); // 10 - 4
      // Existing bucket → merge with only count + updatedAt
      const [, payload, opts] = setSpy.mock.calls[0];
      expect(payload).toEqual({ count: 4, updatedAt: { __ts: "now" } });
      expect(opts).toEqual({ merge: true });
    });

    it("denies once currentCount >= maxRequests with retry-after", async () => {
      const tx = buildExistingTx(10);
      getAdminDbMock.mockReturnValueOnce({
        collection: () => ({ doc: () => ({}) }),
        runTransaction: tx,
      } as unknown as ReturnType<typeof getAdminDb>);
      const res = await checkServerRateLimit(makeRequest(), {
        scope: "foo",
        windowMs: 60_000,
        maxRequests: 10,
      });
      expect(res.success).toBe(false);
      expect(res.source).toBe("firestore");
      expect(res.retryAfter).toBeGreaterThan(0);
      expect(loggerWarn).toHaveBeenCalledWith(
        "rate_limit_observation",
        expect.objectContaining({
          reason: "quota_exceeded",
          statusCode: 429,
        }),
      );
    });

    it("emits success observation log when sampleRate is 1 (every request)", async () => {
      const tx = buildAllowingTx();
      getAdminDbMock.mockReturnValueOnce({
        collection: () => ({ doc: () => ({}) }),
        runTransaction: tx,
      } as unknown as ReturnType<typeof getAdminDb>);
      await checkServerRateLimit(makeRequest(), {
        scope: "foo",
        windowMs: 60_000,
        maxRequests: 10,
        successSampleRate: 1,
      });
      expect(loggerInfo).toHaveBeenCalledWith(
        "rate_limit_observation",
        expect.objectContaining({ reason: "allowed_sampled" }),
      );
    });
  });

  describe("checkServerRateLimit — firestore transaction throws", () => {
    it("falls back to memory and logs reason='firestore_transaction_error'", async () => {
      checkRateLimitMock.mockReturnValueOnce({
        success: true,
        remaining: 9,
        resetTime: 5000,
      });
      const tx = buildThrowingTx(new Error("aborted"));
      getAdminDbMock.mockReturnValueOnce({
        collection: () => ({ doc: () => ({}) }),
        runTransaction: tx,
      } as unknown as ReturnType<typeof getAdminDb>);
      const res = await checkServerRateLimit(makeRequest(), {
        scope: "foo",
        windowMs: 60_000,
        maxRequests: 10,
      });
      expect(res.source).toBe("memory-fallback");
      expect(loggerWarn).toHaveBeenCalledWith(
        "rate_limit_observation",
        expect.objectContaining({
          reason: "firestore_transaction_error",
          error: "aborted",
        }),
      );
    });

    it("coerces non-Error throws to a string in the log", async () => {
      const tx = buildThrowingTx("string-thrown");
      getAdminDbMock.mockReturnValueOnce({
        collection: () => ({ doc: () => ({}) }),
        runTransaction: tx,
      } as unknown as ReturnType<typeof getAdminDb>);
      await checkServerRateLimit(makeRequest(), {
        scope: "foo",
        windowMs: 60_000,
        maxRequests: 10,
      });
      expect(loggerWarn).toHaveBeenCalledWith(
        "rate_limit_observation",
        expect.objectContaining({ error: "string-thrown" }),
      );
    });

    it("with fallbackMode='deny' returns fail-closed when transaction throws", async () => {
      const tx = buildThrowingTx(new Error("aborted"));
      getAdminDbMock.mockReturnValueOnce({
        collection: () => ({ doc: () => ({}) }),
        runTransaction: tx,
      } as unknown as ReturnType<typeof getAdminDb>);
      const res = await checkServerRateLimit(makeRequest(), {
        scope: "foo",
        windowMs: 60_000,
        maxRequests: 10,
        fallbackMode: "deny",
      });
      expect(res.source).toBe("fail-closed");
      expect(res.statusCode).toBe(503);
    });
  });
});
