/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/showcase/submission/approve/route";
import { getVerifiedUser } from "@/lib/server-auth";
import { getAdminDb } from "@/lib/firebase-admin";

jest.mock("@/lib/logger", () => ({
  logger: { logError: jest.fn(), warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}));

jest.mock("@/lib/rate-limit", () => ({
  getClientIdentifier: jest.fn(() => "test-ip"),
}));

jest.mock("@/lib/rate-limit-server", () => ({
  checkServerRateLimit: jest.fn(async () => ({ success: true, retryAfter: 0 })),
  buildRateLimitHeaders: jest.fn(() => ({})),
}));

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;

function makeGetRequest() {
  return new NextRequest("http://localhost/api/showcase/submission/approve", { method: "GET" });
}

function makePostRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/showcase/submission/approve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/showcase/submission/approve", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ADMIN_EMAILS = "admin@example.com";
    process.env.ADMIN_EMAIL = "";
  });

  it("rejects non-admin moderation access", async () => {
    mockGetVerifiedUser.mockResolvedValue({
      uid: "u1",
      email: "member@example.com",
      isAdmin: false,
    });

    const res = await GET(makeGetRequest());

    expect(res.status).toBe(403);
  });

  it("allows admin to reject and approve pending submissions", async () => {
    mockGetVerifiedUser.mockResolvedValue({
      uid: "admin1",
      email: "admin@example.com",
      isAdmin: true,
    });

    const setMock = jest.fn(async () => undefined);
    const docGetMock = jest.fn(async () => ({ exists: true, data: () => ({ status: "pending" }) }));

    const db = {
      collection: jest.fn((name: string) => {
        if (name !== "showcaseSubmissions") throw new Error("unexpected collection");
        return {
          where: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          get: jest.fn(async () => ({ docs: [] })),
          doc: jest.fn(() => ({
            get: docGetMock,
            set: setMock,
          })),
        };
      }),
    };

    mockGetAdminDb.mockReturnValue(db as never);

    const rejectRes = await POST(makePostRequest({ submissionId: "s1", action: "reject" }));
    const rejectBody = await rejectRes.json();
    expect(rejectRes.status).toBe(200);
    expect(rejectBody).toEqual(expect.objectContaining({ status: "rejected", rejected: true }));

    const approveRes = await POST(makePostRequest({ submissionId: "s1", action: "approve" }));
    const approveBody = await approveRes.json();
    expect(approveRes.status).toBe(200);
    expect(approveBody).toEqual(expect.objectContaining({ status: "approved", approved: true }));

    expect(setMock).toHaveBeenCalledTimes(2);
    expect(setMock.mock.calls[0][0]).toEqual(expect.objectContaining({ status: "rejected" }));
    expect(setMock.mock.calls[1][0]).toEqual(expect.objectContaining({ status: "approved" }));
  });

  it("re-approving an already approved submission is idempotent", async () => {
    mockGetVerifiedUser.mockResolvedValue({
      uid: "admin1",
      email: "admin@example.com",
      isAdmin: true,
    });

    const setMock = jest.fn(async () => undefined);
    const db = {
      collection: jest.fn((name: string) => {
        if (name !== "showcaseSubmissions") throw new Error("unexpected collection");
        return {
          doc: jest.fn(() => ({
            get: jest.fn(async () => ({
              exists: true,
              data: () => ({
                status: "approved",
                approvedAt: { toDate: () => new Date("2026-03-01T00:00:00.000Z") },
                approvedBy: "admin-prev",
                decisionSource: "manual",
              }),
            })),
            set: setMock,
          })),
        };
      }),
    };

    mockGetAdminDb.mockReturnValue(db as never);

    const res = await POST(makePostRequest({ submissionId: "s1", action: "approve" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(
      expect.objectContaining({
        alreadyApproved: true,
        status: "approved",
        submissionId: "s1",
      })
    );
    expect(setMock).not.toHaveBeenCalled();
  });

  it("rejecting an already approved submission does not transition state", async () => {
    mockGetVerifiedUser.mockResolvedValue({
      uid: "admin1",
      email: "admin@example.com",
      isAdmin: true,
    });

    const setMock = jest.fn(async () => undefined);
    const db = {
      collection: jest.fn((name: string) => {
        if (name !== "showcaseSubmissions") throw new Error("unexpected collection");
        return {
          doc: jest.fn(() => ({
            get: jest.fn(async () => ({
              exists: true,
              data: () => ({ status: "approved" }),
            })),
            set: setMock,
          })),
        };
      }),
    };

    mockGetAdminDb.mockReturnValue(db as never);

    const res = await POST(makePostRequest({ submissionId: "s1", action: "reject" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(
      expect.objectContaining({
        alreadyApproved: true,
        status: "approved",
      })
    );
    expect(setMock).not.toHaveBeenCalled();
  });
});
