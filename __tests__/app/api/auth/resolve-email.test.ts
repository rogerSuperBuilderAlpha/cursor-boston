/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST } from "@/app/api/auth/resolve-email/route";

const mockGetUserByEmail = jest.fn();
const mockGet = jest.fn();

jest.mock("@/lib/logger", () => ({
  logger: { error: jest.fn(), logError: jest.fn() },
}));

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(() => ({
    collection: () => ({
      doc: () => ({ get: mockGet }),
    }),
  })),
  getAdminAuth: jest.fn(() => ({
    getUserByEmail: mockGetUserByEmail,
  })),
}));

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/auth/resolve-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/resolve-email", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 400 for missing email", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 for non-string email", async () => {
    const res = await POST(makeRequest({ email: 123 }));
    expect(res.status).toBe(400);
  });

  it("returns primary email when found in Firebase Auth", async () => {
    mockGetUserByEmail.mockResolvedValue({ uid: "u1" });
    const res = await POST(makeRequest({ email: "User@Example.com" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.primaryEmail).toBe("user@example.com");
    expect(body.isAlias).toBe(false);
  });

  it("checks emailLookup when not a primary email", async () => {
    mockGetUserByEmail.mockRejectedValue(new Error("not found"));
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ uid: "u1" }),
    });
    // Second call for user doc
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ email: "primary@example.com" }),
    });
    const res = await POST(makeRequest({ email: "alias@example.com" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.primaryEmail).toBe("primary@example.com");
    expect(body.isAlias).toBe(true);
  });

  it("returns null when email not found anywhere", async () => {
    mockGetUserByEmail.mockRejectedValue(new Error("not found"));
    mockGet.mockResolvedValue({ exists: false });
    const res = await POST(makeRequest({ email: "unknown@example.com" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.primaryEmail).toBeNull();
  });

  it("returns 400 for malformed JSON", async () => {
    const req = new NextRequest("http://localhost/api/auth/resolve-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "bad json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
