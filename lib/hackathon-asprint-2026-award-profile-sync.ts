/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { FieldValue } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";
import {
  computeShowcaseAwards,
  type ShowcaseAwardInput,
} from "@/lib/hackathon-asprint-2026-awards";
import { computeAiRanksBySubmissionId } from "@/lib/hackathon-asprint-2026-scores";
import { computePeerAverages } from "@/lib/hackathon-asprint-2026-participant-scoring";
import {
  getAllHackASprint2026ParticipantScoreDocs,
  hackASprint2026ScoreDocId,
  resolveVoterGithubByUid,
} from "@/lib/hackathon-asprint-2026-state";
import { fetchShowcaseSubmissionsFromGitHub } from "@/lib/hackathon-showcase";
import { findUserByGitHubLogin } from "@/lib/github";

/**
 * Same inputs as the public gallery awards (AI rank/score, peer averages).
 */
export async function loadHackASprint2026ShowcaseAwardInputs(
  db: Firestore
): Promise<ShowcaseAwardInput[]> {
  const submissions = await fetchShowcaseSubmissionsFromGitHub();
  if (submissions.length === 0) return [];

  const identities = submissions.map((s) => ({
    submissionId: s.submissionId,
    githubLogin: s.githubLogin,
  }));

  const voterDocs = await getAllHackASprint2026ParticipantScoreDocs(db);
  const voterGithubByUid = await resolveVoterGithubByUid(db, voterDocs);
  const peerAvgBySid = computePeerAverages(identities, voterDocs, voterGithubByUid);

  const refs = submissions.map((s) =>
    db.collection("hackathonShowcaseScores").doc(hackASprint2026ScoreDocId(s.submissionId))
  );
  const snaps = await db.getAll(...refs);

  const aiScoreBySubmissionId = new Map<string, number | null>();
  submissions.forEach((s, i) => {
    const snap = snaps[i];
    const data = snap?.exists ? snap.data() : undefined;
    const ai =
      typeof data?.aiScore === "number" && data.aiScore >= 1 && data.aiScore <= 10
        ? data.aiScore
        : null;
    aiScoreBySubmissionId.set(s.submissionId, ai);
  });

  const aiRankBySubmissionId = computeAiRanksBySubmissionId(
    submissions.map((s) => s.submissionId),
    aiScoreBySubmissionId
  );

  return submissions.map((s) => ({
    submissionId: s.submissionId,
    githubLogin: s.githubLogin,
    aiRank: aiRankBySubmissionId.get(s.submissionId) ?? null,
    aiScore: aiScoreBySubmissionId.get(s.submissionId) ?? null,
    peerAverage: peerAvgBySid.get(s.submissionId.toLowerCase()) ?? null,
  }));
}

/**
 * Writes `hackASprint2026ShowcaseAwards` on each linked user (merge).
 * Uses `new Date()` for peer-reveal gating, matching the gallery.
 */
export async function syncHackASprint2026ShowcaseAwardsToUserProfiles(
  db: Firestore,
  options: { dryRun: boolean; now?: Date }
): Promise<{
  written: number;
  missingUser: number;
  lines: string[];
}> {
  const inputs = await loadHackASprint2026ShowcaseAwardInputs(db);
  const awardsBySid = computeShowcaseAwards(inputs, options.now ?? new Date());

  const lines: string[] = [];
  let written = 0;
  let missingUser = 0;

  for (const row of inputs) {
    const sid = row.submissionId.trim().toLowerCase();
    const kinds = awardsBySid.get(sid) ?? [];
    const gh = row.githubLogin.trim();
    const uid = await findUserByGitHubLogin(gh);
    if (!uid) {
      missingUser += 1;
      lines.push(`skip (no linked user) github=${gh} submission=${sid} would=${JSON.stringify(kinds)}`);
      continue;
    }
    lines.push(`user ${uid} github=${gh} submission=${sid} awards=${JSON.stringify(kinds)}`);
    if (!options.dryRun) {
      await db
        .collection("users")
        .doc(uid)
        .set(
          {
            hackASprint2026ShowcaseAwards: kinds,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
    }
    written += 1;
  }

  return { written, missingUser, lines };
}
