/**
 * @jest-environment node
 *
 * OpenSSF Silver coverage — talk submission moderation route GET/POST guards.
 */
import { GET, POST } from "@/app/api/talks/submission/moderate/route";
import { getVerifiedUser } from "@/lib/server-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { checkServerRateLimit } from "@/lib/rate-limit-server";
import { paginateFirestoreQuery } from "@/lib/firestore-pagination";
import { makeAuthedRequest, makeRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/logger", () => ({
  logger: { logError: jest.fn(), warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}));

jest.mock("@/lib/rate-limit", () => ({
  getClientIdentifier: jest.fn(() => "test-ip"),
}));

jest.mock("@/lib/rate-limit-server", () => ({
  checkServerRateLimit: jest.fn(async () => ({ success: true, retryAfter: 0 })),
  buildRateLimitHeaders: jest.fn(() => ({ "X-RateLimit-Limit": "60" })),
}));

jest.mock("@/lib/firestore-pagination", () => ({
  ...jest.requireActual("@/lib/firestore-pagination"),
  paginateFirestoreQuery: jest.fn(),
}));

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockCheckServerRateLimit = checkServerRateLimit as jest.MockedFunction<
  typeof checkServerRateLimit
>;
const mockPaginate = paginateFirestoreQuery as jest.MockedFunction<typeof paginateFirestoreQuery>;

const adminUser = {
  uid: "admin1",
  email: "admin@example.com",
  name: "Admin",
  isAdmin: true,
};

/** Pending-queue logging uses .where().limit().get() on talkSubmissions. */
function talkSubmissionsCol(inner: { doc: ReturnType<typeof jest.fn> }) {
  return {
    ...inner,
    where: jest.fn(() => ({
      limit: jest.fn(() => ({
        get: jest.fn(async () => ({ docs: [], size: 0, forEach: () => undefined })),
      })),
      orderBy: jest.fn().mockReturnThis(),
    })),
    orderBy: jest.fn().mockReturnThis(),
  };
}

