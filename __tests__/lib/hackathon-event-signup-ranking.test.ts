/**
 * @jest-environment node
 *
 * Complement to __tests__/lib/hackathon-event-signup.test.ts. Targets
 * the previously-uncovered branches (compareUnifiedHackathonRanking,
 * the remaining branches of getHackathonEventSignupBlockReason, and
 * the per-event capacity / signup-doc-id helpers).
 */
import {
  CURSOR_CREDIT_TOP_N,
  compareUnifiedHackathonRanking,
  getConfirmedCapacityForEvent,
  getHackathonEventSignupBlockReason,
  hackathonEventSignupDocId,
} from "@/lib/hackathon-event-signup";
import {
  SPORTS_HACK_2026_CAPACITY,
  SPORTS_HACK_2026_EVENT_ID,
} from "@/lib/sports-hack-2026";

describe("hackathon-event-signup ranking + capacity", () => {
  describe("hackathonEventSignupDocId", () => {
    it("composes eventId__userId", () => {
      expect(hackathonEventSignupDocId("ev", "u")).toBe("ev__u");
    });
  });

  describe("getConfirmedCapacityForEvent", () => {
    it("returns sports-hack capacity for sports-hack-2026", () => {
      expect(getConfirmedCapacityForEvent(SPORTS_HACK_2026_EVENT_ID)).toBe(
        SPORTS_HACK_2026_CAPACITY
      );
    });

    it("falls back to CURSOR_CREDIT_TOP_N for any other event", () => {
      expect(getConfirmedCapacityForEvent("any-other")).toBe(CURSOR_CREDIT_TOP_N);
    });
  });

  describe("getHackathonEventSignupBlockReason — remaining branches", () => {
    const baseOk = {
      visibility: { isPublic: true, showDiscord: true },
      github: { login: "alice" },
      discord: { username: "alice#1" },
    } as Record<string, unknown>;

    it("blocks when github is missing", () => {
      expect(getHackathonEventSignupBlockReason({
        ...baseOk,
        github: undefined,
      })).toContain("Connect GitHub");
    });

    it("blocks when discord is missing", () => {
      expect(getHackathonEventSignupBlockReason({
        ...baseOk,
        discord: undefined,
      })).toContain("Connect Discord");
    });

    it("blocks when showDiscord is off", () => {
      expect(getHackathonEventSignupBlockReason({
        ...baseOk,
        visibility: { isPublic: true, showDiscord: false },
      })).toContain("Show Discord");
    });
  });

  describe("compareUnifiedHackathonRanking", () => {
    const row = (
      mergedPrCount: number,
      source: "website" | "luma_only",
      signedUpAtMs: number
    ) => ({ mergedPrCount, source, signedUpAtMs });

    it("higher mergedPrCount sorts before lower", () => {
      expect(compareUnifiedHackathonRanking(row(5, "website", 0), row(3, "website", 0))).toBeLessThan(0);
      expect(compareUnifiedHackathonRanking(row(3, "website", 0), row(5, "website", 0))).toBeGreaterThan(0);
    });

    it("at equal PR count, website sorts before luma_only", () => {
      expect(
        compareUnifiedHackathonRanking(row(5, "website", 1000), row(5, "luma_only", 0))
      ).toBeLessThan(0);
      expect(
        compareUnifiedHackathonRanking(row(5, "luma_only", 0), row(5, "website", 1000))
      ).toBeGreaterThan(0);
    });

    it("at equal PR count and source, earlier signup sorts first", () => {
      expect(
        compareUnifiedHackathonRanking(row(5, "website", 100), row(5, "website", 200))
      ).toBeLessThan(0);
    });

    it("returns 0 for fully-equal rows", () => {
      expect(
        compareUnifiedHackathonRanking(row(5, "website", 100), row(5, "website", 100))
      ).toBe(0);
    });

    it("sorts a small array stably using the comparator", () => {
      const rows = [
        row(3, "website", 100),
        row(5, "luma_only", 50),
        row(5, "website", 200),
        row(5, "website", 100),
      ];
      const sorted = [...rows].sort(compareUnifiedHackathonRanking);
      // 5-website-100, 5-website-200, 5-luma-50, 3-website-100
      expect(sorted[0]).toEqual(row(5, "website", 100));
      expect(sorted[1]).toEqual(row(5, "website", 200));
      expect(sorted[2]).toEqual(row(5, "luma_only", 50));
      expect(sorted[3]).toEqual(row(3, "website", 100));
    });
  });
});
