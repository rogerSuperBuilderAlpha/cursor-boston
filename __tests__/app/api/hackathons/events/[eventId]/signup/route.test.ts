/**
 * @jest-environment node
 *
 * OpenSSF Silver coverage — hackathon event signup route guards.
 */
import { GET, POST, PATCH, DELETE } from "@/app/api/hackathons/events/[eventId]/signup/route";
import { HACK_A_SPRINT_2026_EVENT_ID } from "@/lib/hackathon-showcase";
import {
  DECLINED_EMAILS,
  getConfirmedCapacityForEvent,
  JUDGE_EMAILS,
} from "@/lib/hackathon-event-signup";
import { getVerifiedUser, getOptionalVerifiedUser } from "@/lib/server-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { fetchMergedPrCountsForLogins } from "@/lib/github-merged-pr-count";
import { checkUpstashRateLimit } from "@/lib/upstash-rate-limit";
import { revalidateTag } from "next/cache";
import { makeAuthedRequest, makeRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("next/cache", () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
  revalidateTag: jest.fn(),
}));

const mockRevalidateTag = revalidateTag as jest.MockedFunction<typeof revalidateTag>;

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
  getOptionalVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/upstash-rate-limit", () => ({
  checkUpstashRateLimit: jest.fn(async () => ({
    success: true,
    remaining: 9,
    resetTime: Date.now() + 60_000,
  })),
}));

const mockCheckUpstashRateLimit = checkUpstashRateLimit as jest.MockedFunction<
  typeof checkUpstashRateLimit
>;

jest.mock("@/lib/rate-limit", () => ({
  getClientIdentifier: jest.fn(() => "test-client"),
  rateLimitConfigs: { hackathonEventSignup: { windowMs: 60_000, maxRequests: 30 } },
}));

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(),
}));

jest.mock("@/lib/github-merged-pr-count", () => ({
  fetchMergedPrCountsForLogins: jest.fn(async () => new Map()),
}));

