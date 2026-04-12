/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST } from "@/app/api/auth/send-email-verification/route";
import { getVerifiedUser } from "@/lib/server-auth";
import { getAdminDb, getAdminAuth } from "@/lib/firebase-admin";
import { sendEmail } from "@/lib/mailgun";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(),
  getAdminAuth: jest.fn(),
}));

jest.mock("@/lib/mailgun", () => ({
  sendEmail: jest.fn(),
}));

jest.mock("@/lib/logger", () => ({
  logApiError: jest.fn(),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockGetAdminAuth = getAdminAuth as jest.MockedFunction<typeof getAdminAuth>;
const mockSendEmail = sendEmail as jest.MockedFunction<typeof sendEmail>;

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/auth/send-email-verification", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeMalformedRequest() {
  return new NextRequest("http://localhost/api/auth/send-email-verification", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "not-json{",
  });
}

function setupFirebaseMocks(userData: Record<string, unknown> | null = null) {
  const mockDocSet = jest.fn().mockResolvedValue(undefined);
  const mockDocGet = jest.fn();

  const docMocks: Record<string, { get: jest.Mock; set: jest.Mock }> = {};

  const getDocMock = (collection: string, docId: string) => {
    const key = `${collection}/${docId}`;
    if (!docMocks[key]) {
      docMocks[key] = { get: jest.fn(), set: jest.fn().mockResolvedValue(undefined) };
    }
    return docMocks[key];
  };

  const db = {
    collection: jest.fn((collectionName: string) => ({
      doc: jest.fn((docId: string) => getDocMock(collectionName, docId)),
    })),
  };

  // Set up user doc
  const userDocMock = getDocMock("users", "user-1");
  userDocMock.get.mockResolvedValue({ data: () => userData });

  const getUserByEmail = jest.fn();

  mockGetAdminDb.mockReturnValue(db as any);
  mockGetAdminAuth.mockReturnValue({ getUserByEmail } as any);

  return { db, getDocMock, getUserByEmail };
}

describe("POST /api/auth/send-email-verification", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSendEmail.mockResolvedValue(undefined as any);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await POST(makeRequest({ email: "test@example.com" }));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 400 for malformed JSON", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "user-1", email: "old@example.com" });
    setupFirebaseMocks();
    const res = await POST(makeMalformedRequest());
    expect(res.status).toBe(400);
  });

  it("returns 400 when email is missing", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "user-1", email: "old@example.com" });
    setupFirebaseMocks();
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Email is required");
  });

  it("returns 400 when email is not a string", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "user-1", email: "old@example.com" });
    setupFirebaseMocks();
    const res = await POST(makeRequest({ email: 42 }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Email is required");
  });

  it("returns 400 when email is too long", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "user-1", email: "old@example.com" });
    setupFirebaseMocks();
    const longEmail = "a".repeat(250) + "@b.co";
    const res = await POST(makeRequest({ email: longEmail }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Email is too long");
  });

  it("returns 400 for invalid email format", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "user-1", email: "old@example.com" });
    setupFirebaseMocks();
    const res = await POST(makeRequest({ email: "not-an-email" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid email format");
  });

  it("returns 500 when admin services are not configured", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "user-1", email: "old@example.com" });
    mockGetAdminDb.mockReturnValue(null as any);
    mockGetAdminAuth.mockReturnValue(null as any);
    const res = await POST(makeRequest({ email: "new@example.com" }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Server not configured");
  });

  it("returns 400 when email is already used by another account in Firebase Auth", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "user-1", email: "old@example.com" });
    const { getUserByEmail } = setupFirebaseMocks({
      email: "old@example.com",
      additionalEmails: [],
    });
    getUserByEmail.mockResolvedValue({ uid: "other-user" });

    const res = await POST(makeRequest({ email: "taken@example.com" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("This email is already associated with an account");
  });

  it("returns 400 when email exists in emailLookup collection", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "user-1", email: "old@example.com" });
    const { getUserByEmail, getDocMock } = setupFirebaseMocks({
      email: "old@example.com",
      additionalEmails: [],
    });
    getUserByEmail.mockRejectedValue(new Error("not found"));

    const lookupDoc = getDocMock("emailLookup", "taken@example.com");
    lookupDoc.get.mockResolvedValue({ exists: true });

    const res = await POST(makeRequest({ email: "taken@example.com" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("This email is already associated with an account");
  });

  it("returns 400 when email is already the primary email", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "user-1", email: "old@example.com" });
    const { getUserByEmail, getDocMock } = setupFirebaseMocks({
      email: "old@example.com",
      additionalEmails: [],
    });
    getUserByEmail.mockRejectedValue(new Error("not found"));

    const lookupDoc = getDocMock("emailLookup", "old@example.com");
    lookupDoc.get.mockResolvedValue({ exists: false });

    const res = await POST(makeRequest({ email: "old@example.com" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("This is already your primary email");
  });

  it("returns 400 when email is already an additional email", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "user-1", email: "old@example.com" });
    const { getUserByEmail, getDocMock } = setupFirebaseMocks({
      email: "old@example.com",
      additionalEmails: [{ email: "extra@example.com", verified: true }],
    });
    getUserByEmail.mockRejectedValue(new Error("not found"));

    const lookupDoc = getDocMock("emailLookup", "extra@example.com");
    lookupDoc.get.mockResolvedValue({ exists: false });

    const res = await POST(makeRequest({ email: "extra@example.com" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("This email is already added to your account");
  });

  it("successfully sends verification email", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "user-1", email: "old@example.com" });
    const { getUserByEmail, getDocMock } = setupFirebaseMocks({
      email: "old@example.com",
      displayName: "Test User",
      additionalEmails: [],
    });
    getUserByEmail.mockRejectedValue(new Error("not found"));

    const lookupDoc = getDocMock("emailLookup", "new@example.com");
    lookupDoc.get.mockResolvedValue({ exists: false });

    const res = await POST(makeRequest({ email: "new@example.com" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.message).toBe("Verification email sent");

    // Verify sendEmail was called with the right recipient
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "new@example.com",
        subject: "Verify your email address",
      })
    );
  });

  it("normalizes email to lowercase and trims whitespace", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "user-1", email: "old@example.com" });
    const { getUserByEmail, getDocMock } = setupFirebaseMocks({
      email: "old@example.com",
      additionalEmails: [],
    });
    getUserByEmail.mockRejectedValue(new Error("not found"));

    const lookupDoc = getDocMock("emailLookup", "new@example.com");
    lookupDoc.get.mockResolvedValue({ exists: false });

    const res = await POST(makeRequest({ email: "  NEW@Example.com  " }));
    expect(res.status).toBe(200);
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "new@example.com" })
    );
  });

  it("returns 500 when sendEmail throws", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "user-1", email: "old@example.com" });
    const { getUserByEmail, getDocMock } = setupFirebaseMocks({
      email: "old@example.com",
      additionalEmails: [],
    });
    getUserByEmail.mockRejectedValue(new Error("not found"));

    const lookupDoc = getDocMock("emailLookup", "new@example.com");
    lookupDoc.get.mockResolvedValue({ exists: false });

    mockSendEmail.mockRejectedValue(new Error("Mailgun error"));

    const res = await POST(makeRequest({ email: "new@example.com" }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Failed to send verification email");
  });
});
