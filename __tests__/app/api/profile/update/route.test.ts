/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { PATCH } from "@/app/api/profile/update/route";
import type { VerifiedUser } from "@/lib/server-auth";
import { getVerifiedUser } from "@/lib/server-auth";

jest.mock("@/lib/logger", () => ({
  logger: { error: jest.fn(), logError: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: jest.fn(() => ({ success: true })),
  getClientIdentifier: () => "test-client",
}));

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

const mockUpdate = jest.fn();
const mockGet = jest.fn();

const mockDb = {
  collection: jest.fn(() => ({
    doc: jest.fn(() => ({
      update: mockUpdate,
      get: mockGet,
    })),
  })),
};

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(() => mockDb),
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: jest.fn(() => "SERVER_TIMESTAMP"),
  },
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;

const testUser: VerifiedUser = { uid: "user-123", name: "Test User" };

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/profile/update", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeMalformedRequest() {
  return new NextRequest("http://localhost/api/profile/update", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: "not-json{{{",
  });
}

describe("PATCH /api/profile/update", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({
        displayName: "Updated Name",
        bio: "A bio",
        location: "Boston",
        company: "Acme",
        jobTitle: "Dev",
        socialLinks: { github: "https://github.com/test" },
      }),
    });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await PATCH(makeRequest({ displayName: "Valid Name" }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 400 for malformed JSON", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const res = await PATCH(makeMalformedRequest());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid JSON in request body");
  });

  it("returns 400 when no valid fields are provided", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const res = await PATCH(makeRequest({ unknownField: "value" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("No valid fields to update");
  });

  it("returns 400 when displayName is too short", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const res = await PATCH(makeRequest({ displayName: "A" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Display name must be at least 2 characters");
  });

  it("returns 400 when displayName is too long", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const res = await PATCH(makeRequest({ displayName: "A".repeat(51) }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Display name must be 50 characters or less");
  });

  it("returns 400 when bio exceeds 500 characters", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const res = await PATCH(makeRequest({ bio: "B".repeat(501) }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Bio must be 500 characters or less");
  });

  it("returns 400 when location exceeds 100 characters", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const res = await PATCH(makeRequest({ location: "L".repeat(101) }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Location must be 100 characters or less");
  });

  it("returns 400 when company exceeds 100 characters", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const res = await PATCH(makeRequest({ company: "C".repeat(101) }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Company must be 100 characters or less");
  });

  it("returns 400 when jobTitle exceeds 100 characters", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const res = await PATCH(makeRequest({ jobTitle: "J".repeat(101) }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Job title must be 100 characters or less");
  });

  it("successfully updates displayName", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const res = await PATCH(makeRequest({ displayName: "New Name" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.profile.displayName).toBe("Updated Name");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: "New Name", updatedAt: "SERVER_TIMESTAMP" })
    );
  });

  it("successfully updates multiple fields", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const res = await PATCH(
      makeRequest({
        displayName: "New Name",
        bio: "A short bio",
        location: "Boston",
        company: "Acme Inc",
        jobTitle: "Engineer",
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        displayName: "New Name",
        bio: "A short bio",
        location: "Boston",
        company: "Acme Inc",
        jobTitle: "Engineer",
        updatedAt: "SERVER_TIMESTAMP",
      })
    );
  });

  it("sets empty strings to null for optional fields", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const res = await PATCH(makeRequest({ bio: "", location: "" }));
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ bio: null, location: null })
    );
  });

  it("merges socialLinks with existing data", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    // First get() call is for reading existing socialLinks, second is for the final profile read
    mockGet
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ socialLinks: { twitter: "https://twitter.com/old" } }),
      })
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({
          displayName: "Test",
          bio: null,
          location: null,
          company: null,
          jobTitle: null,
          socialLinks: {
            twitter: "https://twitter.com/old",
            github: "https://github.com/new",
          },
        }),
      });

    const res = await PATCH(
      makeRequest({ socialLinks: { github: "https://github.com/new" } })
    );
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        socialLinks: {
          twitter: "https://twitter.com/old",
          github: "https://github.com/new",
        },
      })
    );
  });

  it("returns 429 when rate limited", async () => {
    const { checkRateLimit } = require("@/lib/rate-limit");
    checkRateLimit.mockReturnValueOnce({ success: false, retryAfter: 30 });
    mockGetVerifiedUser.mockResolvedValue(testUser);

    const res = await PATCH(makeRequest({ displayName: "Test" }));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("Too many requests");
  });

  it("returns 500 when db is not configured", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const { getAdminDb } = require("@/lib/firebase-admin");
    getAdminDb.mockReturnValueOnce(null);

    const res = await PATCH(makeRequest({ displayName: "Test" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Server not configured");
  });

  it("returns 500 when update throws", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockUpdate.mockRejectedValueOnce(new Error("Firestore error"));

    const res = await PATCH(makeRequest({ displayName: "Valid Name" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to update profile");
  });
});
