/**
 * @jest-environment node
 */
const mockGetDocs = jest.fn();
const mockCollection = jest.fn();
const mockQuery = jest.fn((...args: unknown[]) => ({ __q: args }));
const mockWhere = jest.fn((...args: unknown[]) => ({ __w: args }));

jest.mock("firebase/firestore", () => ({
  collection: (...a: unknown[]) => mockCollection(...a),
  getDocs: (...a: unknown[]) => mockGetDocs(...a),
  query: (...a: unknown[]) => mockQuery(...a),
  where: (...a: unknown[]) => mockWhere(...a),
}));

jest.mock("@/lib/firebase", () => {
  let _db: unknown = { __fake: "db" };
  let _auth: { currentUser: { uid: string; getIdToken: () => Promise<string> } | null } = {
    currentUser: null,
  };
  return {
    get db() {
      return _db;
    },
    get auth() {
      return _auth;
    },
    __setDb(next: unknown) {
      _db = next;
    },
    __setAuth(next: typeof _auth) {
      _auth = next;
    },
  };
});

import {
  BADGES_COLLECTION,
  USER_BADGES_COLLECTION,
  ensureUserBadgesForEligible,
  ensureUserBadgesForEligibleWithStatus,
  getBadgeDocumentId,
  getUserBadgeDocumentId,
  getUserBadgeMap,
  toBadgeDefinitionDocument,
  toUserBadgeDocument,
} from "@/lib/badges/data";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const firebaseMod = require("@/lib/firebase") as {
  __setDb: (db: unknown) => void;
  __setAuth: (auth: unknown) => void;
};
const setDb = firebaseMod.__setDb;
const setAuth = firebaseMod.__setAuth;

const originalFetch = global.fetch;

function tsLike(iso: string) {
  return { toDate: () => new Date(iso) };
}

