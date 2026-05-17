/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Server-only read helpers for the v2 Heroes API. The four route handlers
 * under `app/api/game/heroes/` are thin shells over the functions in this
 * file. Centralizing the queries here keeps the visibility filter applied
 * in exactly one place (per-request neighbor-set + `applyHeroVisibility`
 * / `applyEventVisibility`) and the routes themselves contract-aligned.
 *
 * Writes still live in `lib/game/data-server.ts` + `lib/game/hero-registry.ts`.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  CollectionReference,
  Firestore,
  Query,
  QueryDocumentSnapshot,
} from "firebase-admin/firestore";

import {
  HERO_EVENTS_PAGE_SIZE,
  HEROES_LIST_PAGE_SIZE,
} from "./content/heroes";
import { HERO_BACKSTORY_IDS } from "./content/hero-backstories/_index";
import { paginateFirestoreQuery } from "../firestore-pagination";
import {
  HEROES_COLLECTION,
  heroEventsCollection,
} from "./hero-registry";
import {
  applyEventVisibility,
  applyHeroVisibility,
  computeViewerNeighborTileSet,
  isHeroFullyPublic,
} from "./hero-visibility";
import type {
  GameHeroDoc,
  GameHeroEvent,
  HeroListScope,
  SafeHeroSummary,
} from "./types";

/** API-facing event shape — same fields as `GameHeroEvent` except the
 *  `createdAt` is serialized to an ISO string for JSON transport. */
export interface SafeHeroEvent extends Omit<GameHeroEvent, "createdAt"> {
  createdAt: string;
}

