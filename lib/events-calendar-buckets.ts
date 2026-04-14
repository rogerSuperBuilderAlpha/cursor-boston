/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { Event } from "@/types/events";

/** Calendar day boundary for Boston-area listings. */
export const EVENTS_LISTING_TIMEZONE = "America/New_York";

export function todayYmdInListingTz(
  now: Date = new Date(),
  timeZone: string = EVENTS_LISTING_TIMEZONE
): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * Split events into today / future / past by calendar date in `EVENTS_LISTING_TIMEZONE`.
 * Pass `listingTodayYmd` from the server (e.g. `todayYmdInListingTz(new Date())`) so SSR and
 * the client hydrate identically — using `new Date()` only on the client breaks tab interactivity.
 * `TBD` dates are treated as future. De-duplicates by `event.id` (first wins).
 */
export function partitionEventsForBrowse(
  events: Event[],
  listingTodayYmd: string
): { today: Event[]; future: Event[]; past: Event[] } {
  const todayYmd = listingTodayYmd;
  const today: Event[] = [];
  const future: Event[] = [];
  const past: Event[] = [];
  const seen = new Set<string>();

  for (const event of events) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);

    if (event.date === "TBD") {
      future.push(event);
      continue;
    }
    const ymd = event.date.slice(0, 10);
    if (ymd === todayYmd) today.push(event);
    else if (ymd > todayYmd) future.push(event);
    else past.push(event);
  }

  const futureSort = (a: Event, b: Event) => {
    if (a.date === "TBD" && b.date !== "TBD") return 1;
    if (b.date === "TBD" && a.date !== "TBD") return -1;
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.title.localeCompare(b.title, "en", { sensitivity: "base" });
  };

  const pastSort = (a: Event, b: Event) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return a.title.localeCompare(b.title, "en", { sensitivity: "base" });
  };

  today.sort(futureSort);
  future.sort(futureSort);
  past.sort(pastSort);

  return { today, future, past };
}
