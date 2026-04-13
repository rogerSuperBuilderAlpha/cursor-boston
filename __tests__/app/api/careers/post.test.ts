/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST } from "@/app/api/careers/post/route";
import { getVerifiedUser } from "@/lib/server-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { checkRateLimit } from "@/lib/rate-limit";

jest.mock("@/lib/logger", () => ({
  logger: { logError: jest.fn() },
}));

jest.mock("@/lib/rate-limit", () => {
  const actual = jest.requireActual("@/lib/rate-limit");
  return {
    ...actual,
    getClientIdentifier: jest.fn(() => "test-client"),
    checkRateLimit: jest.fn(() => ({ success: true, retryAfter: 0 })),
  };
});

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(),
}));

jest.mock("@/lib/sanitize", () => ({
  sanitizeText: jest.fn((s: string) => (typeof s === "string" ? s : "")),
  sanitizeUrl: jest.fn((s: string) => {
    try {
      const u = new URL(s);
      return ["http:", "https:"].includes(u.protocol) ? u.href : null;
    } catch {
      return null;
    }
  }),
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: jest.fn(() => "SERVER_TIMESTAMP") },
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<
  typeof getVerifiedUser
>;
const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockCheckRateLimit = checkRateLimit as jest.MockedFunction<
  typeof checkRateLimit
>;

const validPayload = {
  title: "Software Engineer",
  company: "Acme Corp",
  description: "Build things with Cursor",
  location: "Boston, MA",
  type: "full-time",
  experienceLevel: "senior",
  remote: false,
  tags: ["Cursor", "TypeScript"],
  featured: false,
};

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/careers/post", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function buildMockDb(addId = "new-job-id") {
  return {
    collection: jest.fn(() => ({
      add: jest.fn().mockResolvedValue({ id: addId }),
    })),
  };
}

describe("POST /api/careers/post", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 429 when rate limited", async () => {
    mockCheckRateLimit.mockReturnValueOnce({
      success: false,
      remaining: 0,
      resetTime: Date.now() + 60000,
      retryAfter: 60,
    });
    mockGetVerifiedUser.mockResolvedValue({
      uid: "admin1",
      isAdmin: true,
    });
    mockGetAdminDb.mockReturnValue(buildMockDb() as never);

    const res = await POST(makeRequest(validPayload));
    expect(res.status).toBe(429);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    mockGetAdminDb.mockReturnValue(buildMockDb() as never);

    const res = await POST(makeRequest(validPayload));
    expect(res.status).toBe(401);
  });

  it("returns 403 when authenticated but not admin", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "user1", isAdmin: false });
    mockGetAdminDb.mockReturnValue(buildMockDb() as never);

    const res = await POST(makeRequest(validPayload));
    expect(res.status).toBe(403);
  });

  it("returns 400 when required fields are missing", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "admin1", isAdmin: true });
    mockGetAdminDb.mockReturnValue(buildMockDb() as never);

    const res = await POST(makeRequest({ title: "Only title" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/required/i);
  });

  it("returns 400 for non-object payload", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "admin1", isAdmin: true });
    mockGetAdminDb.mockReturnValue(buildMockDb() as never);

    const req = new NextRequest("http://localhost/api/careers/post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '"just a string"',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("creates a listing and returns 200 with id", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "admin1", isAdmin: true });
    const db = buildMockDb("created-job-id");
    mockGetAdminDb.mockReturnValue(db as never);

    const res = await POST(makeRequest(validPayload));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("created-job-id");
    expect(body.title).toBe("Software Engineer");
    expect(body.company).toBe("Acme Corp");
    expect(body.status).toBe("active");

    const collectionCall = db.collection.mock.results[0].value;
    expect(collectionCall.add).toHaveBeenCalledTimes(1);
    const savedDoc = collectionCall.add.mock.calls[0][0];
    expect(savedDoc.postedById).toBe("admin1");
    expect(savedDoc.featured).toBe(false);
  });

  it("sanitizes tags and limits to 10", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "admin1", isAdmin: true });
    const db = buildMockDb();
    mockGetAdminDb.mockReturnValue(db as never);

    const manyTags = Array.from({ length: 15 }, (_, i) => `tag${i}`);
    await POST(makeRequest({ ...validPayload, tags: manyTags }));

    const collectionCall = db.collection.mock.results[0].value;
    const savedDoc = collectionCall.add.mock.calls[0][0];
    expect(savedDoc.tags).toHaveLength(10);
  });

  it("returns 500 when db is not configured", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "admin1", isAdmin: true });
    mockGetAdminDb.mockReturnValue(null as never);

    const res = await POST(makeRequest(validPayload));
    expect(res.status).toBe(500);
  });
});
