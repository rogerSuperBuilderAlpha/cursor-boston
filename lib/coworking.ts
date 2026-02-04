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

  // Get all registrations for this event at once (single field query)
  const registrationsRef = db.collection("coworkingRegistrations");
  const allRegistrationsSnapshot = await registrationsRef
    .where("eventId", "==", eventId)
    .get();
  
  const allRegistrations = allRegistrationsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as CoworkingRegistration[];

  for (const session of sessions) {
    // Filter registrations for this session in memory
    const registrations = allRegistrations.filter(
      (r) => r.sessionId === session.id
    );

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
    // Pre-fetch data outside transaction to avoid composite index issues
    // Get session
    const sessionDoc = await sessionsRef.doc(sessionId).get();
    if (!sessionDoc.exists) {
      return { success: false, error: "Session not found" };
    }

    const session = sessionDoc.data() as Omit<CoworkingSession, "id">;
    if (session.eventId !== eventId) {
      return { success: false, error: "Session does not belong to this event" };
    }

    // Check if user already registered for ANY session in this event
    // Use single field query to avoid composite index requirement
    const userRegistrations = await registrationsRef
      .where("userId", "==", userId)
      .get();
    
    const existingForEvent = userRegistrations.docs.find(
      (doc) => doc.data().eventId === eventId
    );

    if (existingForEvent) {
      const existingReg = existingForEvent.data();
      if (existingReg.sessionId === sessionId) {
        return { success: false, error: "You are already registered for this session" };
      }
      return { success: false, error: "You are already registered for another session at this event. Cancel your existing registration first." };
    }

    // Check capacity using single field query
    const sessionRegistrations = await registrationsRef
      .where("sessionId", "==", sessionId)
      .get();

    if (sessionRegistrations.size >= session.maxSlots) {
      return { success: false, error: "This session is full" };
    }

    // Create registration in transaction
    const result = await db.runTransaction(async (tx) => {
      // Re-check capacity in transaction for race condition safety
      const currentCount = (await tx.get(sessionsRef.doc(sessionId))).data()?.currentBookings || 0;
      if (currentCount >= session.maxSlots) {
        return { success: false, error: "This session is full" };
      }

      // Create registration
      const registrationRef = registrationsRef.doc();
      
      // Build registration data, excluding undefined values
      const registrationData: Record<string, unknown> = {
        eventId,
        sessionId,
        userId,
        userDisplayName: userProfile.displayName,
        registeredAt: FieldValue.serverTimestamp(),
      };
      
      // Only include optional fields if they have values
      if (userProfile.photoUrl) {
        registrationData.userPhotoUrl = userProfile.photoUrl;
      }
      if (userProfile.github) {
        registrationData.userGithub = userProfile.github;
      }

      tx.set(registrationRef, registrationData);
      
      const registration: Omit<CoworkingRegistration, "id"> = {
        eventId,
        sessionId,
        userId,
        userDisplayName: userProfile.displayName,
        userPhotoUrl: userProfile.photoUrl,
        userGithub: userProfile.github,
        registeredAt: Timestamp.now(),
      };

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
    return { success: false, error: "Failed to register. Please try again." };
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
    // Use single field query to avoid composite index requirement
    const snapshot = await registrationsRef
      .where("userId", "==", userId)
      .get();
    
    // Filter for this event in memory
    const regDoc = snapshot.docs.find(
      (doc) => doc.data().eventId === eventId
    );

    if (!regDoc) {
      return { success: false, error: "No registration found" };
    }

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
    photoUrl: profile?.photoURL,
    github: profile?.github?.login,
  };
}
