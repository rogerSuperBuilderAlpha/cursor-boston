/**
 * @jest-environment node
 *
 * Coverage complement for __tests__/lib/logger.test.ts. Targets the
 * previously-uncovered logRequest, withLogging, logApiError, and the
 * sanitizeErrorMessage redaction patterns (Bearer tokens, API keys,
 * emails, /Users/ paths).
 */
import {
  LogLevel,
  logApiError,
  logger,
  withLogging,
} from "@/lib/logger";

function mkRequest(opts: {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
}): Request {
  const headers = new Headers(opts.headers ?? {});
  return new Request(opts.url ?? "https://example.com/api/x", {
    method: opts.method ?? "GET",
    headers,
  });
}

describe("lib/logger — additional coverage", () => {
  beforeEach(() => {
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
    console.debug = jest.fn();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("logRequest", () => {
    it("logs at INFO for 2xx", () => {
      const req = mkRequest({ url: "https://x.com/api/users" });
      const res = new Response("ok", { status: 200 });
      logger.logRequest(req, res, 12);
      expect(console.log).toHaveBeenCalled();
      const msg = (console.log as jest.Mock).mock.calls[0][0] as string;
      expect(msg).toContain("[INFO]");
      expect(msg).toContain("GET /api/users");
      expect(msg).toContain("[200]");
      expect(msg).toContain("[12ms]");
    });

    it("logs at WARN for 4xx", () => {
      const req = mkRequest({});
      const res = new Response("nope", { status: 401 });
      logger.logRequest(req, res, 1);
      expect(console.warn).toHaveBeenCalled();
    });

    it("logs at ERROR for 5xx", () => {
      const req = mkRequest({});
      const res = new Response("boom", { status: 500 });
      logger.logRequest(req, res, 1);
      expect(console.error).toHaveBeenCalled();
    });

    it("captures client IP from x-forwarded-for (first entry, trimmed)", () => {
      const req = mkRequest({
        headers: { "x-forwarded-for": "203.0.113.5, 10.0.0.1" },
      });
      const res = new Response("ok", { status: 200 });
      logger.logRequest(req, res, 1);
      const msg = (console.log as jest.Mock).mock.calls[0][0] as string;
      expect(msg).toContain("203.0.113.5");
    });

    it("captures IP from x-real-ip when x-forwarded-for is absent", () => {
      const req = mkRequest({ headers: { "x-real-ip": "198.51.100.7" } });
      logger.logRequest(req, new Response("ok"), 1);
      const msg = (console.log as jest.Mock).mock.calls[0][0] as string;
      expect(msg).toContain("198.51.100.7");
    });

    it("falls back to cf-connecting-ip", () => {
      const req = mkRequest({ headers: { "cf-connecting-ip": "192.0.2.9" } });
      logger.logRequest(req, new Response("ok"), 1);
      const msg = (console.log as jest.Mock).mock.calls[0][0] as string;
      expect(msg).toContain("192.0.2.9");
    });

    it("captures user-agent when present", () => {
      const req = mkRequest({ headers: { "user-agent": "Mozilla/5.0" } });
      logger.logRequest(req, new Response("ok"), 1);
      const msg = (console.log as jest.Mock).mock.calls[0][0] as string;
      expect(msg).toContain("Mozilla/5.0");
    });
  });

  describe("logError redactions", () => {
    it("redacts Bearer tokens from error messages", () => {
      logger.logError(new Error("authz failed: Bearer abc123tok-_.token"));
      const msg = (console.error as jest.Mock).mock.calls[0][0] as string;
      expect(msg).toContain("Bearer [REDACTED]");
      expect(msg).not.toContain("abc123tok");
    });

    it("redacts common API key prefixes (sk_live_, ghp_, AIza...)", () => {
      logger.logError(new Error("key sk_live_abcdef and AIzaSyXX-DEMO"));
      const msg = (console.error as jest.Mock).mock.calls[0][0] as string;
      expect(msg).toContain("[REDACTED]");
      expect(msg).not.toContain("sk_live_abcdef");
    });

    it("redacts email addresses", () => {
      logger.logError(new Error("user alice@example.com triggered"));
      const msg = (console.error as jest.Mock).mock.calls[0][0] as string;
      expect(msg).toContain("[EMAIL_REDACTED]");
      expect(msg).not.toContain("alice@example.com");
    });

    it("redacts /Users/<name> and /home/<name> paths", () => {
      logger.logError(new Error("Cannot read /Users/ludwitt/cursor-boston/x.ts"));
      const msg = (console.error as jest.Mock).mock.calls[0][0] as string;
      expect(msg).toContain("/Users/[REDACTED]");
      expect(msg).not.toContain("/Users/ludwitt");
    });

    it("returns 'Unknown error' for empty error messages", () => {
      // Triggers the `if (!message) return "Unknown error";` branch.
      logger.logError(new Error(""));
      const msg = (console.error as jest.Mock).mock.calls[0][0] as string;
      expect(msg).toContain("Unknown error");
    });

    it("handles non-Error values without throwing", () => {
      logger.logError("string error");
      expect(console.error).toHaveBeenCalled();
    });

    it("preserves common identifier prefixes in the base64-redaction step", () => {
      // The 40+ char base64 match has an exception for firebase/google/github/discord prefixes.
      const safe = "firebase" + "A".repeat(40);
      logger.logError(new Error(`identifier=${safe}`));
      const msg = (console.error as jest.Mock).mock.calls[0][0] as string;
      expect(msg).toContain(safe);
    });
  });

  describe("withLogging middleware", () => {
    it("invokes the handler and logs the request on success", async () => {
      const handler = jest.fn(async (_req: Request) => new Response("ok", { status: 200 }));
      const wrapped = withLogging(handler);
      const res = await wrapped(mkRequest({}));
      expect(res.status).toBe(200);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalled();
    });

    it("logs the error and returns a 500 with X-Request-ID when the handler throws", async () => {
      const handler = jest.fn(async (_req: Request) => {
        throw new Error("handler boom");
      });
      const wrapped = withLogging(handler);
      const res = await wrapped(mkRequest({}));
      expect(res.status).toBe(500);
      expect(res.headers.get("X-Request-ID")).toMatch(/^[0-9a-f-]{8,}$/);
      const body = await res.json();
      expect(body.error).toBe("Internal server error");
      expect(typeof body.requestId).toBe("string");
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("logApiError", () => {
    it("logs the error with endpoint metadata", () => {
      logApiError("/api/x", new Error("boom"));
      expect(console.error).toHaveBeenCalled();
      const msg = (console.error as jest.Mock).mock.calls[0][0] as string;
      expect(msg).toContain("/api/x");
    });
  });

  describe("LogLevel enum", () => {
    it("exposes the four levels", () => {
      expect(LogLevel.DEBUG).toBe("DEBUG");
      expect(LogLevel.INFO).toBe("INFO");
      expect(LogLevel.WARN).toBe("WARN");
      expect(LogLevel.ERROR).toBe("ERROR");
    });
  });
});
