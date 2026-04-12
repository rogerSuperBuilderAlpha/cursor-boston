/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";

export interface EventRegistration {
  id: string;
  eventId: string;
  eventTitle: string;
  eventDate?: string;
  userId: string;
  userEmail: string;
  userName?: string;
  registeredAt: Timestamp;
  source: "luma" | "manual";
  lumaGuestId?: string;
  status: "registered" | "attended" | "cancelled";
}

export interface UserStats {
  eventsRegistered: number;
  eventsAttended: number;
  talksSubmitted: number;
  talksGiven: number;
  pullRequestsCount?: number;
}

/**
 * Register a user for an event in Firestore.
 * Silently returns if the user is already registered.
 * @param userId - The unique ID of the user
 * @param userEmail - The email address of the user
 * @param userName - The display name of the user
 * @param eventId - The unique ID of the event
 * @param eventTitle - The title of the event
 * @param eventDate - The date of the event (optional)
 * @param lumaGuestId - The Luma guest ID if registered via Luma (optional)
 * @returns A promise that resolves when registration is complete
 * @throws Error if Firebase is not configured
 */
export async function registerForEvent(
  userId: string,
  userEmail: string,
  userName: string | undefined,
  eventId: string,
  eventTitle: string,
  eventDate?: string,
  lumaGuestId?: string
): Promise<void> {
  if (!db) throw new Error("Firebase is not configured");

  const registrationId = `${userId}_${eventId}`;
  const registrationRef = doc(db, "eventRegistrations", registrationId);

  // Check if already registered
  const existing = await getDoc(registrationRef);
  if (existing.exists()) {
    return; // Already registered
  }

  await setDoc(registrationRef, {
    id: registrationId,
    eventId,
    eventTitle,
    eventDate,
    userId,
    userEmail,
    userName,
    registeredAt: serverTimestamp(),
    source: lumaGuestId ? "luma" : "manual",
    lumaGuestId,
    status: "registered",
  });
}

/**
 * Get all event registrations for a user.
 * @param userId - The unique ID of the user
 * @returns A promise resolving to an array of event registrations, or empty array if Firebase is not configured
 */
export async function getUserRegistrations(
  userId: string
): Promise<EventRegistration[]> {
  if (!db) return [];

  const registrationsRef = collection(db, "eventRegistrations");
  const q = query(registrationsRef, where("userId", "==", userId));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => doc.data() as EventRegistration);
}

/**
 * Get activity stats for a user including events, talks, and merged pull requests.
 * @param userId - The unique ID of the user
 * @returns A promise resolving to the user's stats object with zeroed values if Firebase is not configured
 */
export async function getUserStats(userId: string): Promise<UserStats> {
  if (!db) {
    return {
      eventsRegistered: 0,
      eventsAttended: 0,
      talksSubmitted: 0,
      talksGiven: 0,
      pullRequestsCount: 0,
    };
  }

  // Get event registrations
  const registrationsRef = collection(db, "eventRegistrations");
  const regQuery = query(registrationsRef, where("userId", "==", userId));
  const regSnapshot = await getDocs(regQuery);

  const registrations = regSnapshot.docs.map(
    (doc) => doc.data() as EventRegistration
  );
  const eventsRegistered = registrations.length;
  const eventsAttended = registrations.filter(
    (r) => r.status === "attended"
  ).length;

  // Get talk submissions
  const talksRef = collection(db, "talkSubmissions");
  const talksQuery = query(talksRef, where("userId", "==", userId));
  const talksSnapshot = await getDocs(talksQuery);

  const talksSubmitted = talksSnapshot.size;
  const talksGiven = talksSnapshot.docs.filter(
    (doc) => doc.data().status === "completed"
  ).length;

  // Count trusted merged PR records instead of relying only on a cached user field.
  const pullRequestsRef = collection(db, "pullRequests");
  const pullRequestsQuery = query(
    pullRequestsRef,
    where("userId", "==", userId),
    where("state", "==", "merged")
  );
  const pullRequestsSnapshot = await getDocs(pullRequestsQuery);
  const pullRequestsCount = pullRequestsSnapshot.size;

  return {
    eventsRegistered,
    eventsAttended,
    talksSubmitted,
    talksGiven,
    pullRequestsCount,
  };
}

/**
 * Check if a user is registered for a specific event.
 * @param userId - The unique ID of the user
 * @param eventId - The unique ID of the event
 * @returns A promise resolving to true if the user is registered, false otherwise
 */
export async function isUserRegistered(
  userId: string,
  eventId: string
): Promise<boolean> {
  if (!db) return false;

  const registrationId = `${userId}_${eventId}`;
  const registrationRef = doc(db, "eventRegistrations", registrationId);
  const snapshot = await getDoc(registrationRef);

  return snapshot.exists();
}
