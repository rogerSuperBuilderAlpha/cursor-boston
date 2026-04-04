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
