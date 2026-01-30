/**
 * Hackathon helpers: virtual month IDs (Boston time), eligibility, etc.
 */

const BOSTON_TZ = "America/New_York";

/**
 * Get current date in Boston time (for virtual hackathon month).
 */
export function getNowInBoston(): Date {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: BOSTON_TZ })
  );
}

/**
 * Get the current virtual hackathon ID (e.g. "virtual-2025-01").
 * Virtual hackathons run 1st–last day of month in Boston time.
 */
export function getCurrentVirtualHackathonId(): string {
  const now = getNowInBoston();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `virtual-${y}-${m}`;
}

/**
 * Get virtual hackathon ID for a given date in Boston time.
 */
export function getVirtualHackathonIdForDate(date: Date): string {
  const inBoston = new Date(
    date.toLocaleString("en-US", { timeZone: BOSTON_TZ })
  );
  const y = inBoston.getFullYear();
  const m = String(inBoston.getMonth() + 1).padStart(2, "0");
  return `virtual-${y}-${m}`;
}

/**
 * Whether the given ID is a virtual hackathon (monthly) ID.
 */
export function isVirtualHackathonId(hackathonId: string): boolean {
  return /^virtual-\d{4}-\d{2}$/.test(hackathonId);
}

/**
 * Last day of the virtual hackathon month (23:59:59.999) for display.
 * Uses year/month from hackathonId (e.g. virtual-2025-01 -> Jan 31, 2025).
 */
export function getMonthEndFromVirtualId(hackathonId: string): Date {
  const match = hackathonId.match(/^virtual-(\d{4})-(\d{2})$/);
  if (!match) return new Date();
  const year = parseInt(match[1], 10);
  const month1 = parseInt(match[2], 10);
  return new Date(year, month1, 0, 23, 59, 59, 999);
}

/**
 * Start and end of virtual hackathon month in UTC (for comparing with GitHub created_at).
 * Start = 1st 00:00 Boston -> UTC; end = last day 23:59 Boston -> UTC.
 * Uses approximate EST/EDT: EST = UTC-5, EDT = UTC-4.
 */
export function getVirtualMonthStartEndUtc(hackathonId: string): { start: Date; end: Date } | null {
  const match = hackathonId.match(/^virtual-(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const month1 = parseInt(match[2], 10);
  const month0 = month1 - 1;
  const start = new Date(Date.UTC(year, month0, 1, 5, 0, 0, 0));
  const end = new Date(Date.UTC(year, month0 + 1, 0, 4, 59, 59, 999));
  return { start, end };
}

/**
 * Start of current virtual hackathon month (Boston, 00:00:00).
 */
export function getCurrentVirtualMonthStart(): Date {
  const now = getNowInBoston();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/**
 * End of current virtual hackathon month (Boston, last day 23:59:59.999).
 */
export function getCurrentVirtualMonthEnd(): Date {
  const now = getNowInBoston();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
}

/**
 * Cutoff for submissions: 1st of next month 00:00:00 America/New_York.
 * Commits after this disqualify. Returns UTC Date (EST: +5h, EDT: +4h).
 */
export function getSubmissionCutoffForMonth(year: number, month1Based: number): Date {
  const nextMonth = month1Based === 12 ? 1 : month1Based + 1;
  const nextYear = month1Based === 12 ? year + 1 : year;
  const month0 = nextMonth - 1;
  const utcHour = 5; // 00:00 EST = 05:00 UTC; EDT would be 04:00, this is conservative
  return new Date(Date.UTC(nextYear, month0, 1, utcHour, 0, 0, 0));
}
