/**
 * @jest-environment node
 */
import {
  jsonWithLoggedError,
  jsonWithLoggedMessage,
  requestErrorId,
} from "@/lib/server/api-request-error";

jest.mock("@/lib/logger", () => ({
  logger: {
    logError: jest.fn(),
  },
}));

import { logger } from "@/lib/logger";

const mockLogError = logger.logError as jest.MockedFunction<typeof logger.logError>;

describe("api-request-error", () => {
  beforeEach(() => {
    mockLogError.mockClear();
  });

  describe("requestErrorId", () => {
    it("returns an 8-character id", () => {
      const id = requestErrorId();
      expect(id).toHaveLength(8);
    });

    it("returns a different id on each call", () => {
      const a = requestErrorId();
      const b = requestErrorId();
      expect(a).not.toBe(b);
    });
  });

  describe("jsonWithLoggedError", () => {
    it("returns a NextResponse with the given status and merges errorId into body", async () => {
      const err = new Error("boom");
      const res = jsonWithLoggedError(500, err, { code: "SERVER_ERROR" }, { route: "/api/x" });
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.code).toBe("SERVER_ERROR");
      expect(typeof body.errorId).toBe("string");
      expect(body.errorId).toHaveLength(8);
    });

    it("logs the error with the supplied metadata + errorId", () => {
      const err = new Error("boom");
      jsonWithLoggedError(500, err, {}, { route: "/api/x", method: "POST" });
      expect(mockLogError).toHaveBeenCalledTimes(1);
      const call = mockLogError.mock.calls[0];
      expect(call[0]).toBe(err);
      expect(call[1]).toMatchObject({ route: "/api/x", method: "POST" });
      expect(typeof (call[1] as Record<string, string>).errorId).toBe("string");
    });

    it("wraps non-Error values in an Error before logging", () => {
      jsonWithLoggedError(400, "not-an-error", {}, {});
      const call = mockLogError.mock.calls[0];
      expect(call[0]).toBeInstanceOf(Error);
      expect((call[0] as Error).message).toBe("not-an-error");
    });
  });

  describe("jsonWithLoggedMessage", () => {
    it("returns a NextResponse with the given status and merges errorId into body", async () => {
      const res = jsonWithLoggedMessage(403, "forbidden", { code: "FORBIDDEN" }, {});
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.code).toBe("FORBIDDEN");
      expect(typeof body.errorId).toBe("string");
    });

    it("logs a synthetic Error with the message", () => {
      jsonWithLoggedMessage(403, "forbidden", {}, { route: "/api/x" });
      const call = mockLogError.mock.calls[0];
      expect(call[0]).toBeInstanceOf(Error);
      expect((call[0] as Error).message).toBe("forbidden");
    });
  });
});
