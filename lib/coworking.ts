/**
 * Coworking Slots Management
 * 
 * Handles coworking session registration for events like Cafe Cursor.
 */

import { getAdminDb } from "./firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

// ============================================================================
// Types
// ============================================================================

export interface CoworkingSession {
  id: string;
  eventId: string;
  startTime: string; // e.g., "09:00"
  endTime: string;   // e.g., "11:00"
  label: string;     // e.g., "Morning Session (9:00 AM - 11:00 AM)"
  maxSlots: number;
  currentBookings: number;
}

export interface CoworkingRegistration {
  id: string;
  eventId: string;
  sessionId: string;
  userId: string;
  userDisplayName: string;
  userPhotoUrl?: string;
  userGithub?: string;
  registeredAt: Timestamp;
}

export interface CoworkingSlotStatus {
  session: CoworkingSession;
  availableSlots: number;
  isUserRegistered: boolean;
  userRegistrationId?: string;
  attendees: Array<{
    displayName: string;
    photoUrl?: string;
    github?: string;
  }>;
}

// ============================================================================
// Constants
// ============================================================================

// Session definitions for Cafe Cursor (9am-3pm, 2-hour sessions)
export const CAFE_CURSOR_SESSIONS: Omit<CoworkingSession, "id" | "eventId" | "currentBookings">[] = [
  {
    startTime: "09:00",
    endTime: "11:00",
    label: "Morning Session (9:00 AM - 11:00 AM)",
    maxSlots: 20,
  },
  {
    startTime: "11:00",
    endTime: "13:00",
    label: "Midday Session (11:00 AM - 1:00 PM)",
    maxSlots: 20,
  },
  {
    startTime: "13:00",
    endTime: "15:00",
    label: "Afternoon Session (1:00 PM - 3:00 PM)",
    maxSlots: 20,
  },
];

// ============================================================================
// Session Management
// ============================================================================

/**
 * Get or create sessions for an event
 */
