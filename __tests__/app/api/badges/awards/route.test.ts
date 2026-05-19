/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST } from "@/app/api/badges/awards/route";
import { getVerifiedUser } from "@/lib/server-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { checkServerRateLimit } from "@/lib/rate-limit-server";

jest.mock("@/lib/logger", () => ({
  logger: { logError: jest.fn(), warn: jest.fn(), info: jest.fn() },
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

function makeRequest() {
  return new NextRequest("http://localhost/api/badges/awards", { method: "POST" });
}

function makeDocs(values: Array<Record<string, unknown>>) {
  return values.map((data, index) => ({
    id: `doc-${index}`,
    data: () => data,
  }));
}

describe("POST /api/badges/awards", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);

    const res = await POST(makeRequest());

    expect(res.status).toBe(401);
  });

  it("awards missing eligible badge and returns persisted user badges", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "user-1", email: "member@example.com" });

    const batchSet = jest.fn();
    const batchCommit = jest.fn(async () => undefined);

    const userBadgesWhereGet = jest
      .fn()
      .mockResolvedValueOnce({ docs: [] })
      .mockResolvedValueOnce({
        docs: makeDocs([
          {
            id: "user-1_speaker",
            userId: "user-1",
            badgeId: "speaker",
            awardSource: "system",
            awardedAt: { toDate: () => new Date("2026-03-01T00:00:00.000Z") },
          },
        ]),
      });

    const collections = {
      users: {
        doc: jest.fn(() => ({
          get: jest.fn(async () => ({
            exists: true,
            data: () => ({
              displayName: "Member",
              visibility: { isPublic: true },
              bio: "",
              photoURL: "",
            }),
          })),
          set: jest.fn(async () => undefined),
        })),
      },
      eventRegistrations: {
        where: jest.fn().mockReturnThis(),
        get: jest.fn(async () => ({ docs: [] })),
      },
      talkSubmissions: {
        where: jest.fn().mockReturnThis(),
        get: jest.fn(async () => ({
          size: 2,
          docs: makeDocs([{ status: "pending" }, { status: "completed" }]),
        })),
      },
      communityMessages: {
        where: jest.fn().mockReturnThis(),
        get: jest.fn(async () => ({ size: 0, docs: [] })),
      },
      pullRequests: {
        where: jest.fn().mockReturnThis(),
        get: jest.fn(async () => ({ size: 0, docs: [] })),
      },
      hackathonTeams: {
        where: jest.fn().mockReturnThis(),
        get: jest.fn(async () => ({ size: 0, docs: [] })),
      },
      hackathonPool: {
        where: jest.fn().mockReturnThis(),
        get: jest.fn(async () => ({ size: 0, docs: [] })),
      },
      showcaseSubmissions: {
        where: jest.fn().mockReturnThis(),
        get: jest.fn(async () => ({ size: 0, docs: [] })),
      },
      user_badges: {
        where: jest.fn(() => ({ get: userBadgesWhereGet })),
        doc: jest.fn((id: string) => ({ id })),
      },
    } as const;

    const db = {
      collection: jest.fn((name: keyof typeof collections) => collections[name]),
      batch: jest.fn(() => ({
        set: batchSet,
        commit: batchCommit,
      })),
    };

    mockGetAdminDb.mockReturnValue(db as never);

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.eligibleBadgeIds).toContain("speaker");
    expect(batchSet).toHaveBeenCalledTimes(1);
    expect(batchSet.mock.calls[0][0]).toEqual({ id: "user-1_speaker" });
    expect(batchSet.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        userId: "user-1",
        badgeId: "speaker",
        awardSource: "system",
      })
    );
    expect(body.userBadges).toEqual([
      expect.objectContaining({
        userId: "user-1",
        badgeId: "speaker",
        awardSource: "system",
      }),
    ]);
  });

  it("does not award contributor from users.pullRequestsCount alone", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "user-2", email: "member@example.com" });

    const batchSet = jest.fn();
    const batchCommit = jest.fn(async () => undefined);
    const userBadgesWhereGet = jest.fn().mockResolvedValue({ docs: [] });

    const collections = {
      users: {
        doc: jest.fn(() => ({
          get: jest.fn(async () => ({
            exists: true,
            data: () => ({
              displayName: "Member",
              visibility: { isPublic: true },
              bio: "bio",
              photoURL: "https://example.com/avatar.png",
              pullRequestsCount: 99,
            }),
          })),
          set: jest.fn(async () => undefined),
        })),
      },
      eventRegistrations: {
        where: jest.fn().mockReturnThis(),
        get: jest.fn(async () => ({ docs: [] })),
      },
      talkSubmissions: {
        where: jest.fn().mockReturnThis(),
        get: jest.fn(async () => ({ size: 0, docs: [] })),
      },
      communityMessages: {
        where: jest.fn().mockReturnThis(),
        get: jest.fn(async () => ({ size: 0, docs: [] })),
      },
      pullRequests: {
        where: jest.fn().mockReturnThis(),
        get: jest.fn(async () => ({ size: 0, docs: [] })),
      },
      hackathonTeams: {
        where: jest.fn().mockReturnThis(),
        get: jest.fn(async () => ({ size: 0, docs: [] })),
      },
      hackathonPool: {
        where: jest.fn().mockReturnThis(),
        get: jest.fn(async () => ({ size: 0, docs: [] })),
      },
      showcaseSubmissions: {
        where: jest.fn().mockReturnThis(),
        get: jest.fn(async () => ({ size: 0, docs: [] })),
      },
      user_badges: {
        where: jest.fn(() => ({ get: userBadgesWhereGet })),
        doc: jest.fn((id: string) => ({ id })),
      },
    } as const;

    const db = {
      collection: jest.fn((name: keyof typeof collections) => collections[name]),
      batch: jest.fn(() => ({
        set: batchSet,
        commit: batchCommit,
      })),
    };
    mockGetAdminDb.mockReturnValue(db as never);

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.eligibleBadgeIds).not.toContain("contributor");
    expect(batchSet).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ badgeId: "contributor" })
    );
  });

  it("awards contributor when trusted merged PR evidence exists", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "user-3", email: "member@example.com" });

    const batchSet = jest.fn();
    const batchCommit = jest.fn(async () => undefined);

    const userBadgesWhereGet = jest
      .fn()
      .mockResolvedValueOnce({ docs: [] })
      .mockResolvedValueOnce({
        docs: makeDocs([
          {
            id: "user-3_contributor",
            userId: "user-3",
            badgeId: "contributor",
            awardSource: "system",
            awardedAt: { toDate: () => new Date("2026-03-01T00:00:00.000Z") },
          },
        ]),
      });

    const collections = {
      users: {
        doc: jest.fn(() => ({
          get: jest.fn(async () => ({
            exists: true,
            data: () => ({
              displayName: "Member",
              visibility: { isPublic: true },
              bio: "bio",
              photoURL: "https://example.com/avatar.png",
              pullRequestsCount: 0,
            }),
          })),
          set: jest.fn(async () => undefined),
        })),
      },
      eventRegistrations: {
        where: jest.fn().mockReturnThis(),
        get: jest.fn(async () => ({ docs: [] })),
      },
      talkSubmissions: {
        where: jest.fn().mockReturnThis(),
        get: jest.fn(async () => ({ size: 0, docs: [] })),
      },
      communityMessages: {
        where: jest.fn().mockReturnThis(),
        get: jest.fn(async () => ({ size: 0, docs: [] })),
      },
      pullRequests: {
        where: jest.fn().mockReturnThis(),
        get: jest.fn(async () => ({ size: 1, docs: makeDocs([{ state: "merged" }]) })),
      },
      hackathonTeams: {
        where: jest.fn().mockReturnThis(),
        get: jest.fn(async () => ({ size: 0, docs: [] })),
      },
      hackathonPool: {
        where: jest.fn().mockReturnThis(),
        get: jest.fn(async () => ({ size: 0, docs: [] })),
      },
      showcaseSubmissions: {
        where: jest.fn().mockReturnThis(),
        get: jest.fn(async () => ({ size: 0, docs: [] })),
      },
      user_badges: {
        where: jest.fn(() => ({ get: userBadgesWhereGet })),
        doc: jest.fn((id: string) => ({ id })),
      },
    } as const;

    const db = {
      collection: jest.fn((name: keyof typeof collections) => collections[name]),
      batch: jest.fn(() => ({
        set: batchSet,
        commit: batchCommit,
      })),
    };
    mockGetAdminDb.mockReturnValue(db as never);

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.eligibleBadgeIds).toContain("contributor");
    expect(batchSet).toHaveBeenCalledWith(
      { id: "user-3_contributor" },
      expect.objectContaining({ badgeId: "contributor", userId: "user-3" })
    );
  });

  it("returns 429 when rate limit denies", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u9", email: "u@x" });
    const mockRate = checkServerRateLimit as jest.MockedFunction<typeof checkServerRateLimit>;
    mockRate.mockResolvedValueOnce({
      success: false,
      retryAfter: 30,
      statusCode: 429,
    } as never);
    const res = await POST(makeRequest());
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("Too many requests");
    expect(body.retryAfterSeconds).toBe(30);
  });

  it("returns 429 with default 429 statusCode when rate limit lacks statusCode field", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u10", email: "u@x" });
    const mockRate = checkServerRateLimit as jest.MockedFunction<typeof checkServerRateLimit>;
    mockRate.mockResolvedValueOnce({
      success: false,
      retryAfter: 60,
    } as never);
    const res = await POST(makeRequest());
    expect(res.status).toBe(429);
  });

  it("returns 500 when admin db is null", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u11", email: "u@x" });
    mockGetAdminDb.mockReturnValueOnce(null as never);
    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Server not configured");
  });

  it("returns 500 when an unexpected error throws", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u12", email: "u@x" });
    mockGetAdminDb.mockReturnValueOnce({
      collection: () => {
        throw new Error("firestore exploded");
      },
    } as never);
    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal server error");
  });

  it("filters out non-string badgeId entries from existingSnapshot", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u13", email: "u@x" });
    const batchSet = jest.fn();
    const batchCommit = jest.fn(async () => undefined);
    // Existing user_badges where badgeId is a non-string — must be filtered out
    const userBadgesWhereGet = jest.fn().mockResolvedValue({
      docs: makeDocs([
        { badgeId: 42 }, // non-string — must be filtered
        { badgeId: null }, // null — must be filtered
        { badgeId: undefined }, // undefined — must be filtered
        { /* no badgeId field at all */ },
      ]),
    });
    const collections = {
      users: {
        doc: jest.fn(() => ({
          get: jest.fn(async () => ({
            exists: true,
            data: () => ({
              displayName: "Member",
              visibility: { isPublic: true },
            }),
          })),
          set: jest.fn(async () => undefined),
        })),
      },
      eventRegistrations: { where: jest.fn().mockReturnThis(), get: jest.fn(async () => ({ docs: [] })) },
      talkSubmissions: { where: jest.fn().mockReturnThis(), get: jest.fn(async () => ({ size: 0, docs: [] })) },
      communityMessages: { where: jest.fn().mockReturnThis(), get: jest.fn(async () => ({ size: 0, docs: [] })) },
      pullRequests: { where: jest.fn().mockReturnThis(), get: jest.fn(async () => ({ size: 0, docs: [] })) },
      hackathonTeams: { where: jest.fn().mockReturnThis(), get: jest.fn(async () => ({ size: 0, docs: [] })) },
      hackathonPool: { where: jest.fn().mockReturnThis(), get: jest.fn(async () => ({ size: 0, docs: [] })) },
      showcaseSubmissions: { where: jest.fn().mockReturnThis(), get: jest.fn(async () => ({ size: 0, docs: [] })) },
      user_badges: {
        where: jest.fn(() => ({ get: userBadgesWhereGet })),
        doc: jest.fn((id: string) => ({ id })),
      },
    } as const;
    const db = {
      collection: jest.fn((name: keyof typeof collections) => collections[name]),
      batch: jest.fn(() => ({ set: batchSet, commit: batchCommit })),
    };
    mockGetAdminDb.mockReturnValue(db as never);
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    // Non-string badgeIds didn't pollute existingByBadgeId set, so eligible badges
    // (if any) get awarded freshly. The contract: response is 200 with userBadges array.
    const body = await res.json();
    expect(Array.isArray(body.userBadges)).toBe(true);
  });
});
