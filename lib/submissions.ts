import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

/**
 * Escape HTML entities to prevent XSS in email templates
 */
function escapeHtml(text: string | undefined): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

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

// Admin email where notifications will be sent
// Configure via ADMIN_EMAIL environment variable, or defaults to hello@cursorboston.com
// This email will receive notifications for talk and event submissions
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "hello@cursorboston.com";

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

  // Create email notification for admin (with sanitized inputs)
  await addDoc(collection(db, "mail"), {
    to: ADMIN_EMAIL,
    message: {
      subject: `New Talk Submission: ${escapeHtml(submission.title)}`,
      html: `
        <h2>New Talk Submission</h2>
        <p>Someone has submitted a talk idea for Cursor Boston!</p>
        
        <h3>Submitter Info</h3>
        <ul>
          <li><strong>Name:</strong> ${escapeHtml(submission.name)}</li>
          <li><strong>Email:</strong> ${escapeHtml(submission.email)}</li>
          ${submission.linkedIn ? `<li><strong>LinkedIn:</strong> ${escapeHtml(submission.linkedIn)}</li>` : ""}
          ${submission.twitter ? `<li><strong>Twitter:</strong> ${escapeHtml(submission.twitter)}</li>` : ""}
        </ul>
        
        <h3>Talk Details</h3>
        <ul>
          <li><strong>Title:</strong> ${escapeHtml(submission.title)}</li>
          <li><strong>Category:</strong> ${escapeHtml(submission.category)}</li>
          <li><strong>Duration:</strong> ${escapeHtml(submission.duration)}</li>
          <li><strong>Experience Level:</strong> ${escapeHtml(submission.experience)}</li>
        </ul>
        
        <h3>Description</h3>
        <p>${escapeHtml(submission.description)}</p>
        
        ${submission.bio ? `<h3>Speaker Bio</h3><p>${escapeHtml(submission.bio)}</p>` : ""}
        ${submission.previousTalks ? `<h3>Previous Speaking Experience</h3><p>${escapeHtml(submission.previousTalks)}</p>` : ""}
        
        <hr>
        <p><small>Submission ID: ${submissionRef.id}</small></p>
      `,
    },
  });

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

  // Create email notification for admin (with sanitized inputs)
  await addDoc(collection(db, "mail"), {
    to: ADMIN_EMAIL,
    message: {
      subject: `New Event Request: ${escapeHtml(request.title)}`,
      html: `
        <h2>New Event Request</h2>
        <p>Someone wants to host or request an event with Cursor Boston!</p>
        
        <h3>Requester Info</h3>
        <ul>
          <li><strong>Name:</strong> ${escapeHtml(request.name)}</li>
          <li><strong>Email:</strong> ${escapeHtml(request.email)}</li>
          ${request.organization ? `<li><strong>Organization:</strong> ${escapeHtml(request.organization)}</li>` : ""}
        </ul>
        
        <h3>Event Details</h3>
        <ul>
          <li><strong>Type:</strong> ${escapeHtml(request.eventType)}</li>
          <li><strong>Title:</strong> ${escapeHtml(request.title)}</li>
          ${request.proposedDate ? `<li><strong>Proposed Date:</strong> ${escapeHtml(request.proposedDate)}</li>` : ""}
          <li><strong>Expected Attendees:</strong> ${escapeHtml(request.expectedAttendees)}</li>
          ${request.venue ? `<li><strong>Venue:</strong> ${escapeHtml(request.venue)}</li>` : ""}
        </ul>
        
        <h3>Description</h3>
        <p>${escapeHtml(request.description)}</p>
        
        ${request.additionalInfo ? `<h3>Additional Info</h3><p>${escapeHtml(request.additionalInfo)}</p>` : ""}
        
        <hr>
        <p><small>Request ID: ${requestRef.id}</small></p>
      `,
    },
  });

  return requestRef.id;
}
