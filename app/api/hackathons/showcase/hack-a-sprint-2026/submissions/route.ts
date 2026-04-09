import { NextRequest, NextResponse } from "next/server";
import type { DocumentData } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import {
  fetchShowcaseSubmissionsFromGitHub,
  type ShowcaseSubmission,
} from "@/lib/hackathon-showcase";
import { getHackASprint2026Phase } from "@/lib/hackathon-asprint-2026-schedule";
import { computeHackASprint2026RawScore } from "@/lib/hackathon-asprint-2026-scores";
import {
  hackASprint2026PeerVoteDocId,
  hackASprint2026ScoreDocId,
  userHasHackASprint2026Signup,
  userHackASprint2026PeerVoteComplete,
} from "@/lib/hackathon-asprint-2026-state";
import { userIsHackASprint2026Judge } from "@/lib/hackathon-showcase-admin";
import { getJudgeUidSet } from "@/lib/hackathon-showcase";

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
    const user = await getVerifiedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const phase = getHackASprint2026Phase();
    const db = getAdminDb();

    let unlocked = false;
    let signedUp = false;
    let hasCompletedPeerVoting = false;
    let myPeerPicks: string[] = [];
    let judgeEligible = false;

    if (db) {
      const userSnap = await db.collection("users").doc(user.uid).get();
      unlocked = userSnap.data()?.hackASprint2026Unlocked === true;
      signedUp = await userHasHackASprint2026Signup(db, user.uid);
      hasCompletedPeerVoting = await userHackASprint2026PeerVoteComplete(
        db,
        user.uid
      );
      judgeEligible = await userIsHackASprint2026Judge(
        db,
        user.uid,
        user.email
      );
      const pv = await db
        .collection("hackathonASprint2026PeerVotes")
        .doc(hackASprint2026PeerVoteDocId(user.uid))
        .get();
      const picks = pv.data()?.submissionIds;
      if (Array.isArray(picks)) {
        myPeerPicks = picks.map((x: unknown) => String(x).toLowerCase());
      }
    } else {
      judgeEligible = getJudgeUidSet().has(user.uid);
    }

    const revealAi =
      phase === "resultsOpen" ||
      (phase === "peerVotingOpen" && hasCompletedPeerVoting);
    const revealJudgesAndPeers = phase === "resultsOpen";

    const showSubmissionList =
      unlocked &&
      signedUp &&
      (phase === "peerVotingOpen" || phase === "resultsOpen");

    let submissions: ShowcaseSubmission[] = [];
    if (showSubmissionList) {
      submissions = await fetchShowcaseSubmissionsFromGitHub();

      const allowedRaw = process.env.HACK_A_SPRINT_2026_ALLOWED_SUBMISSIONS || "";
      if (allowedRaw.trim()) {
        const allowed = new Set(
          allowedRaw
            .split(",")
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean)
        );
        submissions = submissions.filter((s) => allowed.has(s.submissionId));
      }
    }

    type Row = ShowcaseSubmission & {
      peerVoteCount: number | null;
      aiScore: number | null;
      judgeAverage: number | null;
      rawScore: number | null;
      myJudgeScore: number | null;
    };

    const rows: Row[] = [];

    if (db && submissions.length > 0) {
      const refs = submissions.map((s) =>
        db.collection("hackathonShowcaseScores").doc(hackASprint2026ScoreDocId(s.submissionId))
      );
      const snaps = await db.getAll(...refs);
      const scoreBySid = new Map<string, DocumentData>();
      snaps.forEach((snap, i) => {
        if (snap.exists) {
          scoreBySid.set(submissions[i]!.submissionId, snap.data() ?? {});
        }
      });

      for (const s of submissions) {
        const data = scoreBySid.get(s.submissionId);
        const peerVoteCount =
          typeof data?.peerVoteCount === "number" ? data.peerVoteCount : 0;
        const aiScore =
          typeof data?.aiScore === "number" && data.aiScore >= 1 && data.aiScore <= 10
            ? data.aiScore
            : null;
        const judgeScores =
          data?.judgeScores && typeof data.judgeScores === "object"
            ? (data.judgeScores as Record<string, number>)
            : undefined;
        const judgeAverage = averageJudgeScores(judgeScores);
        const rawScore = computeHackASprint2026RawScore(aiScore, judgeScores);

        const myJudge =
          judgeEligible && judgeScores
            ? judgeScores[user.uid] ?? null
            : null;
        const myJudgeScore =
          typeof myJudge === "number" && myJudge >= 1 && myJudge <= 10
            ? myJudge
            : null;

        rows.push({
          ...s,
          peerVoteCount: revealJudgesAndPeers ? peerVoteCount : null,
          aiScore: revealAi ? aiScore : null,
          judgeAverage: revealJudgesAndPeers ? judgeAverage : null,
          rawScore: revealJudgesAndPeers ? rawScore : null,
          myJudgeScore,
        });
      }

      if (revealJudgesAndPeers) {
        rows.sort((a, b) => {
          const ra = a.rawScore ?? -1;
          const rb = b.rawScore ?? -1;
          if (rb !== ra) return rb - ra;
          const pa = a.peerVoteCount ?? 0;
          const pb = b.peerVoteCount ?? 0;
          return pb - pa;
        });
      }
    }

    return NextResponse.json({
      phase,
      viewer: {
        unlocked,
        signedUp,
        hasCompletedPeerVoting,
        judgeEligible,
        myPeerPicks,
      },
      submissions: rows,
    });
  } catch (e) {
    console.error("[showcase submissions]", e);
    return NextResponse.json(
      { error: "Failed to load submissions" },
      { status: 500 }
    );
  }
}
