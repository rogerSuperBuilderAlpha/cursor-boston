/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type {
  PairProfile,
  PairSession,
} from "./types";

// Collection names
const COLLECTIONS = {
  PROFILES: "pair_profiles",
  SESSIONS: "pair_sessions",
} as const;

// ─── Client-side Firestore operations ───────────────────────────────────────

/**
 * Loads `pair_profiles/{userId}` with the client Firestore SDK.
 *
 * @param userId - Profile id.
 * @returns Profile or `null` if missing or Firestore not configured.
 */
export async function getPairProfile(userId: string): Promise<PairProfile | null> {
  if (!db) return null;
  const docRef = doc(db, COLLECTIONS.PROFILES, userId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  return { ...docSnap.data(), userId: docSnap.id } as PairProfile;
}

/**
 * Lists active profiles for matching UI (client), ordered by `updatedAt` desc.
 *
 * @returns Profiles or empty array when Firestore is unavailable.
 */
export async function getAllActiveProfiles(): Promise<PairProfile[]> {
  if (!db) return [];
  const q = query(
    collection(db, COLLECTIONS.PROFILES),
    where("isActive", "==", true),
    orderBy("updatedAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    ...d.data(),
    userId: d.id,
  })) as PairProfile[];
}

/**
 * Pair sessions where `participantIds` contains the user, newest first.
 *
 * @param userId - Participant uid.
 * @returns Session documents with `id`, or empty if Firestore unavailable.
 */
export async function getPairSessionsForUser(userId: string): Promise<PairSession[]> {
  if (!db) return [];
  const q = query(
    collection(db, COLLECTIONS.SESSIONS),
    where("participantIds", "array-contains", userId),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as PairSession[];
}

/**
 * Partial update on `pair_sessions/{sessionId}` with `updatedAt` server timestamp.
 *
 * @param sessionId - Session document id.
 * @param updates - Mutable session fields.
 * @throws Error when client Firestore is not initialized.
 */
export async function updatePairSession(
  sessionId: string,
  updates: Partial<PairSession>
): Promise<void> {
  if (!db) throw new Error("Firestore not initialized");
  const docRef = doc(db, COLLECTIONS.SESSIONS, sessionId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}
