/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { HACK_A_SPRINT_2026_EVENT_ID } from "@/lib/hackathon-showcase";

export type SubmissionIdentity = {
  submissionId: string;
  githubLogin: string;
};

export function hackASprint2026ParticipantScoresDocId(userId: string): string {
  return `${HACK_A_SPRINT_2026_EVENT_ID}__${userId}`;
}

/** Integers 1–10 only. */
export function normalizeParticipantScores(
  raw: Record<string, unknown> | undefined
): Record<string, number> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    const n = Number(v);
    if (Number.isInteger(n) && n >= 1 && n <= 10) {
      out[k.toLowerCase()] = n;
    }
  }
  return out;
}

export function participantBallotComplete(
  scores: Record<string, number> | undefined,
  ownGithubLogin: string,
  allSubmissions: SubmissionIdentity[]
): boolean {
  const own = ownGithubLogin.trim().toLowerCase();
  const others = allSubmissions.filter(
    (s) => s.githubLogin.trim().toLowerCase() !== own
  );
  if (others.length === 0) return true;
  if (!scores) return false;
  for (const s of others) {
    const sid = s.submissionId.trim().toLowerCase();
    const v = scores[sid];
    if (typeof v !== "number" || v < 1 || v > 10) return false;
  }
  return true;
}

/**
 * Prize eligibility: at least `min(6, #other submissions)` scores strictly above 8 on others.
 */
export function participantPrizeEligibility(
  scores: Record<string, number> | undefined,
  ownGithubLogin: string,
  allSubmissions: SubmissionIdentity[]
): {
  eligible: boolean;
  highScoreCount: number;
  requiredHighScores: number;
} {
  const own = ownGithubLogin.trim().toLowerCase();
  const others = allSubmissions.filter(
    (s) => s.githubLogin.trim().toLowerCase() !== own
  );
  const requiredHighScores = Math.min(6, others.length);
  if (requiredHighScores === 0) {
    return { eligible: true, highScoreCount: 0, requiredHighScores: 0 };
  }
  if (!scores) {
    return { eligible: false, highScoreCount: 0, requiredHighScores };
  }
  let highScoreCount = 0;
  for (const s of others) {
    const sid = s.submissionId.trim().toLowerCase();
    const v = scores[sid];
    if (typeof v === "number" && v > 8) highScoreCount++;
  }
  return {
    eligible: highScoreCount >= requiredHighScores,
    highScoreCount,
    requiredHighScores,
  };
}

/**
 * Mean peer score per submission (1–10), excluding the submitter's own scores.
 * `voterGithubByUid` maps voter userId -> lowercase github login.
 */
export function computePeerAverages(
  submissions: SubmissionIdentity[],
  voterDocs: Array<{ userId: string; scores: Record<string, number> }>,
  voterGithubByUid: Map<string, string>
): Map<string, number | null> {
  const sums = new Map<string, number>();
  const counts = new Map<string, number>();
  for (const s of submissions) {
    const sid = s.submissionId.toLowerCase();
    sums.set(sid, 0);
    counts.set(sid, 0);
  }

  for (const doc of voterDocs) {
    const voterGh = (voterGithubByUid.get(doc.userId) ?? "").toLowerCase();
    for (const s of submissions) {
      const sid = s.submissionId.toLowerCase();
      const submitterGh = s.githubLogin.toLowerCase();
      if (!voterGh || voterGh === submitterGh) continue;
      const sc = doc.scores[sid];
      if (typeof sc !== "number") continue;
      sums.set(sid, (sums.get(sid) ?? 0) + sc);
      counts.set(sid, (counts.get(sid) ?? 0) + 1);
    }
  }

  const out = new Map<string, number | null>();
  for (const s of submissions) {
    const sid = s.submissionId.toLowerCase();
    const c = counts.get(sid) ?? 0;
    if (c === 0) {
      out.set(sid, null);
    } else {
      out.set(sid, (sums.get(sid) ?? 0) / c);
    }
  }
  return out;
}
