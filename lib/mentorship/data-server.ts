/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { getAdminDb } from "@/lib/firebase-admin";
import type {
  MentorshipProfile,
  MentorshipRequest,
  MentorshipPairing,
  MentorshipCheckIn,
  MentorshipRequestStatus,
  GoalStatus,
  MentorshipRole,
} from "./types";
import { normalizeSkills } from "./matching";

export class MentorshipRequestNotFoundError extends Error {
  constructor() { super("Request not found"); this.name = "MentorshipRequestNotFoundError"; }
}
export class MentorshipRequestUnauthorizedError extends Error {
  constructor() { super("Unauthorized"); this.name = "MentorshipRequestUnauthorizedError"; }
}
export class MentorshipRequestAlreadyRespondedError extends Error {
  constructor() { super("Request has already been responded to"); this.name = "MentorshipRequestAlreadyRespondedError"; }
}

const COLLECTIONS = {
  PROFILES: "mentorship_profiles",
  REQUESTS: "mentorship_requests",
  PAIRINGS: "mentorship_pairings",
  CHECK_INS: "mentorship_check_ins",
} as const;

export async function getMentorshipProfileServer(userId: string): Promise<MentorshipProfile | null> {
  const adminDb = getAdminDb();
  if (!adminDb) return null;
  const snap = await adminDb.collection(COLLECTIONS.PROFILES).doc(userId).get();
  if (!snap.exists) return null;
  return { ...snap.data(), userId: snap.id } as MentorshipProfile;
}

/**
 * Full-collection scan of active profiles. Kept for admin / migration use
 * (and as a fallback when a seeker has no skills to query against), but
 * the matches endpoint should call `getMentorshipMatchCandidatesServer`
 * — this function reads every active profile and the cost grows linearly
 * with the user base.
 *
 * @deprecated Prefer `getMentorshipMatchCandidatesServer`. Each call costs
 * one Firestore read per active profile.
 */
export async function getAllActiveMentorshipProfilesServer(): Promise<MentorshipProfile[]> {
  const adminDb = getAdminDb();
  if (!adminDb) return [];
  const snapshot = await adminDb
    .collection(COLLECTIONS.PROFILES)
    .where("isActive", "==", true)
    .orderBy("updatedAt", "desc")
    .get();
  return snapshot.docs.map((d) => ({ ...d.data(), userId: d.id })) as MentorshipProfile[];
}

// Firestore caps `array-contains-any` at 30 values; we also cap the
// returned candidate pool so a single popular skill can't pull thousands of
// profiles. The match score function ranks within this pool, so increasing
// CANDIDATE_LIMIT trades reads for match quality on the long tail.
const ARRAY_CONTAINS_ANY_CAP = 30;
const CANDIDATE_LIMIT = 100;

/**
 * Fetch a bounded pool of candidate profiles likely to score above zero
 * for `seeker`, using Firestore `array-contains-any` against the
 * denormalized `normalizedExpertise` / `normalizedLearningGoals` fields.
 *
 * Read cost: O(matched candidates), capped at `CANDIDATE_LIMIT`. Compare
 * with `getAllActiveMentorshipProfilesServer` which is O(all active).
 *
 * Direction:
 *   - seeker.role === "mentee" → query candidates whose expertise overlaps
 *     seeker.learningGoals, with role IN ["mentor", "both"].
 *   - seeker.role === "mentor" → query candidates whose learningGoals
 *     overlap seeker.expertise, with role IN ["mentee", "both"].
 *   - seeker.role === "both" → run both queries in parallel and dedupe.
 *
 * Falls back to the deprecated full scan only when the seeker has *no*
 * skills to query against (otherwise the query would be meaningless).
 */
