/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import type { DocumentData } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { getOptionalVerifiedUser } from "@/lib/server-auth";
import {
  HACK_A_SPRINT_2026_EVENT_ID,
  fetchShowcaseSubmissionsFromGitHub,
  type ShowcaseSubmission,
} from "@/lib/hackathon-showcase";
import { getHackASprint2026Phase } from "@/lib/hackathon-asprint-2026-schedule";
import {
  computeAiRanksBySubmissionId,
  computeHackASprint2026RawScore,
} from "@/lib/hackathon-asprint-2026-scores";
import {
  computePeerAverages,
  hackASprint2026ParticipantScoresDocId,
  normalizeParticipantScores,
  participantBallotComplete,
} from "@/lib/hackathon-asprint-2026-participant-scoring";
import {
  getAllHackASprint2026ParticipantScoreDocs,
  hackASprint2026ScoreDocId,
  resolveVoterGithubByUid,
} from "@/lib/hackathon-asprint-2026-state";
import { userIsHackASprint2026JudgeFromUserData } from "@/lib/hackathon-showcase-admin";
import {
  hackathonEventSignupDocId,
  profileMatchesHackathonJudgeCheckinException,
} from "@/lib/hackathon-event-signup";
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
    const user = await getOptionalVerifiedUser(request);

    const phase = getHackASprint2026Phase();
    const db = getAdminDb();

    let checkedIn = false;
    let signedUp = false;
    let hasCompletedPeerVoting = false;
    let myParticipantScores: Record<string, number> = {};
    let judgeEligible = false;
    let judgeCheckinBypass = false;
    let viewerGithub: string | null = null;

    if (user && db) {
      const signupRef = db
        .collection("hackathonEventSignups")
        .doc(hackathonEventSignupDocId(HACK_A_SPRINT_2026_EVENT_ID, user.uid));
      const userRef = db.collection("users").doc(user.uid);
      const [signupSnap, userSnap] = await db.getAll(signupRef, userRef);
      const profile = userSnap.data() as Record<string, unknown> | undefined;
      signedUp = signupSnap.exists;
      checkedIn =
        Boolean(signupSnap.exists && signupSnap.data()?.checkedInAt != null) ||
        profileMatchesHackathonJudgeCheckinException(user.email, profile);
      judgeCheckinBypass = profileMatchesHackathonJudgeCheckinException(
        user.email,
        profile
      );
      judgeEligible = userIsHackASprint2026JudgeFromUserData(
        user.uid,
        user.email,
        profile
      );
      const gh = profile?.github as { login?: unknown } | undefined;
      const lg = typeof gh?.login === "string" ? gh.login : "";
      viewerGithub = lg.trim() ? lg.trim().toLowerCase() : null;
    } else if (user && !db) {
      judgeEligible = getJudgeUidSet().has(user.uid);
    }

    /** Public gallery: submissions are always listed (no check-in gate on GET). */
    let submissions: ShowcaseSubmission[] = [];
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

    const submissionGithubSet = new Set(
      submissions.map((s) => s.githubLogin.trim().toLowerCase())
    );
    const isSubmitter = Boolean(
      viewerGithub && submissionGithubSet.has(viewerGithub)
    );

    if (user && db && viewerGithub && submissions.length > 0) {
      const identities = submissions.map((s) => ({
        submissionId: s.submissionId,
        githubLogin: s.githubLogin,
      }));
      const psRef = db
        .collection("hackathonASprint2026ParticipantScores")
        .doc(hackASprint2026ParticipantScoresDocId(user.uid));
      const psSnap = await psRef.get();
      myParticipantScores = psSnap.exists
        ? normalizeParticipantScores(
            psSnap.data()?.scores as Record<string, unknown> | undefined
          )
        : {};
      hasCompletedPeerVoting = participantBallotComplete(
        myParticipantScores,
        viewerGithub,
        identities
      );
    }

    const revealJudgesAndPeers = phase === "resultsOpen";

    type Row = ShowcaseSubmission & {
      peerAverage: number | null;
      peerVoteCount: number | null;
      aiScore: number | null;
      aiRank: number | null;
      aiReasoning: string | null;
      judgeAverage: number | null;
      rawScore: number | null;
      myJudgeScore: number | null;
      myParticipantScore: number | null;
    };

    const rows: Row[] = [];

    if (db && submissions.length > 0) {
      const identities = submissions.map((s) => ({
        submissionId: s.submissionId,
        githubLogin: s.githubLogin,
      }));

      const voterDocs = await getAllHackASprint2026ParticipantScoreDocs(db);
      const voterGithubByUid = await resolveVoterGithubByUid(db, voterDocs);

      const peerAvgBySid = computePeerAverages(
        identities,
        voterDocs,
        voterGithubByUid
      );

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

      const aiScoreBySubmissionId = new Map<string, number | null>();
      for (const s of submissions) {
        const data = scoreBySid.get(s.submissionId);
        const ai =
          typeof data?.aiScore === "number" && data.aiScore >= 1 && data.aiScore <= 10
            ? data.aiScore
            : null;
        aiScoreBySubmissionId.set(s.submissionId, ai);
      }
      const aiRankBySubmissionId = computeAiRanksBySubmissionId(
        submissions.map((s) => s.submissionId),
        aiScoreBySubmissionId
      );

      for (const s of submissions) {
        const data = scoreBySid.get(s.submissionId);
        const legacyPeer =
          typeof data?.peerVoteCount === "number" ? data.peerVoteCount : 0;
        const aiScore =
          typeof data?.aiScore === "number" && data.aiScore >= 1 && data.aiScore <= 10
            ? data.aiScore
            : null;
        const aiReasoningRaw =
          typeof data?.aiReasoning === "string" && data.aiReasoning.trim()
            ? data.aiReasoning.trim()
            : null;
        const aiRank =
          aiScore != null ? aiRankBySubmissionId.get(s.submissionId) ?? null : null;
        const judgeScores =
          data?.judgeScores && typeof data.judgeScores === "object"
            ? (data.judgeScores as Record<string, number>)
            : undefined;
        const judgeAverage = averageJudgeScores(judgeScores);
        const rawScore = computeHackASprint2026RawScore(aiScore, judgeScores);

        const myJudge =
          user && judgeEligible && judgeScores
            ? judgeScores[user.uid] ?? null
            : null;
        const myJudgeScore =
          typeof myJudge === "number" && myJudge >= 1 && myJudge <= 10
            ? myJudge
            : null;

        const sid = s.submissionId.toLowerCase();
        const peerAverage = peerAvgBySid.get(sid) ?? null;
        const myPs = myParticipantScores[sid];
        const myParticipantScore =
          typeof myPs === "number" && myPs >= 1 && myPs <= 10 ? myPs : null;

        rows.push({
          ...s,
          peerAverage,
          peerVoteCount: revealJudgesAndPeers ? legacyPeer : null,
          aiScore,
          aiRank,
          aiReasoning: aiReasoningRaw,
          judgeAverage: revealJudgesAndPeers ? judgeAverage : null,
          rawScore: revealJudgesAndPeers ? rawScore : null,
          myJudgeScore,
          myParticipantScore,
        });
      }

      rows.sort((a, b) => {
        const rankA = a.aiRank ?? Number.POSITIVE_INFINITY;
        const rankB = b.aiRank ?? Number.POSITIVE_INFINITY;
        if (rankA !== rankB) return rankA - rankB;
        const sa = a.aiScore ?? -1;
        const sb = b.aiScore ?? -1;
        if (sb !== sa) return sb - sa;
        return a.submissionId.localeCompare(b.submissionId);
      });
    }

    const isJudgeView = judgeEligible || judgeCheckinBypass;
    const revealScoresToViewer =
      isJudgeView ||
      !user ||
      !isSubmitter ||
      hasCompletedPeerVoting ||
      phase === "resultsOpen";

    const canPeerVote = Boolean(
      user &&
        isSubmitter &&
        !judgeEligible &&
        !judgeCheckinBypass &&
        (phase === "peerVotingOpen" || phase === "resultsOpen")
    );

    const submissionsOut = revealScoresToViewer
      ? rows
      : rows.map((r) => ({
          ...r,
          peerAverage: null,
          peerVoteCount: null,
          aiScore: null,
          aiRank: null,
          aiReasoning: null,
          judgeAverage: null,
          rawScore: null,
        }));

    return NextResponse.json({
      phase,
      viewer: {
        checkedIn,
        signedUp,
        hasCompletedPeerVoting,
        judgeEligible,
        isJudge: isJudgeView,
        peerScoresRevealed: revealScoresToViewer,
        myParticipantScores,
        canPeerVote,
        isSubmitter,
      },
      submissions: submissionsOut,
    });
  } catch (e) {
    console.error("[showcase submissions]", e);
    return NextResponse.json(
      { error: "Failed to load submissions" },
      { status: 500 }
    );
  }
}
