/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST } from "@/app/api/careers/apply/route";
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
  sanitizeDocId: jest.fn((s: string) =>
    s && /^[a-zA-Z0-9_-]+$/.test(s) ? s : null
  ),
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
  jobId: "job123",
  name: "Alice Dev",
  email: "alice@example.com",
  message: "I love building with Cursor!",
};

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/careers/apply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function buildMockDb({
  jobExists = true,
  jobStatus = "active",
  duplicateExists = false,
  addId = "app-id-1",
}: {
  jobExists?: boolean;
  jobStatus?: string;
  duplicateExists?: boolean;
  addId?: string;
} = {}) {
  const jobDoc = {
    exists: jobExists,
    data: () => ({ status: jobStatus }),
  };

  const duplicateSnap = {
    empty: !duplicateExists,
    docs: duplicateExists ? [{ id: "existing-app" }] : [],
  };

  const mockAdd = jest.fn().mockResolvedValue({ id: addId });

  const db = {
    collection: jest.fn((name: string) => {
      if (name === "jobListings") {
        return {
          doc: jest.fn(() => ({ get: jest.fn().mockResolvedValue(jobDoc) })),
        };
      }
      // applications collection
      return {
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue(duplicateSnap),
        add: mockAdd,
      };
    }),
    _mockAdd: mockAdd,
  };
  return db;
}

describe("POST /api/careers/apply", () => {
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
    mockGetVerifiedUser.mockResolvedValue({ uid: "user1" });
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

  it("returns 400 when jobId is missing", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "user1" });
    mockGetAdminDb.mockReturnValue(buildMockDb() as never);

    const res = await POST(makeRequest({ name: "Alice", email: "a@b.com", message: "Hi" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/jobId/i);
  });

  it("returns 400 when required fields are missing", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "user1" });
    mockGetAdminDb.mockReturnValue(buildMockDb() as never);

    const res = await POST(makeRequest({ jobId: "job123" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/required/i);
  });

  it("returns 404 when job does not exist", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "user1" });
    mockGetAdminDb.mockReturnValue(buildMockDb({ jobExists: false }) as never);

    const res = await POST(makeRequest(validPayload));
    expect(res.status).toBe(404);
  });

  it("returns 404 when job is not active", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "user1" });
    mockGetAdminDb.mockReturnValue(
      buildMockDb({ jobExists: true, jobStatus: "closed" }) as never
    );

    const res = await POST(makeRequest(validPayload));
    expect(res.status).toBe(404);
  });

  it("returns 409 on duplicate application", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "user1" });
    mockGetAdminDb.mockReturnValue(
      buildMockDb({ duplicateExists: true }) as never
    );

    const res = await POST(makeRequest(validPayload));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/already applied/i);
  });

  it("creates application and returns 200 with applicationId", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "user1" });
    const db = buildMockDb({ addId: "new-app-id" });
    mockGetAdminDb.mockReturnValue(db as never);

    const res = await POST(makeRequest(validPayload));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.applicationId).toBe("new-app-id");
    expect(body.appliedAt).toBeDefined();

    expect(db._mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job123",
        userId: "user1",
        name: "Alice Dev",
        email: "alice@example.com",
        message: "I love building with Cursor!",
      })
    );
  });

  it("returns 500 when db is not configured", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "user1" });
    mockGetAdminDb.mockReturnValue(null as never);

    const res = await POST(makeRequest(validPayload));
    expect(res.status).toBe(500);
  });
});
