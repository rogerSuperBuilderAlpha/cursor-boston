/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Hack-a-Sprint April 13, 2026 — America/New_York schedule (single source for UI + API).
 */

export const HACK_A_SPRINT_2026_TIMEZONE = "America/New_York";

/** Start of event day in ET for sanity checks */
export const HACK_A_SPRINT_2026_EVENT_DATE = "2026-04-13";

export type HackASprint2026Phase =
  | "preUnlock"
  | "passcodeUnlock"
  | "submissionOpen"
  | "peerVotingOpen"
  | "resultsOpen";

type PhaseBoundary = { hour: number; minute: number };

const BOUNDARIES: { phase: HackASprint2026Phase; at: PhaseBoundary }[] = [
  { phase: "preUnlock", at: { hour: 0, minute: 0 } },
  { phase: "passcodeUnlock", at: { hour: 17, minute: 0 } }, // 5:00 PM ET
  { phase: "submissionOpen", at: { hour: 18, minute: 30 } }, // 6:30 PM ET
  { phase: "peerVotingOpen", at: { hour: 19, minute: 15 } }, // 7:15 PM ET
  { phase: "resultsOpen", at: { hour: 19, minute: 45 } }, // 7:45 PM ET
];

/** NY wall-clock parts for a UTC instant */
function nyParts(date: Date): {
  ky: string;
  y: number;
  m: number;
  d: number;
  hour: number;
  minute: number;
  second: number;
} {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: HACK_A_SPRINT_2026_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const get = (t: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === t)?.value ?? "0";
  return {
    ky: `${get("year")}-${get("month")}-${get("day")}`,
    y: parseInt(get("year"), 10),
    m: parseInt(get("month"), 10),
    d: parseInt(get("day"), 10),
    hour: parseInt(get("hour"), 10),
    minute: parseInt(get("minute"), 10),
    second: parseInt(get("second"), 10),
  };
}

function minutesSinceMidnight(hour: number, minute: number, second: number): number {
  return hour * 60 + minute + second / 60;
}

/**
 * Returns the current Hack-a-Sprint phase for the given instant.
 * Before event day (ET): `preUnlock`. After results window on event day: `resultsOpen`.
 */
export function getHackASprint2026Phase(now: Date = new Date()): HackASprint2026Phase {
  const ny = nyParts(now);
  const [ey, em, ed] = HACK_A_SPRINT_2026_EVENT_DATE.split("-").map(Number);
  const eventDay =
    ny.y === ey && ny.m === em && ny.d === ed;
  const t = minutesSinceMidnight(ny.hour, ny.minute, ny.second);

  if (!eventDay) {
    if (
      ny.y > ey ||
      (ny.y === ey && ny.m > em) ||
      (ny.y === ey && ny.m === em && ny.d > ed)
    ) {
      return "resultsOpen";
    }
    return "preUnlock";
  }

  const b0 = BOUNDARIES[1]!; // 17:00
  const b1 = BOUNDARIES[2]!; // 18:30
  const b2 = BOUNDARIES[3]!; // 19:15
  const b3 = BOUNDARIES[4]!; // 19:45

  const t17 = minutesSinceMidnight(b0.at.hour, b0.at.minute, 0);
  const t1830 = minutesSinceMidnight(b1.at.hour, b1.at.minute, 0);
  const t1915 = minutesSinceMidnight(b2.at.hour, b2.at.minute, 0);
  const t1945 = minutesSinceMidnight(b3.at.hour, b3.at.minute, 0);

  if (t < t17) return "preUnlock";
  if (t < t1830) return "passcodeUnlock";
  if (t < t1915) return "submissionOpen";
  if (t < t1945) return "peerVotingOpen";
  return "resultsOpen";
}
