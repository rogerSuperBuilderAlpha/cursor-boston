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

  it("seeds judge set with organizer email and keeps declined set empty until Luma exports arrive", () => {
    expect(SPORTS_HACK_2026_JUDGE_EMAILS.has("regorhunt02052@gmail.com")).toBe(true);
    expect(SPORTS_HACK_2026_DECLINED_EMAILS.size).toBe(0);
  });
});