describe("lib/badges/data", () => {
  beforeEach(() => {
    mockGetDocs.mockReset();
    mockCollection.mockReset();
    setDb({ __fake: "db" });
    setAuth({ currentUser: null });
    global.fetch = jest.fn();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  describe("constants + pure ID helpers", () => {
    it("BADGES_COLLECTION + USER_BADGES_COLLECTION are the Firestore collection names", () => {
      expect(BADGES_COLLECTION).toBe("badges");
      expect(USER_BADGES_COLLECTION).toBe("user_badges");
    });

    it("getBadgeDocumentId returns the badgeId verbatim", () => {
      expect(getBadgeDocumentId("registered")).toBe("registered");
    });

    it("getUserBadgeDocumentId joins userId + badgeId with an underscore", () => {
      expect(getUserBadgeDocumentId("u1", "registered")).toBe("u1_registered");
    });
  });

  describe("storage-shape mappers", () => {
    it("toBadgeDefinitionDocument copies the documented fields", () => {
      const out = toBadgeDefinitionDocument({
        id: "registered",
        name: "Registered",
        description: "desc",
        category: "profile",
        howToEarn: "sign up",
        sortOrder: 1,
        iconKey: "k",
      });
      expect(out).toEqual({
        id: "registered",
        name: "Registered",
        description: "desc",
        category: "profile",
        howToEarn: "sign up",
        sortOrder: 1,
        iconKey: "k",
      });
    });

    it("toUserBadgeDocument copies the documented fields", () => {
      const out = toUserBadgeDocument({
        id: "u1_registered",
        userId: "u1",
        badgeId: "registered",
        awardedAt: "2026-05-01T00:00:00.000Z",
        awardSource: "system",
        awardedBy: "admin",
      });
      expect(out).toEqual({
        id: "u1_registered",
        userId: "u1",
        badgeId: "registered",
        awardedAt: "2026-05-01T00:00:00.000Z",
        awardSource: "system",
        awardedBy: "admin",
      });
    });
  });

  describe("getUserBadgeMap", () => {
    it("returns {} when db is null", async () => {
      setDb(null);
      expect(await getUserBadgeMap("u1")).toEqual({});
    });

    it("returns {} when userId is empty", async () => {
      expect(await getUserBadgeMap("")).toEqual({});
    });

    it("queries user_badges by userId and maps trusted rows into the map", async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: "ub-1",
            data: () => ({
              id: "ub-1",
              userId: "u1",
              badgeId: "registered",
              awardedAt: "2026-05-01T00:00:00.000Z",
              awardSource: "system",
            }),
          },
        ],
      });
      const out = await getUserBadgeMap("u1");
      expect(out.registered).toMatchObject({
        id: "ub-1",
        userId: "u1",
        badgeId: "registered",
        awardSource: "system",
      });
      expect(mockWhere).toHaveBeenCalledWith("userId", "==", "u1");
    });

    it("converts Timestamp + seconds-shape awardedAt to ISO strings", async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: "ub-ts",
            data: () => ({
              userId: "u1",
              badgeId: "bio",
              awardedAt: tsLike("2026-04-01T00:00:00.000Z"),
              awardSource: "manual",
            }),
          },
          {
            id: "ub-sec",
            data: () => ({
              userId: "u1",
              badgeId: "displayName",
              awardedAt: { seconds: 1717000000 },
              awardSource: "migration",
            }),
          },
        ],
      });
      const out = await getUserBadgeMap("u1");
      expect(out.bio?.awardedAt).toBe("2026-04-01T00:00:00.000Z");
      expect(out.displayName?.awardedAt).toBe(
        new Date(1717000000 * 1000).toISOString(),
      );
    });

    it("drops rows missing required fields or with untrusted awardSource", async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          { id: "x1", data: () => ({}) }, // empty
          {
            id: "x2",
            data: () => ({
              userId: "u1",
              badgeId: "registered",
              awardSource: "self-claim",
              awardedAt: "2026-05-01T00:00:00.000Z",
            }),
          }, // untrusted source
          {
            id: "x3",
            data: () => ({
              userId: "u1",
              badgeId: "bio",
              awardSource: "system",
            }),
          }, // missing awardedAt
        ],
      });
      const out = await getUserBadgeMap("u1");
      expect(out).toEqual({});
    });
  });

  describe("ensureUserBadgesForEligibleWithStatus", () => {
    it("returns failed when userId is empty", async () => {
      const out = await ensureUserBadgesForEligibleWithStatus("", {});
      expect(out.status.state).toBe("failed");
    });

    it("returns complete when no missing-eligible badges remain", async () => {
      const eligibility = { registered: { isEligible: true } };
      const existing = {
        registered: {
          id: "u1_registered",
          userId: "u1",
          badgeId: "registered",
          awardedAt: "2026-05-01T00:00:00.000Z",
          awardSource: "system",
        },
      } as Parameters<typeof ensureUserBadgesForEligibleWithStatus>[2];
      const out = await ensureUserBadgesForEligibleWithStatus(
        "u1",
        eligibility as Parameters<typeof ensureUserBadgesForEligibleWithStatus>[1],
        existing,
      );
      expect(out.status.state).toBe("complete");
      expect(out.userBadgeMap).toBe(existing);
    });

    it("returns degraded when auth.currentUser != target uid (no fetch)", async () => {
      setAuth({ currentUser: { uid: "OTHER", getIdToken: async () => "t" } });
      const out = await ensureUserBadgesForEligibleWithStatus(
        "u1",
        { registered: { isEligible: true } } as Parameters<
          typeof ensureUserBadgesForEligibleWithStatus
        >[1],
      );
      expect(out.status.state).toBe("degraded");
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("returns failed when /api/badges/awards responds non-2xx", async () => {
      setAuth({
        currentUser: { uid: "u1", getIdToken: async () => "tok" },
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false });
      const out = await ensureUserBadgesForEligibleWithStatus(
        "u1",
        { registered: { isEligible: true } } as Parameters<
          typeof ensureUserBadgesForEligibleWithStatus
        >[1],
      );
      expect(out.status.state).toBe("failed");
    });

    it("returns failed when /api/badges/awards returns a non-array shape", async () => {
      setAuth({
        currentUser: { uid: "u1", getIdToken: async () => "tok" },
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ notAnArray: true }),
      });
      const out = await ensureUserBadgesForEligibleWithStatus(
        "u1",
        { registered: { isEligible: true } } as Parameters<
          typeof ensureUserBadgesForEligibleWithStatus
        >[1],
      );
      expect(out.status.state).toBe("failed");
    });

    it("returns complete when all eligible badges come back in the response", async () => {
      setAuth({
        currentUser: { uid: "u1", getIdToken: async () => "tok" },
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          userBadges: [
            {
              id: "u1_registered",
              userId: "u1",
              badgeId: "registered",
              awardedAt: "2026-05-01T00:00:00.000Z",
              awardSource: "system",
            },
          ],
        }),
      });
      const out = await ensureUserBadgesForEligibleWithStatus(
        "u1",
        { registered: { isEligible: true } } as Parameters<
          typeof ensureUserBadgesForEligibleWithStatus
        >[1],
      );
      expect(out.status.state).toBe("complete");
      expect(out.userBadgeMap.registered?.id).toBe("u1_registered");
    });

    it("returns degraded when only some eligible badges come back", async () => {
      setAuth({
        currentUser: { uid: "u1", getIdToken: async () => "tok" },
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          userBadges: [
            {
              id: "u1_registered",
              userId: "u1",
              badgeId: "registered",
              awardedAt: "2026-05-01T00:00:00.000Z",
              awardSource: "system",
            },
          ],
        }),
      });
      const out = await ensureUserBadgesForEligibleWithStatus(
        "u1",
        {
          registered: { isEligible: true },
          bio: { isEligible: true },
        } as Parameters<typeof ensureUserBadgesForEligibleWithStatus>[1],
      );
      expect(out.status.state).toBe("degraded");
    });

    it("returns failed when fetch throws", async () => {
      setAuth({
        currentUser: { uid: "u1", getIdToken: async () => "tok" },
      });
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("net down"));
      const out = await ensureUserBadgesForEligibleWithStatus(
        "u1",
        { registered: { isEligible: true } } as Parameters<
          typeof ensureUserBadgesForEligibleWithStatus
        >[1],
      );
      expect(out.status.state).toBe("failed");
    });

    it("ensureUserBadgesForEligible delegates and returns only the badge map", async () => {
      setAuth({
        currentUser: { uid: "u1", getIdToken: async () => "tok" },
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          userBadges: [
            {
              id: "u1_registered",
              userId: "u1",
              badgeId: "registered",
              awardedAt: "2026-05-01T00:00:00.000Z",
              awardSource: "system",
            },
          ],
        }),
      });
      const out = await ensureUserBadgesForEligible(
        "u1",
        { registered: { isEligible: true } } as Parameters<typeof ensureUserBadgesForEligible>[1],
      );
      expect(out.registered?.id).toBe("u1_registered");
    });
  });
});
