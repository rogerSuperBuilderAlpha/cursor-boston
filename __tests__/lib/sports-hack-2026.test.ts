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

  it("is capped at 119 confirmed seats (bumped 2026-05-22 to match available Cursor credits)", () => {
    expect(SPORTS_HACK_2026_CAPACITY).toBe(119);
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
    it("tier progression walks from hot → far as rank increases, with the bubble at the 119-seat cap", () => {
      expect(getSportsHack2026RankTier(1).tone).toBe("hot");
      expect(getSportsHack2026RankTier(15).tone).toBe("hot");
      expect(getSportsHack2026RankTier(16).tone).toBe("good");
      expect(getSportsHack2026RankTier(45).tone).toBe("good");
      expect(getSportsHack2026RankTier(46).tone).toBe("solid");
      expect(getSportsHack2026RankTier(90).tone).toBe("solid");
      expect(getSportsHack2026RankTier(91).tone).toBe("bubble");
      expect(getSportsHack2026RankTier(119).tone).toBe("bubble"); // exactly at the cap
      expect(getSportsHack2026RankTier(120).tone).toBe("close");
      expect(getSportsHack2026RankTier(150).tone).toBe("close");
      expect(getSportsHack2026RankTier(151).tone).toBe("climb");
      expect(getSportsHack2026RankTier(190).tone).toBe("climb");
      expect(getSportsHack2026RankTier(191).tone).toBe("far");
      expect(getSportsHack2026RankTier(1000).tone).toBe("far");
    });

    it("bubble/close copy references the capacity so it stays in sync with SPORTS_HACK_2026_CAPACITY", () => {
      expect(getSportsHack2026RankTier(110).detail).toContain(String(SPORTS_HACK_2026_CAPACITY));
      expect(getSportsHack2026RankTier(130).detail).toContain(String(SPORTS_HACK_2026_CAPACITY));
    });

    it("every tier has a non-empty label and detail", () => {
      for (const rank of [1, 20, 60, 100, 130, 170, 300]) {
        const t = getSportsHack2026RankTier(rank);
        expect(t.label.length).toBeGreaterThan(0);
        expect(t.detail.length).toBeGreaterThan(0);
      }
    });
  });
});
