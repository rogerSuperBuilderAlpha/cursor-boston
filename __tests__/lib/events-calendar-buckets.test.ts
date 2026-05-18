/**
 * @jest-environment node
 */
import {
  EVENTS_LISTING_TIMEZONE,
  partitionEventsForBrowse,
  todayYmdInListingTz,
} from "@/lib/events-calendar-buckets";
import type { Event } from "@/types/events";

const mkEvent = (overrides: Partial<Event>): Event =>
  ({
    id: "e-1",
    title: "Test",
    date: "2026-06-01",
    ...overrides,
  } as unknown as Event);

describe("events-calendar-buckets", () => {
  describe("EVENTS_LISTING_TIMEZONE", () => {
    it("is America/New_York for Boston-area listings", () => {
      expect(EVENTS_LISTING_TIMEZONE).toBe("America/New_York");
    });
  });

  describe("todayYmdInListingTz", () => {
    it("returns YYYY-MM-DD format", () => {
      const ymd = todayYmdInListingTz(new Date("2026-06-15T20:00:00Z"));
      expect(ymd).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("uses the listing timezone (Eastern) by default", () => {
      // 2026-06-15 03:00 UTC == 2026-06-14 23:00 ET (still 2026-06-14 in Boston)
      expect(todayYmdInListingTz(new Date("2026-06-15T03:00:00Z"))).toBe("2026-06-14");
    });

    it("supports a custom timezone", () => {
      // Tokyo is UTC+9; 2026-06-14 23:00 UTC == 2026-06-15 08:00 in Tokyo
      expect(
        todayYmdInListingTz(new Date("2026-06-14T23:00:00Z"), "Asia/Tokyo")
      ).toBe("2026-06-15");
    });
  });

  describe("partitionEventsForBrowse", () => {
    const today = "2026-06-15";

    it("splits events into today / future / past correctly", () => {
      const events = [
        mkEvent({ id: "today-1", date: "2026-06-15", title: "Today event" }),
        mkEvent({ id: "future-1", date: "2026-07-01", title: "Future event" }),
        mkEvent({ id: "past-1", date: "2026-05-01", title: "Past event" }),
      ];
      const { today: t, future: f, past: p } = partitionEventsForBrowse(events, today);
      expect(t.map((e) => e.id)).toEqual(["today-1"]);
      expect(f.map((e) => e.id)).toEqual(["future-1"]);
      expect(p.map((e) => e.id)).toEqual(["past-1"]);
    });

    it("treats TBD events as future", () => {
      const events = [mkEvent({ id: "tbd-1", date: "TBD", title: "Maybe" } as unknown as Partial<Event>)];
      const { future } = partitionEventsForBrowse(events, today);
      expect(future.map((e) => e.id)).toEqual(["tbd-1"]);
    });

    it("uses only the date prefix (ignores time-of-day)", () => {
      const events = [
        mkEvent({ id: "today-with-time", date: "2026-06-15T18:00:00Z" } as unknown as Partial<Event>),
      ];
      const { today: t } = partitionEventsForBrowse(events, today);
      expect(t.map((e) => e.id)).toEqual(["today-with-time"]);
    });

    it("de-duplicates by event.id (first wins)", () => {
      const events = [
        mkEvent({ id: "dup", date: "2026-07-01", title: "first" }),
        mkEvent({ id: "dup", date: "2026-08-01", title: "second" }),
      ];
      const { future } = partitionEventsForBrowse(events, today);
      expect(future).toHaveLength(1);
      expect(future[0].title).toBe("first");
    });

    it("sorts future events ascending by date, then by title case-insensitively", () => {
      const events = [
        mkEvent({ id: "f3", date: "2026-08-01", title: "beta" }),
        mkEvent({ id: "f1", date: "2026-07-01", title: "Charlie" }),
        mkEvent({ id: "f2", date: "2026-07-01", title: "alpha" }),
      ];
      const { future } = partitionEventsForBrowse(events, today);
      expect(future.map((e) => e.id)).toEqual(["f2", "f1", "f3"]);
    });

    it("places TBD events at the end of the future list", () => {
      const events = [
        mkEvent({ id: "tbd", date: "TBD" } as unknown as Partial<Event>),
        mkEvent({ id: "real", date: "2026-07-01" }),
      ];
      const { future } = partitionEventsForBrowse(events, today);
      expect(future.map((e) => e.id)).toEqual(["real", "tbd"]);
    });

    it("sorts past events descending by date, then by title", () => {
      const events = [
        mkEvent({ id: "p1", date: "2026-04-01", title: "older" }),
        mkEvent({ id: "p2", date: "2026-05-01", title: "newer" }),
        mkEvent({ id: "p3", date: "2026-05-01", title: "Also newer" }),
      ];
      const { past } = partitionEventsForBrowse(events, today);
      expect(past.map((e) => e.id)).toEqual(["p3", "p2", "p1"]);
    });
  });
});
