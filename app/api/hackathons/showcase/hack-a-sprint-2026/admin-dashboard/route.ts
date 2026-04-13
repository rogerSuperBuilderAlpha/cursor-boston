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
  HACK_A_SPRINT_2026_EVENT_ID,
  fetchShowcaseSubmissionsFromGitHub,
  getJudgeUidSet,
} from "@/lib/hackathon-showcase";
import { getHackASprint2026Phase } from "@/lib/hackathon-asprint-2026-schedule";
import { computeHackASprint2026RawScore } from "@/lib/hackathon-asprint-2026-scores";
import { computePeerAverages } from "@/lib/hackathon-asprint-2026-participant-scoring";
import {
  getAllHackASprint2026ParticipantScoreDocs,
  hackASprint2026ScoreDocId,
} from "@/lib/hackathon-asprint-2026-state";
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

    const identities = submissions.map((s) => ({
      submissionId: s.submissionId,
      githubLogin: s.githubLogin,
    }));
    const voterDocs = await getAllHackASprint2026ParticipantScoreDocs(db);
    const voterUids = [...new Set(voterDocs.map((d) => d.userId))];
    const voterRefs = voterUids.map((uid) => db.collection("users").doc(uid));
    const voterSnaps = voterRefs.length > 0 ? await db.getAll(...voterRefs) : [];
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

      const sid = s.submissionId.toLowerCase();
      const peerAverage = peerAvgBySid.get(sid) ?? null;

      return {
        submissionId: s.submissionId,
        githubLogin: s.githubLogin,
        title: s.payload.title,
        description: s.payload.description,
        projectRepoUrl: s.payload.projectRepoUrl,
        deployedUrl: s.payload.deployedUrl,
        loomVideoUrl: s.payload.loomVideoUrl,
        aiScore,
        judgeScores,
        judgeAverage,
        peerVoteCount,
        peerAverage,
        rawScore,
      };
    });

    rows.sort((a, b) => {
      const ra = a.rawScore ?? -1;
      const rb = b.rawScore ?? -1;
      if (rb !== ra) return rb - ra;
      const pa = a.peerAverage ?? -1;
      const pb = b.peerAverage ?? -1;
      if (pb !== pa) return pb - pa;
      return (b.peerVoteCount ?? 0) - (a.peerVoteCount ?? 0);
    });

    const participantBallotSnap = await db
      .collection("hackathonASprint2026ParticipantScores")
      .where("eventId", "==", HACK_A_SPRINT_2026_EVENT_ID)
      .count()
      .get();
    const totalVoters = participantBallotSnap.data().count;

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
