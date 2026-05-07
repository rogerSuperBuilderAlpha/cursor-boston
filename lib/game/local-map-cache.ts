/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Per-user localStorage cache for the personal map view (own tiles +
 * enemy-adjacent ring + owner summaries). Drives /game/tiles, /game/spells,
 * /game/recruit so they don't refetch the whole world on every page load.
 *
 * Design:
 *   - One entry per `userId` so signing into a different account doesn't
 *     leak the previous account's view.
 *   - Schema-versioned. A bumped `CACHE_VERSION` invalidates old entries
 *     transparently — no migration code, just a fresh fetch on next load.
 *   - Action handlers call `mergeTiles` / `mergeOwners` after every action
 *     response, so the cache stays current across page navigations
 *     without an extra read.
 *   - Manual refresh is rate-limited to once every 5 minutes. The gate is
 *     client-side (localStorage timestamp); the server still enforces
 *     normal API auth + rate limits, so this is a UX nicety, not a
 *     security boundary.
 */

import type { Caste, MapTile } from "./types";

const CACHE_VERSION = 1;
const KEY_PREFIX = "cb-game-map-v" + CACHE_VERSION + ":";
export const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export interface CachedOwnerSummary {
  userId: string;
  displayName: string;
  caste: Caste | null;
  shielded: boolean;
}

export interface CachedMapView {
  myTiles: MapTile[];
  borderTiles: MapTile[];
  owners: CachedOwnerSummary[];
  lastFetchedAt: number; // ms epoch
}

interface StoredEntry extends CachedMapView {
  v: number; // schema version, must equal CACHE_VERSION
  userId: string;
}

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    // Private mode, locked-down browser, etc.
    return null;
  }
}

function keyFor(userId: string): string {
  return KEY_PREFIX + userId;
}

/** Load a cached view for `userId`. Returns null on missing / corrupt /
 *  version-mismatch / userId-mismatch (defensive against multi-account). */
