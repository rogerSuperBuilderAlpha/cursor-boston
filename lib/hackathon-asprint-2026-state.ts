/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { Firestore } from "firebase-admin/firestore";
import { HACK_A_SPRINT_2026_EVENT_ID } from "@/lib/hackathon-showcase";
import { hackathonEventSignupDocId } from "@/lib/hackathon-event-signup";

export function hackASprint2026PeerVoteDocId(userId: string): string {
  return `${HACK_A_SPRINT_2026_EVENT_ID}__${userId}`;
}

export function hackASprint2026ScoreDocId(submissionId: string): string {
  return `${HACK_A_SPRINT_2026_EVENT_ID}__${submissionId.toLowerCase()}`;
}

export async function userHasHackASprint2026Signup(
  db: Firestore,
  uid: string
): Promise<boolean> {
  const id = hackathonEventSignupDocId(HACK_A_SPRINT_2026_EVENT_ID, uid);
  const snap = await db.collection("hackathonEventSignups").doc(id).get();
  return snap.exists;
}

export async function userHackASprint2026PeerVoteComplete(
  db: Firestore,
  uid: string
): Promise<boolean> {
  const id = hackASprint2026PeerVoteDocId(uid);
  const snap = await db.collection("hackathonASprint2026PeerVotes").doc(id).get();
  if (!snap.exists) return false;
  const ids = snap.data()?.submissionIds;
  return Array.isArray(ids) && ids.length === 6;
}
