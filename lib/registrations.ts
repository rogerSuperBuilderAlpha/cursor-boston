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

// Register user for an event
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

// Get user's event registrations
export async function getUserRegistrations(
  userId: string
): Promise<EventRegistration[]> {
  if (!db) return [];

  const registrationsRef = collection(db, "eventRegistrations");
  const q = query(registrationsRef, where("userId", "==", userId));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => doc.data() as EventRegistration);
}

// Get user stats
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

  // Get PR count from user profile
  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);
  const pullRequestsCount = userSnap.data()?.pullRequestsCount || 0;

  return {
    eventsRegistered,
    eventsAttended,
    talksSubmitted,
    talksGiven,
    pullRequestsCount,
  };
}

// Check if user is registered for an event
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
