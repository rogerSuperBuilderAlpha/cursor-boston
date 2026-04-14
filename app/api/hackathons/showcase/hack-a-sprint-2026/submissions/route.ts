/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import type { DocumentData } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import {
  fetchShowcaseSubmissionsFromGitHub,
  type ShowcaseSubmission,
} from "@/lib/hackathon-showcase";
import { getHackASprint2026Phase } from "@/lib/hackathon-asprint-2026-schedule";
import {
  computeAiRanksBySubmissionId,
  computeHackASprint2026RawScore,
} from "@/lib/hackathon-asprint-2026-scores";
import { computePeerAverages } from "@/lib/hackathon-asprint-2026-participant-scoring";
import {
  getAllHackASprint2026ParticipantScoreDocs,
  getParticipantScoresForUser,
  hackASprint2026ScoreDocId,
  userHasHackASprint2026Signup,
  userIsCheckedInForHackASprint2026,
  userHackASprint2026PeerVoteComplete,
} from "@/lib/hackathon-asprint-2026-state";
import { userIsHackASprint2026Judge } from "@/lib/hackathon-showcase-admin";
import { profileMatchesHackathonJudgeCheckinException } from "@/lib/hackathon-event-signup";
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

    let checkedIn = false;
    let signedUp = false;
    let hasCompletedPeerVoting = false;
    let myParticipantScores: Record<string, number> = {};
    let judgeEligible = false;
    let judgeCheckinBypass = false;
    let viewerGithub: string | null = null;

    if (db) {
      checkedIn = await userIsCheckedInForHackASprint2026(db, user.uid, user.email);
      signedUp = await userHasHackASprint2026Signup(db, user.uid);
      judgeEligible = await userIsHackASprint2026Judge(
        db,
        user.uid,
        user.email
      );
      const uSnap = await db.collection("users").doc(user.uid).get();
      const profile = uSnap.data() as Record<string, unknown> | undefined;
      judgeCheckinBypass = profileMatchesHackathonJudgeCheckinException(
        user.email,
        profile
      );
      const gh = profile?.github as { login?: unknown } | undefined;
      const lg = typeof gh?.login === "string" ? gh.login : "";
      viewerGithub = lg.trim() ? lg.trim().toLowerCase() : null;
    } else {
      judgeEligible = getJudgeUidSet().has(user.uid);
    }

    // Judges/organizers may match check-in bypass without a hackathonEventSignups doc;
    // they still need the same checked-in gate as /me.
    const showSubmissionList =
      checkedIn && (signedUp || judgeEligible || judgeCheckinBypass);

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

    if (db && viewerGithub && submissions.length > 0) {
      const identities = submissions.map((s) => ({
        submissionId: s.submissionId,
        githubLogin: s.githubLogin,
      }));
      hasCompletedPeerVoting = await userHackASprint2026PeerVoteComplete(
        db,
        user.uid,
        identities,
        viewerGithub
      );
      myParticipantScores = await getParticipantScoresForUser(db, user.uid);
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
      const voterUids = [...new Set(voterDocs.map((d) => d.userId))];
      const voterRefs = voterUids.map((uid) => db.collection("users").doc(uid));
      const voterSnaps =
        voterRefs.length > 0 ? await db.getAll(...voterRefs) : [];
      const voterGithubByUid = new Map<string, string>();
      for (const snap of voterSnaps) {
        const login = snap.data()?.github?.login;
        if (typeof login === "string" && login.trim()) {
          voterGithubByUid.set(snap.id, login.trim().toLowerCase());
        }
      }

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
          judgeEligible && judgeScores
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

    return NextResponse.json({
      phase,
      viewer: {
        checkedIn,
        signedUp,
        hasCompletedPeerVoting,
        judgeEligible,
        myParticipantScores,
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
