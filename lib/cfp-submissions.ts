import { doc, setDoc, getDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "./firebase";
import { sanitizeText, sanitizeName } from "./sanitize";

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

const ABSTRACT_MIN_WORDS = 1500;
const ABSTRACT_MAX_WORDS = 2500;

export function countWords(text: string): number {
  if (!text || typeof text !== "string") return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function isValidEduEmail(email: string): boolean {
  if (!email || typeof email !== "string") return false;
  return email.toLowerCase().trim().endsWith(".edu");
}

export interface CfpSubmission {
  abstract: string;
  name: string;
  email: string;
  school: string;
  department: string;
  advisor: string;
  thesisTitle: string;
  userId: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface CfpSubmissionInput {
  abstract: string;
  name: string;
  email: string;
  school: string;
  department: string;
  advisor: string;
  thesisTitle: string;
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL || "hello@cursorboston.com";

/**
 * Validate CFP submission data
 */
export function validateCfpSubmission(data: CfpSubmissionInput): string | null {
  const wordCount = countWords(data.abstract);
  if (wordCount < ABSTRACT_MIN_WORDS) {
    return `Abstract must be at least ${ABSTRACT_MIN_WORDS} words (currently ${wordCount}).`;
  }
  if (wordCount > ABSTRACT_MAX_WORDS) {
    return `Abstract must be at most ${ABSTRACT_MAX_WORDS} words (currently ${wordCount}).`;
  }
  if (!isValidEduEmail(data.email)) {
    return "Email must be an institutional .edu address.";
  }
  if (!data.name?.trim()) return "Name is required.";
  if (!data.school?.trim()) return "School is required.";
  if (!data.department?.trim()) return "Department is required.";
  if (!data.advisor?.trim()) return "Advisor is required.";
  if (!data.thesisTitle?.trim()) return "Thesis title/topic is required.";
  return null;
}

/**
 * Submit or update a CFP proposal in Firestore.
 * Uses userId as document ID for one submission per user.
 */
export async function submitCfpProposal(
  data: CfpSubmissionInput,
  userId: string
): Promise<void> {
  if (!db) {
    throw new Error("Firebase is not configured");
  }

  const error = validateCfpSubmission(data);
  if (error) {
    throw new Error(error);
  }

  const sanitized: Omit<CfpSubmission, "userId" | "createdAt" | "updatedAt"> = {
    abstract: sanitizeText(data.abstract),
    name: sanitizeName(data.name),
    email: data.email.trim().toLowerCase(),
    school: sanitizeText(data.school),
    department: sanitizeText(data.department),
    advisor: sanitizeText(data.advisor),
    thesisTitle: sanitizeText(data.thesisTitle),
  };

  const docRef = doc(db, "cfpSubmissions", userId);

  const existing = await getDoc(docRef);
  const now = serverTimestamp();

  const payload: Record<string, unknown> = {
    ...sanitized,
    userId,
    updatedAt: now,
  };
  if (!existing.exists()) {
    payload.createdAt = now;
  }

  await setDoc(docRef, payload, { merge: true });

  // Admin notification (mail collection may be server-only; submission still succeeds)
  try {
    const { addDoc, collection } = await import("firebase/firestore");
    await addDoc(collection(db, "mail"), {
      to: ADMIN_EMAIL,
      message: {
        subject: `CFP Submission: ${escapeHtml(sanitized.thesisTitle)}`,
        html: `
          <h2>New CFP Submission</h2>
          <p>A graduate student has submitted to the "What is AI?" conference.</p>
          
          <h3>Submitter Info</h3>
          <ul>
            <li><strong>Name:</strong> ${escapeHtml(sanitized.name)}</li>
            <li><strong>Email:</strong> ${escapeHtml(sanitized.email)}</li>
            <li><strong>School:</strong> ${escapeHtml(sanitized.school)}</li>
            <li><strong>Department:</strong> ${escapeHtml(sanitized.department)}</li>
            <li><strong>Advisor:</strong> ${escapeHtml(sanitized.advisor)}</li>
            <li><strong>Thesis Title:</strong> ${escapeHtml(sanitized.thesisTitle)}</li>
          </ul>
          
          <h3>Abstract</h3>
          <p>${escapeHtml(sanitized.abstract)}</p>
          
          <hr>
          <p><small>User ID: ${userId}</small></p>
        `,
      },
    });
  } catch {
    // Ignore mail errors; submission is already saved
  }
}

/**
 * Fetch existing CFP submission for a user
 */
export async function getCfpSubmission(userId: string): Promise<CfpSubmission | null> {
  if (!db) {
    throw new Error("Firebase is not configured");
  }

  const docRef = doc(db, "cfpSubmissions", userId);
  const snap = await getDoc(docRef);

  if (!snap.exists()) {
    return null;
  }

  return snap.data() as CfpSubmission;
}
