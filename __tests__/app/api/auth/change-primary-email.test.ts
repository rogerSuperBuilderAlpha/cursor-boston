/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST } from "@/app/api/auth/change-primary-email/route";
import { getVerifiedUser } from "@/lib/server-auth";
import { getAdminDb, getAdminAuth } from "@/lib/firebase-admin";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

const mockUpdate = jest.fn();
const mockGet = jest.fn();
const mockDelete = jest.fn();
const mockSet = jest.fn();
const mockUpdateUser = jest.fn();

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(),
  getAdminAuth: jest.fn(),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockGetAdminAuth = getAdminAuth as jest.MockedFunction<typeof getAdminAuth>;

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/auth/change-primary-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeMalformedRequest() {
  return new NextRequest("http://localhost/api/auth/change-primary-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "not-json{",
  });
}

function setupFirebaseMocks(userData: Record<string, unknown> | null = null) {
  const docMocks: Record<string, { get: jest.Mock; update: jest.Mock; delete: jest.Mock; set: jest.Mock }> = {};

  const getDocMock = (collection: string, docId: string) => {
    const key = `${collection}/${docId}`;
    if (!docMocks[key]) {
      docMocks[key] = { get: jest.fn(), update: jest.fn(), delete: jest.fn(), set: jest.fn() };
    }
    return docMocks[key];
  };

  const db = {
    collection: jest.fn((collectionName: string) => ({
      doc: jest.fn((docId: string) => getDocMock(collectionName, docId)),
    })),
  };

  // Set up the user doc
  const userDoc = getDocMock("users", "user-1");
  userDoc.get.mockResolvedValue({ data: () => userData });
  userDoc.update.mockImplementation(mockUpdate);

  mockGetAdminDb.mockReturnValue(db as any);
  mockGetAdminAuth.mockReturnValue({ updateUser: mockUpdateUser } as any);

  return { db, getDocMock };
}

describe("POST /api/auth/change-primary-email", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdate.mockResolvedValue(undefined);
    mockUpdateUser.mockResolvedValue(undefined);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await POST(makeRequest({ newPrimaryEmail: "new@example.com" }));
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

  it("returns 400 when newPrimaryEmail is missing", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "user-1", email: "old@example.com" });
    setupFirebaseMocks();
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("New primary email is required");
  });

  it("returns 400 when newPrimaryEmail is not a string", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "user-1", email: "old@example.com" });
    setupFirebaseMocks();
    const res = await POST(makeRequest({ newPrimaryEmail: 123 }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("New primary email is required");
  });

  it("returns 500 when admin services are not configured", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "user-1", email: "old@example.com" });
    mockGetAdminDb.mockReturnValue(null as any);
    mockGetAdminAuth.mockReturnValue(null as any);
    const res = await POST(makeRequest({ newPrimaryEmail: "new@example.com" }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Server not configured");
  });

  it("returns 404 when user document is not found", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "user-1", email: "old@example.com" });
    setupFirebaseMocks(null);
    const res = await POST(makeRequest({ newPrimaryEmail: "new@example.com" }));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("User not found");
  });

  it("returns 400 when email is not a verified additional email", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "user-1", email: "old@example.com" });
    setupFirebaseMocks({
      email: "old@example.com",
      additionalEmails: [
        { email: "unverified@example.com", verified: false },
      ],
    });
    const res = await POST(makeRequest({ newPrimaryEmail: "new@example.com" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Email must be a verified additional email on your account");
  });

  it("returns 400 when email is additional but not verified", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "user-1", email: "old@example.com" });
    setupFirebaseMocks({
      email: "old@example.com",
      additionalEmails: [
        { email: "new@example.com", verified: false },
      ],
    });
    const res = await POST(makeRequest({ newPrimaryEmail: "new@example.com" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Email must be a verified additional email on your account");
  });

  it("successfully changes primary email", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "user-1", email: "old@example.com" });
    const { getDocMock } = setupFirebaseMocks({
      email: "old@example.com",
      additionalEmails: [
        { email: "new@example.com", verified: true },
      ],
    });

    // emailLookup doc for old primary
    const oldLookupDoc = getDocMock("emailLookup", "old@example.com");
    oldLookupDoc.get.mockResolvedValue({ exists: true, data: () => ({ uid: "user-1" }) });
    oldLookupDoc.delete.mockResolvedValue(undefined);
    oldLookupDoc.set.mockResolvedValue(undefined);

    // emailLookup doc for new primary
    const newLookupDoc = getDocMock("emailLookup", "new@example.com");
    newLookupDoc.delete.mockResolvedValue(undefined);

    const res = await POST(makeRequest({ newPrimaryEmail: "new@example.com" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.message).toBe("Primary email changed successfully");

    // Verify Firebase Auth was updated
    expect(mockUpdateUser).toHaveBeenCalledWith("user-1", { email: "new@example.com" });
  });

  it("normalizes email to lowercase", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "user-1", email: "old@example.com" });
    const { getDocMock } = setupFirebaseMocks({
      email: "old@example.com",
      additionalEmails: [
        { email: "new@example.com", verified: true },
      ],
    });

    const oldLookupDoc = getDocMock("emailLookup", "old@example.com");
    oldLookupDoc.get.mockResolvedValue({ exists: true, data: () => ({ uid: "user-1" }) });
    oldLookupDoc.delete.mockResolvedValue(undefined);
    oldLookupDoc.set.mockResolvedValue(undefined);

    const newLookupDoc = getDocMock("emailLookup", "new@example.com");
    newLookupDoc.delete.mockResolvedValue(undefined);

    const res = await POST(makeRequest({ newPrimaryEmail: "  NEW@Example.com  " }));
    expect(res.status).toBe(200);
    expect(mockUpdateUser).toHaveBeenCalledWith("user-1", { email: "new@example.com" });
  });

  it("rolls back Firebase Auth on Firestore failure", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "user-1", email: "old@example.com" });
    setupFirebaseMocks({
      email: "old@example.com",
      additionalEmails: [
        { email: "new@example.com", verified: true },
      ],
    });

    // Make the Firestore update fail
    mockUpdate.mockRejectedValue(new Error("Firestore write failed"));

    const res = await POST(makeRequest({ newPrimaryEmail: "new@example.com" }));
    expect(res.status).toBe(500);

    // Auth should have been called twice: once to set new, once to rollback
    expect(mockUpdateUser).toHaveBeenCalledTimes(2);
    expect(mockUpdateUser).toHaveBeenCalledWith("user-1", { email: "new@example.com" });
    expect(mockUpdateUser).toHaveBeenCalledWith("user-1", { email: "old@example.com" });
  });
});
