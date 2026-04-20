/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

export const SPORTS_HACK_2026_EVENT_ID = "sports-hack-2026";

export const SPORTS_HACK_2026_NAME = "Boston Tech Week Sports Hack";
export const SPORTS_HACK_2026_SHORT_NAME = "Sports Hack 2026";

export const SPORTS_HACK_2026_LUMA_SLUG = "t5vseeed";
export const SPORTS_HACK_2026_LUMA_EMBED_ID = "evt-tTiu9jkwv4jVVxx";
export const SPORTS_HACK_2026_LUMA_URL = `https://luma.com/${SPORTS_HACK_2026_LUMA_SLUG}`;

export const SPORTS_HACK_2026_CAPACITY = 80;
export const SPORTS_HACK_2026_TIMEZONE = "America/New_York";
export const SPORTS_HACK_2026_EVENT_DATE = "2026-05-26";
export const SPORTS_HACK_2026_START_HOUR_ET = 10;
export const SPORTS_HACK_2026_END_HOUR_ET = 16;
export const SPORTS_HACK_2026_LOCATION = "Cambridge, MA";

/**
 * Organizer / judge emails — used to keep organizers off the participant list
 * and to bypass door check-in gates for their own accounts. Add more via the
 * `SPORTS_HACK_2026_JUDGE_EMAILS` env var (comma-separated, case-insensitive).
 */
export const SPORTS_HACK_2026_JUDGE_EMAILS: ReadonlySet<string> = new Set([
  "regorhunt02052@gmail.com",
]);

/**
 * Luma registrants who have declined — excluded from participant list.
 * Populated as organizers confirm declines from each Luma export.
 */
export const SPORTS_HACK_2026_DECLINED_EMAILS: ReadonlySet<string> = new Set();