export function loadCachedMap(userId: string): CachedMapView | null {
  const s = storage();
  if (!s) return null;
  const raw = s.getItem(keyFor(userId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredEntry;
    if (parsed.v !== CACHE_VERSION) return null;
    if (parsed.userId !== userId) return null;
    if (!Array.isArray(parsed.myTiles)) return null;
    if (!Array.isArray(parsed.borderTiles)) return null;
    if (!Array.isArray(parsed.owners)) return null;
    if (typeof parsed.lastFetchedAt !== "number") return null;
    return {
      myTiles: parsed.myTiles,
      borderTiles: parsed.borderTiles,
      owners: parsed.owners,
      lastFetchedAt: parsed.lastFetchedAt,
    };
  } catch {
    return null;
  }
}

/** Persist a fresh view to the cache. Call after a full /api/game/map/me
 *  fetch (manual refresh or first load). */
export function saveCachedMap(
  userId: string,
  view: Omit<CachedMapView, "lastFetchedAt"> & { lastFetchedAt?: number }
): void {
  const s = storage();
  if (!s) return;
  const entry: StoredEntry = {
    v: CACHE_VERSION,
    userId,
    myTiles: view.myTiles,
    borderTiles: view.borderTiles,
    owners: view.owners,
    lastFetchedAt: view.lastFetchedAt ?? Date.now(),
  };
  try {
    s.setItem(keyFor(userId), JSON.stringify(entry));
  } catch {
    // Storage full / quota exceeded — drop silently. The next manual
    // refresh will succeed once the user clears something or the storage
    // clears itself.
  }
}

/** Clear the cache for `userId`. Call on sign-out or on schema changes. */
export function clearCachedMap(userId: string): void {
  const s = storage();
  if (!s) return;
  try {
    s.removeItem(keyFor(userId));
  } catch {
    /* ignore */
  }
}

/**
 * Merge a partial set of tile updates into the cached view. Tiles whose
 * `tileId` is already present are replaced; new tile ids are appended into
 * the appropriate bucket based on `ownerId`:
 *   - tile owned by `userId` → `myTiles`, removed from `borderTiles` if it
 *     used to live there (e.g. you just conquered a border tile).
 *   - tile owned by someone else → `borderTiles` (only if it touches one
 *     of your tiles), removed from `myTiles` if it used to be yours.
 *   - tile with null owner → removed from both buckets (re-fog edge case).
 *
 * No-ops if the cache doesn't exist; the caller's next refresh will
 * fetch the whole view fresh.
 */
export function mergeTiles(
  userId: string,
  updates: ReadonlyArray<MapTile>
): CachedMapView | null {
  const cached = loadCachedMap(userId);
  if (!cached) return null;

  const myById = new Map(cached.myTiles.map((t) => [t.tileId, t] as const));
  const borderById = new Map(
    cached.borderTiles.map((t) => [t.tileId, t] as const)
  );

  // Build a fast adjacency check: a tile is on my border iff at least one
  // neighbor is in `myById`. We snapshot myIds *before* applying updates so
  // a single batch of updates produces consistent border membership.
  const myIdsBefore = new Set(myById.keys());

  for (const u of updates) {
    if (u.ownerId === userId) {
      myById.set(u.tileId, u);
      borderById.delete(u.tileId);
    } else if (u.ownerId) {
      myById.delete(u.tileId);
      // Only keep if it touches something I already owned.
      if (tileTouchesAny(u, myIdsBefore)) {
        borderById.set(u.tileId, u);
      } else {
        borderById.delete(u.tileId);
      }
    } else {
      myById.delete(u.tileId);
      borderById.delete(u.tileId);
    }
  }

  const next: CachedMapView = {
    myTiles: Array.from(myById.values()),
    borderTiles: Array.from(borderById.values()),
    owners: cached.owners,
    // Action-driven merges do not reset lastFetchedAt — only a full fetch
    // resets the rate-limit clock.
    lastFetchedAt: cached.lastFetchedAt,
  };
  saveCachedMap(userId, next);
  return next;
}

/** Add or replace owner summaries (e.g. you conquered a border tile and
 *  need its previous owner's record kept around for history, or you saw a
 *  new enemy show up on your border via attack). */
export function mergeOwners(
  userId: string,
  updates: ReadonlyArray<CachedOwnerSummary>
): CachedMapView | null {
  const cached = loadCachedMap(userId);
  if (!cached) return null;
  const byId = new Map(cached.owners.map((o) => [o.userId, o] as const));
  for (const u of updates) byId.set(u.userId, u);
  const next: CachedMapView = {
    ...cached,
    owners: Array.from(byId.values()),
  };
  saveCachedMap(userId, next);
  return next;
}

/** True iff at least 5 minutes have elapsed since the last full refresh. */
export function mayRefresh(view: CachedMapView | null, now: number = Date.now()): boolean {
  if (!view) return true;
  return now - view.lastFetchedAt >= REFRESH_INTERVAL_MS;
}

/** Milliseconds remaining until refresh is allowed again. 0 if already
 *  allowed. Useful for rendering a countdown next to the disabled button. */
export function msUntilRefresh(
  view: CachedMapView | null,
  now: number = Date.now()
): number {
  if (!view) return 0;
  return Math.max(0, REFRESH_INTERVAL_MS - (now - view.lastFetchedAt));
}

// --- helpers ---

// Six axial neighbor offsets for a pointy-top hex grid. Mirrors the same
// constant on the world map page; kept inline so this module is dependency-
// free of the world-gen lib (which would pull in unused exports).
const HEX_NEIGHBORS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, -1],
  [-1, 1],
];

function tileTouchesAny(t: MapTile, ids: ReadonlySet<string>): boolean {
  for (const [dq, dr] of HEX_NEIGHBORS) {
    const id = `${t.q + dq}_${t.r + dr}`;
    if (ids.has(id)) return true;
  }
  return false;
}
