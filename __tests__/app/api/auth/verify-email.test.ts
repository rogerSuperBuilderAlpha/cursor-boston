/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { GET } from "@/app/api/auth/verify-email/route";
import { getAdminDb } from "@/lib/firebase-admin";

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(),
}));

jest.mock("@/lib/logger", () => ({
  logger: { logError: jest.fn(), info: jest.fn() },
  logApiError: jest.fn(),
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    arrayUnion: jest.fn((v) => ({ __arrayUnion: v })),
    serverTimestamp: jest.fn(() => ({ __serverTimestamp: true })),
  },
}));

const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;

const HEX64 = "a".repeat(64);

function verifyRequest(token: string | null) {
  const url = new URL("http://localhost/api/auth/verify-email");
  if (token !== null) url.searchParams.set("token", token);
  return new NextRequest(url, { method: "GET" });
}

function locationOf(res: Response): string {
  return res.headers.get("location") ?? "";
}

function buildDb(opts: {
  verification?: { exists: boolean; data?: Record<string, unknown> | null };
  emailLookup?: { exists: boolean };
}) {
  const verificationDoc = {
    get: jest.fn().mockResolvedValue({
      exists: opts.verification?.exists ?? false,
      data: () => opts.verification?.data,
    }),
    delete: jest.fn().mockResolvedValue(undefined),
  };
  const emailLookupDoc = {
    get: jest.fn().mockResolvedValue({
      exists: opts.emailLookup?.exists ?? false,
    }),
    set: jest.fn().mockResolvedValue(undefined),
  };
  const userDoc = {
    update: jest.fn().mockResolvedValue(undefined),
  };
  const db: any = {
    collection: jest.fn((name: string) => {
      if (name === "emailVerifications") {
        return { doc: jest.fn(() => verificationDoc) };
      }
      if (name === "emailLookup") {
        return { doc: jest.fn(() => emailLookupDoc) };
      }
      if (name === "users") {
        return { doc: jest.fn(() => userDoc) };
      }
      return { doc: jest.fn() };
    }),
  };
  return { db, verificationDoc, emailLookupDoc, userDoc };
}

describe("GET /api/auth/verify-email", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("redirects with missing_token when no token query param is provided", async () => {
    const res = await GET(verifyRequest(null));
    expect(locationOf(res)).toContain("emailVerification=error");
    expect(locationOf(res)).toContain("message=missing_token");
  });

  it("redirects with invalid_token when the token is not 64 hex chars", async () => {
    const res = await GET(verifyRequest("not-hex-too-short"));
    expect(locationOf(res)).toContain("message=invalid_token");
  });

  it("redirects with invalid_token when the token includes non-hex characters", async () => {
    const res = await GET(verifyRequest("z".repeat(64)));
    expect(locationOf(res)).toContain("message=invalid_token");
  });

  it("redirects with server_error when admin DB is not configured", async () => {
    mockGetAdminDb.mockReturnValue(null as any);
    const res = await GET(verifyRequest(HEX64));
    expect(locationOf(res)).toContain("message=server_error");
  });

  it("redirects with invalid_token when the verification doc does not exist", async () => {
    const { db } = buildDb({ verification: { exists: false } });
    mockGetAdminDb.mockReturnValue(db);
    const res = await GET(verifyRequest(HEX64));
    expect(locationOf(res)).toContain("message=invalid_token");
  });

  it("redirects with invalid_token when verification.data() returns undefined", async () => {
    const { db } = buildDb({ verification: { exists: true, data: undefined } });
    mockGetAdminDb.mockReturnValue(db);
    const res = await GET(verifyRequest(HEX64));
    expect(locationOf(res)).toContain("message=invalid_token");
  });

  it("redirects with token_expired and deletes the token when expiresAt is in the past", async () => {
    const past = new Date(Date.now() - 60_000);
    const { db, verificationDoc } = buildDb({
      verification: {
        exists: true,
        data: { uid: "u1", email: "x@y.com", expiresAt: past },
      },
    });
    mockGetAdminDb.mockReturnValue(db);
    const res = await GET(verifyRequest(HEX64));
    expect(locationOf(res)).toContain("message=token_expired");
    expect(verificationDoc.delete).toHaveBeenCalled();
  });

  it("redirects with email_taken when emailLookup already has the email", async () => {
    const future = new Date(Date.now() + 60_000);
    const { db, verificationDoc } = buildDb({
      verification: {
        exists: true,
        data: { uid: "u1", email: "x@y.com", expiresAt: future },
      },
      emailLookup: { exists: true },
    });
    mockGetAdminDb.mockReturnValue(db);
    const res = await GET(verifyRequest(HEX64));
    expect(locationOf(res)).toContain("message=email_taken");
    expect(verificationDoc.delete).toHaveBeenCalled();
  });

  it("on success: adds email to user, creates emailLookup, deletes verification, redirects success", async () => {
    const future = new Date(Date.now() + 60_000);
    const { db, verificationDoc, emailLookupDoc, userDoc } = buildDb({
      verification: {
        exists: true,
        data: { uid: "u1", email: "  NEW@Example.com  ", expiresAt: future },
      },
      emailLookup: { exists: false },
    });
    mockGetAdminDb.mockReturnValue(db);

    const res = await GET(verifyRequest(HEX64));

    expect(locationOf(res)).toContain("emailVerification=success");
    expect(locationOf(res)).toContain("tab=security");

    expect(userDoc.update).toHaveBeenCalledTimes(1);
    const updatePayload = userDoc.update.mock.calls[0][0];
    expect(updatePayload.additionalEmails).toEqual({ __arrayUnion: expect.any(Object) });

    expect(emailLookupDoc.set).toHaveBeenCalledTimes(1);
    const lookupPayload = emailLookupDoc.set.mock.calls[0][0];
    expect(lookupPayload.uid).toBe("u1");
    expect(lookupPayload.isPrimary).toBe(false);

    expect(verificationDoc.delete).toHaveBeenCalled();
  });

  it("redirects with server_error when the Firestore read throws unexpectedly", async () => {
    const db: any = {
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: jest.fn().mockRejectedValue(new Error("firestore-down")),
        })),
      })),
    };
    mockGetAdminDb.mockReturnValue(db);
    const res = await GET(verifyRequest(HEX64));
    expect(locationOf(res)).toContain("message=server_error");
  });
});
