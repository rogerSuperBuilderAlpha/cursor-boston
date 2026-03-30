/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST } from "@/app/api/talks/submission/moderate/route";
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

function makePostRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/talks/submission/moderate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/talks/submission/moderate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ADMIN_EMAILS = "admin@example.com";
    process.env.ADMIN_EMAIL = "";
  });

  it("requires approval before complete", async () => {
    mockGetVerifiedUser.mockResolvedValue({
      uid: "admin1",
      email: "admin@example.com",
      isAdmin: true,
    });

    const db = {
      collection: jest.fn((name: string) => {
        if (name !== "talkSubmissions") throw new Error("unexpected collection");
        return {
          doc: jest.fn(() => ({
            get: jest.fn(async () => ({ exists: true, data: () => ({ status: "pending" }) })),
            set: jest.fn(async () => undefined),
          })),
        };
      }),
    };

    mockGetAdminDb.mockReturnValue(db as never);

    const res = await POST(makePostRequest({ submissionId: "t1", action: "complete" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("must be approved");
  });

  it("supports approve -> complete transition", async () => {
    mockGetVerifiedUser.mockResolvedValue({
      uid: "admin1",
      email: "admin@example.com",
      isAdmin: true,
    });

    let status: "pending" | "approved" | "completed" = "pending";
    const setMock = jest.fn(async (payload: Record<string, unknown>) => {
      if (payload.status === "approved") status = "approved";
      if (payload.status === "completed") status = "completed";
    });

    const db = {
      collection: jest.fn((name: string) => {
        if (name !== "talkSubmissions") throw new Error("unexpected collection");
        return {
          doc: jest.fn(() => ({
            get: jest.fn(async () => ({ exists: true, data: () => ({ status }) })),
            set: setMock,
          })),
        };
      }),
    };

    mockGetAdminDb.mockReturnValue(db as never);

    const approveRes = await POST(makePostRequest({ submissionId: "t1", action: "approve" }));
    const approveBody = await approveRes.json();
    expect(approveRes.status).toBe(200);
    expect(approveBody).toEqual(expect.objectContaining({ status: "approved", approved: true }));

    const completeRes = await POST(makePostRequest({ submissionId: "t1", action: "complete" }));
    const completeBody = await completeRes.json();
    expect(completeRes.status).toBe(200);
    expect(completeBody).toEqual(expect.objectContaining({ status: "completed", approved: true }));

    expect(setMock).toHaveBeenCalledTimes(2);
    expect(setMock.mock.calls[0][0]).toEqual(expect.objectContaining({ status: "approved" }));
    expect(setMock.mock.calls[1][0]).toEqual(expect.objectContaining({ status: "completed" }));
  });

  it("completing an already completed talk is blocked", async () => {
    mockGetVerifiedUser.mockResolvedValue({
      uid: "admin1",
      email: "admin@example.com",
      isAdmin: true,
    });

    const setMock = jest.fn(async () => undefined);
    const db = {
      collection: jest.fn((name: string) => {
        if (name !== "talkSubmissions") throw new Error("unexpected collection");
        return {
          doc: jest.fn(() => ({
            get: jest.fn(async () => ({ exists: true, data: () => ({ status: "completed" }) })),
            set: setMock,
          })),
        };
      }),
    };

    mockGetAdminDb.mockReturnValue(db as never);

    const res = await POST(makePostRequest({ submissionId: "t1", action: "complete" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("must be approved");
    expect(setMock).not.toHaveBeenCalled();
  });

  it("re-approving an already approved talk is idempotent", async () => {
    mockGetVerifiedUser.mockResolvedValue({
      uid: "admin1",
      email: "admin@example.com",
      isAdmin: true,
    });

    const setMock = jest.fn(async () => undefined);
    const db = {
      collection: jest.fn((name: string) => {
        if (name !== "talkSubmissions") throw new Error("unexpected collection");
        return {
          doc: jest.fn(() => ({
            get: jest.fn(async () => ({ exists: true, data: () => ({ status: "approved" }) })),
            set: setMock,
          })),
        };
      }),
    };

    mockGetAdminDb.mockReturnValue(db as never);

    const res = await POST(makePostRequest({ submissionId: "t1", action: "approve" }));
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

  it("approving an already completed talk is a no-op", async () => {
    mockGetVerifiedUser.mockResolvedValue({
      uid: "admin1",
      email: "admin@example.com",
      isAdmin: true,
    });

    const setMock = jest.fn(async () => undefined);
    const db = {
      collection: jest.fn((name: string) => {
        if (name !== "talkSubmissions") throw new Error("unexpected collection");
        return {
          doc: jest.fn(() => ({
            get: jest.fn(async () => ({ exists: true, data: () => ({ status: "completed" }) })),
            set: setMock,
          })),
        };
      }),
    };

    mockGetAdminDb.mockReturnValue(db as never);

    const res = await POST(makePostRequest({ submissionId: "t1", action: "approve" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(
      expect.objectContaining({
        alreadyCompleted: true,
        status: "completed",
      })
    );
    expect(setMock).not.toHaveBeenCalled();
  });
});
