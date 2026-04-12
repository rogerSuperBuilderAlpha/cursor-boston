/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { doc, setDoc, getDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "./firebase";
import { sanitizeText, sanitizeName } from "./sanitize";

const ABSTRACT_MIN_WORDS = 1500;
const ABSTRACT_MAX_WORDS = 2500;

/**
 * @param text - Prose to measure.
 * @returns Word count (whitespace-separated tokens); `0` for empty or non-string.
 */
export function countWords(text: string): number {
  if (!text || typeof text !== "string") return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * @param email - Email string to test.
 * @returns `true` if it ends with `.edu` (case-insensitive).
 */
export function isValidEduEmail(email: string): boolean {
  if (!email || typeof email !== "string") return false;
  return email.toLowerCase().trim().endsWith(".edu");
}

export interface UserProfileForEdu {
  email?: string | null;
  additionalEmails?: Array<{ email: string; verified: boolean }>;
}

/**
 * Whether the primary email is `.edu` or any verified additional email is `.edu`.
 *
 * @param userEmail - Primary account email.
 * @param userProfile - Optional profile with `additionalEmails`.
 * @returns `true` if a qualifying institutional email exists.
 */
export function hasVerifiedEduEmail(
  userEmail: string | null | undefined,
  userProfile: UserProfileForEdu | null | undefined
): boolean {
  if (isValidEduEmail(userEmail || "")) return true;
  const additional = userProfile?.additionalEmails || [];
  return additional.some(
    (e) => e.verified && isValidEduEmail(e.email)
  );
}

/**
 * Get the verified .edu email to use for CFP (primary first, then first verified additional)
 *
 * @param userEmail - Primary email.
 * @param userProfile - Optional profile with verified additional emails.
 * @returns Lowercased `.edu` address or `null`.
 */
export function getVerifiedEduEmail(
  userEmail: string | null | undefined,
  userProfile: UserProfileForEdu | null | undefined
): string | null {
  if (isValidEduEmail(userEmail || "")) return (userEmail || "").toLowerCase().trim();
  const additional = userProfile?.additionalEmails || [];
  const edu = additional.find((e) => e.verified && isValidEduEmail(e.email));
  return edu ? edu.email.toLowerCase().trim() : null;
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

/**
 * Validate CFP submission data
 *
 * @param data - Raw CFP form payload.
 * @returns Error message string, or `null` when valid.
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
 *
 * @param data - Validated input fields.
 * @param userId - Document id / owner.
 * @throws Error when Firestore is missing or {@link validateCfpSubmission} fails.
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

  try {
    await fetch("/api/notify-admin/cfp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...sanitized, userId }),
    });
  } catch {
    // Ignore; submission is saved
  }
}

/**
 * Loads the current user's CFP document if present.
 *
 * @param userId - Document id.
 * @returns Stored submission or `null`.
 * @throws Error when Firestore is not configured.
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