export async function getOrCreateSessions(eventId: string): Promise<CoworkingSession[]> {
  const db = getAdminDb();
  if (!db) throw new Error("Firebase Admin not configured");

  const sessionsRef = db.collection("coworkingSessions");
  // Query without orderBy to avoid composite index requirement, sort in JS
  const existingSnapshot = await sessionsRef
    .where("eventId", "==", eventId)
    .get();

  if (!existingSnapshot.empty) {
    const sessions = existingSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as CoworkingSession[];
    // Sort by startTime in memory
    return sessions.sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  // Create sessions for this event
  const batch = db.batch();
  const sessions: CoworkingSession[] = [];

  for (const sessionDef of CAFE_CURSOR_SESSIONS) {
    const sessionRef = sessionsRef.doc();
    const session: CoworkingSession = {
      id: sessionRef.id,
      eventId,
      ...sessionDef,
      currentBookings: 0,
    };
    batch.set(sessionRef, {
      eventId,
      startTime: sessionDef.startTime,
      endTime: sessionDef.endTime,
      label: sessionDef.label,
      maxSlots: sessionDef.maxSlots,
      currentBookings: 0,
      createdAt: FieldValue.serverTimestamp(),
    });
    sessions.push(session);
  }

  await batch.commit();
  return sessions;
}

/**
 * Get all sessions with their current status
 */
export async function getSessionsWithStatus(
  eventId: string,
  userId?: string
): Promise<CoworkingSlotStatus[]> {
  const db = getAdminDb();
  if (!db) throw new Error("Firebase Admin not configured");

  const sessions = await getOrCreateSessions(eventId);
  const statuses: CoworkingSlotStatus[] = [];

  for (const session of sessions) {
    // Get registrations for this session
    const registrationsRef = db.collection("coworkingRegistrations");
    const registrationsSnapshot = await registrationsRef
      .where("eventId", "==", eventId)
      .where("sessionId", "==", session.id)
      .get();

    const registrations = registrationsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as CoworkingRegistration[];

    // Check if user is registered
    const userRegistration = userId
      ? registrations.find((r) => r.userId === userId)
      : undefined;

    // Build attendees list (public info only)
    const attendees = registrations.map((r) => ({
      displayName: r.userDisplayName,
      photoUrl: r.userPhotoUrl,
      github: r.userGithub,
    }));

    statuses.push({
      session: {
        ...session,
        currentBookings: registrations.length,
      },
      availableSlots: session.maxSlots - registrations.length,
      isUserRegistered: !!userRegistration,
      userRegistrationId: userRegistration?.id,
      attendees,
    });
  }

  return statuses;
}

// ============================================================================
// Registration Management
// ============================================================================

export interface RegisterResult {
  success: boolean;
  error?: string;
  registration?: CoworkingRegistration;
}

/**
 * Register a user for a coworking session
 */
export async function registerForSession(
  eventId: string,
  sessionId: string,
  userId: string,
  userProfile: {
    displayName: string;
    photoUrl?: string;
    github?: string;
  }
): Promise<RegisterResult> {
  const db = getAdminDb();
  if (!db) throw new Error("Firebase Admin not configured");

  const sessionsRef = db.collection("coworkingSessions");
  const registrationsRef = db.collection("coworkingRegistrations");

  // Use a transaction to ensure atomic registration
  try {
    const result = await db.runTransaction(async (tx) => {
      // Get session
      const sessionDoc = await tx.get(sessionsRef.doc(sessionId));
      if (!sessionDoc.exists) {
        return { success: false, error: "Session not found" };
      }

      const session = sessionDoc.data() as Omit<CoworkingSession, "id">;
      if (session.eventId !== eventId) {
        return { success: false, error: "Session does not belong to this event" };
      }

      // Check if user already registered for ANY session in this event
      const existingSnapshot = await tx.get(
        registrationsRef
          .where("eventId", "==", eventId)
          .where("userId", "==", userId)
      );

      if (!existingSnapshot.empty) {
        const existingReg = existingSnapshot.docs[0].data();
        if (existingReg.sessionId === sessionId) {
          return { success: false, error: "You are already registered for this session" };
        }
        return { success: false, error: "You are already registered for another session at this event. Cancel your existing registration first." };
      }

      // Check capacity
      const currentRegistrations = await tx.get(
        registrationsRef
          .where("eventId", "==", eventId)
          .where("sessionId", "==", sessionId)
      );

      if (currentRegistrations.size >= session.maxSlots) {
        return { success: false, error: "This session is full" };
      }

      // Create registration
      const registrationRef = registrationsRef.doc();
      const registration: Omit<CoworkingRegistration, "id"> = {
        eventId,
        sessionId,
        userId,
        userDisplayName: userProfile.displayName,
        userPhotoUrl: userProfile.photoUrl,
        userGithub: userProfile.github,
        registeredAt: Timestamp.now(),
      };

      tx.set(registrationRef, {
        ...registration,
        registeredAt: FieldValue.serverTimestamp(),
      });

      // Update session booking count
      tx.update(sessionsRef.doc(sessionId), {
        currentBookings: FieldValue.increment(1),
      });

      return {
        success: true,
        registration: {
          id: registrationRef.id,
          ...registration,
        },
      };
    });

    return result;
  } catch (error) {
    console.error("Error registering for session:", error);
    return { success: false, error: "Failed to register" };
  }
}

/**
 * Cancel a user's registration
 */
export async function cancelRegistration(
  eventId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const db = getAdminDb();
  if (!db) throw new Error("Firebase Admin not configured");

  const registrationsRef = db.collection("coworkingRegistrations");
  const sessionsRef = db.collection("coworkingSessions");

  try {
    const snapshot = await registrationsRef
      .where("eventId", "==", eventId)
      .where("userId", "==", userId)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return { success: false, error: "No registration found" };
    }

    const regDoc = snapshot.docs[0];
    const regData = regDoc.data();

    await db.runTransaction(async (tx) => {
      tx.delete(regDoc.ref);
      tx.update(sessionsRef.doc(regData.sessionId), {
        currentBookings: FieldValue.increment(-1),
      });
    });

    return { success: true };
  } catch (error) {
    console.error("Error canceling registration:", error);
    return { success: false, error: "Failed to cancel registration" };
  }
}

/**
 * Check if a user is eligible to register for coworking
 * Requirements: registered user, public profile, GitHub connected
 */
export async function checkCoworkingEligibility(
  userId: string
): Promise<{ eligible: boolean; reason?: string }> {
  const db = getAdminDb();
  if (!db) throw new Error("Firebase Admin not configured");

  const userRef = db.collection("users").doc(userId);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    return { eligible: false, reason: "Please complete your profile to register." };
  }

  const profile = userSnap.data();
  const visibility = profile?.visibility ?? {};

  if (!visibility.isPublic) {
    return { 
      eligible: false, 
      reason: "Make your profile public in Settings to register for coworking." 
    };
  }

  if (!profile?.github) {
    return { 
      eligible: false, 
      reason: "Connect your GitHub account in Settings to register for coworking." 
    };
  }

  return { eligible: true };
}

/**
 * Get user's profile info for registration
 */
export async function getUserProfileForRegistration(
  userId: string
): Promise<{ displayName: string; photoUrl?: string; github?: string } | null> {
  const db = getAdminDb();
  if (!db) return null;

  const userRef = db.collection("users").doc(userId);
  const userSnap = await userRef.get();

  if (!userSnap.exists) return null;

  const profile = userSnap.data();
  return {
    displayName: profile?.displayName || profile?.name || "Anonymous",
    photoUrl: profile?.photoUrl,
    github: profile?.github?.username,
  };
}