jest.mock("@/lib/github-recent-merged-prs", () => ({
  getGithubRepoPair: jest.fn(() => ({ owner: "cursor-boston", repo: "cursor-boston" })),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockGetOptionalVerifiedUser = getOptionalVerifiedUser as jest.MockedFunction<
  typeof getOptionalVerifiedUser
>;
const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockFetchMergedPrCounts = fetchMergedPrCountsForLogins as jest.MockedFunction<
  typeof fetchMergedPrCountsForLogins
>;

const EVENT_ID = HACK_A_SPRINT_2026_EVENT_ID;
const BASE_PATH = `/api/hackathons/events/${EVENT_ID}/signup`;

const testUser = {
  uid: "u1",
  email: "user@test.com",
  name: "Test User",
  isAdmin: false,
};

const validProfile = {
  github: { login: "testuser" },
  discord: "user#1234",
  visibility: { isPublic: true, showDiscord: true },
};

function routeContext(eventId = EVENT_ID) {
  return { params: Promise.resolve({ eventId }) };
}

function emptyQuerySnap() {
  return { docs: [], empty: true };
}

function buildLeaderboardDb() {
  const chainable = {
    where: jest.fn().mockReturnThis(),
    get: jest.fn().mockResolvedValue(emptyQuerySnap()),
  };
  return {
    collection: jest.fn(() => chainable),
    getAll: jest.fn().mockResolvedValue([]),
  };
}

type LeaderboardSignupSeed = {
  userId: string;
  displayName?: string;
  githubLogin?: string;
  email?: string;
  confirmed?: boolean;
  mergedPrCount?: number;
  checkedIn?: boolean;
  willBeLate?: boolean;
  queuingForSpot?: boolean;
  noGithub?: boolean;
};

type LumaRegistrantSeed = {
  name?: string;
  email?: string;
  githubLogin?: string;
  confirmed?: boolean;
  lumaCreatedAt?: string;
};

type CohortAppSeed = {
  email: string;
  cohorts?: string[];
  status?: string;
};

type PullRequestSeed = {
  userId: string;
  repository?: string;
};

function buildLeaderboardDbWithSignups(
  signups: LeaderboardSignupSeed[],
  opts: {
    lumaRegistrants?: LumaRegistrantSeed[];
    cohortApps?: CohortAppSeed[];
    pullRequests?: PullRequestSeed[];
  } = {},
) {
  const signupDocs = signups.map((seed, index) => ({
    id: `signup-${index}`,
    data: () => ({
      userId: seed.userId,
      eventId: EVENT_ID,
      signedUpAt: { toMillis: () => 1_000 + index },
      ...(seed.confirmed
        ? {
            confirmedAt: { toMillis: () => 2_000 + index },
            frozenRank: index + 1,
            frozenPrCount: seed.mergedPrCount ?? 0,
          }
        : {}),
      ...(seed.checkedIn ? { checkedInAt: { toMillis: () => 3_000 + index } } : {}),
      ...(seed.willBeLate ? { willBeLate: true } : {}),
      ...(seed.queuingForSpot ? { queuingForSpot: true } : {}),
    }),
  }));

  const signupSnap = { docs: signupDocs, empty: signupDocs.length === 0 };

  const userSnaps = signups.map((seed) => ({
    id: seed.userId,
    exists: true,
    data: () => ({
      displayName: seed.displayName ?? "User",
      email: seed.email ?? `${seed.userId}@test.com`,
      github:
        seed.noGithub || !seed.githubLogin ? undefined : { login: seed.githubLogin },
    }),
  }));

  const prDocs = (opts.pullRequests ?? []).map((pr, index) => ({
    id: `pr-${index}`,
    data: () => ({
      userId: pr.userId,
      state: "merged",
      repository: pr.repository ?? "cursor-boston/cursor-boston",
    }),
  }));
  const prSnap = { docs: prDocs, empty: prDocs.length === 0 };

  const lumaDocs = (opts.lumaRegistrants ?? []).map((seed, index) => ({
    id: `luma-${index}`,
    data: () => ({
      eventId: EVENT_ID,
      email: seed.email ?? `luma-${index}@example.com`,
      githubLogin: seed.githubLogin ?? null,
      name: seed.name ?? `Luma Guest ${index}`,
      lumaCreatedAt: seed.lumaCreatedAt ?? "2026-04-01T10:00:00.000Z",
      ...(seed.confirmed
        ? {
            confirmedAt: { toMillis: () => 5_000 + index },
            frozenRank: index + 10,
            frozenPrCount: 1,
          }
        : {}),
    }),
  }));
  const lumaSnap = { docs: lumaDocs, empty: lumaDocs.length === 0 };

  const cohortDocs = (opts.cohortApps ?? []).map((seed, index) => ({
    id: `cohort-${index}`,
    data: () => ({
      email: seed.email,
      cohorts: seed.cohorts ?? ["cohort-1"],
      status: seed.status ?? "admitted",
    }),
  }));
  const cohortSnap = { docs: cohortDocs, empty: cohortDocs.length === 0 };

  const db = {
    collection: jest.fn((name: string) => {
      if (name === "hackathonEventSignups") {
        return {
          where: jest.fn().mockReturnValue({
            get: jest.fn().mockResolvedValue(signupSnap),
          }),
        };
      }
      if (name === "users") {
        return {
          doc: jest.fn((id: string) => ({ id })),
        };
      }
      if (name === "pullRequests") {
        return {
          where: jest.fn().mockReturnThis(),
          get: jest.fn().mockResolvedValue(prSnap),
        };
      }
      if (name === "hackathonLumaRegistrants") {
        return {
          where: jest.fn().mockReturnValue({
            get: jest.fn().mockResolvedValue(lumaSnap),
          }),
        };
      }
      if (name === "summerCohortApplications") {
        return {
          get: jest.fn().mockResolvedValue(cohortSnap),
        };
      }
      return {
        where: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue(emptyQuerySnap()),
      };
    }),
    getAll: jest.fn().mockResolvedValue(userSnaps),
  };

  return db;
}

function buildSignupDb({
  userProfile = validProfile,
  signupExists = false,
  signupData = {},
}: {
  userProfile?: Record<string, unknown> | null;
  signupExists?: boolean;
  signupData?: Record<string, unknown>;
} = {}) {
  const mockSet = jest.fn().mockResolvedValue(undefined);
  const mockUpdate = jest.fn().mockResolvedValue(undefined);
  const mockDelete = jest.fn().mockResolvedValue(undefined);

  const signupDoc = {
    get: jest.fn().mockResolvedValue({
      exists: signupExists,
      data: () => (signupExists ? signupData : undefined),
    }),
    set: mockSet,
    update: mockUpdate,
    delete: mockDelete,
  };

  const userDoc = {
    get: jest.fn().mockResolvedValue({
      exists: userProfile != null,
      data: () => userProfile ?? undefined,
    }),
  };

  const db = {
    collection: jest.fn((name: string) => {
      if (name === "users") {
        return { doc: jest.fn(() => userDoc) };
      }
      if (name === "hackathonEventSignups") {
        return { doc: jest.fn(() => signupDoc) };
      }
      return {
        where: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue(emptyQuerySnap()),
      };
    }),
    getAll: jest.fn().mockResolvedValue([]),
  };

  return { db, mockSet, mockUpdate, mockDelete, signupDoc };
}

describe("GET /api/hackathons/events/[eventId]/signup", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetOptionalVerifiedUser.mockResolvedValue(null);
    mockFetchMergedPrCounts.mockResolvedValue(new Map());
    mockCheckUpstashRateLimit.mockResolvedValue({
      success: true,
      remaining: 9,
      resetTime: Date.now() + 60_000,
    });
  });

  it("returns 404 for unknown event id", async () => {
    const res = await GET(
      makeRequest({ path: "/api/hackathons/events/not-a-real-event/signup" }),
      { params: Promise.resolve({ eventId: "not-a-real-event" }) },
    );
    expect(res.status).toBe(404);
  });

  it("returns leaderboard payload for a valid event", async () => {
    mockGetAdminDb.mockReturnValue(buildLeaderboardDb() as never);

    const { status, body } = await readJson(
      await GET(makeRequest({ path: BASE_PATH }), routeContext()),
    );

    expect(status).toBe(200);
    expect(body).toMatchObject({
      eventId: EVENT_ID,
      entries: [],
      totalCount: 0,
      websiteSignupCount: 0,
      me: null,
    });
  });

  it("includes me when the caller is authenticated", async () => {
    mockGetAdminDb.mockReturnValue(buildLeaderboardDb() as never);
    mockGetOptionalVerifiedUser.mockResolvedValue(testUser);

    const { status, body } = await readJson(
      await GET(makeAuthedRequest({ path: BASE_PATH }), routeContext()),
    );

    expect(status).toBe(200);
    expect(body.me).toMatchObject({ signedUp: false });
  });

  it("returns 429 when rate limited", async () => {
    mockCheckUpstashRateLimit.mockResolvedValue({
      success: false,
      retryAfter: 30,
      remaining: 0,
      resetTime: Date.now() + 30_000,
    });

    const { status, body } = await readJson(
      await GET(makeRequest({ path: BASE_PATH }), routeContext()),
    );

    expect(status).toBe(429);
    expect(body).toMatchObject({ error: "Too many requests", retryAfterSeconds: 30 });
  });

  it("returns 500 when leaderboard loading fails", async () => {
    mockGetAdminDb.mockReturnValue(null);

    const res = await GET(makeRequest({ path: BASE_PATH }), routeContext());
    expect(res.status).toBe(500);
  });

  it("returns me details when the authenticated user is on the leaderboard", async () => {
    mockGetAdminDb.mockReturnValue(
      buildLeaderboardDbWithSignups([
        {
          userId: testUser.uid,
          displayName: "Test User",
          githubLogin: "testuser",
          confirmed: true,
          mergedPrCount: 3,
          checkedIn: true,
          willBeLate: true,
        },
      ]) as never,
    );
    mockGetOptionalVerifiedUser.mockResolvedValue(testUser);
    mockFetchMergedPrCounts.mockResolvedValue(new Map([["testuser", 3]]));

    const { status, body } = await readJson(
      await GET(makeAuthedRequest({ path: BASE_PATH }), routeContext()),
    );

    expect(status).toBe(200);
    expect(body.me).toMatchObject({
      signedUp: true,
      rank: 1,
      mergedPrCount: 3,
      creditEligible: true,
      willBeLate: true,
    });
    expect(body.entries[0]).toMatchObject({
      userId: testUser.uid,
      checkedIn: true,
      willBeLate: true,
    });
  });

  it("excludes declined website signups and judge-only luma registrants", async () => {
    const declinedEmail = [...DECLINED_EMAILS][0]!;
    const judgeEmail = [...JUDGE_EMAILS][0]!;

    mockGetAdminDb.mockReturnValue(
      buildLeaderboardDbWithSignups(
        [
          {
            userId: "declined-user",
            email: declinedEmail,
            githubLogin: "declined",
          },
          {
            userId: "visible-user",
            displayName: "Visible Dev",
            githubLogin: "visible",
          },
        ],
        {
          lumaRegistrants: [
            { email: judgeEmail, name: "Judge Guest", githubLogin: "judge-guest" },
            {
              email: "luma-only@example.com",
              name: "Luma Only",
              githubLogin: "luma-only",
            },
          ],
        },
      ) as never,
    );
    mockFetchMergedPrCounts.mockResolvedValue(
      new Map([
        ["visible", 1],
        ["luma-only", 4],
      ]),
    );

    const { status, body } = await readJson(
      await GET(makeRequest({ path: BASE_PATH }), routeContext()),
    );

    expect(status).toBe(200);
    expect(body.entries).toHaveLength(2);
    expect(body.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ githubLogin: "visible", userId: "visible-user" }),
        expect.objectContaining({
          githubLogin: "luma-only",
          userId: null,
          lumaRegistered: true,
        }),
      ]),
    );
    expect(body.websiteSignupCount).toBe(1);
  });

  it("merges luma confirmation into matching website signups and prioritizes cohort-1", async () => {
    mockGetAdminDb.mockReturnValue(
      buildLeaderboardDbWithSignups(
        [
          {
            userId: "cohort-user",
            email: "cohort@example.com",
            githubLogin: "cohort-user",
            displayName: "Cohort Builder",
          },
          {
            userId: "regular-user",
            email: "regular@example.com",
            githubLogin: "regular-user",
            displayName: "Regular Dev",
            confirmed: true,
            mergedPrCount: 10,
          },
        ],
        {
          lumaRegistrants: [
            {
              email: "cohort@example.com",
              githubLogin: "cohort-user",
              confirmed: true,
              lumaCreatedAt: "2026-03-01T08:00:00.000Z",
            },
          ],
          cohortApps: [{ email: "cohort@example.com", status: "admitted" }],
        },
      ) as never,
    );
    mockFetchMergedPrCounts.mockResolvedValue(
      new Map([
        ["cohort-user", 1],
        ["regular-user", 10],
      ]),
    );

    const { status, body } = await readJson(
      await GET(makeRequest({ path: BASE_PATH }), routeContext()),
    );

    expect(status).toBe(200);
    expect(body.entries[0]).toMatchObject({
      userId: "cohort-user",
      status: "confirmed",
      isCohort1: true,
      lumaRegistered: true,
    });
    expect(body.entries[1]).toMatchObject({
      userId: "regular-user",
      status: "confirmed",
      isCohort1: false,
    });
  });

  it("uses Firestore pullRequests when a signup has no linked GitHub login", async () => {
    mockGetAdminDb.mockReturnValue(
      buildLeaderboardDbWithSignups(
        [{ userId: "no-gh-user", displayName: "No GitHub", noGithub: true }],
        {
          pullRequests: [
            { userId: "no-gh-user" },
            { userId: "no-gh-user", repository: "other/repo" },
          ],
        },
      ) as never,
    );

    const { status, body } = await readJson(
      await GET(makeRequest({ path: BASE_PATH }), routeContext()),
    );

    expect(status).toBe(200);
    expect(body.entries[0]).toMatchObject({
      userId: "no-gh-user",
      mergedPrCount: 1,
      githubLogin: null,
    });
  });

  it("returns confirmed and waitlisted entries with event capacity", async () => {
    mockGetAdminDb.mockReturnValue(
      buildLeaderboardDbWithSignups([
        {
          userId: "confirmed-1",
          displayName: "Confirmed Dev",
          githubLogin: "confirmed",
          confirmed: true,
          mergedPrCount: 5,
        },
        {
          userId: "waitlisted-1",
          displayName: "Waitlisted Dev",
          githubLogin: "waitlisted",
          confirmed: false,
          mergedPrCount: 2,
        },
      ]) as never,
    );
    mockFetchMergedPrCounts.mockResolvedValue(
      new Map([
        ["confirmed", 5],
        ["waitlisted", 2],
      ]),
    );

    const { status, body } = await readJson(
      await GET(makeRequest({ path: BASE_PATH }), routeContext()),
    );

    expect(status).toBe(200);
    expect(body.creditTopN).toBe(getConfirmedCapacityForEvent(EVENT_ID));
    expect(body.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: "confirmed-1",
          status: "confirmed",
          creditEligible: true,
          displayName: "Confirmed Dev",
        }),
        expect.objectContaining({
          userId: "waitlisted-1",
          status: "waitlisted",
          creditEligible: false,
          displayName: "Waitlisted Dev",
        }),
      ]),
    );
  });
});

