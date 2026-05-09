/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Per-area access gate for the Summer Cohort admin dashboard
 * (/admin/summer-cohort and /api/summer-cohort/admin/*).
 *
 * Source of truth is the `SUMMER_COHORT_ADMIN_EMAILS` env var — comma-separated
 * lowercase emails managed in Vercel. This is intentionally separate from the
 * general `isAdmin` claim so applications/intake/votes data can be scoped
 * tighter than the rest of the admin surface.
 */
export const SUMMER_COHORT_ADMIN_EMAILS_ENV = "SUMMER_COHORT_ADMIN_EMAILS";

export function getSummerCohortAdminEmailSet(): Set<string> {
  const csv = process.env[SUMMER_COHORT_ADMIN_EMAILS_ENV] || "";
  return new Set(
    csv
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isSummerCohortAdminEmail(
  email: string | null | undefined
): boolean {
  if (!email) return false;
  return getSummerCohortAdminEmailSet().has(email.trim().toLowerCase());
}
