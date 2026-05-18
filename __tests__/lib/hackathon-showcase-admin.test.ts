/**
 * @jest-environment node
 *
 * Coverage push #61 — lib/hackathon-showcase-admin.ts. Drives:
 *   - awardHackASprint2026ShowcaseBadge (no-admin-db, missing user,
 *     successful badge write)
 *   - userIsHackASprint2026JudgeFromUserData (uid allowlist, token
 *     email, profile email, verified additional emails, empty allowlist
 *     short-circuit)
 *   - userIsHackASprint2026Judge wrapper
 */
const mockGetAdminDb = jest.fn();
jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: () => mockGetAdminDb(),
}));

const mockFindUser = jest.fn();
jest.mock("@/lib/github", () => ({
  findUserByGitHubLogin: (...a: unknown[]) => mockFindUser(...a),
}));

const loggerSpies = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
jest.mock("@/lib/logger", () => ({
  logger: {
    info: (...a: unknown[]) => loggerSpies.info(...a),
    warn: (...a: unknown[]) => loggerSpies.warn(...a),
    error: (...a: unknown[]) => loggerSpies.error(...a),
    debug: () => {},
  },
}));

const mockJudgeUidSet = new Set<string>();
const mockJudgeEmailSet = new Set<string>();
jest.mock("@/lib/hackathon-showcase", () => ({
  getJudgeUidSet: () => mockJudgeUidSet,
  getJudgeEmailSet: () => mockJudgeEmailSet,
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "__ts" },
}));

import {
  awardHackASprint2026ShowcaseBadge,
  userIsHackASprint2026Judge,
  userIsHackASprint2026JudgeFromUserData,
} from "@/lib/hackathon-showcase-admin";

function makeUsersDb() {
  const setSpy = jest.fn().mockResolvedValue(undefined);
  return {
    db: {
      collection: jest.fn((name: string) => {
        if (name !== "users") throw new Error(`Unexpected coll: ${name}`);
        return {
          doc: () => ({ set: setSpy, get: jest.fn() }),
        };
      }),
    },
    spies: { setSpy },
  };
}

beforeEach(() => {
  mockGetAdminDb.mockReset();
  mockFindUser.mockReset();
  mockJudgeUidSet.clear();
  mockJudgeEmailSet.clear();
  loggerSpies.warn.mockClear();
  loggerSpies.info.mockClear();
});

describe("awardHackASprint2026ShowcaseBadge", () => {
  it("warns and bails when admin db is missing", async () => {
    mockGetAdminDb.mockReturnValueOnce(null);
    await awardHackASprint2026ShowcaseBadge("alice");
    expect(loggerSpies.warn).toHaveBeenCalledWith(
      "awardHackASprint2026ShowcaseBadge: no admin db",
      expect.any(Object)
    );
    expect(mockFindUser).not.toHaveBeenCalled();
  });

  it("warns and bails when no linked user found", async () => {
    const { db, spies } = makeUsersDb();
    mockGetAdminDb.mockReturnValueOnce(db);
    mockFindUser.mockResolvedValueOnce(null);
    await awardHackASprint2026ShowcaseBadge("ghost");
    expect(loggerSpies.warn).toHaveBeenCalledWith(
      "awardHackASprint2026ShowcaseBadge: no linked user",
      expect.any(Object)
    );
    expect(spies.setSpy).not.toHaveBeenCalled();
  });

  it("writes the badge merge-patch when a user is found", async () => {
    const { db, spies } = makeUsersDb();
    mockGetAdminDb.mockReturnValueOnce(db);
    mockFindUser.mockResolvedValueOnce("u1");
    await awardHackASprint2026ShowcaseBadge("alice");
    expect(spies.setSpy).toHaveBeenCalledWith(
      {
        hackASprint2026ShowcaseBadge: true,
        updatedAt: "__ts",
      },
      { merge: true }
    );
    expect(loggerSpies.info).toHaveBeenCalledWith(
      "Awarded Hack-a-Sprint 2026 showcase badge",
      expect.objectContaining({ githubLogin: "alice", userId: "u1" })
    );
  });
});

describe("userIsHackASprint2026JudgeFromUserData", () => {
  it("returns true for a uid on the allowlist (ignores email check)", () => {
    mockJudgeUidSet.add("u1");
    expect(userIsHackASprint2026JudgeFromUserData("u1", null, undefined)).toBe(true);
  });

  it("returns false when the email allowlist is empty and uid not present", () => {
    expect(userIsHackASprint2026JudgeFromUserData("u1", "x@x.com", { email: "x@x.com" })).toBe(
      false
    );
  });

  it("returns true when token email matches the allowlist (case + whitespace insensitive)", () => {
    mockJudgeEmailSet.add("judge@example.com");
    expect(
      userIsHackASprint2026JudgeFromUserData("u1", "  JUDGE@example.com  ", undefined)
    ).toBe(true);
  });

  it("returns true when profile email matches", () => {
    mockJudgeEmailSet.add("judge@example.com");
    expect(
      userIsHackASprint2026JudgeFromUserData("u1", null, { email: "Judge@Example.com" })
    ).toBe(true);
  });

  it("returns true when a verified additional email matches", () => {
    mockJudgeEmailSet.add("alt@example.com");
    expect(
      userIsHackASprint2026JudgeFromUserData("u1", null, {
        additionalEmails: [
          { email: "skip@example.com", verified: false },
          { email: "alt@example.com", verified: true },
        ],
      })
    ).toBe(true);
  });

  it("ignores unverified additional emails even when they match", () => {
    mockJudgeEmailSet.add("alt@example.com");
    expect(
      userIsHackASprint2026JudgeFromUserData("u1", null, {
        additionalEmails: [{ email: "alt@example.com", verified: false }],
      })
    ).toBe(false);
  });

  it("returns false when no candidate matches the allowlist", () => {
    mockJudgeEmailSet.add("ad@example.com");
    expect(
      userIsHackASprint2026JudgeFromUserData("u1", "other@x.com", { email: "different@x.com" })
    ).toBe(false);
  });

  it("treats non-string email fields safely", () => {
    mockJudgeEmailSet.add("any@example.com");
    expect(
      userIsHackASprint2026JudgeFromUserData("u1", null, {
        email: 42 as unknown as string,
        additionalEmails: [{ verified: true } as unknown as { email: string }],
      })
    ).toBe(false);
  });
});

describe("userIsHackASprint2026Judge", () => {
  it("loads user doc and delegates to the pure helper", async () => {
    mockJudgeEmailSet.add("judge@example.com");
    const usersDoc = {
      get: jest.fn().mockResolvedValueOnce({
        data: () => ({ email: "JUDGE@example.com" }),
      }),
    };
    const db = {
      collection: jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue(usersDoc),
      }),
    } as unknown as Parameters<typeof userIsHackASprint2026Judge>[0];
    expect(await userIsHackASprint2026Judge(db, "u1")).toBe(true);
  });

  it("forwards the optional token email when provided", async () => {
    mockJudgeEmailSet.add("token@example.com");
    const usersDoc = {
      get: jest.fn().mockResolvedValueOnce({ data: () => ({}) }),
    };
    const db = {
      collection: jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue(usersDoc),
      }),
    } as unknown as Parameters<typeof userIsHackASprint2026Judge>[0];
    expect(await userIsHackASprint2026Judge(db, "u1", "token@example.com")).toBe(true);
  });
});
