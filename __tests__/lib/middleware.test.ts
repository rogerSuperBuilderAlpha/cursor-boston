/**
 * @jest-environment node
 */

import { NextRequest, NextResponse } from "next/server";
import {
  isOriginAllowed,
  withCsrfProtection,
  withRateLimitMiddleware,
  withLoggingMiddleware,
  withMiddleware,
  withSecurityMiddleware,
} from "@/lib/middleware";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

jest.mock("@/lib/rate-limit", () => ({
  ...jest.requireActual("@/lib/rate-limit"),
  checkRateLimit: jest.fn(),
  getClientIdentifier: jest.fn(() => "ip:127.0.0.1"),
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    logError: jest.fn(),
  },
}));

const mockRateLimit = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;

function makeRequest(opts: {
  method?: string;
  origin?: string;
  referer?: string;
  url?: string;
  headers?: Record<string, string>;
}) {
  const headers: Record<string, string> = { ...opts.headers };
  if (opts.origin !== undefined) headers["origin"] = opts.origin;
  if (opts.referer !== undefined) headers["referer"] = opts.referer;
  return new NextRequest(opts.url ?? "http://localhost:3000/api/x", {
    method: opts.method ?? "POST",
    headers,
  });
}

function okHandler(body: unknown = { ok: true }, status = 200) {
  return jest.fn(async () => NextResponse.json(body, { status }));
}

describe("isOriginAllowed", () => {
  const originalEnv = process.env.NODE_ENV;
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  afterEach(() => {
    Object.defineProperty(process.env, "NODE_ENV", { value: originalEnv, configurable: true });
    if (originalAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  });

  it("returns true for GET (safe method)", () => {
    expect(isOriginAllowed(makeRequest({ method: "GET" }))).toBe(true);
  });

  it("returns true for HEAD", () => {
    expect(isOriginAllowed(makeRequest({ method: "HEAD" }))).toBe(true);
  });

  it("returns true for OPTIONS", () => {
    expect(isOriginAllowed(makeRequest({ method: "OPTIONS" }))).toBe(true);
  });

  it("returns true for POST with an allowed origin (cursorboston.com)", () => {
    expect(
      isOriginAllowed(
        makeRequest({ method: "POST", origin: "https://cursorboston.com" })
      )
    ).toBe(true);
  });

  it("returns true when origin matches NEXT_PUBLIC_APP_URL", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
    expect(
      isOriginAllowed(
        makeRequest({ method: "POST", origin: "https://app.example.com" })
      )
    ).toBe(true);
  });

  it("returns false for POST with a disallowed origin", () => {
    expect(
      isOriginAllowed(
        makeRequest({ method: "POST", origin: "https://evil.example.com" })
      )
    ).toBe(false);
  });

  it("returns true for POST with no origin but an allowed referer", () => {
    expect(
      isOriginAllowed(
        makeRequest({
          method: "POST",
          referer: "https://cursorboston.com/some/page",
        })
      )
    ).toBe(true);
  });

  it("returns false for POST with no origin and a disallowed referer", () => {
    expect(
      isOriginAllowed(
        makeRequest({
          method: "POST",
          referer: "https://evil.example.com/page",
        })
      )
    ).toBe(false);
  });

  it("returns false for POST with no origin/referer in production", () => {
    Object.defineProperty(process.env, "NODE_ENV", { value: "production", configurable: true });
    expect(isOriginAllowed(makeRequest({ method: "POST" }))).toBe(false);
  });

  it("returns true for POST with no origin/referer in development", () => {
    Object.defineProperty(process.env, "NODE_ENV", { value: "development", configurable: true });
    expect(isOriginAllowed(makeRequest({ method: "POST" }))).toBe(true);
  });

  it("returns false for POST with a malformed referer URL", () => {
    expect(
      isOriginAllowed(makeRequest({ method: "POST", referer: "not a url" }))
    ).toBe(false);
  });

  it("returns true when origin equals the request URL origin (same-origin POST)", () => {
    expect(
      isOriginAllowed(
        makeRequest({
          method: "POST",
          origin: "http://localhost:3000",
          url: "http://localhost:3000/api/x",
        }),
      ),
    ).toBe(true);
  });

  it("returns true when referer origin equals the request URL origin (same-origin)", () => {
    expect(
      isOriginAllowed(
        makeRequest({
          method: "POST",
          referer: "http://localhost:3000/path/to/page",
          url: "http://localhost:3000/api/x",
        }),
      ),
    ).toBe(true);
  });

  it("returns true when referer origin matches NEXT_PUBLIC_APP_URL", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://staging.example.com";
    expect(
      isOriginAllowed(
        makeRequest({
          method: "POST",
          referer: "https://staging.example.com/some/page",
        }),
      ),
    ).toBe(true);
    delete process.env.NEXT_PUBLIC_APP_URL;
  });
});

