/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST } from "@/app/api/cfp/send-edu-code/route";
import type { VerifiedUser } from "@/lib/server-auth";
import { getVerifiedUser } from "@/lib/server-auth";
import { sendEmail } from "@/lib/mailgun";

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

jest.mock("@/lib/mailgun", () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
}));

const mockSet = jest.fn().mockResolvedValue(undefined);
const mockDocGet = jest.fn();
const mockDocRef = { get: mockDocGet, set: mockSet };
const mockGetUserByEmail = jest.fn();

const mockDb = {
  collection: jest.fn((name: string) => ({
    doc: jest.fn(() => {
      if (name === "eduVerificationCodes") return { set: mockSet };
      if (name === "emailLookup") return { get: mockDocGet };
      if (name === "users")
        return { get: jest.fn().mockResolvedValue(mockUserDoc) };
      return mockDocRef;
    }),
  })),
};

const mockAuth = {
  getUserByEmail: mockGetUserByEmail,
};

let mockUserDoc = {
  data: () => ({ email: "primary@gmail.com", additionalEmails: [] }),
};

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(() => mockDb),
  getAdminAuth: jest.fn(() => mockAuth),
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: jest.fn(() => "MOCK_TIMESTAMP") },
}));

jest.mock("crypto", () => ({
  randomInt: jest.fn(() => 123456),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<
  typeof getVerifiedUser
>;
const mockSendEmail = sendEmail as jest.MockedFunction<typeof sendEmail>;

const testUser: VerifiedUser = { uid: "user123", name: "Test User" };

function makeRequest(
  body: Record<string, unknown>,
  options?: { omitAuth?: boolean }
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (!options?.omitAuth) {
    headers["authorization"] = "Bearer valid-token";
  }
  return new NextRequest("http://localhost/api/cfp/send-edu-code", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function makeRawRequest(body: string, hasAuth = true) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (hasAuth) headers["authorization"] = "Bearer valid-token";
  return new NextRequest("http://localhost/api/cfp/send-edu-code", {
    method: "POST",
    headers,
    body,
  });
}

describe("POST /api/cfp/send-edu-code", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserByEmail.mockRejectedValue(new Error("not found"));
    mockDocGet.mockResolvedValue({ exists: false });
    mockUserDoc = {
      data: () => ({ email: "primary@gmail.com", additionalEmails: [] }),
    };
  });

  // --- Auth tests ---

  it("returns 401 when no auth token is provided", async () => {
    const req = new NextRequest("http://localhost/api/cfp/send-edu-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "student@mit.edu" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toMatch(/sign in/i);
  });

  it("returns 401 when getVerifiedUser returns null", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await POST(makeRequest({ email: "student@mit.edu" }));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toMatch(/session/i);
  });

  // --- Validation tests ---

  it("returns 400 when email is missing", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/email/i);
  });

  it("returns 400 when email is not a .edu address", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const res = await POST(makeRequest({ email: "user@gmail.com" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/\.edu/i);
  });

  it("returns 400 when email is too long", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const longEmail = "a".repeat(250) + "@b.edu";
    const res = await POST(makeRequest({ email: longEmail }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/too long/i);
  });

  it("returns 400 when email format is invalid", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const res = await POST(makeRequest({ email: "not-an-email.edu" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/invalid email|\.edu/i);
  });

  it("returns 400 for malformed JSON body", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const res = await POST(makeRawRequest("{bad json}"));
    expect(res.status).toBe(400);
  });

  // --- Duplicate email tests ---

  it("returns 400 when email is already primary on another account", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockGetUserByEmail.mockResolvedValue({ uid: "other-user" });
    const res = await POST(makeRequest({ email: "student@mit.edu" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/already associated/i);
  });

  it("returns 400 when email exists in emailLookup", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockDocGet.mockResolvedValue({ exists: true });
    const res = await POST(makeRequest({ email: "student@mit.edu" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/already associated/i);
  });

  it("returns 400 when email is the user's primary email", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockUserDoc = {
      data: () => ({
        email: "student@mit.edu",
        additionalEmails: [],
      }),
    };
    const res = await POST(makeRequest({ email: "student@mit.edu" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/already your primary/i);
  });

  it("returns 400 when email is already an additional email", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockUserDoc = {
      data: () => ({
        email: "primary@gmail.com",
        additionalEmails: [{ email: "student@mit.edu" }],
      }),
    };
    const res = await POST(makeRequest({ email: "student@mit.edu" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/already added/i);
  });

  // --- Success path ---

  it("saves code and sends email on success", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const res = await POST(makeRequest({ email: "student@mit.edu" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.message).toMatch(/sent/i);
    expect(mockSet).toHaveBeenCalled();
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "student@mit.edu",
        subject: expect.stringContaining("verification"),
      })
    );
  });

  // --- Error handling ---

  it("returns 401 for auth-related errors in catch block", async () => {
    mockGetVerifiedUser.mockRejectedValue(
      Object.assign(new Error("Error decoding token"), {
        code: "auth/id-token-expired",
      })
    );
    const res = await POST(makeRequest({ email: "student@mit.edu" }));
    expect(res.status).toBe(401);
  });

  it("returns 500 for unexpected errors", async () => {
    mockGetVerifiedUser.mockRejectedValue(new Error("Something broke"));
    const res = await POST(makeRequest({ email: "student@mit.edu" }));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toMatch(/failed/i);
  });
});
