/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Formats an ISO date string into a short US locale date (e.g. `"Mar 5, 2026"`).
 *
 * @param iso - ISO-8601 date string.
 * @returns Formatted date or empty string when `iso` is falsy.
 */
export function formatCookbookDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