export async function getMentorshipMatchCandidatesServer(
  seeker: MentorshipProfile
): Promise<MentorshipProfile[]> {
  const adminDb = getAdminDb();
  if (!adminDb) return [];

  const seekerLearning = normalizeSkills(seeker.learningGoals).slice(
    0,
    ARRAY_CONTAINS_ANY_CAP
  );
  const seekerExpertise = normalizeSkills(seeker.expertise).slice(
    0,
    ARRAY_CONTAINS_ANY_CAP
  );

  const wantsMentor = seeker.role === "mentee" || seeker.role === "both";
  const wantsMentee = seeker.role === "mentor" || seeker.role === "both";

  // If the seeker has nothing to query against, fall back to the full
  // scan — the UX otherwise shows zero matches with no explanation.
  // Seeker has no skills → can't filter; load up to CANDIDATE_LIMIT
  // active profiles instead.
  const hasMentorQuery = wantsMentor && seekerLearning.length > 0;
  const hasMenteeQuery = wantsMentee && seekerExpertise.length > 0;
  if (!hasMentorQuery && !hasMenteeQuery) {
    const fallback = await adminDb
      .collection(COLLECTIONS.PROFILES)
      .where("isActive", "==", true)
      .orderBy("updatedAt", "desc")
      .limit(CANDIDATE_LIMIT)
      .get();
    return fallback.docs.map(
      (d) => ({ ...d.data(), userId: d.id }) as MentorshipProfile
    );
  }

  const queries: Promise<FirebaseFirestore.QuerySnapshot>[] = [];
  // role IN [...] queries — Firestore allows up to 30 values for `in`,
  // so explicit two-element arrays are safe.
  const mentorRoles: MentorshipRole[] = ["mentor", "both"];
  const menteeRoles: MentorshipRole[] = ["mentee", "both"];

  if (hasMentorQuery) {
    queries.push(
      adminDb
        .collection(COLLECTIONS.PROFILES)
        .where("isActive", "==", true)
        .where("role", "in", mentorRoles)
        .where("normalizedExpertise", "array-contains-any", seekerLearning)
        .limit(CANDIDATE_LIMIT)
        .get()
    );
  }
  if (hasMenteeQuery) {
    queries.push(
      adminDb
        .collection(COLLECTIONS.PROFILES)
        .where("isActive", "==", true)
        .where("role", "in", menteeRoles)
        .where(
          "normalizedLearningGoals",
          "array-contains-any",
          seekerExpertise
        )
        .limit(CANDIDATE_LIMIT)
        .get()
    );
  }

  const snaps = await Promise.all(queries);
  const seen = new Set<string>();
  const out: MentorshipProfile[] = [];
  for (const snap of snaps) {
    for (const d of snap.docs) {
      if (d.id === seeker.userId) continue;
      if (seen.has(d.id)) continue;
      seen.add(d.id);
      out.push({ ...d.data(), userId: d.id } as MentorshipProfile);
    }
  }
  return out;
}

