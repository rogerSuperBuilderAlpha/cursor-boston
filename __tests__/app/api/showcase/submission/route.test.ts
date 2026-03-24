/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/showcase/submission/route";
import { getVerifiedUser } from "@/lib/server-auth";
import { getAdminDb } from "@/lib/firebase-admin";

jest.mock("@/content/showcase.json", () => ({
  projects: [{ id: "project-1" }],
}));

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
});
