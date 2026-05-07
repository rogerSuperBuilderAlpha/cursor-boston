/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Cursor-based pagination helper for Firestore queries.
 *
 * Standard contract for paginated list endpoints:
 *   Request:  ?limit=20&cursor=<lastDocId>
 *   Response: { <listKey>: [...], nextCursor: string | null, hasMore: boolean }
 *
 * Cursor is the last document's id. To resume, the helper fetches that
 * doc and uses Firestore's `startAfter()`. `hasMore` is determined by
 * fetching `limit + 1` docs in a single query (no extra round-trip).
 */

import type {
  CollectionReference,
  Query,
  QueryDocumentSnapshot,
} from "firebase-admin/firestore";

import { sanitizeDocId } from "@/lib/sanitize";

export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;

/**
 * Parse a `?limit=` query param, clamped to `[1, maxLimit]` with a default.
 * Non-numeric, missing, or out-of-range values fall back to `defaultLimit`.
 */
export function clampLimit(
  raw: string | null | undefined,
  defaultLimit: number = DEFAULT_PAGE_LIMIT,
  maxLimit: number = MAX_PAGE_LIMIT
): number {
  const fallback = Math.min(Math.max(1, defaultLimit), maxLimit);
  if (raw == null) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.max(1, parsed), maxLimit);
}

/**
 * Sanitize a `?cursor=` param. Returns null for missing, empty, or
 * malformed cursors (rejecting anything that isn't a Firestore-safe doc id).
 */
export function parseCursor(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return sanitizeDocId(trimmed);
}

export interface PaginatedQueryResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * Run a Firestore query with cursor-based pagination.
 *
 * Fetches `limit + 1` docs to determine `hasMore` without a second query.
 * If `cursor` resolves to a doc that no longer exists (deleted between
 * pages), it is ignored and the page restarts from the beginning of the
 * query — surprising but safer than throwing.
 */
export async function paginateFirestoreQuery<T>(opts: {
  query: Query;
  collection: CollectionReference;
  cursor: string | null;
  limit: number;
  mapDoc: (doc: QueryDocumentSnapshot) => T;
}): Promise<PaginatedQueryResult<T>> {
  let q = opts.query.limit(opts.limit + 1);
  if (opts.cursor) {
    const cursorDoc = await opts.collection.doc(opts.cursor).get();
    if (cursorDoc.exists) {
      q = q.startAfter(cursorDoc);
    }
  }
  const snap = await q.get();
  const sliced = snap.docs.slice(0, opts.limit);
  const items = sliced.map(opts.mapDoc);
  const hasMore = snap.docs.length > opts.limit;
  const nextCursor =
    hasMore && sliced.length > 0 ? sliced[sliced.length - 1].id : null;
  return { items, nextCursor, hasMore };
}

/**
 * Apply cursor-based pagination to a pre-materialized in-memory array.
 * Use this only when the underlying lib does in-memory sorting / unioning
 * (e.g. attacks `side=all`, artifacts) and a Firestore cursor is not
 * achievable — cursor here is the id of the last item on the previous
 * page, not a doc snapshot.
 */
export function paginateInMemory<T extends { id?: string }>(
  items: T[],
  cursor: string | null,
  limit: number
): PaginatedQueryResult<T> {
  let startIdx = 0;
  if (cursor) {
    const cursorIdx = items.findIndex((it) => it.id === cursor);
    startIdx = cursorIdx >= 0 ? cursorIdx + 1 : 0;
  }
  const page = items.slice(startIdx, startIdx + limit);
  const hasMore = startIdx + page.length < items.length;
  const lastItem = page.length > 0 ? page[page.length - 1] : undefined;
  const nextCursor =
    hasMore && lastItem?.id ? lastItem.id : null;
  return { items: page, nextCursor, hasMore };
}