/** Coerces Firestore Timestamp | Date to an ISO string. */
function toIso(value: unknown): string {
  if (value && typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  return new Date(0).toISOString();
}

/** Read a hero doc into the persisted shape. */
function mapHeroDoc(doc: QueryDocumentSnapshot): GameHeroDoc {
  return doc.data() as GameHeroDoc;
}

/** Read an event doc into the JSON-safe shape (excluding visibility checks). */
function mapEventDoc(doc: QueryDocumentSnapshot): SafeHeroEvent {
  const data = doc.data() as GameHeroEvent;
  return {
    ...data,
    id: doc.id,
    createdAt: toIso(data.createdAt),
  };
}

interface HeroesListArgs {
  db: Firestore;
  viewerId: string;
  scope: HeroListScope;
  cursor: string | null;
  limit: number;
}

/**
 * Paginated hero list with the visibility filter applied per-row.
 *
 * - `scope=mine` → `currentOwnerId == viewerId`, sorted by `lastEventAt`
 * - `scope=all`  → all living heroes (`isDeceased == false`), sorted by
 *                  `lastEventAt`
 * - `scope=fallen` → deceased + past-season heroes
 *                  (`isDeceased == true OR awaitingResurrection == true`),
 *                  sorted by `lastEventAt`. Because Firestore can't OR
 *                  across two fields in a single query, we run the two
 *                  shards and merge in-memory — the result set is small
 *                  (one-time lore browse, not a hot path).
 */
export async function getHeroesListServer(
  args: HeroesListArgs
): Promise<{ items: SafeHeroSummary[]; nextCursor: string | null; hasMore: boolean }> {
  const collection = args.db.collection(
    HEROES_COLLECTION
  ) as CollectionReference;

  const limit = Math.min(args.limit, HEROES_LIST_PAGE_SIZE);

  const neighborSet = await computeViewerNeighborTileSet(
    args.db,
    args.viewerId
  );

  if (args.scope === "fallen") {
    const fallenHeroes = await loadFallenHeroes(args.db);
    const start = args.cursor
      ? Math.max(0, fallenHeroes.findIndex((h) => h.id === args.cursor) + 1)
      : 0;
    const page = fallenHeroes.slice(start, start + limit);
    const hasMore = start + page.length < fallenHeroes.length;
    return {
      items: page.map((h) => applyHeroVisibility(h, args.viewerId, neighborSet)),
      nextCursor: hasMore && page.length > 0 ? page[page.length - 1].id : null,
      hasMore,
    };
  }

  let query: Query;
  if (args.scope === "mine") {
    query = collection
      .where("currentOwnerId", "==", args.viewerId)
      .orderBy("lastEventAt", "desc");
  } else {
    query = collection
      .where("isDeceased", "==", false)
      .orderBy("lastEventAt", "desc");
  }

  const { items, nextCursor, hasMore } = await paginateFirestoreQuery<GameHeroDoc>({
    query,
    collection,
    cursor: args.cursor,
    limit,
    mapDoc: mapHeroDoc,
  });

  return {
    items: items.map((h) => applyHeroVisibility(h, args.viewerId, neighborSet)),
    nextCursor,
    hasMore,
  };
}

/** Loads the union of `isDeceased=true` and `awaitingResurrection=true`
 *  hero docs (Firestore can't OR across two fields in one query), merges
 *  + dedupes by id, and sorts by lastEventAt desc. The lore-browse list
 *  is bounded by the total hero population, so an in-memory union is fine. */
async function loadFallenHeroes(db: Firestore): Promise<GameHeroDoc[]> {
  const collection = db.collection(HEROES_COLLECTION);
  const [deceasedSnap, limboSnap] = await Promise.all([
    collection
      .where("isDeceased", "==", true)
      .orderBy("lastEventAt", "desc")
      .get(),
    collection
      .where("awaitingResurrection", "==", true)
      .orderBy("lastEventAt", "desc")
      .get(),
  ]);
  const byId = new Map<string, GameHeroDoc>();
  for (const doc of deceasedSnap.docs) byId.set(doc.id, mapHeroDoc(doc));
  for (const doc of limboSnap.docs) byId.set(doc.id, mapHeroDoc(doc));
  return Array.from(byId.values()).sort(
    (a, b) => Date.parse(toIso(b.lastEventAt)) - Date.parse(toIso(a.lastEventAt))
  );
}

interface HeroDetailArgs {
  db: Firestore;
  viewerId: string;
  heroId: string;
}

export interface HeroDetailResult {
  hero: SafeHeroSummary;
  events: SafeHeroEvent[];
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * Fetches the hero doc + the first page of events, both visibility-
 * filtered. Returns `null` when the hero doesn't exist (route maps to 404).
 */
export async function getHeroDetailServer(
  args: HeroDetailArgs
): Promise<HeroDetailResult | null> {
  const heroSnap = await args.db
    .collection(HEROES_COLLECTION)
    .doc(args.heroId)
    .get();
  if (!heroSnap.exists) return null;
  const hero = heroSnap.data() as GameHeroDoc;

  const neighborSet = await computeViewerNeighborTileSet(args.db, args.viewerId);
  const safeHero = applyHeroVisibility(hero, args.viewerId, neighborSet);

  const events = await getHeroEventsServer({
    db: args.db,
    viewerId: args.viewerId,
    heroId: args.heroId,
    cursor: null,
    limit: HERO_EVENTS_PAGE_SIZE,
    heroDocCache: hero,
  });

  return {
    hero: safeHero,
    events: events.items,
    nextCursor: events.nextCursor,
    hasMore: events.hasMore,
  };
}

interface HeroEventsArgs {
  db: Firestore;
  viewerId: string;
  heroId: string;
  cursor: string | null;
  limit: number;
  /** Optional pre-loaded hero doc to avoid a redundant read when callers
   *  already have it (e.g. the detail endpoint). */
  heroDocCache?: GameHeroDoc;
}

export interface HeroEventsResult {
  items: SafeHeroEvent[];
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * Paginated hero events with visibility filtering. For living heroes,
 * events are filtered to the viewer's tenure; for deceased / past-season
 * heroes, all events are returned.
 *
 * Two-shard logic: when the hero is living, we issue a server-side
 * `where("ownerIdAtTime", "==", viewerId)` query so the database does
 * the filter. When the hero is fully public, we drop the filter and
 * return everything ordered by `createdAt desc`.
 */
export async function getHeroEventsServer(
  args: HeroEventsArgs
): Promise<HeroEventsResult> {
  const limit = Math.min(args.limit, HERO_EVENTS_PAGE_SIZE);

  let hero = args.heroDocCache;
  if (!hero) {
    const snap = await args.db
      .collection(HEROES_COLLECTION)
      .doc(args.heroId)
      .get();
    if (!snap.exists) return { items: [], nextCursor: null, hasMore: false };
    hero = snap.data() as GameHeroDoc;
  }

  const fullyPublic = isHeroFullyPublic(hero);
  const events = heroEventsCollection(args.db, args.heroId);

  let query: Query;
  if (fullyPublic) {
    query = events.orderBy("createdAt", "desc");
  } else {
    query = events
      .where("ownerIdAtTime", "==", args.viewerId)
      .orderBy("createdAt", "desc");
  }

  const { items, nextCursor, hasMore } = await paginateFirestoreQuery<SafeHeroEvent>({
    query,
    collection: events as CollectionReference,
    cursor: args.cursor,
    limit,
    mapDoc: mapEventDoc,
  });

  // Belt-and-suspenders: even though the query filters by ownerIdAtTime
  // when the hero is living, apply the visibility predicate so a future
  // schema change can't silently leak. Pure pass-through in steady state.
  return {
    items: items.filter((e) => applyEventVisibility(e, args.viewerId, fullyPublic)),
    nextCursor,
    hasMore,
  };
}

interface HeroBackstoryArgs {
  heroId: string;
}

/**
 * Returns the markdown contents of `lib/game/content/hero-backstories/<heroId>.md`,
 * or `null` if no chapter has been contributed yet. Reads from disk so
 * contributors see their PR live immediately on next deploy without a
 * build-time codegen step beyond the index.
 *
 * Note: this runs on the Node server (route is `runtime: "nodejs"` by
 * default for app router). The backstories dir ships with the app bundle.
 */
export async function getHeroBackstoryServer(
  args: HeroBackstoryArgs
): Promise<string | null> {
  if (!HERO_BACKSTORY_IDS.has(args.heroId)) return null;
  const filePath = join(
    process.cwd(),
    "lib",
    "game",
    "content",
    "hero-backstories",
    `${args.heroId}.md`
  );
  try {
    return await readFile(filePath, "utf8");
  } catch {
    // File listed in the index but missing on disk — treat as not-yet-written.
    return null;
  }
}

// Re-export underlying constants so route handlers don't need a separate
// import path for them.
export { HERO_EVENTS_PAGE_SIZE, HEROES_LIST_PAGE_SIZE };
