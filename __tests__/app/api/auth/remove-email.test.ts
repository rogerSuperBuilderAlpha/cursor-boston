/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST } from "@/app/api/auth/remove-email/route";
import type { VerifiedUser } from "@/lib/server-auth";
import { getVerifiedUser } from "@/lib/server-auth";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

const mockUpdate = jest.fn().mockResolvedValue(undefined);
const mockDelete = jest.fn().mockResolvedValue(undefined);
const mockUserGet = jest.fn();

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(() => ({
    collection: (name: string) => ({
      doc: () =>
        name === "users"
          ? { get: mockUserGet, update: mockUpdate }
          : { delete: mockDelete },
    }),
  })),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const testUser: VerifiedUser = { uid: "u1", name: "Test" };

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/auth/remove-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/remove-email", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(testUser);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await POST(makeRequest({ email: "test@example.com" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for missing email", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 404 when user doc not found", async () => {
    mockUserGet.mockResolvedValue({ data: () => null });
    const res = await POST(makeRequest({ email: "test@example.com" }));
    expect(res.status).toBe(404);
  });

  it("returns 400 when email not in additionalEmails", async () => {
    mockUserGet.mockResolvedValue({
      data: () => ({ additionalEmails: [{ email: "other@example.com" }] }),
    });
    const res = await POST(makeRequest({ email: "test@example.com" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });

  it("removes email and cleans up emailLookup on success", async () => {
    mockUserGet.mockResolvedValue({
      data: () => ({
        additionalEmails: [{ email: "test@example.com" }],
      }),
    });
    const res = await POST(makeRequest({ email: "Test@Example.com" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockDelete).toHaveBeenCalled();
  });
});
