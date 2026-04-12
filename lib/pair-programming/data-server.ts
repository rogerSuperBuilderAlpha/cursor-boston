/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { getAdminDb } from "@/lib/firebase-admin";
import type {
  PairProfile,
  PairRequest,
  RequestStatus,
} from "./types";

/** Custom error classes for typed error handling in API routes */
export class PairRequestNotFoundError extends Error {
  constructor() { super("Request not found"); this.name = "PairRequestNotFoundError"; }
}
export class PairRequestUnauthorizedError extends Error {
  constructor() { super("Unauthorized"); this.name = "PairRequestUnauthorizedError"; }
}
export class PairRequestAlreadyRespondedError extends Error {
  constructor() { super("Request has already been responded to"); this.name = "PairRequestAlreadyRespondedError"; }
}

// Collection names
const COLLECTIONS = {
  PROFILES: "pair_profiles",
  REQUESTS: "pair_requests",
  SESSIONS: "pair_sessions",
} as const;

// ─── Server-side operations (for API routes) ────────────────────────────────

/**
 * Loads a pair profile by user id via Admin Firestore (API routes).
 *
 * @param userId - Profile document id.
 * @returns Profile with `userId` set, or `null` if missing or Admin unavailable.
 */
export async function getPairProfileServer(userId: string): Promise<PairProfile | null> {
  const adminDb = getAdminDb();
  if (!adminDb) return null;
  const docRef = adminDb.collection(COLLECTIONS.PROFILES).doc(userId);
  const docSnap = await docRef.get();
  if (!docSnap.exists) return null;
  return { ...docSnap.data(), userId: docSnap.id } as PairProfile;
}

/**
 * Lists active pair profiles ordered by `updatedAt` descending (Admin SDK).
 *
 * @returns Array of profiles, or empty if Admin is unavailable.
 */
export async function getAllActiveProfilesServer(): Promise<PairProfile[]> {
  const adminDb = getAdminDb();
  if (!adminDb) return [];
  const snapshot = await adminDb
    .collection(COLLECTIONS.PROFILES)
    .where("isActive", "==", true)
    .orderBy("updatedAt", "desc")
    .get();
  return snapshot.docs.map((d) => ({
    ...d.data(),
    userId: d.id,
  })) as PairProfile[];
}

/**
 * Creates or updates `pair_profiles/{userId}` with server timestamps.
 *
 * @param userId - Owner uid.
 * @param profile - Writable profile fields (excludes `userId`, `createdAt`, `updatedAt`).
 * @throws Error when Firebase Admin is not initialized.
 */
export async function createOrUpdatePairProfileServer(
  userId: string,
  profile: Omit<PairProfile, "userId" | "createdAt" | "updatedAt">
): Promise<void> {
  const adminDb = getAdminDb();
  if (!adminDb) throw new Error("Firebase Admin not initialized");

  const docRef = adminDb.collection(COLLECTIONS.PROFILES).doc(userId);
  const existing = await docRef.get();

  if (existing.exists) {
    await docRef.update({
      ...profile,
      updatedAt: new Date(),
    });
  } else {
    await docRef.set({
      ...profile,
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}

/**
 * Creates a pending pair request document.
 *
 * @param request - From/to users, session type, proposed time, etc. (id/timestamps/status added here).
 * @returns New Firestore document id.
 * @throws Error when Firebase Admin is not initialized.
 */
export async function createPairRequestServer(
  request: Omit<PairRequest, "id" | "createdAt" | "updatedAt" | "status">
): Promise<string> {
  const adminDb = getAdminDb();
  if (!adminDb) throw new Error("Firebase Admin not initialized");
  const docRef = await adminDb.collection(COLLECTIONS.REQUESTS).add({
    ...request,
    status: "pending" as RequestStatus,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return docRef.id;
}

/**
 * Lists pair requests sent by or received by the user, newest first.
 *
 * @param userId - User whose requests to load.
 * @param type - `"sent"` filters `fromUserId`; `"received"` filters `toUserId`.
 * @returns Request documents with `id` field, or empty if Admin unavailable.
 */
export async function getPairRequestsForUserServer(
  userId: string,
  type: "sent" | "received"
): Promise<PairRequest[]> {
  const adminDb = getAdminDb();
  if (!adminDb) return [];
  const field = type === "sent" ? "fromUserId" : "toUserId";
  const snapshot = await adminDb
    .collection(COLLECTIONS.REQUESTS)
    .where(field, "==", userId)
    .orderBy("createdAt", "desc")
    .get();
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as PairRequest[];
}

/**
 * Recipient accepts or declines a pending request; on accept, creates a `pair_sessions` row in the same transaction.
 *
 * @param requestId - Request document id.
 * @param userId - Acting user (must be `toUserId`).
 * @param action - `"accept"` or `"decline"`.
 * @returns New status and optional `sessionId` when accepted.
 * @throws PairRequestNotFoundError | PairRequestUnauthorizedError | PairRequestAlreadyRespondedError | Error.
 */
export async function respondToPairRequestServer(
  requestId: string,
  userId: string,
  action: "accept" | "decline"
): Promise<{ status: RequestStatus; sessionId?: string }> {
  const adminDb = getAdminDb();
  if (!adminDb) throw new Error("Firebase Admin not initialized");

  // Use a transaction to prevent race conditions
  return adminDb.runTransaction(async (transaction) => {
    const requestRef = adminDb.collection(COLLECTIONS.REQUESTS).doc(requestId);
    const requestDoc = await transaction.get(requestRef);

    if (!requestDoc.exists) {
      throw new PairRequestNotFoundError();
    }

    const requestData = requestDoc.data();
    if (!requestData) {
      throw new PairRequestNotFoundError();
    }

    if (requestData.toUserId !== userId) {
      throw new PairRequestUnauthorizedError();
    }

    if (requestData.status !== "pending") {
      throw new PairRequestAlreadyRespondedError();
    }

    const newStatus: RequestStatus = action === "accept" ? "accepted" : "declined";
    transaction.update(requestRef, {
      status: newStatus,
      updatedAt: new Date(),
    });

    let sessionId: string | undefined;
    if (action === "accept") {
      const sessionRef = adminDb.collection(COLLECTIONS.SESSIONS).doc();
      transaction.set(sessionRef, {
        participantIds: [requestData.fromUserId, userId],
        sessionType: requestData.sessionType,
        status: "scheduled",
        scheduledTime: requestData.proposedTime || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      sessionId = sessionRef.id;
    }

    return { status: newStatus, sessionId };
  });
}
