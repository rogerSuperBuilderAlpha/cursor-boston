import { NextRequest, NextResponse } from "next/server";
import type { DocumentData } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import {
  HACK_A_SPRINT_2026_EVENT_ID,
  fetchShowcaseSubmissionsFromGitHub,
  getJudgeUidSet,
} from "@/lib/hackathon-showcase";
import { getHackASprint2026Phase } from "@/lib/hackathon-asprint-2026-schedule";
import { computeHackASprint2026RawScore } from "@/lib/hackathon-asprint-2026-scores";
import { hackASprint2026ScoreDocId } from "@/lib/hackathon-asprint-2026-state";
import { checkRateLimit, getClientIdentifier, rateLimitConfigs } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function averageJudgeScores(
  judgeScores: Record<string, number> | undefined
): number | null {
  if (!judgeScores || typeof judgeScores !== "object") return null;
  const vals = Object.values(judgeScores).filter(
    (n) => typeof n === "number" && n >= 1 && n <= 10
  );
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export async function GET(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request as unknown as Request);
    const rate = checkRateLimit(
      `hack-asprint-admin-dash:${clientId}`,
      rateLimitConfigs.hackathonShowcaseVote
    );
    if (!rate.success) {
      return NextResponse.json(
        { error: "Too many requests", retryAfterSeconds: rate.retryAfter },
        { status: 429 }
      );
    }

    const user = await getVerifiedUser(request);
    if (!user?.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const phase = getHackASprint2026Phase();
    const submissions = await fetchShowcaseSubmissionsFromGitHub();
    const judgeUids = [...getJudgeUidSet()];

    // Fetch all score docs
    const scoreBySid = new Map<string, DocumentData>();
    if (submissions.length > 0) {
      const refs = submissions.map((s) =>
        db
          .collection("hackathonShowcaseScores")
          .doc(hackASprint2026ScoreDocId(s.submissionId))
      );
      const snaps = await db.getAll(...refs);
      snaps.forEach((snap, i) => {
        if (snap.exists) {
          scoreBySid.set(submissions[i]!.submissionId, snap.data() ?? {});
        }
      });
    }

    // Build submission rows with full score breakdown
    const rows = submissions.map((s) => {
      const data = scoreBySid.get(s.submissionId);
      const aiScore =
        typeof data?.aiScore === "number" && data.aiScore >= 1 && data.aiScore <= 10
          ? data.aiScore
          : null;
      const judgeScores =
        data?.judgeScores && typeof data.judgeScores === "object"
          ? (data.judgeScores as Record<string, number>)
          : {};
      const peerVoteCount =
        typeof data?.peerVoteCount === "number" ? data.peerVoteCount : 0;
      const judgeAverage = averageJudgeScores(judgeScores);
      const rawScore = computeHackASprint2026RawScore(
        aiScore,
        Object.keys(judgeScores).length > 0 ? judgeScores : undefined
      );

      return {
        submissionId: s.submissionId,
        githubLogin: s.githubLogin,
        title: s.payload.title,
        aiScore,
        judgeScores,
        judgeAverage,
        peerVoteCount,
        rawScore,
      };
    });

    rows.sort((a, b) => {
      const ra = a.rawScore ?? -1;
      const rb = b.rawScore ?? -1;
      if (rb !== ra) return rb - ra;
      return (b.peerVoteCount ?? 0) - (a.peerVoteCount ?? 0);
    });

    // Voting stats
    const voteSnap = await db
      .collection("hackathonASprint2026PeerVotes")
      .where("eventId", "==", HACK_A_SPRINT_2026_EVENT_ID)
      .count()
      .get();
    const totalVoters = voteSnap.data().count;

    const signupSnap = await db
      .collection("hackathonEventSignups")
      .where("eventId", "==", HACK_A_SPRINT_2026_EVENT_ID)
      .count()
      .get();
    const totalSignups = signupSnap.data().count;

    // Judge progress
    const judgeProgress = judgeUids.map((uid) => {
      const scored = rows.filter(
        (r) =>
          r.judgeScores[uid] !== undefined &&
          typeof r.judgeScores[uid] === "number"
      ).length;
      return { uid, scored, total: submissions.length };
    });

    return NextResponse.json({
      phase,
      totalSubmissions: submissions.length,
      totalSignups,
      totalVoters,
      judgeUids,
      judgeProgress,
      submissions: rows,
    });
  } catch (e) {
    console.error("[admin-dashboard]", e);
    return NextResponse.json(
      { error: "Failed to load dashboard" },
      { status: 500 }
    );
  }
}
