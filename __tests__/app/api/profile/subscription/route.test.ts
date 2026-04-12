/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { GET, PATCH } from "@/app/api/profile/subscription/route";
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

const mockContactGet = jest.fn();
const mockContactUpdate = jest.fn();
const mockUserGet = jest.fn();

const mockDb = {
  collection: jest.fn((name: string) => {
    if (name === "eventContacts") {
      return {
        doc: jest.fn(() => ({
          get: mockContactGet,
          update: mockContactUpdate,
        })),
      };
    }
    if (name === "users") {
      return {
        doc: jest.fn(() => ({
          get: mockUserGet,
        })),
      };
    }
    return { doc: jest.fn(() => ({ get: jest.fn() })) };
  }),
};

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(() => mockDb),
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: jest.fn(() => "SERVER_TIMESTAMP"),
    delete: jest.fn(() => "FIELD_DELETE"),
  },
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;

const testUser: VerifiedUser & { email: string } = {
  uid: "user-123",
  name: "Test User",
  email: "test@example.com",
};

function makeGetRequest() {
  return new NextRequest("http://localhost/api/profile/subscription", {
    method: "GET",
  });
}

function makePatchRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/profile/subscription", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeMalformedPatchRequest() {
  return new NextRequest("http://localhost/api/profile/subscription", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: "not-json{{{",
  });
}

// ---------- GET ----------

describe("GET /api/profile/subscription", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns onList=false when no contact doc exists", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockContactGet.mockResolvedValue({ exists: false });
    mockUserGet.mockResolvedValue({
      exists: true,
      data: () => ({ additionalEmails: [] }),
    });

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.onList).toBe(false);
    expect(body.subscribed).toBe(false);
  });

  it("returns subscribed=true when contact exists and not unsubscribed", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockContactGet.mockResolvedValue({
      exists: true,
      data: () => ({ unsubscribed: false }),
    });

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.onList).toBe(true);
    expect(body.subscribed).toBe(true);
  });

  it("returns subscribed=false when contact is unsubscribed", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockContactGet.mockResolvedValue({
      exists: true,
      data: () => ({ unsubscribed: true }),
    });

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.onList).toBe(true);
    expect(body.subscribed).toBe(false);
  });

  it("finds contact via additional verified email", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    // Primary email not found
    mockContactGet
      .mockResolvedValueOnce({ exists: false })
      // Additional email found
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ unsubscribed: false }),
      });
    mockUserGet.mockResolvedValue({
      exists: true,
      data: () => ({
        additionalEmails: [{ email: "alt@example.com", verified: true }],
      }),
    });

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.onList).toBe(true);
    expect(body.subscribed).toBe(true);
  });

  it("skips unverified additional emails", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockContactGet.mockResolvedValue({ exists: false });
    mockUserGet.mockResolvedValue({
      exists: true,
      data: () => ({
        additionalEmails: [{ email: "unverified@example.com", verified: false }],
      }),
    });

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.onList).toBe(false);
  });

  it("returns 429 when rate limited", async () => {
    const { checkRateLimit } = require("@/lib/rate-limit");
    checkRateLimit.mockReturnValueOnce({ success: false });

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(429);
  });

  it("returns 500 when db is not configured", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const { getAdminDb } = require("@/lib/firebase-admin");
    getAdminDb.mockReturnValueOnce(null);

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Server not configured");
  });
});

// ---------- PATCH ----------

describe("PATCH /api/profile/subscription", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await PATCH(makePatchRequest({ subscribed: true }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for malformed JSON", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const res = await PATCH(makeMalformedPatchRequest());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid JSON");
  });

  it("returns 400 when subscribed is not a boolean", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const res = await PATCH(makePatchRequest({ subscribed: "yes" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("subscribed must be a boolean");
  });

  it("returns 400 when subscribed is missing", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const res = await PATCH(makePatchRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("subscribed must be a boolean");
  });

  it("returns 404 when no contact doc is found", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockContactGet.mockResolvedValue({ exists: false });
    mockUserGet.mockResolvedValue({
      exists: true,
      data: () => ({ additionalEmails: [] }),
    });

    const res = await PATCH(makePatchRequest({ subscribed: true }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("No event contact record found for your email");
  });

  it("resubscribes when subscribed=true", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockContactGet.mockResolvedValue({
      exists: true,
      data: () => ({ unsubscribed: true }),
    });

    const res = await PATCH(makePatchRequest({ subscribed: true }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.subscribed).toBe(true);
    expect(mockContactUpdate).toHaveBeenCalledWith({
      unsubscribed: false,
      unsubscribedAt: "FIELD_DELETE",
      resubscribedAt: "SERVER_TIMESTAMP",
    });
  });

  it("unsubscribes when subscribed=false", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockContactGet.mockResolvedValue({
      exists: true,
      data: () => ({ unsubscribed: false }),
    });

    const res = await PATCH(makePatchRequest({ subscribed: false }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.subscribed).toBe(false);
    expect(mockContactUpdate).toHaveBeenCalledWith({
      unsubscribed: true,
      unsubscribedAt: "SERVER_TIMESTAMP",
    });
  });

  it("returns 429 when rate limited", async () => {
    const { checkRateLimit } = require("@/lib/rate-limit");
    checkRateLimit.mockReturnValueOnce({ success: false });

    const res = await PATCH(makePatchRequest({ subscribed: true }));
    expect(res.status).toBe(429);
  });

  it("returns 500 when db is not configured", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const { getAdminDb } = require("@/lib/firebase-admin");
    getAdminDb.mockReturnValueOnce(null);

    const res = await PATCH(makePatchRequest({ subscribed: true }));
    expect(res.status).toBe(500);
  });
});
