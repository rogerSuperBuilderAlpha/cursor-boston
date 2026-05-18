/**
 * @jest-environment node
 */
import {
  ApiErrorSchema,
  ErrorCodeEnum,
  PaginationFieldsSchema,
  PaginationQuerySchema,
  RateLimitedErrorSchema,
  REQUIRES_AUTH,
  SECURITY_SCHEMES,
} from "@/lib/api-schemas/common";

describe("lib/api-schemas/common", () => {
  describe("ErrorCodeEnum", () => {
    it("accepts every well-known code", () => {
      for (const v of [
        "UNAUTHORIZED",
        "FORBIDDEN",
        "NOT_FOUND",
        "VALIDATION_ERROR",
        "RATE_LIMITED",
        "CONFLICT",
        "SERVER_ERROR",
        "NOT_CONFIGURED",
      ]) {
        expect(ErrorCodeEnum.safeParse(v).success).toBe(true);
      }
    });

    it("rejects an unknown code", () => {
      expect(ErrorCodeEnum.safeParse("MYSTERY").success).toBe(false);
    });
  });

  describe("ApiErrorSchema", () => {
    it("accepts the canonical error envelope", () => {
      const ok = ApiErrorSchema.safeParse({
        success: false,
        error: { message: "Bad input", code: "VALIDATION_ERROR" },
      });
      expect(ok.success).toBe(true);
    });

    it("rejects success=true", () => {
      const r = ApiErrorSchema.safeParse({
        success: true,
        error: { message: "x", code: "SERVER_ERROR" },
      });
      expect(r.success).toBe(false);
    });

    it("rejects an unknown error code", () => {
      const r = ApiErrorSchema.safeParse({
        success: false,
        error: { message: "x", code: "MYSTERY" },
      });
      expect(r.success).toBe(false);
    });

    it("rejects a missing error.message", () => {
      const r = ApiErrorSchema.safeParse({
        success: false,
        error: { code: "SERVER_ERROR" },
      });
      expect(r.success).toBe(false);
    });
  });

  describe("RateLimitedErrorSchema", () => {
    it("accepts an error string alone", () => {
      const r = RateLimitedErrorSchema.safeParse({ error: "too many requests" });
      expect(r.success).toBe(true);
    });

    it("accepts an optional non-negative retryAfterSeconds", () => {
      const r = RateLimitedErrorSchema.safeParse({
        error: "x",
        retryAfterSeconds: 30,
      });
      expect(r.success).toBe(true);
    });

    it("rejects a negative retryAfterSeconds", () => {
      const r = RateLimitedErrorSchema.safeParse({
        error: "x",
        retryAfterSeconds: -1,
      });
      expect(r.success).toBe(false);
    });

    it("rejects a non-integer retryAfterSeconds", () => {
      const r = RateLimitedErrorSchema.safeParse({
        error: "x",
        retryAfterSeconds: 2.5,
      });
      expect(r.success).toBe(false);
    });
  });

  describe("PaginationQuerySchema", () => {
    it("accepts an empty object (all fields optional)", () => {
      expect(PaginationQuerySchema.safeParse({}).success).toBe(true);
    });

    it("accepts a numeric-string limit", () => {
      const r = PaginationQuerySchema.safeParse({ limit: "20" });
      expect(r.success).toBe(true);
    });

    it("rejects a non-numeric limit", () => {
      const r = PaginationQuerySchema.safeParse({ limit: "ten" });
      expect(r.success).toBe(false);
    });

    it("accepts an opaque string cursor", () => {
      const r = PaginationQuerySchema.safeParse({
        cursor: "abc:0:xyz",
      });
      expect(r.success).toBe(true);
    });
  });

  describe("PaginationFieldsSchema", () => {
    it("accepts a populated next page", () => {
      const r = PaginationFieldsSchema.safeParse({
        nextCursor: "abc",
        hasMore: true,
      });
      expect(r.success).toBe(true);
    });

    it("accepts the last page (nextCursor=null)", () => {
      const r = PaginationFieldsSchema.safeParse({
        nextCursor: null,
        hasMore: false,
      });
      expect(r.success).toBe(true);
    });

    it("rejects missing hasMore", () => {
      const r = PaginationFieldsSchema.safeParse({ nextCursor: "x" });
      expect(r.success).toBe(false);
    });
  });

  describe("security definitions", () => {
    it("SECURITY_SCHEMES has bearerAuth + cookieAuth in OpenAPI shape", () => {
      expect(SECURITY_SCHEMES.bearerAuth).toMatchObject({
        type: "http",
        scheme: "bearer",
        bearerFormat: "Firebase ID token",
      });
      expect(SECURITY_SCHEMES.cookieAuth).toMatchObject({
        type: "apiKey",
        in: "cookie",
        name: "session",
      });
    });

    it("REQUIRES_AUTH lists both auth methods (one of)", () => {
      expect(REQUIRES_AUTH).toEqual([{ bearerAuth: [] }, { cookieAuth: [] }]);
    });
  });
});
