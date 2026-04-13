/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { Firestore } from "firebase-admin/firestore";
import { HACK_A_SPRINT_2026_EVENT_ID } from "@/lib/hackathon-showcase";
import {
  hackathonEventSignupDocId,
  profileMatchesHackathonJudgeCheckinException,
} from "@/lib/hackathon-event-signup";
import {
  hackASprint2026ParticipantScoresDocId,
  normalizeParticipantScores,
  participantBallotComplete,
  type SubmissionIdentity,
} from "@/lib/hackathon-asprint-2026-participant-scoring";

export function hackASprint2026PeerVoteDocId(userId: string): string {
  return `${HACK_A_SPRINT_2026_EVENT_ID}__${userId}`;
}

export function hackASprint2026ScoreDocId(submissionId: string): string {
  return `${HACK_A_SPRINT_2026_EVENT_ID}__${submissionId.toLowerCase()}`;
}

export { hackASprint2026ParticipantScoresDocId };

export async function userHasHackASprint2026Signup(
  db: Firestore,
  uid: string
): Promise<boolean> {
  const id = hackathonEventSignupDocId(HACK_A_SPRINT_2026_EVENT_ID, uid);
  const snap = await db.collection("hackathonEventSignups").doc(id).get();
  return snap.exists;
}

export async function userIsCheckedInForHackASprint2026(
  db: Firestore,
  uid: string,
  tokenEmail?: string | null
): Promise<boolean> {
  const id = hackathonEventSignupDocId(HACK_A_SPRINT_2026_EVENT_ID, uid);
  const snap = await db.collection("hackathonEventSignups").doc(id).get();
  if (snap.exists && snap.data()?.checkedInAt != null) {
    return true;
  }
  const userSnap = await db.collection("users").doc(uid).get();
  return profileMatchesHackathonJudgeCheckinException(
    tokenEmail ?? null,
    userSnap.data() as Record<string, unknown> | undefined
  );
}

/**
 * True when the user has entered a valid 1–10 score for every other submission.
 */
export async function userHackASprint2026PeerVoteComplete(
  db: Firestore,
  uid: string,
  allSubmissions: SubmissionIdentity[],
  ownGithubLogin: string
): Promise<boolean> {
  const id = hackASprint2026ParticipantScoresDocId(uid);
  const snap = await db.collection("hackathonASprint2026ParticipantScores").doc(id).get();
  if (!snap.exists) return false;
  const scores = normalizeParticipantScores(
    snap.data()?.scores as Record<string, unknown> | undefined
  );
  return participantBallotComplete(scores, ownGithubLogin, allSubmissions);
}

export async function getParticipantScoresForUser(
  db: Firestore,
  uid: string
): Promise<Record<string, number>> {
  const id = hackASprint2026ParticipantScoresDocId(uid);
  const snap = await db.collection("hackathonASprint2026ParticipantScores").doc(id).get();
  if (!snap.exists) return {};
  return normalizeParticipantScores(
    snap.data()?.scores as Record<string, unknown> | undefined
  );
}

export async function getAllHackASprint2026ParticipantScoreDocs(
  db: Firestore
): Promise<Array<{ userId: string; scores: Record<string, number> }>> {
  const snap = await db
    .collection("hackathonASprint2026ParticipantScores")
    .where("eventId", "==", HACK_A_SPRINT_2026_EVENT_ID)
    .get();
  return snap.docs
    .map((d) => {
      const data = d.data();
      let userId = typeof data.userId === "string" ? data.userId : "";
      if (!userId) {
        const parts = d.id.split("__");
        userId = parts.length >= 2 ? parts.slice(1).join("__") : "";
      }
      return {
        userId,
        scores: normalizeParticipantScores(
          data.scores as Record<string, unknown> | undefined
        ),
      };
    })
    .filter((x) => Boolean(x.userId));
}
