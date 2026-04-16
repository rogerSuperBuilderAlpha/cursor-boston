/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { HACK_A_SPRINT_2026_TIMEZONE } from "@/lib/hackathon-asprint-2026-schedule";

/**
 * GitHub logins (lowercase) for human judges' top picks — one badge each if they appear in the gallery.
 * (If someone has not merged a submission JSON, they will not show a card or badge.)
 */
export const HACK_A_SPRINT_2026_JUDGES_PICK_GITHUB_LOGINS = [
  "michaelrschulte",
  "zombiedays",
] as const;

/** How many additional submissions win strictly from AI rank (excluding judges' pick). */
export const HACK_A_SPRINT_2026_AI_JUDGED_WINNER_COUNT = 2;

/**
 * How many peer-review winners after the reveal instant (by mean peer score, highest first).
 * Excludes anyone who already has a judges' pick or an AI-judged slot.
 */
export const HACK_A_SPRINT_2026_PEER_REVIEW_WINNER_COUNT = 2;

/** Wall time in America/New_York when peer-review winner badges appear (event week Friday, 12:00). */
export const HACK_A_SPRINT_2026_PEER_AWARDS_REVEAL_NY = {
  year: 2026,
  month: 4,
  day: 17,
  hour: 12,
  minute: 0,
} as const;

export type ShowcaseAwardKind =
  | "judgesWinner"
  | "aiJudgedWinner"
  | "peerReviewWinner";

export const SHOWCASE_AWARD_LABEL: Record<ShowcaseAwardKind, string> = {
  judgesWinner: "Judges winner",
  aiJudgedWinner: "AI judged winner",
  peerReviewWinner: "Peer review winner",
};

export type ShowcaseAwardInput = {
  submissionId: string;
  githubLogin: string;
  aiRank: number | null;
  aiScore: number | null;
  peerAverage: number | null;
};

/**
 * UTC instant for a fixed calendar date + clock time interpreted in `America/New_York`
 * (handles EST/EDT). Used for the peer-review winner reveal.
 */
export function hackASprint2026ZonedWallTimeToUtcMs(
  timeZone: string,
  y: number,
  m: number,
  d: number,
  hour: number,
  minute: number
): number {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const low = Date.UTC(y, m - 1, d - 1);
  const high = Date.UTC(y, m - 1, d + 2);
  for (let t = low; t < high; t += 60_000) {
    const parts = formatter.formatToParts(new Date(t));
    const get = (ty: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((p) => p.type === ty)?.value ?? "0");
    if (
      get("year") === y &&
      get("month") === m &&
      get("day") === d &&
      get("hour") === hour &&
      get("minute") === minute
    ) {
      return t;
    }
  }
  return Date.UTC(y, m - 1, d, 16, minute, 0);
}

function normGh(login: string): string {
  return login.trim().toLowerCase();
}

function normSid(id: string): string {
  return id.trim().toLowerCase();
}

function peerRevealUtcMs(): number {
  const raw =
    process.env.NEXT_PUBLIC_HACK_A_SPRINT_2026_PEER_AWARDS_REVEAL_AT?.trim() ||
    process.env.HACK_A_SPRINT_2026_PEER_AWARDS_REVEAL_AT?.trim();
  if (raw) {
    const ms = Date.parse(raw);
    if (!Number.isNaN(ms)) return ms;
  }
  const z = HACK_A_SPRINT_2026_PEER_AWARDS_REVEAL_NY;
  return hackASprint2026ZonedWallTimeToUtcMs(
    HACK_A_SPRINT_2026_TIMEZONE,
    z.year,
    z.month,
    z.day,
    z.hour,
    z.minute
  );
}

export function isHackASprint2026PeerAwardsRevealed(now: Date = new Date()): boolean {
  return now.getTime() >= peerRevealUtcMs();
}

/**
 * Deterministic awards for the public gallery. One GitHub login cannot receive more than one award.
 * Order: judges' picks → AI-judged (by AI rank) → peer review (by peer average) after reveal time.
 */
export function computeShowcaseAwards(
  rows: ShowcaseAwardInput[],
  now: Date = new Date()
): Map<string, ShowcaseAwardKind[]> {
  const out = new Map<string, ShowcaseAwardKind[]>();
  const excluded = new Set<string>();

  const byLogin = new Map<string, ShowcaseAwardInput>();
  for (const r of rows) {
    byLogin.set(normGh(r.githubLogin), r);
  }

  for (const pick of HACK_A_SPRINT_2026_JUDGES_PICK_GITHUB_LOGINS) {
    const judgesGh = normGh(pick);
    const judgesRow = byLogin.get(judgesGh);
    if (judgesRow) {
      const sid = normSid(judgesRow.submissionId);
      out.set(sid, ["judgesWinner"]);
      excluded.add(judgesGh);
    }
  }

  const aiOrdered = [...rows].sort((a, b) => {
    const ra = a.aiRank ?? Number.POSITIVE_INFINITY;
    const rb = b.aiRank ?? Number.POSITIVE_INFINITY;
    if (ra !== rb) return ra - rb;
    const sa = a.aiScore ?? -1;
    const sb = b.aiScore ?? -1;
    if (sb !== sa) return sb - sa;
    return normSid(a.submissionId).localeCompare(normSid(b.submissionId));
  });

  let aiSlots = 0;
  for (const r of aiOrdered) {
    if (aiSlots >= HACK_A_SPRINT_2026_AI_JUDGED_WINNER_COUNT) break;
    const gh = normGh(r.githubLogin);
    if (excluded.has(gh)) continue;
    if (r.aiRank == null && r.aiScore == null) continue;
    const sid = normSid(r.submissionId);
    const prev = out.get(sid) ?? [];
    out.set(sid, [...prev, "aiJudgedWinner"]);
    excluded.add(gh);
    aiSlots++;
  }

  if (!isHackASprint2026PeerAwardsRevealed(now)) {
    return out;
  }

  const peerOrdered = [...rows].sort((a, b) => {
    const pa = a.peerAverage;
    const pb = b.peerAverage;
    if (pa == null && pb == null) return normSid(a.submissionId).localeCompare(normSid(b.submissionId));
    if (pa == null) return 1;
    if (pb == null) return -1;
    if (pb !== pa) return pb - pa;
    return normSid(a.submissionId).localeCompare(normSid(b.submissionId));
  });

  let peerSlots = 0;
  for (const r of peerOrdered) {
    if (peerSlots >= HACK_A_SPRINT_2026_PEER_REVIEW_WINNER_COUNT) break;
    const gh = normGh(r.githubLogin);
    if (excluded.has(gh)) continue;
    if (r.peerAverage == null) continue;
    const sid = normSid(r.submissionId);
    const prev = out.get(sid) ?? [];
    out.set(sid, [...prev, "peerReviewWinner"]);
    excluded.add(gh);
    peerSlots++;
  }

  return out;
}

export function showcaseAwardLabelsForRow(
  awards: Map<string, ShowcaseAwardKind[]>,
  submissionId: string
): string[] {
  const kinds = awards.get(normSid(submissionId)) ?? [];
  return kinds.map((k) => SHOWCASE_AWARD_LABEL[k]);
}
