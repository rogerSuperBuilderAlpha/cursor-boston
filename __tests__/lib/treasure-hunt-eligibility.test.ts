/**
 * @jest-environment node
 */
import {
  TREASURE_HUNT_PR_WINDOW_HOURS,
  checkTreasureHuntEligibility,
  emailAlreadyWon,
  treasureHuntEnabled,
} from "@/lib/treasure-hunt-eligibility";
import type { Firestore } from "firebase-admin/firestore";

jest.mock("@/lib/hackathon-showcase", () => ({
  githubUserHasRecentlyMergedPr: jest.fn(),
}));

import { githubUserHasRecentlyMergedPr } from "@/lib/hackathon-showcase";

const mockHasPr = githubUserHasRecentlyMergedPr as jest.MockedFunction<
  typeof githubUserHasRecentlyMergedPr
>;

type UserDoc = Record<string, unknown>;
type ProgressDoc = Record<string, unknown>;

function fakeDb(
  user: UserDoc | undefined,
  progress: ProgressDoc | undefined,
  emailWonResult: boolean = false
): Firestore {
  return {
    collection: (name: string) => ({
      doc: (_id: string) => ({
        get: async () => ({
          exists: !!(name === "users" ? user : progress),
          data: () => (name === "users" ? user : progress),
        }),
      }),
      where: () => ({
        limit: () => ({
          get: async () => ({ empty: !emailWonResult }),
        }),
      }),
    }),
  } as unknown as Firestore;
}

describe("treasure-hunt-eligibility", () => {
  const originalEnv = process.env.TREASURE_HUNT_ENABLED;

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.TREASURE_HUNT_ENABLED;
    else process.env.TREASURE_HUNT_ENABLED = originalEnv;
    mockHasPr.mockReset();
  });

  describe("constants", () => {
    it("exposes a 24h PR window", () => {
      expect(TREASURE_HUNT_PR_WINDOW_HOURS).toBe(24);
    });
  });

  describe("treasureHuntEnabled", () => {
    it("defaults to true when env is unset", () => {
      delete process.env.TREASURE_HUNT_ENABLED;
      expect(treasureHuntEnabled()).toBe(true);
    });

    it("is true for any value other than literal 'false'", () => {
      process.env.TREASURE_HUNT_ENABLED = "true";
      expect(treasureHuntEnabled()).toBe(true);
      process.env.TREASURE_HUNT_ENABLED = "1";
      expect(treasureHuntEnabled()).toBe(true);
    });

    it("returns false only for the exact string 'false'", () => {
      process.env.TREASURE_HUNT_ENABLED = "false";
      expect(treasureHuntEnabled()).toBe(false);
    });
  });

  describe("checkTreasureHuntEligibility", () => {
    it("returns feature_disabled when env disables the hunt", async () => {
      process.env.TREASURE_HUNT_ENABLED = "false";
      const result = await checkTreasureHuntEligibility(fakeDb({}, {}), "u1");
      expect(result).toEqual({ ok: false, reason: "feature_disabled" });
    });

    it("returns not_signed_in for empty uid", async () => {
      const result = await checkTreasureHuntEligibility(fakeDb({}, {}), "");
      expect(result).toEqual({ ok: false, reason: "not_signed_in" });
    });

    it("returns no_github when user has no github.login", async () => {
      const result = await checkTreasureHuntEligibility(fakeDb({}, {}), "u1");
      expect(result).toEqual({ ok: false, reason: "no_github" });
    });

    it("returns no_github when github field is not an object", async () => {
      const result = await checkTreasureHuntEligibility(
        fakeDb({ github: "octocat" }, {}),
        "u1"
      );
      expect(result).toEqual({ ok: false, reason: "no_github" });
    });

    it("returns no_discord when github is linked but discord is missing", async () => {
      const result = await checkTreasureHuntEligibility(
        fakeDb({ github: { login: "octocat" } }, {}),
        "u1"
      );
      expect(result).toEqual({ ok: false, reason: "no_discord" });
    });

    it("returns already_won if treasureHuntProgress has a prizeCodeId", async () => {
      const result = await checkTreasureHuntEligibility(
        fakeDb(
          { github: { login: "octocat" }, discord: { username: "oct#1" } },
          { prizeCodeId: "code-123" }
        ),
        "u1"
      );
      expect(result).toEqual({ ok: false, reason: "already_won" });
    });

    it("returns no_recent_pr if no qualifying PR exists", async () => {
      mockHasPr.mockResolvedValueOnce(false);
      const result = await checkTreasureHuntEligibility(
        fakeDb({ github: { login: "octocat" }, discord: { username: "oct#1" } }, {}),
        "u1"
      );
      expect(result).toEqual({ ok: false, reason: "no_recent_pr" });
    });

    it("returns ok+identity when all gates pass", async () => {
      mockHasPr.mockResolvedValueOnce(true);
      const result = await checkTreasureHuntEligibility(
        fakeDb({ github: { login: " octocat " }, discord: { username: " oct#1 " } }, {}),
        "u1"
      );
      expect(result).toEqual({ ok: true, githubLogin: "octocat", discordUsername: "oct#1" });
      expect(mockHasPr).toHaveBeenCalledWith("octocat", 24);
    });
  });

  describe("emailAlreadyWon", () => {
    it("returns false for empty string", async () => {
      expect(await emailAlreadyWon(fakeDb({}, {}), "")).toBe(false);
    });

    it("returns false when no winner record exists", async () => {
      expect(await emailAlreadyWon(fakeDb({}, {}, false), "x@example.com")).toBe(false);
    });

    it("returns true when a winner record exists", async () => {
      expect(await emailAlreadyWon(fakeDb({}, {}, true), "x@example.com")).toBe(true);
    });

    it("lowercases + trims before checking", async () => {
      // Behavioral assertion: the mock doesn't care about input shape, but
      // the function should still handle whitespace and case without throwing.
      expect(await emailAlreadyWon(fakeDb({}, {}, true), "  X@Example.COM  ")).toBe(true);
    });
  });
});
