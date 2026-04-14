/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { HACK_A_SPRINT_2026_EVENT_ID } from "@/lib/hackathon-showcase";
import { hackASprint2026ScoreDocId } from "@/lib/hackathon-asprint-2026-state";

/**
 * rawScore: ceil((avg(judges) + ai) / 2) when both exist;
 * if only one side exists, ceil that side alone.
 */
export function computeHackASprint2026RawScore(
  aiScore: number | null | undefined,
  judgeScores: Record<string, number> | undefined
): number | null {
  const judges = judgeScores
    ? Object.values(judgeScores).filter(
        (n) => typeof n === "number" && n >= 1 && n <= 10
      )
    : [];
  const judgeAvg =
    judges.length > 0
      ? judges.reduce((a, b) => a + b, 0) / judges.length
      : null;
  const ai =
    typeof aiScore === "number" && aiScore >= 1 && aiScore <= 10
      ? aiScore
      : null;

  if (judgeAvg != null && ai != null) {
    return Math.ceil((judgeAvg + ai) / 2);
  }
  if (judgeAvg != null) return Math.ceil(judgeAvg);
  if (ai != null) return Math.ceil(ai);
  return null;
}

/**
 * Competition-style ranks by AI score (1 = best). Tied scores share the same rank;
 * the next distinct score skips (e.g. two10s → rank 1, next9 → rank 3).
 */
export function computeAiRanksBySubmissionId(
  submissionIds: string[],
  aiScoreBySubmissionId: Map<string, number | null>
): Map<string, number> {
  const scored: { submissionId: string; score: number }[] = [];
  for (const submissionId of submissionIds) {
    const score = aiScoreBySubmissionId.get(submissionId);
    if (typeof score === "number" && score >= 1 && score <= 10) {
      scored.push({ submissionId, score });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  const rankById = new Map<string, number>();
  let i = 0;
  while (i < scored.length) {
    const score = scored[i]!.score;
    let j = i;
    while (j < scored.length && scored[j]!.score === score) {
      j++;
    }
    const rank = i + 1;
    for (let k = i; k < j; k++) {
      rankById.set(scored[k]!.submissionId, rank);
    }
    i = j;
  }
  return rankById;
}

export async function ensureHackASprint2026ScoreDoc(
  db: Firestore,
  submissionId: string
): Promise<void> {
  const sid = submissionId.toLowerCase();
  const ref = db
    .collection("hackathonShowcaseScores")
    .doc(hackASprint2026ScoreDocId(sid));
  await ref.set(
    {
      eventId: HACK_A_SPRINT_2026_EVENT_ID,
      submissionId: sid,
      aiScore: null,
      judgeScores: {},
      peerVoteCount: 0,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}