describe("withCsrfProtection", () => {
  it("forwards to the handler when the origin is allowed", async () => {
    const handler = okHandler();
    const wrapped = withCsrfProtection(handler);
    const res = await wrapped(
      makeRequest({ method: "POST", origin: "https://cursorboston.com" })
    );
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("returns 403 with the standard error body when the origin is blocked", async () => {
    const handler = okHandler();
    const wrapped = withCsrfProtection(handler);
    const res = await wrapped(
      makeRequest({ method: "POST", origin: "https://evil.example.com" })
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Forbidden: Invalid origin" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("logs a warning when blocking a request", async () => {
    const handler = okHandler();
    const wrapped = withCsrfProtection(handler);
    await wrapped(
      makeRequest({ method: "POST", origin: "https://evil.example.com" })
    );
    expect(logger.warn).toHaveBeenCalledWith(
      "CSRF protection blocked request",
      expect.objectContaining({ origin: "https://evil.example.com" })
    );
  });
});

describe("withRateLimitMiddleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("forwards to handler and adds X-RateLimit headers on success", async () => {
    mockRateLimit.mockReturnValue({
      success: true,
      remaining: 9,
      resetTime: 12345,
    } as any);

    const handler = okHandler();
    const wrapped = withRateLimitMiddleware(
      { windowMs: 60_000, maxRequests: 10 },
      handler
    );
    const res = await wrapped(makeRequest({ method: "POST" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("X-RateLimit-Limit")).toBe("10");
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("9");
    expect(res.headers.get("X-RateLimit-Reset")).toBe("12345");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("returns 429 with Retry-After and X-RateLimit headers when rate-limited", async () => {
    mockRateLimit.mockReturnValue({
      success: false,
      remaining: 0,
      resetTime: 99999,
      retryAfter: 30,
    } as any);

    const handler = okHandler();
    const wrapped = withRateLimitMiddleware(
      { windowMs: 60_000, maxRequests: 10 },
      handler
    );
    const res = await wrapped(makeRequest({ method: "POST" }));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
    expect(res.headers.get("X-RateLimit-Limit")).toBe("10");
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(handler).not.toHaveBeenCalled();
  });
});

describe("withLoggingMiddleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("adds an X-Request-ID header to the response", async () => {
    const handler = okHandler();
    const wrapped = withLoggingMiddleware(handler);
    const res = await wrapped(makeRequest({ method: "GET" }));
    const requestId = res.headers.get("X-Request-ID");
    expect(requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  it("logs at INFO level for 2xx responses", async () => {
    const handler = okHandler({ ok: true }, 200);
    const wrapped = withLoggingMiddleware(handler);
    await wrapped(makeRequest({ method: "GET" }));
    expect(logger.info).toHaveBeenCalledWith(
      "API Request",
      expect.objectContaining({ statusCode: 200, method: "GET" })
    );
  });

  it("logs at WARN level for 4xx responses", async () => {
    const handler = okHandler({ error: "bad" }, 400);
    const wrapped = withLoggingMiddleware(handler);
    await wrapped(makeRequest({ method: "POST" }));
    expect(logger.warn).toHaveBeenCalledWith(
      "API Request",
      expect.objectContaining({ statusCode: 400 })
    );
  });

  it("logs at ERROR level for 5xx responses", async () => {
    const handler = okHandler({ error: "boom" }, 500);
    const wrapped = withLoggingMiddleware(handler);
    await wrapped(makeRequest({ method: "POST" }));
    expect(logger.error).toHaveBeenCalledWith(
      "API Request",
      expect.objectContaining({ statusCode: 500 })
    );
  });

  it("returns a 500 with the request ID when the handler throws", async () => {
    const handler = jest.fn(async () => {
      throw new Error("kaboom");
    });
    const wrapped = withLoggingMiddleware(handler);
    const res = await wrapped(makeRequest({ method: "POST" }));
    expect(res.status).toBe(500);
    const requestId = res.headers.get("X-Request-ID");
    expect(requestId).toBeTruthy();
    const body = await res.json();
    expect(body.requestId).toBe(requestId);
    expect(logger.logError).toHaveBeenCalled();
  });

  it("captures the client IP from x-forwarded-for (first value)", async () => {
    const handler = okHandler();
    const wrapped = withLoggingMiddleware(handler);
    await wrapped(
      makeRequest({
        method: "GET",
        headers: { "x-forwarded-for": "203.0.113.42, 10.0.0.1" },
      })
    );
    expect(logger.info).toHaveBeenCalledWith(
      "API Request",
      expect.objectContaining({ ip: "203.0.113.42" })
    );
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", async () => {
    const handler = okHandler();
    const wrapped = withLoggingMiddleware(handler);
    await wrapped(
      makeRequest({
        method: "GET",
        headers: { "x-real-ip": "203.0.113.99" },
      })
    );
    expect(logger.info).toHaveBeenCalledWith(
      "API Request",
      expect.objectContaining({ ip: "203.0.113.99" })
    );
  });

  it("captures the user-agent when present", async () => {
    const handler = okHandler();
    const wrapped = withLoggingMiddleware(handler);
    await wrapped(
      makeRequest({
        method: "GET",
        headers: { "user-agent": "test-runner/1.0" },
      })
    );
    expect(logger.info).toHaveBeenCalledWith(
      "API Request",
      expect.objectContaining({ userAgent: "test-runner/1.0" })
    );
  });
});

describe("withMiddleware (composite)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRateLimit.mockReturnValue({
      success: true,
      remaining: 99,
      resetTime: 0,
    } as any);
  });

  it("composes CSRF + rate-limit + logging on a happy-path request", async () => {
    const handler = okHandler();
    const wrapped = withMiddleware({ windowMs: 60_000, maxRequests: 100 }, handler);
    const res = await wrapped(
      makeRequest({ method: "POST", origin: "https://cursorboston.com" })
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("X-RateLimit-Limit")).toBe("100");
    expect(res.headers.get("X-Request-ID")).toBeTruthy();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("CSRF rejects the request before rate limit or handler run", async () => {
    const handler = okHandler();
    const wrapped = withMiddleware({ windowMs: 60_000, maxRequests: 100 }, handler);
    const res = await wrapped(
      makeRequest({ method: "POST", origin: "https://evil.example.com" })
    );
    expect(res.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
    expect(mockRateLimit).not.toHaveBeenCalled();
  });
});

describe("withSecurityMiddleware (CSRF + logging, no rate limit)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("forwards to handler when origin allowed and adds X-Request-ID", async () => {
    const handler = okHandler();
    const wrapped = withSecurityMiddleware(handler);
    const res = await wrapped(
      makeRequest({ method: "POST", origin: "https://cursorboston.com" })
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Request-ID")).toBeTruthy();
    expect(mockRateLimit).not.toHaveBeenCalled();
  });
});
