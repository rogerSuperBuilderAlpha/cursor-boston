/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { sanitizeDocId, sanitizeText, sanitizeUrl } from "@/lib/sanitize";

export const MONTHLY_CHALLENGES_COLLECTION = "monthlyChallenges";
export const MONTHLY_CHALLENGE_SUBMISSIONS_COLLECTION = "monthlyChallengeSubmissions";

/** @internal */
export type MonthlyChallengeStatus = "draft" | "open" | "judging" | "published" | "archived";
/** @internal */
export type MonthlyChallengeSubmissionStatus =
  | "draft"
  | "submitted"
  | "needs_changes"
  | "eligible"
  | "ineligible"
  | "winner"
  | "withdrawn";

export interface MonthlyChallengeWindow {
  status?: string;
  submissionOpenAt?: unknown;
  submissionCloseAt?: unknown;
}

/** @internal */
export interface MonthlyChallengeSubmissionInput {
  title: string;
  summary: string;
  repositoryUrl?: string;
  demoUrl?: string;
  writeup: string;
  cursorWorkflow: string;
  submitNow?: boolean;
}

/** @internal */
export interface NormalizedMonthlyChallengeSubmission {
  title: string;
  summary: string;
  repositoryUrl?: string;
  demoUrl?: string;
  writeup: string;
  cursorWorkflow: string;
  status: Extract<MonthlyChallengeSubmissionStatus, "draft" | "submitted">;
}

/** @internal */
export interface MonthlyChallengeSubmissionValidation {
  data: NormalizedMonthlyChallengeSubmission | null;
  errors: string[];
}

const ACTIVE_SUBMISSION_STATUSES: MonthlyChallengeSubmissionStatus[] = [
  "draft",
  "submitted",
  "needs_changes",
  "eligible",
  "ineligible",
  "winner",
];

function compactSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function dateMillis(value: unknown): number {
  if (typeof value === "string") {
    return Date.parse(value);
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof value.toMillis === "function"
  ) {
    return value.toMillis();
  }
  return Number.NaN;
}

function normalizeOptionalUrl(
  value: string | undefined,
  fieldName: "repositoryUrl" | "demoUrl",
  errors: string[]
): string | undefined {
  if (!value || value.trim().length === 0) {
    return undefined;
  }

  const sanitized = sanitizeUrl(value);
  if (!sanitized) {
    errors.push(`${fieldName} must be an http or https URL.`);
    return undefined;
  }

  if (fieldName === "repositoryUrl") {
    const url = new URL(sanitized);
    const pathParts = url.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
    if (!["github.com", "www.github.com"].includes(url.hostname) || pathParts.length < 2) {
      errors.push("repositoryUrl must point to a GitHub repository.");
      return undefined;
    }
  }

  return sanitized;
}

export function sanitizeChallengeId(raw: string): string | null {
  return sanitizeDocId(raw);
}

/** @internal */
export function isActiveChallengeSubmissionStatus(status: string): boolean {
  return ACTIVE_SUBMISSION_STATUSES.includes(status as MonthlyChallengeSubmissionStatus);
}

export function activeChallengeSubmissionStatuses(): MonthlyChallengeSubmissionStatus[] {
  return [...ACTIVE_SUBMISSION_STATUSES];
}

export function isMonthlyChallengeSubmissionWindowOpen(
  challenge: MonthlyChallengeWindow,
  now: Date = new Date()
): boolean {
  if (challenge.status !== "open") {
    return false;
  }

  const openAt = dateMillis(challenge.submissionOpenAt);
  const closeAt = dateMillis(challenge.submissionCloseAt);
  const current = now.getTime();

  return Number.isFinite(openAt) && Number.isFinite(closeAt) && current >= openAt && current <= closeAt;
}

export function normalizeMonthlyChallengeSubmission(
  input: MonthlyChallengeSubmissionInput
): MonthlyChallengeSubmissionValidation {
  const errors: string[] = [];
  const title = compactSpaces(sanitizeText(input.title)).slice(0, 120);
  const summary = compactSpaces(sanitizeText(input.summary)).slice(0, 500);
  const writeup = sanitizeText(input.writeup).slice(0, 4000);
  const cursorWorkflow = sanitizeText(input.cursorWorkflow).slice(0, 2000);
  const repositoryUrl = normalizeOptionalUrl(input.repositoryUrl, "repositoryUrl", errors);
  const demoUrl = normalizeOptionalUrl(input.demoUrl, "demoUrl", errors);

  if (title.length < 3) errors.push("Title must be at least 3 characters.");
  if (summary.length < 20) errors.push("Summary must be at least 20 characters.");
  if (writeup.length < 50) errors.push("Writeup must be at least 50 characters.");
  if (cursorWorkflow.length < 20) {
    errors.push("Cursor workflow note must be at least 20 characters.");
  }

  if (errors.length > 0) {
    return { data: null, errors };
  }

  return {
    data: {
      title,
      summary,
      repositoryUrl,
      demoUrl,
      writeup,
      cursorWorkflow,
      status: input.submitNow === true ? "submitted" : "draft",
    },
    errors: [],
  };
}
