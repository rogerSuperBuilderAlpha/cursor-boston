/**
 * @jest-environment node
 *
 * OpenSSF Gold coverage push #37 — lib/api-response standardised
 * response helpers.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  apiError,
  apiSuccess,
  parseRequestBody,
  ErrorCode,
} from "@/lib/api-response";

describe("ErrorCode constants", () => {
  it("exposes the 8 documented codes", () => {
    expect(Object.keys(ErrorCode).sort()).toEqual([
      "CONFLICT",
      "FORBIDDEN",
      "NOT_CONFIGURED",
      "NOT_FOUND",
      "RATE_LIMITED",
      "SERVER_ERROR",
      "UNAUTHORIZED",
      "VALIDATION_ERROR",
    ]);
  });
});

describe("apiError", () => {
  async function bodyOf(res: NextResponse) {
    return res.json();
  }

  it("returns status 401 + UNAUTHORIZED inferred from 401", async () => {
    const res = apiError("not signed in", 401);
    expect(res.status).toBe(401);
    const body = await bodyOf(res);
    expect(body).toEqual({
      success: false,
      error: { message: "not signed in", code: "UNAUTHORIZED" },
    });
  });

  it("returns status 403 + FORBIDDEN inferred", async () => {
    const res = apiError("no", 403);
    expect((await bodyOf(res)).error.code).toBe("FORBIDDEN");
  });

  it("returns status 404 + NOT_FOUND inferred", async () => {
    const res = apiError("missing", 404);
    expect((await bodyOf(res)).error.code).toBe("NOT_FOUND");
  });

  it("returns status 409 + CONFLICT inferred", async () => {
    const res = apiError("conflict", 409);
    expect((await bodyOf(res)).error.code).toBe("CONFLICT");
  });

  it("returns status 429 + RATE_LIMITED inferred", async () => {
    const res = apiError("slow down", 429);
    expect((await bodyOf(res)).error.code).toBe("RATE_LIMITED");
  });

  it("returns VALIDATION_ERROR for generic 4xx (e.g. 400)", async () => {
    const res = apiError("bad body", 400);
    expect((await bodyOf(res)).error.code).toBe("VALIDATION_ERROR");
  });

  it("returns SERVER_ERROR for 5xx", async () => {
    const res = apiError("boom", 500);
    expect((await bodyOf(res)).error.code).toBe("SERVER_ERROR");
  });

  it("honours an explicit code override", async () => {
    const res = apiError("not configured", 500, ErrorCode.NOT_CONFIGURED);
    expect((await bodyOf(res)).error.code).toBe("NOT_CONFIGURED");
  });
});

describe("apiSuccess", () => {
  it("returns status 200 with success=true and spread data by default", async () => {
    const res = apiSuccess({ foo: "bar", count: 3 });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true, foo: "bar", count: 3 });
  });

  it("honours a custom status (e.g. 201)", async () => {
    const res = apiSuccess({ id: "new" }, 201);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({ success: true, id: "new" });
  });
});

describe("parseRequestBody", () => {
  function makeReq(body: string | null, contentType = "application/json") {
    return new NextRequest("https://example.com/x", {
      method: "POST",
      headers: { "content-type": contentType },
      body: body ?? undefined,
    });
  }

  it("returns the parsed object on valid JSON", async () => {
    const req = makeReq(JSON.stringify({ a: 1, b: "two" }));
    const parsed = await parseRequestBody(req);
    expect(parsed).toEqual({ a: 1, b: "two" });
  });

  it("returns a 400 NextResponse when body is not valid JSON", async () => {
    const req = makeReq("not json");
    const parsed = await parseRequestBody(req);
    expect(parsed).toBeInstanceOf(NextResponse);
    if (parsed instanceof NextResponse) {
      expect(parsed.status).toBe(400);
      const body = await parsed.json();
      expect(body.error).toContain("Invalid JSON");
    }
  });

  it("works with a plain Request (not just NextRequest)", async () => {
    const req = new Request("https://example.com/x", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ok: true }),
    });
    const parsed = await parseRequestBody(req);
    expect(parsed).toEqual({ ok: true });
  });

  it("returns 400 when body is empty (no JSON)", async () => {
    const req = makeReq("");
    const parsed = await parseRequestBody(req);
    expect(parsed).toBeInstanceOf(NextResponse);
    if (parsed instanceof NextResponse) {
      expect(parsed.status).toBe(400);
    }
  });
});
