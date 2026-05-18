/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST } from "@/app/api/certificate/claim/route";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import { checkServerRateLimit } from "@/lib/rate-limit-server";
import { reconcileMergedPrCreditForUser } from "@/lib/github-merged-pr-reconcile";

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(),
}));
jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));
jest.mock("@/lib/rate-limit", () => ({
  getClientIdentifier: jest.fn(() => "ip:127.0.0.1"),
}));
jest.mock("@/lib/rate-limit-server", () => ({
  checkServerRateLimit: jest.fn(),
  buildRateLimitHeaders: jest.fn(() => ({})),
}));
jest.mock("@/lib/github-merged-pr-reconcile", () => ({
  reconcileMergedPrCreditForUser: jest.fn(),
}));
jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), logError: jest.fn() },
}));
jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: jest.fn(() => ({ __serverTimestamp: true })),
  },
}));

const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockRateLimit = checkServerRateLimit as jest.MockedFunction<typeof checkServerRateLimit>;
const mockReconcile = reconcileMergedPrCreditForUser as jest.MockedFunction<
  typeof reconcileMergedPrCreditForUser
>;

function claimRequest() {
  return new NextRequest("http://localhost/api/certificate/claim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
}

function buildDb(opts: {
  userData?: Record<string, unknown> | undefined;
  existingCertExists?: boolean;
  existingCertData?: Record<string, unknown>;
  createdCertData?: Record<string, unknown>;
}) {
  const userDoc = {
    get: jest.fn().mockResolvedValue({
      data: () => opts.userData,
    }),
  };
  const existingCertDoc = {
    get: jest.fn().mockResolvedValue({
      exists: opts.existingCertExists ?? false,
      data: () => opts.existingCertData,
    }),
    set: jest.fn().mockResolvedValue(undefined),
  };
  // After .set(), the route reads back the same doc — second .get() returns the created data
  let getCallCount = 0;
  existingCertDoc.get = jest.fn().mockImplementation(() => {
    getCallCount++;
    if (getCallCount === 1) {
      return Promise.resolve({
        exists: opts.existingCertExists ?? false,
        data: () => opts.existingCertData,
      });
    }
    return Promise.resolve({
      data: () => opts.createdCertData,
    });
  });

  const db: any = {
    collection: jest.fn((name: string) => {
      if (name === "users") return { doc: jest.fn(() => userDoc) };
      if (name === "certificates") return { doc: jest.fn(() => existingCertDoc) };
      return { doc: jest.fn() };
    }),
  };
  return { db, userDoc, certDoc: existingCertDoc };
}

describe("POST /api/certificate/claim", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRateLimit.mockResolvedValue({ success: true } as any);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await POST(claimRequest());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 429 when rate-limited", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1" } as any);
    mockRateLimit.mockResolvedValue({
      success: false,
      retryAfter: 30,
      statusCode: 429,
    } as any);
    const res = await POST(claimRequest());
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toBe("Too many requests");
    expect(json.retryAfterSeconds).toBe(30);
  });

  it("returns 500 when admin DB is not configured", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1" } as any);
    mockGetAdminDb.mockReturnValue(null as any);
    const res = await POST(claimRequest());
    expect(res.status).toBe(500);
  });

  it("returns 400 when the user has no GitHub login on their profile", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1" } as any);
    const { db } = buildDb({ userData: { displayName: "Pat" } }); // no github field
    mockGetAdminDb.mockReturnValue(db);
    const res = await POST(claimRequest());
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("GitHub account");
  });

  it("returns 400 when github field is not an object", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1" } as any);
    const { db } = buildDb({ userData: { github: "not-an-object" } });
    mockGetAdminDb.mockReturnValue(db);
    const res = await POST(claimRequest());
    expect(res.status).toBe(400);
  });

  it("returns 400 when github.login is empty/whitespace", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1" } as any);
    const { db } = buildDb({ userData: { github: { login: "   " } } });
    mockGetAdminDb.mockReturnValue(db);
    const res = await POST(claimRequest());
    expect(res.status).toBe(400);
  });

  it("returns the existing certificate idempotently when one already exists", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1" } as any);
    const { db } = buildDb({
      userData: { github: { login: "octocat" } },
      existingCertExists: true,
      existingCertData: {
        id: "cert-u1",
        userId: "u1",
        displayName: "Octocat",
        githubLogin: "octocat",
        pullRequestsCount: 12,
        issuedAt: { toDate: () => new Date("2026-01-01") },
        certName: "Cursor Boston Open Source Contributor",
        certUrl: "https://cursorboston.com/certificates/cert-u1",
        kind: "contributor",
      },
    });
    mockGetAdminDb.mockReturnValue(db);
    const res = await POST(claimRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.certificate.githubLogin).toBe("octocat");
    expect(json.linkedInAddToProfileUrl).toContain("linkedin.com");
    // GitHub reconcile MUST NOT have been called since we short-circuited
    expect(mockReconcile).not.toHaveBeenCalled();
  });

  it("returns 403 when merged-PR count is below the threshold", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1" } as any);
    const { db } = buildDb({ userData: { github: { login: "octocat" } } });
    mockGetAdminDb.mockReturnValue(db);
    mockReconcile.mockResolvedValue({ mergedPrCount: 4 } as any);
    const res = await POST(claimRequest());
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.eligible).toBe(false);
    expect(json.pullRequestsCount).toBe(4);
    expect(json.required).toBe(10);
  });

  it("creates a certificate when the user has enough merged PRs", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1", name: "Pat" } as any);
    const { db, certDoc } = buildDb({
      userData: { github: { login: "octocat" }, displayName: "Pat Dev" },
      createdCertData: {
        id: "cert-u1",
        userId: "u1",
        displayName: "Pat Dev",
        githubLogin: "octocat",
        pullRequestsCount: 15,
        issuedAt: { toDate: () => new Date("2026-05-12") },
        certName: "Cursor Boston Open Source Contributor",
        certUrl: "https://cursorboston.com/certificates/cert-u1",
        kind: "contributor",
      },
    });
    mockGetAdminDb.mockReturnValue(db);
    mockReconcile.mockResolvedValue({ mergedPrCount: 15 } as any);

    const res = await POST(claimRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.certificate.pullRequestsCount).toBe(15);
    expect(certDoc.set).toHaveBeenCalledTimes(1);
    const payload = certDoc.set.mock.calls[0][0];
    expect(payload.userId).toBe("u1");
    expect(payload.githubLogin).toBe("octocat");
    expect(payload.displayName).toBe("Pat Dev");
    expect(payload.pullRequestsCount).toBe(15);
    expect(payload.kind).toBe("contributor");
  });

  it("returns 500 when the read-back of the created certificate fails to parse", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1" } as any);
    const { db } = buildDb({
      userData: { github: { login: "octocat" } },
      createdCertData: { malformed: "missing-required-fields" },
    });
    mockGetAdminDb.mockReturnValue(db);
    mockReconcile.mockResolvedValue({ mergedPrCount: 12 } as any);
    const res = await POST(claimRequest());
    expect(res.status).toBe(500);
  });

  it("returns 500 when the GitHub reconcile call throws", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1" } as any);
    const { db } = buildDb({ userData: { github: { login: "octocat" } } });
    mockGetAdminDb.mockReturnValue(db);
    mockReconcile.mockRejectedValue(new Error("github-rate-limited"));
    const res = await POST(claimRequest());
    expect(res.status).toBe(500);
  });
});
