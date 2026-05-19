/**
 * @jest-environment node
 *
 * OpenSSF Silver coverage push #75 — PyData registration route guards.
 */
import { NextRequest } from "next/server";
import { POST } from "@/app/api/events/pydata-2026/registration/route";
import { getVerifiedUser } from "@/lib/server-auth";

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
});
