/**
 * @jest-environment node
 *
 * OpenSSF Gold coverage push #23 — PyData 2026 withdraw POST route.
 *
 * Form-encoded POST that validates an HMAC token, marks the PyData
 * registration as cancelled, and 303-redirects back to the confirmation
 * page with a status query string. All response shapes here are
 * redirects — the assertions read `response.headers.get('location')`.
 */
import { NextRequest } from "next/server";
import { POST } from "@/app/api/events/pydata-2026/withdraw/route";
import { getAdminDb } from "@/lib/firebase-admin";
import { verifyPydataWithdrawToken } from "@/lib/unsubscribe-token";
import { checkRateLimit } from "@/lib/rate-limit";

jest.mock("@/lib/firebase-admin", () => ({ getAdminDb: jest.fn() }));
jest.mock("@/lib/unsubscribe-token", () => ({
  verifyPydataWithdrawToken: jest.fn(),
}));
jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: jest.fn(),
  getClientIdentifier: jest.fn(() => "client-1"),
}));
jest.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: jest.fn(() => "TS") },
}));

const mockDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockVerifyToken = verifyPydataWithdrawToken as jest.MockedFunction<
  typeof verifyPydataWithdrawToken
>;
const mockRateLimit = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;

const VALID_TOKEN = "a".repeat(64); // 64 hex chars passes the regex
const VALID_EMAIL = "user@example.com";

function makeFormReq(body: Record<string, string> | null) {
  const form = new URLSearchParams();
  if (body) {
    for (const [k, v] of Object.entries(body)) form.append(k, v);
  }
  return new NextRequest("https://example.com/api/events/pydata-2026/withdraw", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
}

function setupDb(opts: { empty?: boolean; updateOk?: boolean } = {}) {
  const update = jest.fn().mockResolvedValue(undefined);
  if (opts.updateOk === false) update.mockRejectedValue(new Error("update failed"));
  const docRef = { update };
  const docs = opts.empty ? [] : [{ ref: docRef }];
  const query = {
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    get: jest.fn().mockResolvedValue({
      empty: !!opts.empty,
      docs,
    }),
  };
  const db = { collection: jest.fn(() => query) };
  mockDb.mockReturnValue(db as never);
  return { db, query, update };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRateLimit.mockReturnValue({ success: true, remaining: 19, resetTime: Date.now() + 60000 } as never);
  mockVerifyToken.mockReturnValue(true);
});

describe("POST /api/events/pydata-2026/withdraw", () => {
  it("303 redirects to ?status=rate-limited when rate limit denied", async () => {
    mockRateLimit.mockReturnValueOnce({
      success: false,
      remaining: 0,
      resetTime: Date.now() + 60000,
    } as never);
    const res = await POST(makeFormReq({ email: VALID_EMAIL, token: VALID_TOKEN }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("status=rate-limited");
  });

  it("303 redirects to ?status=invalid when zod parse fails (missing fields)", async () => {
    const res = await POST(makeFormReq({ email: "", token: "" }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("status=invalid");
  });

  it("303 redirects to ?status=invalid when formData throws", async () => {
    // formData() throws when body is JSON instead of urlencoded
    const req = new NextRequest("https://example.com/api/events/pydata-2026/withdraw", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-form-data",
    });
    const res = await POST(req);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("status=invalid");
  });

  it("303 redirects to ?status=invalid when token is not 64-hex", async () => {
    const res = await POST(makeFormReq({ email: VALID_EMAIL, token: "short-token" }));
    expect(res.headers.get("location")).toContain("status=invalid");
  });

  it("303 redirects to ?status=invalid when token has non-hex chars", async () => {
    const res = await POST(
      makeFormReq({ email: VALID_EMAIL, token: "Z".repeat(64) }),
    );
    expect(res.headers.get("location")).toContain("status=invalid");
  });

  it("303 redirects to ?status=invalid when HMAC verification fails", async () => {
    mockVerifyToken.mockReturnValueOnce(false);
    const res = await POST(makeFormReq({ email: VALID_EMAIL, token: VALID_TOKEN }));
    expect(res.headers.get("location")).toContain("status=invalid");
  });

  it("303 redirects to ?status=error when admin db is null", async () => {
    mockDb.mockReturnValue(null as never);
    const res = await POST(makeFormReq({ email: VALID_EMAIL, token: VALID_TOKEN }));
    expect(res.headers.get("location")).toContain("status=error");
  });

  it("303 redirects to ?status=success when no matching registration (does not leak existence)", async () => {
    setupDb({ empty: true });
    const res = await POST(makeFormReq({ email: VALID_EMAIL, token: VALID_TOKEN }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("status=success");
  });

  it("303 redirects to ?status=success and writes cancelled status on happy path", async () => {
    const { update, query } = setupDb({});
    const res = await POST(makeFormReq({ email: VALID_EMAIL, token: VALID_TOKEN }));
    expect(res.headers.get("location")).toContain("status=success");
    expect(update).toHaveBeenCalledWith({ status: "cancelled", updatedAt: "TS" });
    expect(query.where).toHaveBeenCalledWith("email", "==", VALID_EMAIL);
  });

  it("normalises the email to lowercase + trimmed before the query", async () => {
    const { query } = setupDb({});
    await POST(
      makeFormReq({ email: "   USER@EXAMPLE.COM   ", token: VALID_TOKEN }),
    );
    expect(query.where).toHaveBeenCalledWith("email", "==", VALID_EMAIL);
  });

  it("303 redirects to ?status=error when the update transaction throws", async () => {
    setupDb({ updateOk: false });
    const res = await POST(makeFormReq({ email: VALID_EMAIL, token: VALID_TOKEN }));
    expect(res.headers.get("location")).toContain("status=error");
  });
});
