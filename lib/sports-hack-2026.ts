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
 * Sports-hack-2026 keeps this set empty on purpose: this is a fresh event
 * with fresh registrants, so nobody from the hack-a-sprint judge list should
 * be auto-filtered from the leaderboard or the Luma import. If/when sports
 * hack picks named judges, add them here.
 */
export const SPORTS_HACK_2026_JUDGE_EMAILS: ReadonlySet<string> = new Set();

/**
 * Luma registrants who have declined — excluded from participant list.
 * Populated as organizers confirm declines from each Luma export.
 */
export const SPORTS_HACK_2026_DECLINED_EMAILS: ReadonlySet<string> = new Set();

/**
 * Pre-freeze rank tier for sports-hack-2026. Before the ranking snapshot
 * script runs, nobody has `confirmedAt` set — so the API would mark everyone
 * as "waitlisted", which reads as scary and inaccurate. Instead, show a
 * descriptive tier based on current rank vs. the 80-seat cap.
 *
 * Tones correspond to badge colors in the UI:
 *   "hot"    → emerald (strong)
 *   "good"   → emerald (softer)
 *   "solid"  → emerald (softest)
 *   "bubble" → amber
 *   "close"  → amber (warmer)
 *   "climb"  → orange
 *   "far"    → rose
 */
export type SportsHack2026RankTone =
  | "hot"
  | "good"
  | "solid"
  | "bubble"
  | "close"
  | "climb"
  | "far";

export interface SportsHack2026RankTier {
  label: string;
  detail: string;
  tone: SportsHack2026RankTone;
}

export function getSportsHack2026RankTier(rank: number): SportsHack2026RankTier {
  if (rank <= 10) {
    return {
      label: "🔥 On fire",
      detail: "You're at the top of the leaderboard — stay active and you're in.",
      tone: "hot",
    };
  }
  if (rank <= 30) {
    return {
      label: "💪 Looking great",
      detail: "Great position — a couple more PRs and you're locked in.",
      tone: "good",
    };
  }
  if (rank <= 60) {
    return {
      label: "👍 Solid — in the band",
      detail: "You're comfortably in the confirmed band. Keep the momentum.",
      tone: "solid",
    };
  }
  if (rank <= SPORTS_HACK_2026_CAPACITY) {
    return {
      label: "⚡ On the bubble",
      detail: `You're in the top ${SPORTS_HACK_2026_CAPACITY} but near the edge — a few more merges pads your lead before the freeze.`,
      tone: "bubble",
    };
  }
  if (rank <= 100) {
    return {
      label: "🎯 One good week away",
      detail: `Just outside the top ${SPORTS_HACK_2026_CAPACITY}. One productive week of PRs and you're in.`,
      tone: "close",
    };
  }
  if (rank <= 130) {
    return {
      label: "🚀 Climb mode",
      detail: `Needs a meaningful PR push to break into the top ${SPORTS_HACK_2026_CAPACITY}.`,
      tone: "climb",
    };
  }
  return {
    label: "🏋️ Heavy lift",
    detail: `A big PR push is required to climb into the top ${SPORTS_HACK_2026_CAPACITY}.`,
    tone: "far",
  };
}
