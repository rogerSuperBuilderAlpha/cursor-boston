/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import {
  HACK_A_SPRINT_2026_EVENT_ID,
  fetchShowcaseSubmissionsFromGitHub,
  getJudgeUidSet,
  githubUserHasMergedLabeledShowcasePr,
} from "@/lib/hackathon-showcase";
import { userIsHackASprint2026JudgeFromUserData } from "@/lib/hackathon-showcase-admin";
import { getHackASprint2026Phase } from "@/lib/hackathon-asprint-2026-schedule";
import {
  hackASprint2026ParticipantScoresDocId,
  normalizeParticipantScores,
  participantBallotComplete,
  participantPrizeEligibility,
} from "@/lib/hackathon-asprint-2026-participant-scoring";
import {
  hackathonEventSignupDocId,
  profileMatchesHackathonJudgeCheckinException,
} from "@/lib/hackathon-event-signup";

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

    const phase = getHackASprint2026Phase();

    let judgeEligible = getJudgeUidSet().has(user.uid);

    if (db) {
      const signupRef = db
        .collection("hackathonEventSignups")
        .doc(hackathonEventSignupDocId(HACK_A_SPRINT_2026_EVENT_ID, user.uid));
      const userRef = db.collection("users").doc(user.uid);
      const [signupSnap, userSnap] = await db.getAll(signupRef, userRef);
      const profile = userSnap.data() as Record<string, unknown> | undefined;
      judgeEligible = userIsHackASprint2026JudgeFromUserData(
        user.uid,
        user.email,
        profile
      );
      signedUp = signupSnap.exists;
      checkedIn =
        Boolean(signupSnap.exists && signupSnap.data()?.checkedInAt != null) ||
        profileMatchesHackathonJudgeCheckinException(user.email, profile);
      const gh = profile?.github as { login?: unknown } | undefined;
      const login = typeof gh?.login === "string" ? gh.login : "";
      if (login.trim()) {
        githubLogin = login.trim().toLowerCase();
      }

      if (githubLogin && checkedIn && signedUp) {
        let submissions = await fetchShowcaseSubmissionsFromGitHub();
        submissions = filterAllowedSubmissions(submissions);
        const identities = submissions.map((s) => ({
          submissionId: s.submissionId,
          githubLogin: s.githubLogin,
        }));
        const psRef = db
          .collection("hackathonASprint2026ParticipantScores")
          .doc(hackASprint2026ParticipantScoresDocId(user.uid));
        const psSnap = await psRef.get();
        const scores = psSnap.exists
          ? normalizeParticipantScores(
              psSnap.data()?.scores as Record<string, unknown> | undefined
            )
          : {};
        hasCompletedPeerVoting = participantBallotComplete(
          scores,
          githubLogin,
          identities
        );
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
