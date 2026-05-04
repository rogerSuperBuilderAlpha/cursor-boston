/**
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
} from "./types";

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

export async function createOrUpdateMentorshipProfileServer(
  userId: string,
  profile: Omit<MentorshipProfile, "userId" | "createdAt" | "updatedAt">
): Promise<void> {
  const adminDb = getAdminDb();
  if (!adminDb) throw new Error("Firebase Admin not initialized");
  const ref = adminDb.collection(COLLECTIONS.PROFILES).doc(userId);
  const existing = await ref.get();
  if (existing.exists) {
    await ref.update({ ...profile, updatedAt: new Date() });
  } else {
    await ref.set({ ...profile, userId, createdAt: new Date(), updatedAt: new Date() });
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
