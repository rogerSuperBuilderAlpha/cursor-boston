/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/showcase/submission/route";
import { getVerifiedUser } from "@/lib/server-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { checkUpstashRateLimit } from "@/lib/upstash-rate-limit";

jest.mock("@/content/showcase.json", () => ({
  projects: [{ id: "project-1" }],
}));

jest.mock("@/lib/logger", () => ({
  logger: { logError: jest.fn(), warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}));

jest.mock("@/lib/rate-limit", () => ({
  getClientIdentifier: jest.fn(() => "test-ip"),
  checkRateLimit: jest.fn(() => ({ success: true, remaining: 19 })),
  buildMemoryRateLimitHeaders: jest.fn(() => ({})),
}));

jest.mock("@/lib/upstash-rate-limit", () => ({
  checkUpstashRateLimit: jest.fn(async () => ({ success: true, remaining: 9, resetTime: Date.now() + 60000 })),
}));

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;

function makePostRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/showcase/submission", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/showcase/submission", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ADMIN_EMAILS = "";
    process.env.ADMIN_EMAIL = "";
  });

  it("returns authenticated user's submissions on GET", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u1@example.com" });

    const db = {
      collection: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        get: jest.fn(async () => ({
          docs: [
            { data: () => ({ projectId: "project-1", status: "approved" }) },
            { data: () => ({ projectId: "project-2", status: "rejected" }) },
          ],
        })),
      })),
    };

    mockGetAdminDb.mockReturnValue(db as never);

    const res = await GET(new NextRequest("http://localhost/api/showcase/submission"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.submissions).toEqual([
      { projectId: "project-1", status: "approved" },
      { projectId: "project-2", status: "rejected" },
    ]);
  });

  it("creates a pending submission and supports rejected -> pending resubmission", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u1@example.com" });

    let existingStatus: "missing" | "rejected" = "missing";
    const setMock = jest.fn(async (payload: Record<string, unknown>) => {
      if (payload.status === "pending") {
        existingStatus = "rejected";
      }
    });

    const submissionRef = {
      get: jest.fn(async () =>
        existingStatus === "missing"
          ? { exists: false }
          : { exists: true, data: () => ({ status: "rejected" }) }
      ),
      set: setMock,
    };

    const db = {
      collection: jest.fn((name: string) => {
        if (name !== "showcaseSubmissions") throw new Error("unexpected collection");
        return {
          doc: jest.fn(() => submissionRef),
        };
      }),
    };

    mockGetAdminDb.mockReturnValue(db as never);

    const createRes = await POST(makePostRequest({ projectId: "project-1" }));
    const createBody = await createRes.json();
    expect(createRes.status).toBe(200);
    expect(createBody).toEqual(
      expect.objectContaining({ created: true, status: "pending", projectId: "project-1" })
    );

    const resubmitRes = await POST(makePostRequest({ projectId: "project-1" }));
    const resubmitBody = await resubmitRes.json();
    expect(resubmitRes.status).toBe(200);
    expect(resubmitBody).toEqual(
      expect.objectContaining({ resubmitted: true, status: "pending", projectId: "project-1" })
    );

    expect(setMock).toHaveBeenCalledTimes(2);
  });

  it("treats repeated submission while already pending as idempotent no-op", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u1@example.com" });

    const setMock = jest.fn(async () => undefined);
    const submissionRef = {
      get: jest.fn(async () => ({ exists: true, data: () => ({ status: "pending" }) })),
      set: setMock,
    };

    const db = {
      collection: jest.fn((name: string) => {
        if (name !== "showcaseSubmissions") throw new Error("unexpected collection");
        return {
          doc: jest.fn(() => submissionRef),
        };
      }),
    };

    mockGetAdminDb.mockReturnValue(db as never);

    const res = await POST(makePostRequest({ projectId: "project-1" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(
      expect.objectContaining({
        created: false,
        status: "pending",
        projectId: "project-1",
      })
    );
    expect(body.resubmitted).toBeUndefined();
    expect(setMock).not.toHaveBeenCalled();
  });

  it("GET returns 401 when unauthenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await GET(new NextRequest("http://localhost/api/showcase/submission"));
    expect(res.status).toBe(401);
  });

  it("GET returns 429 when rate-limited", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@x" });
    const rate = checkUpstashRateLimit as jest.MockedFunction<typeof checkUpstashRateLimit>;
    rate.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      retryAfter: 30,
      resetTime: Date.now() + 60000,
    } as never);
    const res = await GET(new NextRequest("http://localhost/api/showcase/submission"));
    expect(res.status).toBe(429);
  });

  it("GET returns 500 when admin db is null", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@x" });
    mockGetAdminDb.mockReturnValueOnce(null as never);
    const res = await GET(new NextRequest("http://localhost/api/showcase/submission"));
    expect(res.status).toBe(500);
  });

  it("GET filters out submissions with non-string projectId", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@x" });
    mockGetAdminDb.mockReturnValueOnce({
      collection: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        get: jest.fn(async () => ({
          docs: [
            { data: () => ({ projectId: "p1", status: "pending" }) },
            { data: () => ({ projectId: 42 /* not string */, status: "approved" }) },
            { data: () => ({ /* missing projectId */ status: "pending" }) },
          ],
        })),
      })),
    } as never);
    const res = await GET(new NextRequest("http://localhost/api/showcase/submission"));
    const body = await res.json();
    expect(body.submissions).toHaveLength(1);
    expect(body.submissions[0]).toEqual({ projectId: "p1", status: "pending" });
  });

  it("GET returns 500 'Internal server error' when query throws", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@x" });
    mockGetAdminDb.mockReturnValueOnce({
      collection: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        get: jest.fn().mockRejectedValue(new Error("firestore down")),
      })),
    } as never);
    const res = await GET(new NextRequest("http://localhost/api/showcase/submission"));
    expect(res.status).toBe(500);
  });

  it("POST returns 429 when rate-limited", async () => {
    const rate = checkUpstashRateLimit as jest.MockedFunction<typeof checkUpstashRateLimit>;
    rate.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      retryAfter: 30,
      resetTime: Date.now() + 60000,
    } as never);
    const res = await POST(makePostRequest({ projectId: "project-1" }));
    expect(res.status).toBe(429);
  });

  it("POST returns 401 unauthenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await POST(makePostRequest({ projectId: "project-1" }));
    expect(res.status).toBe(401);
  });

  it("POST returns 500 when admin db is null", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@x" });
    mockGetAdminDb.mockReturnValueOnce(null as never);
    const res = await POST(makePostRequest({ projectId: "project-1" }));
    expect(res.status).toBe(500);
  });

  it("POST returns 400 for invalid JSON body", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@x" });
    mockGetAdminDb.mockReturnValueOnce({ collection: jest.fn() } as never);
    const req = new NextRequest("http://localhost/api/showcase/submission", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("POST returns 400 when zod schema rejects body", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@x" });
    mockGetAdminDb.mockReturnValueOnce({ collection: jest.fn() } as never);
    const res = await POST(makePostRequest({ projectId: 123 } as never));
    expect(res.status).toBe(400);
  });

  it("POST returns 404 for unknown projectId", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@x" });
    mockGetAdminDb.mockReturnValueOnce({ collection: jest.fn() } as never);
    const res = await POST(makePostRequest({ projectId: "ghost-project" }));
    expect(res.status).toBe(404);
  });

  it("POST auto-approves when caller is admin (isAdmin=true)", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "admin", email: "a@x", isAdmin: true });
    const setMock = jest.fn(async () => undefined);
    const submissionRef = {
      get: jest.fn(async () => ({ exists: false })),
      set: setMock,
    };
    mockGetAdminDb.mockReturnValueOnce({
      collection: jest.fn(() => ({
        doc: jest.fn(() => submissionRef),
      })),
    } as never);
    const res = await POST(makePostRequest({ projectId: "project-1" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("approved");
    const payload = setMock.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.status).toBe("approved");
    expect(payload.decisionSource).toBe("auto");
  });

  it("POST returns 500 when an unexpected error throws", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", email: "u@x" });
    mockGetAdminDb.mockReturnValueOnce({
      collection: jest.fn(() => {
        throw new Error("boom");
      }),
    } as never);
    const res = await POST(makePostRequest({ projectId: "project-1" }));
    expect(res.status).toBe(500);
  });
});
