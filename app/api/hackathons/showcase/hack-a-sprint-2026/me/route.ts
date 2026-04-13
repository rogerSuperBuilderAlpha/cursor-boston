/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import {
  fetchShowcaseSubmissionsFromGitHub,
  getJudgeUidSet,
  githubUserHasMergedLabeledShowcasePr,
} from "@/lib/hackathon-showcase";
import { userIsHackASprint2026Judge } from "@/lib/hackathon-showcase-admin";
import { getHackASprint2026Phase } from "@/lib/hackathon-asprint-2026-schedule";
import { participantPrizeEligibility } from "@/lib/hackathon-asprint-2026-participant-scoring";
import {
  getParticipantScoresForUser,
  userHasHackASprint2026Signup,
  userIsCheckedInForHackASprint2026,
  userHackASprint2026PeerVoteComplete,
} from "@/lib/hackathon-asprint-2026-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function filterAllowedSubmissions<T extends { submissionId: string }>(
  submissions: T[]
): T[] {
  const allowedRaw = process.env.HACK_A_SPRINT_2026_ALLOWED_SUBMISSIONS || "";
  if (!allowedRaw.trim()) return submissions;
  const allowed = new Set(
    allowedRaw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
  return submissions.filter((s) => allowed.has(s.submissionId));
}

export async function GET(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getAdminDb();
    let githubLogin: string | null = null;
    let checkedIn = false;
    let signedUp = false;
    let hasCompletedPeerVoting = false;
    let prizeEligible = false;
    let highScoreCount = 0;
    let requiredHighScores = 0;

    const judgeEligible = db
      ? await userIsHackASprint2026Judge(db, user.uid, user.email)
      : getJudgeUidSet().has(user.uid);

    const phase = getHackASprint2026Phase();

    if (db) {
      const userSnap = await db.collection("users").doc(user.uid).get();
      const ud = userSnap.data();
      const login = ud?.github?.login;
      if (typeof login === "string" && login.trim()) {
        githubLogin = login.trim();
      }
      checkedIn = await userIsCheckedInForHackASprint2026(db, user.uid, user.email);
      signedUp = await userHasHackASprint2026Signup(db, user.uid);

      if (
        githubLogin &&
        (phase === "peerVotingOpen" || phase === "resultsOpen")
      ) {
        let submissions = await fetchShowcaseSubmissionsFromGitHub();
        submissions = filterAllowedSubmissions(submissions);
        const identities = submissions.map((s) => ({
          submissionId: s.submissionId,
          githubLogin: s.githubLogin,
        }));
        hasCompletedPeerVoting = await userHackASprint2026PeerVoteComplete(
          db,
          user.uid,
          identities,
          githubLogin
        );
        const scores = await getParticipantScoresForUser(db, user.uid);
        const pe = participantPrizeEligibility(scores, githubLogin, identities);
        prizeEligible = pe.eligible;
        highScoreCount = pe.highScoreCount;
        requiredHighScores = pe.requiredHighScores;
      }
    }

    let participantEligible = false;
    if (githubLogin) {
      participantEligible =
        await githubUserHasMergedLabeledShowcasePr(githubLogin);
    }

    return NextResponse.json({
      phase,
      signedUp,
      checkedIn,
      hasCompletedPeerVoting,
      prizeEligible,
      highScoreCount,
      requiredHighScores,
      participantEligible,
      judgeEligible,
      githubLogin,
    });
  } catch (e) {
    console.error("[showcase me]", e);
    return NextResponse.json(
      { error: "Failed to load eligibility" },
      { status: 500 }
    );
  }
}