describe("POST /api/hackathons/events/[eventId]/signup", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(null);
    mockCheckUpstashRateLimit.mockResolvedValue({
      success: true,
      remaining: 9,
      resetTime: Date.now() + 60_000,
    });
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await POST(makeRequest({ method: "POST", path: BASE_PATH }), routeContext());
    expect(res.status).toBe(401);
  });

  it("returns 400 when profile is incomplete", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const { db } = buildSignupDb({ userProfile: { visibility: { isPublic: false } } });
    mockGetAdminDb.mockReturnValue(db as never);

    const { status, body } = await readJson(
      await POST(makeAuthedRequest({ method: "POST", path: BASE_PATH }), routeContext()),
    );

    expect(status).toBe(400);
    expect(body.error).toMatch(/public/i);
  });

  it("returns 200 when signup is created", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const { db, mockSet } = buildSignupDb();
    mockGetAdminDb.mockReturnValue(db as never);

    const { status, body } = await readJson(
      await POST(makeAuthedRequest({ method: "POST", path: BASE_PATH }), routeContext()),
    );

    expect(status).toBe(200);
    expect(body).toMatchObject({ signedUp: true });
    expect(mockSet).toHaveBeenCalledTimes(1);
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: EVENT_ID,
        userId: testUser.uid,
        signedUpAt: expect.anything(),
      }),
    );
    expect(mockSet.mock.calls[0]?.[0]).not.toHaveProperty("confirmedAt");
    expect(mockRevalidateTag).toHaveBeenCalledWith("hackathon-event-signup", { expire: 0 });
  });

  it("returns 200 with alreadySignedUp when duplicate signup", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const { db, mockSet } = buildSignupDb({ signupExists: true });
    mockGetAdminDb.mockReturnValue(db as never);

    const { status, body } = await readJson(
      await POST(makeAuthedRequest({ method: "POST", path: BASE_PATH }), routeContext()),
    );

    expect(status).toBe(200);
    expect(body).toMatchObject({ signedUp: true, alreadySignedUp: true });
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("returns 400 when GitHub is not connected", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const { db } = buildSignupDb({
      userProfile: { ...validProfile, github: undefined },
    });
    mockGetAdminDb.mockReturnValue(db as never);

    const { status, body } = await readJson(
      await POST(makeAuthedRequest({ method: "POST", path: BASE_PATH }), routeContext()),
    );

    expect(status).toBe(400);
    expect(body.error).toMatch(/github/i);
  });

  it("returns 429 when rate limited", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockCheckUpstashRateLimit.mockResolvedValue({
      success: false,
      retryAfter: 45,
      remaining: 0,
      resetTime: Date.now() + 45_000,
    });

    const { status, body } = await readJson(
      await POST(makeAuthedRequest({ method: "POST", path: BASE_PATH }), routeContext()),
    );

    expect(status).toBe(429);
    expect(body.retryAfterSeconds).toBe(45);
  });

  it("returns 500 when Firestore admin is unavailable", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockGetAdminDb.mockReturnValue(null);

    const res = await POST(
      makeAuthedRequest({ method: "POST", path: BASE_PATH }),
      routeContext(),
    );
    expect(res.status).toBe(500);
  });

  it("returns 400 when Discord is not connected", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const { db } = buildSignupDb({
      userProfile: { ...validProfile, discord: undefined },
    });
    mockGetAdminDb.mockReturnValue(db as never);

    const { status, body } = await readJson(
      await POST(makeAuthedRequest({ method: "POST", path: BASE_PATH }), routeContext()),
    );

    expect(status).toBe(400);
    expect(body.error).toMatch(/discord/i);
  });

  it("returns 404 for unknown event on POST", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const { db } = buildSignupDb();
    mockGetAdminDb.mockReturnValue(db as never);

    const res = await POST(
      makeAuthedRequest({
        method: "POST",
        path: "/api/hackathons/events/not-a-real-event/signup",
      }),
      { params: Promise.resolve({ eventId: "not-a-real-event" }) },
    );
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/hackathons/events/[eventId]/signup", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(null);
    mockCheckUpstashRateLimit.mockResolvedValue({
      success: true,
      remaining: 9,
      resetTime: Date.now() + 60_000,
    });
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await PATCH(
      makeRequest({ method: "PATCH", path: BASE_PATH, body: { willBeLate: true } }),
      routeContext(),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid JSON body", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const { db } = buildSignupDb({
      signupExists: true,
      signupData: { confirmedAt: { toMillis: () => Date.now() } },
    });
    mockGetAdminDb.mockReturnValue(db as never);

    const res = await PATCH(
      makeAuthedRequest({ method: "PATCH", path: BASE_PATH, body: "not-json" }),
      routeContext(),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid json/i);
  });

  it("returns 400 when body has no updatable fields", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const { db } = buildSignupDb({
      signupExists: true,
      signupData: { confirmedAt: { toMillis: () => Date.now() } },
    });
    mockGetAdminDb.mockReturnValue(db as never);

    const { status, body } = await readJson(
      await PATCH(
        makeAuthedRequest({ method: "PATCH", path: BASE_PATH, body: {} }),
        routeContext(),
      ),
    );

    expect(status).toBe(400);
    expect(body.error).toMatch(/no valid fields/i);
  });

  it("returns 200 when willBeLate is set for a confirmed signup", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const { db, mockUpdate } = buildSignupDb({
      signupExists: true,
      signupData: { confirmedAt: { toMillis: () => Date.now() } },
    });
    mockGetAdminDb.mockReturnValue(db as never);

    const { status, body } = await readJson(
      await PATCH(
        makeAuthedRequest({
          method: "PATCH",
          path: BASE_PATH,
          body: { willBeLate: true },
        }),
        routeContext(),
      ),
    );

    expect(status).toBe(200);
    expect(body).toMatchObject({ ok: true });
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("returns 404 when patching without an existing signup", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const { db } = buildSignupDb({ signupExists: false });
    mockGetAdminDb.mockReturnValue(db as never);

    const { status, body } = await readJson(
      await PATCH(
        makeAuthedRequest({
          method: "PATCH",
          path: BASE_PATH,
          body: { queuingForSpot: true },
        }),
        routeContext(),
      ),
    );

    expect(status).toBe(404);
    expect(body.error).toMatch(/not signed up/i);
  });

  it("returns 400 when waitlisted user marks willBeLate", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const { db } = buildSignupDb({ signupExists: true, signupData: {} });
    mockGetAdminDb.mockReturnValue(db as never);

    const { status, body } = await readJson(
      await PATCH(
        makeAuthedRequest({
          method: "PATCH",
          path: BASE_PATH,
          body: { willBeLate: true },
        }),
        routeContext(),
      ),
    );

    expect(status).toBe(400);
    expect(body.error).toMatch(/confirmed attendees/i);
  });

  it("returns 200 when waitlisted user sets queuingForSpot", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const { db, mockUpdate } = buildSignupDb({ signupExists: true, signupData: {} });
    mockGetAdminDb.mockReturnValue(db as never);

    const { status, body } = await readJson(
      await PATCH(
        makeAuthedRequest({
          method: "PATCH",
          path: BASE_PATH,
          body: { queuingForSpot: true },
        }),
        routeContext(),
      ),
    );

    expect(status).toBe(200);
    expect(body).toMatchObject({ ok: true });
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("returns 429 when rate limited", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockCheckUpstashRateLimit.mockResolvedValue({
      success: false,
      retryAfter: 20,
      remaining: 0,
      resetTime: Date.now() + 20_000,
    });

    const res = await PATCH(
      makeAuthedRequest({
        method: "PATCH",
        path: BASE_PATH,
        body: { willBeLate: true },
      }),
      routeContext(),
    );
    expect(res.status).toBe(429);
  });

  it("returns 500 when Firestore admin is unavailable", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockGetAdminDb.mockReturnValue(null);

    const res = await PATCH(
      makeAuthedRequest({
        method: "PATCH",
        path: BASE_PATH,
        body: { willBeLate: true },
      }),
      routeContext(),
    );
    expect(res.status).toBe(500);
  });

  it("returns 400 when a confirmed user tries to queue for a spot", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const { db } = buildSignupDb({
      signupExists: true,
      signupData: { confirmedAt: { toMillis: () => Date.now() } },
    });
    mockGetAdminDb.mockReturnValue(db as never);

    const { status, body } = await readJson(
      await PATCH(
        makeAuthedRequest({
          method: "PATCH",
          path: BASE_PATH,
          body: { queuingForSpot: true },
        }),
        routeContext(),
      ),
    );

    expect(status).toBe(400);
    expect(body.error).toMatch(/waitlisted attendees only/i);
  });

  it("returns 400 when a waitlisted user tries to give up a spot", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const { db } = buildSignupDb({ signupExists: true, signupData: {} });
    mockGetAdminDb.mockReturnValue(db as never);

    const { status, body } = await readJson(
      await PATCH(
        makeAuthedRequest({
          method: "PATCH",
          path: BASE_PATH,
          body: { giveUpSpot: true },
        }),
        routeContext(),
      ),
    );

    expect(status).toBe(400);
    expect(body.error).toMatch(/confirmed attendees can give up/i);
  });

  it("clears willBeLate and queuingForSpot when set to false", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const { db, mockUpdate } = buildSignupDb({
      signupExists: true,
      signupData: {
        confirmedAt: { toMillis: () => Date.now() },
        willBeLate: true,
        queuingForSpot: true,
      },
    });
    mockGetAdminDb.mockReturnValue(db as never);

    const { status, body } = await readJson(
      await PATCH(
        makeAuthedRequest({
          method: "PATCH",
          path: BASE_PATH,
          body: { willBeLate: false, queuingForSpot: false },
        }),
        routeContext(),
      ),
    );

    expect(status).toBe(200);
    expect(body).toMatchObject({ ok: true });
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockRevalidateTag).toHaveBeenCalledWith("hackathon-event-signup", { expire: 0 });
  });

  it("returns 200 when confirmed user gives up spot", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const { db, mockUpdate } = buildSignupDb({
      signupExists: true,
      signupData: { confirmedAt: { toMillis: () => Date.now() } },
    });
    mockGetAdminDb.mockReturnValue(db as never);

    const { status, body } = await readJson(
      await PATCH(
        makeAuthedRequest({
          method: "PATCH",
          path: BASE_PATH,
          body: { giveUpSpot: true },
        }),
        routeContext(),
      ),
    );

    expect(status).toBe(200);
    expect(body).toMatchObject({ ok: true, gaveUpSpot: true });
    expect(mockUpdate).toHaveBeenCalled();
  });
});

