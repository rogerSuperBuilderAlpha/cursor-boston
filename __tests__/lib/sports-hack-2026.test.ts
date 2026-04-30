/**
 * @jest-environment node
 */
import {
  SPORTS_HACK_2026_CAPACITY,
  SPORTS_HACK_2026_DECLINED_EMAILS,
  SPORTS_HACK_2026_EVENT_DATE,
  SPORTS_HACK_2026_EVENT_ID,
  SPORTS_HACK_2026_JUDGE_EMAILS,
  SPORTS_HACK_2026_LOCATION,
  SPORTS_HACK_2026_LUMA_EMBED_ID,
  SPORTS_HACK_2026_LUMA_SLUG,
  SPORTS_HACK_2026_LUMA_URL,
  SPORTS_HACK_2026_NAME,
  SPORTS_HACK_2026_SHORT_NAME,
  SPORTS_HACK_2026_TIMEZONE,
  SPORTS_HACK_2026_START_HOUR_ET,
  SPORTS_HACK_2026_END_HOUR_ET,
  getSportsHack2026RankTier,
} from "@/lib/sports-hack-2026";

describe("sports-hack-2026 constants", () => {
  it("uses the kebab-case event id shared across Firestore and API paths", () => {
    expect(SPORTS_HACK_2026_EVENT_ID).toBe("sports-hack-2026");
  });

  it("is capped at 80 confirmed seats (matches plan with user)", () => {
    expect(SPORTS_HACK_2026_CAPACITY).toBe(80);
  });

  it("points at the correct Luma slug + embed id for Boston Tech Week Sports Hack", () => {
    expect(SPORTS_HACK_2026_LUMA_SLUG).toBe("t5vseeed");
    expect(SPORTS_HACK_2026_LUMA_EMBED_ID).toBe("evt-tTiu9jkwv4jVVxx");
    expect(SPORTS_HACK_2026_LUMA_URL).toBe(`https://luma.com/${SPORTS_HACK_2026_LUMA_SLUG}`);
  });

  it("schedules for Tue May 26, 2026 ET, 10 AM – 4 PM", () => {
    expect(SPORTS_HACK_2026_EVENT_DATE).toBe("2026-05-26");
    expect(SPORTS_HACK_2026_TIMEZONE).toBe("America/New_York");
    expect(SPORTS_HACK_2026_START_HOUR_ET).toBe(10);
    expect(SPORTS_HACK_2026_END_HOUR_ET).toBe(16);
  });

  it("exposes human-readable event name + location for marketing copy", () => {
    expect(SPORTS_HACK_2026_NAME).toMatch(/Sports Hack/i);
    expect(SPORTS_HACK_2026_SHORT_NAME).toMatch(/Sports Hack/i);
    expect(SPORTS_HACK_2026_LOCATION).toMatch(/Cambridge/);
  });

  it("starts with empty judge/declined sets (fresh event, no inherited filters)", () => {
    // Intentionally empty until sports-hack picks named judges. See
    // lib/sports-hack-2026.ts — seeding the hack-a-sprint organizer here
    // caused Roger to be dropped from the Luma import, which was wrong.
    expect(SPORTS_HACK_2026_JUDGE_EMAILS.size).toBe(0);
    expect(SPORTS_HACK_2026_DECLINED_EMAILS.size).toBe(0);
  });

  describe("getSportsHack2026RankTier", () => {
    it("tier progression walks from hot → far as rank increases, with the bubble at the 80-seat cap", () => {
      expect(getSportsHack2026RankTier(1).tone).toBe("hot");
      expect(getSportsHack2026RankTier(10).tone).toBe("hot");
      expect(getSportsHack2026RankTier(11).tone).toBe("good");
      expect(getSportsHack2026RankTier(30).tone).toBe("good");
      expect(getSportsHack2026RankTier(31).tone).toBe("solid");
      expect(getSportsHack2026RankTier(60).tone).toBe("solid");
      expect(getSportsHack2026RankTier(61).tone).toBe("bubble");
      expect(getSportsHack2026RankTier(80).tone).toBe("bubble"); // exactly at the cap
      expect(getSportsHack2026RankTier(81).tone).toBe("close");
      expect(getSportsHack2026RankTier(100).tone).toBe("close");
      expect(getSportsHack2026RankTier(101).tone).toBe("climb");
      expect(getSportsHack2026RankTier(130).tone).toBe("climb");
      expect(getSportsHack2026RankTier(131).tone).toBe("far");
      expect(getSportsHack2026RankTier(1000).tone).toBe("far");
    });

    it("bubble/close copy references the capacity so it stays in sync with SPORTS_HACK_2026_CAPACITY", () => {
      expect(getSportsHack2026RankTier(75).detail).toContain(String(SPORTS_HACK_2026_CAPACITY));
      expect(getSportsHack2026RankTier(90).detail).toContain(String(SPORTS_HACK_2026_CAPACITY));
    });

    it("every tier has a non-empty label and detail", () => {
      for (const rank of [1, 15, 45, 70, 90, 120, 200]) {
        const t = getSportsHack2026RankTier(rank);
        expect(t.label.length).toBeGreaterThan(0);
        expect(t.detail.length).toBeGreaterThan(0);
      }
    });
  });
});