export async function createOrUpdateMentorshipProfileServer(
  userId: string,
  profile: Omit<MentorshipProfile, "userId" | "createdAt" | "updatedAt">
): Promise<void> {
  const adminDb = getAdminDb();
  if (!adminDb) throw new Error("Firebase Admin not initialized");
  // Denormalize lowercase skill arrays so the candidate-fetch path can
  // use Firestore `array-contains-any` without case-sensitivity issues.
  const denormalized = {
    ...profile,
    normalizedExpertise: normalizeSkills(profile.expertise),
    normalizedLearningGoals: normalizeSkills(profile.learningGoals),
  };
  const ref = adminDb.collection(COLLECTIONS.PROFILES).doc(userId);
  const existing = await ref.get();
  if (existing.exists) {
    await ref.update({ ...denormalized, updatedAt: new Date() });
  } else {
    await ref.set({
      ...denormalized,
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}

export async function createMentorshipRequestServer(
  request: Omit<MentorshipRequest, "id" | "createdAt" | "updatedAt" | "status">
): Promise<string> {
  const adminDb = getAdminDb();
  if (!adminDb) throw new Error("Firebase Admin not initialized");
  const ref = await adminDb.collection(COLLECTIONS.REQUESTS).add({
    ...request,
    status: "pending" as MentorshipRequestStatus,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return ref.id;
}

export async function getMentorshipRequestsForUserServer(
  userId: string,
  type: "sent" | "received"
): Promise<MentorshipRequest[]> {
  const adminDb = getAdminDb();
  if (!adminDb) return [];
  const field = type === "sent" ? "fromUserId" : "toUserId";
  const snapshot = await adminDb
    .collection(COLLECTIONS.REQUESTS)
    .where(field, "==", userId)
    .orderBy("createdAt", "desc")
    .get();
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as MentorshipRequest[];
}

export async function respondToMentorshipRequestServer(
  requestId: string,
  userId: string,
  action: "accept" | "decline"
): Promise<{ status: MentorshipRequestStatus; pairingId?: string }> {
  const adminDb = getAdminDb();
  if (!adminDb) throw new Error("Firebase Admin not initialized");

  return adminDb.runTransaction(async (tx) => {
    const requestRef = adminDb.collection(COLLECTIONS.REQUESTS).doc(requestId);
    const requestDoc = await tx.get(requestRef);

    if (!requestDoc.exists) throw new MentorshipRequestNotFoundError();
    const data = requestDoc.data();
    if (!data) throw new MentorshipRequestNotFoundError();
    if (data.toUserId !== userId) throw new MentorshipRequestUnauthorizedError();
    if (data.status !== "pending") throw new MentorshipRequestAlreadyRespondedError();

    const newStatus: MentorshipRequestStatus = action === "accept" ? "accepted" : "declined";
    tx.update(requestRef, { status: newStatus, updatedAt: new Date() });

    let pairingId: string | undefined;
    if (action === "accept") {
      const pairingRef = adminDb.collection(COLLECTIONS.PAIRINGS).doc();
      const goals = (data.goals as string[]).map((g, i) => ({
        id: `goal-${Date.now()}-${i}`,
        description: g,
        status: "in-progress" as GoalStatus,
      }));
      tx.set(pairingRef, {
        mentorId: data.toUserId,
        menteeId: data.fromUserId,
        goals,
        status: "active",
        startedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      pairingId = pairingRef.id;
    }

    return { status: newStatus, pairingId };
  });
}

export async function getMentorshipPairingsForUserServer(userId: string): Promise<MentorshipPairing[]> {
  const adminDb = getAdminDb();
  if (!adminDb) return [];
  const [mentorSnap, menteeSnap] = await Promise.all([
    adminDb.collection(COLLECTIONS.PAIRINGS).where("mentorId", "==", userId).where("status", "==", "active").get(),
    adminDb.collection(COLLECTIONS.PAIRINGS).where("menteeId", "==", userId).where("status", "==", "active").get(),
  ]);
  const seen = new Set<string>();
  const pairings: MentorshipPairing[] = [];
  for (const doc of [...mentorSnap.docs, ...menteeSnap.docs]) {
    if (!seen.has(doc.id)) {
      seen.add(doc.id);
      pairings.push({ id: doc.id, ...doc.data() } as MentorshipPairing);
    }
  }
  return pairings;
}

export async function addCheckInServer(
  checkIn: Omit<MentorshipCheckIn, "id" | "createdAt">
): Promise<string> {
  const adminDb = getAdminDb();
  if (!adminDb) throw new Error("Firebase Admin not initialized");
  const ref = await adminDb.collection(COLLECTIONS.CHECK_INS).add({
    ...checkIn,
    createdAt: new Date(),
  });
  return ref.id;
}

export async function updateGoalStatusServer(
  pairingId: string,
  goalId: string,
  status: GoalStatus
): Promise<void> {
  const adminDb = getAdminDb();
  if (!adminDb) throw new Error("Firebase Admin not initialized");
  const ref = adminDb.collection(COLLECTIONS.PAIRINGS).doc(pairingId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Pairing not found");
  const data = snap.data() as MentorshipPairing;
  const goals = data.goals.map((g) =>
    g.id === goalId
      ? { ...g, status, ...(status === "completed" ? { completedAt: new Date() } : {}) }
      : g
  );
  await ref.update({ goals, updatedAt: new Date() });
}
