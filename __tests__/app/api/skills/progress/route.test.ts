/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { GET } from "@/app/api/skills/progress/route";
import { getAdminDb } from "@/lib/firebase-admin";
import { checkServerRateLimit } from "@/lib/rate-limit-server";
import { getVerifiedUser } from "@/lib/server-auth";
import { fetchProfileDataBundleJson } from "@/lib/profile-bundle-server";

jest.mock("@/lib/server-auth", () => ({ getVerifiedUser: jest.fn() }));
jest.mock("@/lib/firebase-admin", () => ({ getAdminDb: jest.fn() }));
jest.mock("@/lib/rate-limit", () => ({ getClientIdentifier: jest.fn(() => "ip-1") }));
jest.mock("@/lib/rate-limit-server", () => ({
  checkServerRateLimit: jest.fn(),
  buildRateLimitHeaders: jest.fn(() => ({ "Retry-After": "30" })),
}));
jest.mock("@/lib/profile-bundle-server", () => ({
  fetchProfileDataBundleJson: jest.fn(),
}));

const mockUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockRate = checkServerRateLimit as jest.MockedFunction<
  typeof checkServerRateLimit
>;
const mockBundle = fetchProfileDataBundleJson as jest.MockedFunction<
  typeof fetchProfileDataBundleJson
>;

function makeReq() {
  return new NextRequest("https://example.com/api/skills/progress");
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUser.mockResolvedValue({ uid: "u1", email: "u1@example.com" });
  mockDb.mockReturnValue({ collection: jest.fn() } as never);
  mockRate.mockResolvedValue({
    success: true,
    remaining: 59,
    resetTime: Date.now() + 60000,
    source: "firestore",
  });
  mockBundle.mockResolvedValue({
    stats: {
      eventsRegistered: 0,
      eventsAttended: 0,
      talksSubmitted: 0,
      talksGiven: 0,
      pullRequestsCount: 1,
    },
    registrations: [],
    talks: [],
    badgeEligibility: {
      input: {
        pullRequestsCount: 1,
        showcaseSubmissionsCount: 1,
      },
      status: {
        state: "complete",
        isAuthoritative: true,
        failedSources: [],
      },
    },
    userBadgeMap: {
      contributor: {
        id: "u1_contributor",
        userId: "u1",
        badgeId: "contributor",
        awardedAt: "2026-05-01T00:00:00.000Z",
        awardSource: "system",
      },
    },
  } as never);
});

describe("GET /api/skills/progress", () => {
  it("returns 401 when unauthenticated", async () => {
    mockUser.mockResolvedValueOnce(null);

    const res = await GET(makeReq());

    expect(res.status).toBe(401);
    expect(mockRate).not.toHaveBeenCalled();
  });

  it("returns 429 when rate-limited", async () => {
    mockRate.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      resetTime: Date.now() + 60000,
      retryAfter: 30,
      source: "firestore",
    });

    const res = await GET(makeReq());

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
  });

  it("returns 500 when Admin Firestore is unavailable", async () => {
    mockDb.mockReturnValueOnce(null as never);

    const res = await GET(makeReq());

    expect(res.status).toBe(500);
  });

  it("returns signed-in skills progress with private no-store cache", async () => {
    const res = await GET(makeReq());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(mockBundle).toHaveBeenCalledWith(expect.anything(), "u1");
    expect(body.summary.totalSkills).toBeGreaterThan(0);
    expect(body.progress).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          skillId: "contributor",
          level: "practiced",
          earnedBadgeIds: ["contributor"],
        }),
      ])
    );
  });

  it("returns 500 when the profile bundle read fails", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    mockBundle.mockRejectedValueOnce(new Error("db down"));

    const res = await GET(makeReq());

    expect(res.status).toBe(500);
    spy.mockRestore();
  });
});
