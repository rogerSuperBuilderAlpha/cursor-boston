/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Final door-list gate for the May 13 PyData event at Moderna.
 *
 * The 150 confirmed-attendee emails live in a private Firestore collection
 * (server-side, Admin SDK only). They never appear in this public repo —
 * `/api/events/pydata-2026/access` reads them and returns a boolean to the
 * gate component. Keeping the emails off the client is the whole point.
 *
 * Doc IDs in the collection are the lowercased, trimmed email — exact-match
 * lookups via `.doc(email).get()` keep reads O(1).
 */
export const PYDATA_2026_ACCESS_LIST_COLLECTION = "pydataHack2026AccessList";

/**
 * Normalize an email for allowlist comparison. Door-list matching is
 * case-insensitive (people register with mixed casing); whitespace gets
 * trimmed because pasted CSV values sometimes carry a stray space.
 */
export function normalizePydataEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}