describe("DELETE /api/hackathons/events/[eventId]/signup", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(null);
    mockCheckUpstashRateLimit.mockResolvedValue({
      success: true,
      remaining: 9,
      resetTime: Date.now() + 60_000,
    });
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await DELETE(
      makeRequest({ method: "DELETE", path: BASE_PATH }),
      routeContext(),
    );
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockCheckUpstashRateLimit.mockResolvedValue({
      success: false,
      retryAfter: 15,
      remaining: 0,
      resetTime: Date.now() + 15_000,
    });

    const res = await DELETE(
      makeAuthedRequest({ method: "DELETE", path: BASE_PATH }),
      routeContext(),
    );
    expect(res.status).toBe(429);
  });

  it("returns 404 for unknown event on DELETE", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);

    const res = await DELETE(
      makeAuthedRequest({
        method: "DELETE",
        path: "/api/hackathons/events/not-a-real-event/signup",
      }),
      { params: Promise.resolve({ eventId: "not-a-real-event" }) },
    );
    expect(res.status).toBe(404);
  });

  it("returns 500 when Firestore admin is unavailable", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockGetAdminDb.mockReturnValue(null);

    const res = await DELETE(
      makeAuthedRequest({ method: "DELETE", path: BASE_PATH }),
      routeContext(),
    );
    expect(res.status).toBe(500);
  });

  it("returns 200 when the user leaves the signup list", async () => {
    mockGetVerifiedUser.mockResolvedValue(testUser);
    const { db } = buildSignupDb({ signupExists: true });
    mockGetAdminDb.mockReturnValue(db as never);

    const { status, body } = await readJson(
      await DELETE(makeAuthedRequest({ method: "DELETE", path: BASE_PATH }), routeContext()),
    );

    expect(status).toBe(200);
    expect(body).toMatchObject({ left: true });
    expect(mockRevalidateTag).toHaveBeenCalledWith("hackathon-event-signup", { expire: 0 });
  });
});
