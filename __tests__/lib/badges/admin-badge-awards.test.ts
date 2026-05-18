/**
 * @jest-environment node
 */
const adminDbMock = jest.fn();
jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: () => adminDbMock(),
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: () => ({ __ts: "now" }),
  },
}));

jest.mock("@/lib/badges/definitions", () => ({
  BADGE_IDS: [
    "registered",
    "displayName",
    "publicProfile",
    "bio",
    "avatar",
    "discord",
    "github",
    "firstEvent",
    "talkSubmitter",
    "contributor",
    "communityVoice",
    "communityPoster",
    "hackathonPlayer",
    "showcase",
    "mentor",
  ],
}));

const mockEvaluate = jest.fn();
jest.mock("@/lib/badges/eligibility", () => ({
  evaluateBadgeEligibility: (...args: unknown[]) => mockEvaluate(...args),
}));

import {
  buildAdminBadgeEligibilityInput,
  syncUserBadgesForUser,
  userBadgeFromFirestoreDoc,
} from "@/lib/badges/admin-badge-awards";

function tsLike(iso: string) {
  return { toDate: () => new Date(iso) };
}

describe("lib/badges/admin-badge-awards", () => {
  beforeEach(() => {
    adminDbMock.mockReset();
    mockEvaluate.mockReset();
  });

  describe("userBadgeFromFirestoreDoc", () => {
    const VALID = {
      badgeId: "registered",
      userId: "u1",
      awardSource: "system",
      awardedAt: "2026-05-01T00:00:00.000Z",
      awardedBy: "admin",
      id: "doc-123",
    };

    it("parses a valid system-awarded badge with ISO awardedAt", () => {
      const out = userBadgeFromFirestoreDoc("fallback-id", VALID);
      expect(out).toEqual({
        id: "doc-123",
        userId: "u1",
        badgeId: "registered",
        awardedAt: "2026-05-01T00:00:00.000Z",
        awardSource: "system",
        awardedBy: "admin",
      });
    });

    it("uses docId when data.id is missing", () => {
      const out = userBadgeFromFirestoreDoc("doc-from-arg", {
        ...VALID,
        id: undefined,
      });
      expect(out?.id).toBe("doc-from-arg");
    });

    it("accepts a Timestamp-like awardedAt and converts to ISO", () => {
      const out = userBadgeFromFirestoreDoc("doc-123", {
        ...VALID,
        awardedAt: tsLike("2026-04-01T00:00:00.000Z"),
      });
      expect(out?.awardedAt).toBe("2026-04-01T00:00:00.000Z");
    });

    it("rejects when badgeId is not a known BADGE_ID", () => {
      const out = userBadgeFromFirestoreDoc("doc-123", {
        ...VALID,
        badgeId: "not-real",
      });
      expect(out).toBeNull();
    });

    it("rejects when badgeId is not a string", () => {
      const out = userBadgeFromFirestoreDoc("doc-123", {
        ...VALID,
        badgeId: 42,
      });
      expect(out).toBeNull();
    });

    it("rejects when userId is not a string", () => {
      const out = userBadgeFromFirestoreDoc("doc-123", {
        ...VALID,
        userId: 42,
      });
      expect(out).toBeNull();
    });

    it("rejects when awardSource isn't in the trusted set", () => {
      const out = userBadgeFromFirestoreDoc("doc-123", {
        ...VALID,
        awardSource: "self-claim",
      });
      expect(out).toBeNull();
    });

    it("rejects when awardSource is not a string", () => {
      const out = userBadgeFromFirestoreDoc("doc-123", {
        ...VALID,
        awardSource: 42,
      });
      expect(out).toBeNull();
    });

    it("rejects when awardedAt cannot be parsed (null / invalid string)", () => {
      expect(
        userBadgeFromFirestoreDoc("doc-123", { ...VALID, awardedAt: "not-a-date" }),
      ).toBeNull();
      expect(
        userBadgeFromFirestoreDoc("doc-123", { ...VALID, awardedAt: null }),
      ).toBeNull();
      expect(
        userBadgeFromFirestoreDoc("doc-123", { ...VALID, awardedAt: 42 }),
      ).toBeNull();
    });

    it("omits awardedBy when it isn't a string", () => {
      const out = userBadgeFromFirestoreDoc("doc-123", {
        ...VALID,
        awardedBy: 42,
      });
      expect(out?.awardedBy).toBeUndefined();
    });

    it("accepts each trusted award source (system / migration / manual)", () => {
      for (const src of ["system", "migration", "manual"]) {
        const out = userBadgeFromFirestoreDoc("doc", { ...VALID, awardSource: src });
        expect(out?.awardSource).toBe(src);
      }
    });
  });

  describe("buildAdminBadgeEligibilityInput", () => {
    it("returns {} when admin db is unavailable", async () => {
      adminDbMock.mockReturnValueOnce(null);
      const out = await buildAdminBadgeEligibilityInput("u1");
      expect(out).toEqual({});
    });

    function fakeDb(overrides: Record<string, unknown> = {}) {
      const docs = (arr: Record<string, unknown>[]) => ({
        size: arr.length,
        docs: arr.map((d) => ({ data: () => d })),
        empty: arr.length === 0,
      });
      const userSnap = {
        exists: true,
        data: () => ({
          displayName: "Alice",
          visibility: { isPublic: true },
          bio: "hi",
          photoURL: "https://x/a.png",
          discord: { id: "d1" },
          github: { login: "alice" },
          ...overrides,
        }),
      };

      const userRef = { get: jest.fn().mockResolvedValue(userSnap) };
      const eventReg = {
        where: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue(
          docs([{ status: "attended" }, { status: "registered" }]),
        ),
      };
      const talks = {
        where: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue(
          docs([{ status: "completed" }, { status: "submitted" }]),
        ),
      };
      const messages = {
        where: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue(
          docs([{ parentId: null }, { parentId: "p" }, { parentId: null }]),
        ),
      };
      const prs = {
        where: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue(docs([{}, {}, {}])),
      };
      const teams = {
        where: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue(docs([{}])),
      };
      const pool = {
        where: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue(docs([{}, {}, {}])),
      };
      const showcase = {
        where: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue(
          docs([{ status: "approved" }, { status: "pending" }]),
        ),
      };

      const collection = jest.fn((name: string) => {
        switch (name) {
          case "users":
            return { doc: () => userRef };
          case "eventRegistrations":
            return eventReg;
          case "talkSubmissions":
            return talks;
          case "communityMessages":
            return messages;
          case "pullRequests":
            return prs;
          case "hackathonTeams":
            return teams;
          case "hackathonPool":
            return pool;
          case "showcaseSubmissions":
            return showcase;
          default:
            throw new Error(`unexpected: ${name}`);
        }
      });
      return {
        db: { collection, batch: jest.fn() },
        spies: { userRef, eventReg, talks, messages, prs, teams, pool, showcase },
      };
    }

    it("returns a fully-populated input for a normal user", async () => {
      const { db } = fakeDb();
      adminDbMock.mockReturnValueOnce(db as unknown as Record<string, unknown>);
      const out = await buildAdminBadgeEligibilityInput("u1");
      expect(out).toMatchObject({
        hasDisplayName: true,
        isPublicProfile: true,
        hasBio: true,
        hasAvatar: true,
        hasDiscordConnected: true,
        hasGithubConnected: true,
        eventsAttendedCount: 1, // 1 attended of 2 regs
        talksSubmittedCount: 2,
        talksGivenCount: 1, // 1 completed of 2 talks
        pullRequestsCount: 3,
        communityMessagesCount: 3,
        communityPostsCount: 2, // 2 with no parentId
        hackathonParticipationCount: 3, // max(teams=1, pool=3)
        showcaseSubmissionsCount: 1, // 1 approved of 2
        mentorMatchesCount: 0,
      });
    });

    it("returns false for boolean flags when user profile fields are empty", async () => {
      const { db } = fakeDb({
        displayName: "",
        visibility: { isPublic: false },
        bio: "   ",
        photoURL: "",
        discord: null,
        github: undefined,
      });
      adminDbMock.mockReturnValueOnce(db as unknown as Record<string, unknown>);
      const out = await buildAdminBadgeEligibilityInput("u1");
      expect(out).toMatchObject({
        hasDisplayName: false,
        isPublicProfile: false,
        hasBio: false,
        hasAvatar: false,
        hasDiscordConnected: false,
        hasGithubConnected: false,
      });
    });

    it("treats non-existent user doc as empty user data", async () => {
      const { db } = fakeDb();
      // Override userRef.get to return non-existent snap
      (db.collection("users") as unknown as { doc: () => { get: jest.Mock } })
        .doc()
        .get.mockResolvedValueOnce({ exists: false, data: () => undefined });
      adminDbMock.mockReturnValueOnce(db as unknown as Record<string, unknown>);
      const out = await buildAdminBadgeEligibilityInput("u1");
      expect(out.hasDisplayName).toBe(false);
      expect(out.hasBio).toBe(false);
    });
  });

  describe("syncUserBadgesForUser", () => {
    it("returns empty result when admin db is unavailable", async () => {
      adminDbMock.mockReturnValueOnce(null);
      const out = await syncUserBadgesForUser("u1", { awardedBy: "admin" });
      expect(out).toEqual({ eligibleBadgeIds: [], newlyAwardedBadgeIds: [] });
    });

    it("awards missing badges + persists earnedBadgeIds, returns both lists", async () => {
      const eligibilityMap = {
        registered: { isEligible: true },
        displayName: { isEligible: true },
        bio: { isEligible: false },
      };
      mockEvaluate.mockReturnValueOnce(eligibilityMap);

      // Existing user_badges already has registered, missing displayName.
      const existingDocs = [
        { id: "u1_registered", data: () => ({ badgeId: "registered" }) },
      ];
      const finalDocs = [
        {
          id: "u1_registered",
          data: () => ({
            id: "u1_registered",
            userId: "u1",
            badgeId: "registered",
            awardSource: "migration",
            awardedAt: "2026-05-01T00:00:00.000Z",
          }),
        },
        {
          id: "u1_displayName",
          data: () => ({
            id: "u1_displayName",
            userId: "u1",
            badgeId: "displayName",
            awardSource: "migration",
            awardedAt: "2026-05-01T00:00:00.000Z",
          }),
        },
      ];

      const userBadgesGet = jest
        .fn()
        .mockResolvedValueOnce({ docs: existingDocs })
        .mockResolvedValueOnce({ docs: finalDocs });
      const userBadgesWhere = jest.fn().mockReturnValue({ get: userBadgesGet });
      const userBadgesDoc = jest.fn().mockImplementation((id: string) => ({
        __ref: id,
      }));
      const userBadgesRef = { where: userBadgesWhere, doc: userBadgesDoc };

      const batchSet = jest.fn();
      const batchCommit = jest.fn().mockResolvedValue(undefined);
      const batch = { set: batchSet, commit: batchCommit };

      const usersSet = jest.fn().mockResolvedValue(undefined);
      const usersDocObj = {
        set: usersSet,
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({ displayName: "Alice" }),
        }),
      };
      const usersDoc = jest.fn().mockReturnValue(usersDocObj);
      const usersCol = { doc: usersDoc };

      const collection = jest.fn((name: string) => {
        if (name === "user_badges") return userBadgesRef;
        if (name === "users") return usersCol;
        // Other reads inside buildAdminBadgeEligibilityInput
        return {
          where: jest.fn().mockReturnThis(),
          get: jest.fn().mockResolvedValue({ docs: [], size: 0, empty: true }),
          doc: () => ({
            get: jest.fn().mockResolvedValue({
              exists: true,
              data: () => ({ displayName: "Alice" }),
            }),
          }),
        };
      });

      const db = {
        collection,
        batch: () => batch,
      };
      adminDbMock.mockReturnValue(db as unknown as Record<string, unknown>);

      const out = await syncUserBadgesForUser("u1", { awardedBy: "admin" });
      expect(out.eligibleBadgeIds.sort()).toEqual(["displayName", "registered"]);
      expect(out.newlyAwardedBadgeIds).toEqual(["displayName"]);
      expect(batchSet).toHaveBeenCalledTimes(1);
      expect(batchSet.mock.calls[0][1]).toMatchObject({
        id: "u1_displayName",
        userId: "u1",
        badgeId: "displayName",
        awardSource: "migration",
        awardedBy: "admin",
      });
      // earnedBadgeIds list reflects what's actually persisted
      expect(usersSet).toHaveBeenCalledWith(
        { earnedBadgeIds: ["registered", "displayName"] },
        { merge: true },
      );
    });

    it("skips batch.commit when nothing new is eligible", async () => {
      mockEvaluate.mockReturnValueOnce({ registered: { isEligible: true } });

      const existingDocs = [
        {
          id: "u1_registered",
          data: () => ({
            id: "u1_registered",
            userId: "u1",
            badgeId: "registered",
            awardSource: "migration",
            awardedAt: "2026-05-01T00:00:00.000Z",
          }),
        },
      ];
      const userBadgesGet = jest.fn().mockResolvedValueOnce({ docs: existingDocs });
      const userBadgesRef = {
        where: jest.fn().mockReturnValue({ get: userBadgesGet }),
        doc: jest.fn(),
      };

      const batchCommit = jest.fn();
      const batchSet = jest.fn();
      const batch = { set: batchSet, commit: batchCommit };

      const usersSet = jest.fn();
      const collection = jest.fn((name: string) => {
        if (name === "user_badges") return userBadgesRef;
        if (name === "users") {
          return {
            doc: () => ({
              set: usersSet,
              get: jest.fn().mockResolvedValue({
                exists: true,
                data: () => ({ displayName: "Alice" }),
              }),
            }),
          };
        }
        return {
          where: jest.fn().mockReturnThis(),
          get: jest.fn().mockResolvedValue({ docs: [], size: 0, empty: true }),
          doc: () => ({
            get: jest
              .fn()
              .mockResolvedValue({ exists: true, data: () => ({}) }),
          }),
        };
      });

      adminDbMock.mockReturnValue({
        collection,
        batch: () => batch,
      } as unknown as Record<string, unknown>);
      const out = await syncUserBadgesForUser("u1", { awardedBy: "admin" });
      expect(out.newlyAwardedBadgeIds).toEqual([]);
      expect(batchCommit).not.toHaveBeenCalled();
      expect(usersSet).toHaveBeenCalledWith(
        { earnedBadgeIds: ["registered"] },
        { merge: true },
      );
    });

    it("filters out un-string badgeIds when computing existingByBadgeId", async () => {
      mockEvaluate.mockReturnValueOnce({ registered: { isEligible: true } });

      // existing docs include a row with no badgeId — should not block
      // the missing-eligible computation
      const existingDocs = [
        { id: "weird", data: () => ({}) },
        { id: "weird2", data: () => ({ badgeId: 42 }) },
      ];
      const finalDocs = [
        {
          id: "u1_registered",
          data: () => ({
            id: "u1_registered",
            userId: "u1",
            badgeId: "registered",
            awardSource: "migration",
            awardedAt: "2026-05-01T00:00:00.000Z",
          }),
        },
      ];
      const userBadgesGet = jest
        .fn()
        .mockResolvedValueOnce({ docs: existingDocs })
        .mockResolvedValueOnce({ docs: finalDocs });
      const userBadgesRef = {
        where: jest.fn().mockReturnValue({ get: userBadgesGet }),
        doc: jest.fn().mockImplementation((id: string) => ({ __ref: id })),
      };

      const batchSet = jest.fn();
      const batchCommit = jest.fn().mockResolvedValue(undefined);
      const usersSet = jest.fn();
      const collection = jest.fn((name: string) => {
        if (name === "user_badges") return userBadgesRef;
        if (name === "users") {
          return {
            doc: () => ({
              set: usersSet,
              get: jest.fn().mockResolvedValue({
                exists: true,
                data: () => ({ displayName: "Alice" }),
              }),
            }),
          };
        }
        return {
          where: jest.fn().mockReturnThis(),
          get: jest.fn().mockResolvedValue({ docs: [], size: 0, empty: true }),
          doc: () => ({
            get: jest
              .fn()
              .mockResolvedValue({ exists: true, data: () => ({}) }),
          }),
        };
      });

      adminDbMock.mockReturnValue({
        collection,
        batch: () => ({ set: batchSet, commit: batchCommit }),
      } as unknown as Record<string, unknown>);
      const out = await syncUserBadgesForUser("u1", { awardedBy: "admin" });
      expect(out.newlyAwardedBadgeIds).toEqual(["registered"]);
    });
  });
});
