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
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { MentorshipProfile, MentorshipPairing } from "./types";

const COLLECTIONS = {
  PROFILES: "mentorship_profiles",
  REQUESTS: "mentorship_requests",
  PAIRINGS: "mentorship_pairings",
  CHECK_INS: "mentorship_check_ins",
} as const;

export async function getMentorshipProfile(userId: string): Promise<MentorshipProfile | null> {
  if (!db) return null;
  const snap = await getDoc(doc(db, COLLECTIONS.PROFILES, userId));
  if (!snap.exists()) return null;
  return { ...snap.data(), userId: snap.id } as MentorshipProfile;
}

export async function getAllActiveMentorshipProfiles(): Promise<MentorshipProfile[]> {
  if (!db) return [];
  const q = query(
    collection(db, COLLECTIONS.PROFILES),
    where("isActive", "==", true),
    orderBy("updatedAt", "desc"),
    limit(100)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ ...d.data(), userId: d.id })) as MentorshipProfile[];
}

export async function getMentorshipPairingsForUser(userId: string): Promise<MentorshipPairing[]> {
  if (!db) return [];
  // Fetch as mentor and mentee separately since Firestore doesn't support OR on different fields
  const [mentorSnap, menteeSnap] = await Promise.all([
    getDocs(query(
      collection(db, COLLECTIONS.PAIRINGS),
      where("mentorId", "==", userId),
      where("status", "==", "active"),
      orderBy("createdAt", "desc")
    )),
    getDocs(query(
      collection(db, COLLECTIONS.PAIRINGS),
      where("menteeId", "==", userId),
      where("status", "==", "active"),
      orderBy("createdAt", "desc")
    )),
  ]);

  const seen = new Set<string>();
  const pairings: MentorshipPairing[] = [];
  for (const snap of [...mentorSnap.docs, ...menteeSnap.docs]) {
    if (!seen.has(snap.id)) {
      seen.add(snap.id);
      pairings.push({ id: snap.id, ...snap.data() } as MentorshipPairing);
    }
  }
  return pairings;
}
