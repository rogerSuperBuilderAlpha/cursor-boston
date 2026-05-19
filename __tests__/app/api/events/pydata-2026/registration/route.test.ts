/**
 * @jest-environment node
 *
 * OpenSSF Silver coverage push #75 — PyData registration route guards.
 */
import { NextRequest } from "next/server";
import { POST, GET } from "@/app/api/events/pydata-2026/registration/route";
import { getVerifiedUser } from "@/lib/server-auth";
import { getAdminDb } from "@/lib/firebase-admin";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/middleware", () => ({
  withMiddleware: (_: unknown, handler: (...a: unknown[]) => unknown) => handler,
  withLoggingMiddleware: (handler: (...a: unknown[]) => unknown) => handler,
  withCsrfProtection: (handler: (...a: unknown[]) => unknown) => handler,
  withRateLimitMiddleware: (_: unknown, handler: (...a: unknown[]) => unknown) =>
    handler,
  rateLimitConfigs: { standard: { windowMs: 60_000, maxRequests: 100 } },
}));

jest.mock("@/lib/pydata-2026", () => {
  const actual = jest.requireActual<typeof import("@/lib/pydata-2026")>(
    "@/lib/pydata-2026",
  );
  return {
    ...actual,
    PYDATA_2026_REGISTRATION_OPEN: true,
  };
});

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(() => ({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn().mockResolvedValue({ exists: false }),
        set: jest.fn(),
      })),
      where: jest.fn().mockReturnThis(),
    })),
  })),
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "__ts" },
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<
  typeof getVerifiedUser
>;

describe("POST /api/events/pydata-2026/registration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(null);
  });

  it("returns 401 when unauthenticated", async () => {
    const req = new NextRequest(
      "http://localhost/api/events/pydata-2026/registration",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          firstName: "Ada",
          lastName: "Lovelace",
          email: "ada@example.com",
        }),
      },
    );
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid JSON body", async () => {
    mockGetVerifiedUser.mockResolvedValue({
      uid: "u1",
      email: "ada@example.com",
      name: "Ada",
    });
    const req = new NextRequest(
      "http://localhost/api/events/pydata-2026/registration",
      {
        method: "POST",
        body: "not-json",
      },
    );
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 500 when admin db is null", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@x" });
    const fb = require("@/lib/firebase-admin");
    fb.getAdminDb.mockReturnValueOnce(null);
    const req = new NextRequest(
      "http://localhost/api/events/pydata-2026/registration",
      { method: "POST", body: JSON.stringify({}) },
    );
    const res = await POST(req);
    expect(res.status).toBe(500);
  });

  it("returns 400 with missingFields when validation fails", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@x" });
    const req = new NextRequest(
      "http://localhost/api/events/pydata-2026/registration",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ firstName: "" }),
      },
    );
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Validation failed");
    expect(Array.isArray(body.missingFields)).toBe(true);
  });

  it("writes a first-submission with createdAt+status fields", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "ada@example.com" });
    const setSpy = jest.fn();
    const fb = require("@/lib/firebase-admin");
    fb.getAdminDb.mockReturnValueOnce({
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({ exists: false }),
          set: setSpy,
        })),
      })),
    });
    const req = new NextRequest(
      "http://localhost/api/events/pydata-2026/registration",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          firstName: "Ada",
          lastName: "Lovelace",
          email: "ada@example.com",
          phone: "555-1234",
          organization: "Cursor Boston",
          attendingConfirmed: true,
        }),
      },
    );
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.isFirstSubmission).toBe(true);
    expect(setSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        createdAt: "__ts",
        status: "awaiting-badge",
        updatedAt: "__ts",
      }),
      { merge: true },
    );
  });

  it("preserves createdAt/status on subsequent edits", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "ada@example.com" });
    const setSpy = jest.fn();
    const fb = require("@/lib/firebase-admin");
    fb.getAdminDb.mockReturnValueOnce({
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({ exists: true }),
          set: setSpy,
        })),
      })),
    });
    const req = new NextRequest(
      "http://localhost/api/events/pydata-2026/registration",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          firstName: "Ada",
          lastName: "Lovelace",
          email: "ada@example.com",
          phone: "555-1234",
          organization: "Cursor Boston",
          attendingConfirmed: true,
        }),
      },
    );
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isFirstSubmission).toBe(false);
    // No createdAt key on edit; only updatedAt
    const payload = setSpy.mock.calls[0][0];
    expect(payload.createdAt).toBeUndefined();
    expect(payload.status).toBeUndefined();
    expect(payload.updatedAt).toBe("__ts");
  });
});

describe("GET /api/events/pydata-2026/registration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const req = new NextRequest(
      "http://localhost/api/events/pydata-2026/registration",
    );
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 500 when admin db is null", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@x" });
    const fb = require("@/lib/firebase-admin");
    fb.getAdminDb.mockReturnValueOnce(null);
    const req = new NextRequest(
      "http://localhost/api/events/pydata-2026/registration",
    );
    const res = await GET(req);
    expect(res.status).toBe(500);
  });

  it("returns registered=false when no doc exists", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@x" });
    const fb = require("@/lib/firebase-admin");
    fb.getAdminDb.mockReturnValueOnce({
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({ exists: false }),
        })),
      })),
    });
    const req = new NextRequest(
      "http://localhost/api/events/pydata-2026/registration",
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ registered: false, registration: null });
  });

  it("returns the registration with normalised status on happy path", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@x" });
    const fb = require("@/lib/firebase-admin");
    fb.getAdminDb.mockReturnValueOnce({
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              firstName: "Ada",
              lastName: "Lovelace",
              email: "ada@example.com",
              status: "checked-in",
              createdAt: { toMillis: () => 1000 },
              updatedAt: { toMillis: () => 2000 },
            }),
          }),
        })),
      })),
    });
    const req = new NextRequest(
      "http://localhost/api/events/pydata-2026/registration",
    );
    const res = await GET(req);
    const body = await res.json();
    expect(body.registered).toBe(true);
    expect(body.registration.firstName).toBe("Ada");
    expect(body.registration.status).toBe("checked-in");
    expect(body.registration.createdAt).toBe(1000);
    expect(body.registration.updatedAt).toBe(2000);
  });

  it("falls back to 'awaiting-badge' when status is an unknown value", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@x" });
    const fb = require("@/lib/firebase-admin");
    fb.getAdminDb.mockReturnValueOnce({
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              firstName: "Ada",
              email: "ada@example.com",
              status: "bogus-status",
              createdAt: { toMillis: () => 1000 },
            }),
          }),
        })),
      })),
    });
    const req = new NextRequest(
      "http://localhost/api/events/pydata-2026/registration",
    );
    const res = await GET(req);
    const body = await res.json();
    expect(body.registration.status).toBe("awaiting-badge");
    // updatedAt falls back to createdAt
    expect(body.registration.updatedAt).toBe(1000);
  });

  it("returns null registration when createdAt is missing", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@x" });
    const fb = require("@/lib/firebase-admin");
    fb.getAdminDb.mockReturnValueOnce({
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({ firstName: "Ada" /* no createdAt */ }),
          }),
        })),
      })),
    });
    const req = new NextRequest(
      "http://localhost/api/events/pydata-2026/registration",
    );
    const res = await GET(req);
    const body = await res.json();
    expect(body.registered).toBe(false);
    expect(body.registration).toBeNull();
  });
});
