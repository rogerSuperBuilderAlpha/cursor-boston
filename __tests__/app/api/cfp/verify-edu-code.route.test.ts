/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST } from "@/app/api/cfp/verify-edu-code/route";
import type { VerifiedUser } from "@/lib/server-auth";
import { getVerifiedUser } from "@/lib/server-auth";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    logError: jest.fn(),
  },
  logApiError: jest.fn(),
}));

const mockDelete = jest.fn().mockResolvedValue(undefined);
const mockUpdate = jest.fn().mockResolvedValue(undefined);
const mockCodeDocSet = jest.fn().mockResolvedValue(undefined);
const mockEmailLookupSet = jest.fn().mockResolvedValue(undefined);
let mockCodeDocData: Record<string, unknown> | undefined;
let mockCodeDocExists = true;

const mockDb = {
  collection: jest.fn((name: string) => ({
    doc: jest.fn(() => {
      if (name === "eduVerificationCodes") {
        return {
          get: jest.fn().mockResolvedValue({
            exists: mockCodeDocExists,
            data: () => mockCodeDocData,
          }),
          set: mockCodeDocSet,
          delete: mockDelete,
        };
      }
      if (name === "users") {
        return { update: mockUpdate };
      }
      if (name === "emailLookup") {
        return { set: mockEmailLookupSet };
      }
      return {};
    }),
  })),
};

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(() => mockDb),
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: jest.fn(() => "MOCK_TIMESTAMP"),
    arrayUnion: jest.fn((...args: unknown[]) => args),
  },
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<
  typeof getVerifiedUser
>;

const testUser: VerifiedUser = { uid: "user123", name: "Test User" };

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/cfp/verify-edu-code", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authorization: "Bearer valid-token",
    },
    body: JSON.stringify(body),
  });
}

function makeRawRequest(body: string) {
  return new NextRequest("http://localhost/api/cfp/verify-edu-code", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authorization: "Bearer valid-token",
    },
    body,
  });
}

describe("POST /api/cfp/verify-edu-code", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCodeDocExists = true;
    mockCodeDocData = {
      uid: testUser.uid,
      email: "student@mit.edu",
      code: "123456",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min in future
    };
  });

  // --- Auth tests ---

  it("returns 401 when not authenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await POST(
      makeRequest({ email: "student@mit.edu", code: "123456" })
    );
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toMatch(/unauthorized/i);
  });

  // --- Validation tests ---

  it("returns 400 when email is missing", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const res = await POST(makeRequest({ code: "123456" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/email.*code.*required/i);
  });

  it("returns 400 when code is missing", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const res = await POST(makeRequest({ email: "student@mit.edu" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/required/i);
  });

  it("returns 400 when email is not .edu", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const res = await POST(
      makeRequest({ email: "user@gmail.com", code: "123456" })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/\.edu/i);
  });

  it("returns 400 for malformed JSON body", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const res = await POST(makeRawRequest("{not valid json"));
    expect(res.status).toBe(400);
  });

  // --- Code verification tests ---

  it("returns 400 when no verification code document exists", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockCodeDocExists = false;
    const res = await POST(
      makeRequest({ email: "student@mit.edu", code: "123456" })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/invalid or expired/i);
  });

  it("returns 400 when code has expired", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockCodeDocData = {
      ...mockCodeDocData,
      expiresAt: new Date(Date.now() - 60 * 1000), // 1 min ago
    };
    const res = await POST(
      makeRequest({ email: "student@mit.edu", code: "123456" })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/expired/i);
    expect(mockDelete).toHaveBeenCalled();
  });

  it("returns 400 when code does not match", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const res = await POST(
      makeRequest({ email: "student@mit.edu", code: "999999" })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/invalid code/i);
  });

  it("returns 400 when uid does not match", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockCodeDocData = {
      ...mockCodeDocData,
      uid: "different-user",
    };
    const res = await POST(
      makeRequest({ email: "student@mit.edu", code: "123456" })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/invalid/i);
  });

  it("returns 400 when email in doc does not match request", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockCodeDocData = {
      ...mockCodeDocData,
      email: "other@harvard.edu",
    };
    const res = await POST(
      makeRequest({ email: "student@mit.edu", code: "123456" })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/invalid/i);
  });

  // --- Success path ---

  it("verifies code and updates user on success", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const res = await POST(
      makeRequest({ email: "student@mit.edu", code: "123456" })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.email).toBe("student@mit.edu");

    // Should update user doc with eduBadge and additionalEmails
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        eduBadge: true,
      })
    );
    // Should create emailLookup entry
    expect(mockEmailLookupSet).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: testUser.uid,
        isPrimary: false,
      })
    );
    // Should delete the verification code doc
    expect(mockDelete).toHaveBeenCalled();
  });

  // --- Error handling ---

  it("returns 500 for unexpected errors", async () => {
    mockGetVerifiedUser.mockRejectedValue(new Error("Unexpected failure"));
    const res = await POST(
      makeRequest({ email: "student@mit.edu", code: "123456" })
    );
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toMatch(/failed to verify/i);
  });
});