function makeStatusDocs(status: string, count = 1) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${status}-${index}`,
    data: () => ({
      userId: `user-${index}`,
      title: `${status} talk ${index}`,
      status,
      createdAt: { toDate: () => new Date("2026-03-01T12:00:00.000Z") },
    }),
  }));
}

describe("GET /api/talks/submission/moderate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(null);
    mockCheckServerRateLimit.mockResolvedValue({ success: true, retryAfter: 0 });
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await GET(makeRequest({ path: "/api/talks/submission/moderate" }));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockGetVerifiedUser.mockResolvedValue(adminUser);
    mockCheckServerRateLimit.mockResolvedValue({
      success: false,
      retryAfter: 30,
      statusCode: 429,
    });

    const res = await GET(makeAuthedRequest({ path: "/api/talks/submission/moderate" }));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("Too many requests");
  });

  it("returns 503 when the rate-limit service is unavailable", async () => {
    mockGetVerifiedUser.mockResolvedValue(adminUser);
    mockCheckServerRateLimit.mockResolvedValue({
      success: false,
      retryAfter: 0,
      statusCode: 503,
    });

    const res = await GET(makeAuthedRequest({ path: "/api/talks/submission/moderate" }));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("Rate limit service unavailable");
  });

  it("returns 403 when the caller is not an admin", async () => {
    mockGetVerifiedUser.mockResolvedValue({
      uid: "u1",
      email: "member@example.com",
      name: "Member",
      isAdmin: false,
    });

    const res = await GET(makeAuthedRequest({ path: "/api/talks/submission/moderate" }));
    expect(res.status).toBe(403);
  });

  it("returns 500 when Firestore admin is unavailable", async () => {
    mockGetVerifiedUser.mockResolvedValue(adminUser);
    mockGetAdminDb.mockReturnValue(null);

    const res = await GET(makeAuthedRequest({ path: "/api/talks/submission/moderate" }));
    expect(res.status).toBe(500);
  });

  it("returns all three status buckets when no status filter is provided", async () => {
    mockGetVerifiedUser.mockResolvedValue(adminUser);

    const pendingDocs = makeStatusDocs("pending");
    const approvedDocs = makeStatusDocs("approved");
    const completedDocs = makeStatusDocs("completed");

    const db = {
      collection: jest.fn((name: string) => {
        if (name !== "talkSubmissions") throw new Error("unexpected collection");
        return {
          where: jest.fn((_field: string, _op: string, status: string) => ({
            limit: jest.fn(() => ({
              get: jest.fn(async () => {
                if (status === "pending") return { docs: pendingDocs, size: pendingDocs.length };
                if (status === "approved") return { docs: approvedDocs, size: approvedDocs.length };
                return { docs: completedDocs, size: completedDocs.length };
              }),
            })),
          })),
        };
      }),
    };
    mockGetAdminDb.mockReturnValue(db as never);

    const { status, body } = await readJson(
      await GET(makeAuthedRequest({ path: "/api/talks/submission/moderate" })),
    );

    expect(status).toBe(200);
    expect(body).toMatchObject({
      nextCursor: null,
      hasMore: false,
      talkSubmissions: expect.arrayContaining([
        expect.objectContaining({ status: "pending", title: "pending talk 0" }),
        expect.objectContaining({ status: "approved", title: "approved talk 0" }),
        expect.objectContaining({ status: "completed", title: "completed talk 0" }),
      ]),
    });
    expect((body as { talkSubmissions: unknown[] }).talkSubmissions).toHaveLength(3);
  });

  it("returns paginated results for a single status filter", async () => {
    mockGetVerifiedUser.mockResolvedValue(adminUser);

    const collection = {
      doc: jest.fn(),
    };
    const query = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
    };

    const db = {
      collection: jest.fn(() => ({
        ...collection,
        where: jest.fn().mockReturnValue(query),
        orderBy: jest.fn().mockReturnValue(query),
      })),
    };
    mockGetAdminDb.mockReturnValue(db as never);
    mockPaginate.mockResolvedValue({
      items: [
        {
          submissionId: "pending-0",
          userId: "user-0",
          title: "Pending talk",
          status: "pending",
          createdAt: "2026-03-01T12:00:00.000Z",
        },
      ],
      nextCursor: "pending-0",
      hasMore: true,
    });

    const { status, body } = await readJson(
      await GET(
        makeAuthedRequest({
          path: "/api/talks/submission/moderate",
          searchParams: { status: "pending", limit: "10", cursor: "cursor-1" },
        }),
      ),
    );

    expect(status).toBe(200);
    expect(body).toEqual({
      talkSubmissions: [
        expect.objectContaining({ submissionId: "pending-0", status: "pending" }),
      ],
      nextCursor: "pending-0",
      hasMore: true,
    });
    expect(mockPaginate).toHaveBeenCalled();
  });

  it("returns 500 when loading submissions throws", async () => {
    mockGetVerifiedUser.mockResolvedValue(adminUser);
    mockGetAdminDb.mockReturnValue({
      collection: jest.fn(() => {
        throw new Error("firestore unavailable");
      }),
    } as never);

    const res = await GET(makeAuthedRequest({ path: "/api/talks/submission/moderate" }));
    expect(res.status).toBe(500);
  });
});

describe("POST /api/talks/submission/moderate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(null);
    mockCheckServerRateLimit.mockResolvedValue({ success: true, retryAfter: 0 });
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await POST(
      makeRequest({
        method: "POST",
        path: "/api/talks/submission/moderate",
        body: { submissionId: "t1", action: "approve" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when the caller is not an admin", async () => {
    mockGetVerifiedUser.mockResolvedValue({
      uid: "u1",
      email: "member@example.com",
      name: "Member",
      isAdmin: false,
    });

    const res = await POST(
      makeAuthedRequest({
        method: "POST",
        path: "/api/talks/submission/moderate",
        body: { submissionId: "t1", action: "approve" },
      }),
    );
    expect(res.status).toBe(403);
  });

  it("returns 500 when Firestore admin is unavailable", async () => {
    mockGetVerifiedUser.mockResolvedValue(adminUser);
    mockGetAdminDb.mockReturnValue(null);

    const res = await POST(
      makeAuthedRequest({
        method: "POST",
        path: "/api/talks/submission/moderate",
        body: { submissionId: "t1", action: "approve" },
      }),
    );
    expect(res.status).toBe(500);
  });

  it("returns 400 for invalid JSON", async () => {
    mockGetVerifiedUser.mockResolvedValue(adminUser);
    mockGetAdminDb.mockReturnValue({ collection: jest.fn() } as never);

    const res = await POST(
      makeAuthedRequest({
        method: "POST",
        path: "/api/talks/submission/moderate",
        body: "not-json",
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid json/i);
  });

  it("returns 400 for an invalid submission id", async () => {
    mockGetVerifiedUser.mockResolvedValue(adminUser);
    mockGetAdminDb.mockReturnValue({ collection: jest.fn() } as never);

    const res = await POST(
      makeAuthedRequest({
        method: "POST",
        path: "/api/talks/submission/moderate",
        body: { submissionId: "", action: "approve" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when the submission does not exist", async () => {
    mockGetVerifiedUser.mockResolvedValue(adminUser);

    const db = {
      collection: jest.fn(() =>
        talkSubmissionsCol({
          doc: jest.fn(() => ({
            get: jest.fn(async () => ({ exists: false })),
            set: jest.fn(),
          })),
        }),
      ),
    };
    mockGetAdminDb.mockReturnValue(db as never);

    const res = await POST(
      makeAuthedRequest({
        method: "POST",
        path: "/api/talks/submission/moderate",
        body: { submissionId: "missing-talk", action: "approve" },
      }),
    );
    expect(res.status).toBe(404);
  });

  it("requires approval before complete", async () => {
    mockGetVerifiedUser.mockResolvedValue(adminUser);

    const db = {
      collection: jest.fn(() =>
        talkSubmissionsCol({
          doc: jest.fn(() => ({
            get: jest.fn(async () => ({ exists: true, data: () => ({ status: "pending" }) })),
            set: jest.fn(async () => undefined),
          })),
        }),
      ),
    };
    mockGetAdminDb.mockReturnValue(db as never);

    const { status, body } = await readJson(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/talks/submission/moderate",
          body: { submissionId: "t1", action: "complete" },
        }),
      ),
    );

    expect(status).toBe(400);
    expect(body.error).toContain("must be approved");
  });

  it("supports approve -> complete transition", async () => {
    mockGetVerifiedUser.mockResolvedValue(adminUser);

    let status: "pending" | "approved" | "completed" = "pending";
    const setMock = jest.fn(async (payload: Record<string, unknown>) => {
      if (payload.status === "approved") status = "approved";
      if (payload.status === "completed") status = "completed";
    });

    const db = {
      collection: jest.fn(() =>
        talkSubmissionsCol({
          doc: jest.fn(() => ({
            get: jest.fn(async () => ({ exists: true, data: () => ({ status }) })),
            set: setMock,
          })),
        }),
      ),
    };
    mockGetAdminDb.mockReturnValue(db as never);

    const approveRes = await POST(
      makeAuthedRequest({
        method: "POST",
        path: "/api/talks/submission/moderate",
        body: { submissionId: "t1", action: "approve" },
      }),
    );
    const approveBody = await approveRes.json();
    expect(approveRes.status).toBe(200);
    expect(approveBody).toEqual(expect.objectContaining({ status: "approved", approved: true }));

    const completeRes = await POST(
      makeAuthedRequest({
        method: "POST",
        path: "/api/talks/submission/moderate",
        body: { submissionId: "t1", action: "complete" },
      }),
    );
    const completeBody = await completeRes.json();
    expect(completeRes.status).toBe(200);
    expect(completeBody).toEqual(expect.objectContaining({ status: "completed", approved: true }));

    expect(setMock).toHaveBeenCalledTimes(2);
    expect(setMock.mock.calls[0][0]).toEqual(expect.objectContaining({ status: "approved" }));
    expect(setMock.mock.calls[1][0]).toEqual(expect.objectContaining({ status: "completed" }));
  });

  it("completing an already completed talk is blocked", async () => {
    mockGetVerifiedUser.mockResolvedValue(adminUser);

    const setMock = jest.fn(async () => undefined);
    const db = {
      collection: jest.fn(() =>
        talkSubmissionsCol({
          doc: jest.fn(() => ({
            get: jest.fn(async () => ({ exists: true, data: () => ({ status: "completed" }) })),
            set: setMock,
          })),
        }),
      ),
    };
    mockGetAdminDb.mockReturnValue(db as never);

    const { status, body } = await readJson(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/talks/submission/moderate",
          body: { submissionId: "t1", action: "complete" },
        }),
      ),
    );

    expect(status).toBe(400);
    expect(body.error).toContain("must be approved");
    expect(setMock).not.toHaveBeenCalled();
  });

  it("re-approving an already approved talk is idempotent", async () => {
    mockGetVerifiedUser.mockResolvedValue(adminUser);

    const setMock = jest.fn(async () => undefined);
    const db = {
      collection: jest.fn(() =>
        talkSubmissionsCol({
          doc: jest.fn(() => ({
            get: jest.fn(async () => ({ exists: true, data: () => ({ status: "approved" }) })),
            set: setMock,
          })),
        }),
      ),
    };
    mockGetAdminDb.mockReturnValue(db as never);

    const { status, body } = await readJson(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/talks/submission/moderate",
          body: { submissionId: "t1", action: "approve" },
        }),
      ),
    );

    expect(status).toBe(200);
    expect(body).toEqual(
      expect.objectContaining({
        alreadyApproved: true,
        status: "approved",
      }),
    );
    expect(setMock).not.toHaveBeenCalled();
  });

  it("approving an already completed talk is a no-op", async () => {
    mockGetVerifiedUser.mockResolvedValue(adminUser);

    const setMock = jest.fn(async () => undefined);
    const db = {
      collection: jest.fn(() =>
        talkSubmissionsCol({
          doc: jest.fn(() => ({
            get: jest.fn(async () => ({ exists: true, data: () => ({ status: "completed" }) })),
            set: setMock,
          })),
        }),
      ),
    };
    mockGetAdminDb.mockReturnValue(db as never);

    const { status, body } = await readJson(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/talks/submission/moderate",
          body: { submissionId: "t1", action: "approve" },
        }),
      ),
    );

    expect(status).toBe(200);
    expect(body).toEqual(
      expect.objectContaining({
        alreadyCompleted: true,
        status: "completed",
      }),
    );
    expect(setMock).not.toHaveBeenCalled();
  });
});
