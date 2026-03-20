import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

export interface TalkSubmission {
  // Submitter info
  name: string;
  email: string;
  // Talk details
  title: string;
  description: string;
  category: string;
  duration: string; // "5-10 min", "15-20 min", "30+ min"
  experience: string; // "beginner", "intermediate", "advanced"
  // Optional
  bio?: string;
  linkedIn?: string;
  twitter?: string;
  previousTalks?: string;
}

export interface EventRequest {
  // Requester info
  name: string;
  email: string;
  organization?: string;
  // Event details
  eventType: string; // "workshop", "meetup", "hackathon", "university-session"
  title: string;
  description: string;
  proposedDate?: string;
  expectedAttendees: string;
  venue?: string;
  // Additional info
  additionalInfo?: string;
}

/**
 * Submit a talk proposal to Firestore
 * Also creates an email document for Firebase Trigger Email extension
 */
export async function submitTalkProposal(submission: TalkSubmission, userId?: string): Promise<string> {
  if (!db) {
    throw new Error("Firebase is not configured");
  }

  // Store the submission
  const submissionRef = await addDoc(collection(db, "talkSubmissions"), {
    ...submission,
    userId: userId || null,
    status: "pending",
    createdAt: serverTimestamp(),
  });

  try {
    await fetch("/api/notify-admin/talk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...submission,
        submissionId: submissionRef.id,
      }),
    });
  } catch {
    // Ignore; submission is saved
  }

  return submissionRef.id;
}

/**
 * Submit an event request to Firestore
 * Also creates an email document for Firebase Trigger Email extension
 */
export async function submitEventRequest(request: EventRequest, userId?: string): Promise<string> {
  if (!db) {
    throw new Error("Firebase is not configured");
  }

  // Store the request
  const requestRef = await addDoc(collection(db, "eventRequests"), {
    ...request,
    userId: userId || null,
    status: "pending",
    createdAt: serverTimestamp(),
  });

  try {
    await fetch("/api/notify-admin/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...request,
        requestId: requestRef.id,
      }),
    });
  } catch {
    // Ignore; request is saved
  }

  return requestRef.id;
}
