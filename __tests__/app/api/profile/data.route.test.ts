/**
 * @jest-environment node
 *
 * OpenSSF Gold coverage push #50 — profile/data GET route.
 */
import { NextRequest } from "next/server";
import { GET } from "@/app/api/profile/data/route";
import { getVerifiedUser } from "@/lib/server-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { fetchProfileDataBundleJson } from "@/lib/profile-bundle-server";
import { reconcileMergedPrCreditForUser } from "@/lib/github-merged-pr-reconcile";

jest.mock("@/lib/server-auth", () => ({ getVerifiedUser: jest.fn() }));
jest.mock("@/lib/firebase-admin", () => ({ getAdminDb: jest.fn() }));
jest.mock("@/lib/rate-limit", () => ({
  ...jest.requireActual("@/lib/rate-limit"),
  checkRateLimit: jest.fn(),
  getClientIdentifier: jest.fn(() => "client-1"),
}));
jest.mock("@/lib/profile-bundle-server", () => ({
  fetchProfileDataBundleJson: jest.fn(),
}));
jest.mock("@/lib/github-merged-pr-reconcile", () => ({
  reconcileMergedPrCreditForUser: jest.fn(),
}));

const mockUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockRate = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;
const mockBundle = fetchProfileDataBundleJson as jest.MockedFunction<typeof fetchProfileDataBundleJson>;
const mockReconcile = reconcileMergedPrCreditForUser as jest.MockedFunction<
  typeof reconcileMergedPrCreditForUser
>;

function makeReq(searchParams: Record<string, string> = {}) {
  const url = new URL("https://example.com/api/profile/data");
  for (const [k, v] of Object.entries(searchParams)) url.searchParams.set(k, v);
  return new NextRequest(url);
}

function setupUserDoc(login: string | undefined | null) {
  mockDb.mockReturnValue({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn().mockResolvedValue({
          exists: login !== null,
          data: () =>
            login === null ? undefined : login === undefined ? {} : { github: { login } },
        }),
      })),
    })),
  } as never);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRate.mockReturnValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 } as never);
  mockUser.mockResolvedValue({ uid: "u1", email: "u@x" } as never);
  mockBundle.mockResolvedValue({ user: { uid: "u1" } } as never);
});

describe("GET /api/profile/data", () => {
  it("returns 429 with Retry-After when rate-limited", async () => {
    mockRate.mockReturnValueOnce({
      success: false,
      remaining: 0,
      retryAfter: 30,
      resetTime: Date.now() + 60000,
    } as never);
    const res = await GET(makeReq());
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
  });

  it("defaults Retry-After=60 when rate-limit lacks retryAfter", async () => {
    mockRate.mockReturnValueOnce({
      success: false,
      remaining: 0,
      resetTime: Date.now() + 60000,
    } as never);
    const res = await GET(makeReq());
    expect(res.headers.get("Retry-After")).toBe("60");
  });

  it("returns 401 when unauthenticated", async () => {
    mockUser.mockResolvedValueOnce(null);
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it("returns 500 when admin db is null", async () => {
    mockDb.mockReturnValue(null as never);
    const res = await GET(makeReq());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("Server not configured");
  });

  it("returns 400 when query params fail zod validation", async () => {
    setupUserDoc(undefined);
    const res = await GET(makeReq({ format: "not-a-valid-format" }));
    expect(res.status).toBe(400);
  });

  it("returns the legacy bundle shape with private no-store cache by default", async () => {
    setupUserDoc(undefined);
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    const body = await res.json();
    expect(body).toEqual({ user: { uid: "u1" } });
  });

  it("returns the GDPR-portable wrapped shape when format=portable", async () => {
    setupUserDoc(undefined);
    const res = await GET(makeReq({ format: "portable" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toContain("attachment");
    expect(res.headers.get("content-disposition")).toContain("cursor-boston-data-u1.json");
    const body = await res.json();
    expect(body.schema).toBe("cursor-boston-data-export-v1");
    expect(body.userId).toBe("u1");
    expect(body.data).toEqual({ user: { uid: "u1" } });
    expect(body.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("triggers github reconciliation when reconcileGithub=1 and login present", async () => {
    setupUserDoc("octocat");
    await GET(makeReq({ reconcileGithub: "1" }));
    expect(mockReconcile).toHaveBeenCalledWith("u1", "octocat");
  });

  it("skips reconciliation when reconcileGithub=1 but user doc has no github login", async () => {
    setupUserDoc(undefined);
    await GET(makeReq({ reconcileGithub: "1" }));
    expect(mockReconcile).not.toHaveBeenCalled();
  });

  it("skips reconciliation when reconcileGithub=1 but user doc does not exist", async () => {
    setupUserDoc(null);
    await GET(makeReq({ reconcileGithub: "1" }));
    expect(mockReconcile).not.toHaveBeenCalled();
  });

  it("skips reconciliation when reconcileGithub flag is absent", async () => {
    setupUserDoc("octocat");
    await GET(makeReq());
    expect(mockReconcile).not.toHaveBeenCalled();
  });

  it("returns 500 'Failed to load profile data' when bundle fetch throws", async () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    setupUserDoc(undefined);
    mockBundle.mockRejectedValueOnce(new Error("firestore down"));
    const res = await GET(makeReq());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to load profile data");
    consoleErrorSpy.mockRestore();
  });
});
