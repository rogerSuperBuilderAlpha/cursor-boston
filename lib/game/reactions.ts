/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Server-side reaction toggle for chat / community-feed / hero-event
 * docs. The route `/api/game/reactions` is a thin wrapper around
 * `toggleReactionServer` — keeping the Firestore logic here lets unit
 * tests (and other callers) stay free of Next.js plumbing.
 *
 * Idempotency: a `game_reactions/{trackerId}` doc records "user U placed
 * reaction R on doc D of scope S". Doc existence is the bool. Toggling
 * on creates the tracker and increments the target counter by +1;
 * toggling off deletes the tracker and decrements by -1. The whole
 * thing runs in a Firestore transaction so concurrent toggles can't
 * desync the tracker from the counter.
 */

import { FieldValue, Firestore } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import type {
  ReactionEmoji,
  ReactionMap,
  ReactionScope,
  ReactionTracker,
} from "./types";
import { REACTION_EMOJIS } from "./types";

const TRACKERS_COLLECTION = "game_reactions";

function adminDbOrThrow(): Firestore {
  const db = getAdminDb();
  if (!db) throw new Error("Firebase Admin not initialized");
  return db;
}

export class ReactionInvalidScopeError extends Error {
  constructor() {
    super("Invalid reaction scope");
    this.name = "ReactionInvalidScopeError";
  }
}
export class ReactionInvalidEmojiError extends Error {
  constructor() {
    super("Invalid reaction emoji");
    this.name = "ReactionInvalidEmojiError";
  }
}
export class ReactionTargetNotFoundError extends Error {
  constructor() {
    super("Reaction target not found");
    this.name = "ReactionTargetNotFoundError";
  }
}
export class ReactionMissingHeroIdError extends Error {
  constructor() {
    super("heroId required when scope is hero_event");
    this.name = "ReactionMissingHeroIdError";
  }
}

function emojiIndex(emoji: ReactionEmoji): number {
  return REACTION_EMOJIS.indexOf(emoji);
}

function trackerIdFor(
  userId: string,
  scope: ReactionScope,
  docId: string,
  emoji: ReactionEmoji
): string {
  const idx = emojiIndex(emoji);
  return `${userId}_${scope}_${docId}_${idx}`;
}

function targetDocRef(
  db: Firestore,
  scope: ReactionScope,
  docId: string,
  heroId?: string
) {
  if (scope === "chat") {
    return db.collection("game_community_messages").doc(docId);
  }
  if (scope === "feed") {
    return db.collection("game_community_events").doc(docId);
  }
  if (scope === "hero_event") {
    if (!heroId) throw new ReactionMissingHeroIdError();
    return db
      .collection("game_heroes")
      .doc(heroId)
      .collection("events")
      .doc(docId);
  }
  throw new ReactionInvalidScopeError();
}

export interface ToggleReactionResult {
  /** Whether the reaction is now present (true) or removed (false). */
  active: boolean;
  /** Updated counter map on the target doc after the toggle. */
  reactions: ReactionMap;
}

export async function toggleReactionServer(args: {
  userId: string;
  scope: ReactionScope;
  docId: string;
  emoji: ReactionEmoji;
  heroId?: string;
  now?: Date;
}): Promise<ToggleReactionResult> {
  if (!REACTION_EMOJIS.includes(args.emoji)) {
    throw new ReactionInvalidEmojiError();
  }
  if (args.scope !== "chat" && args.scope !== "feed" && args.scope !== "hero_event") {
    throw new ReactionInvalidScopeError();
  }

  const now = args.now ?? new Date();
  const db = adminDbOrThrow();
  const targetRef = targetDocRef(db, args.scope, args.docId, args.heroId);
  const trackerId = trackerIdFor(args.userId, args.scope, args.docId, args.emoji);
  const trackerRef = db.collection(TRACKERS_COLLECTION).doc(trackerId);

  return db.runTransaction(async (tx) => {
    const [targetSnap, trackerSnap] = await Promise.all([
      tx.get(targetRef),
      tx.get(trackerRef),
    ]);
    if (!targetSnap.exists) throw new ReactionTargetNotFoundError();

    const alreadyActive = trackerSnap.exists;
    const counterKey = `reactions.${args.emoji}`;
    if (alreadyActive) {
      tx.delete(trackerRef);
      tx.update(targetRef, { [counterKey]: FieldValue.increment(-1) });
    } else {
      const tracker: ReactionTracker = {
        userId: args.userId,
        scope: args.scope,
        docId: args.docId,
        reaction: args.emoji,
        createdAt: now,
        ...(args.heroId ? { heroId: args.heroId } : {}),
      };
      tx.set(trackerRef, tracker);
      tx.update(targetRef, { [counterKey]: FieldValue.increment(1) });
    }

    const targetData = targetSnap.data() as { reactions?: ReactionMap };
    const prior = targetData.reactions ?? {};
    const priorCount = prior[args.emoji] ?? 0;
    const nextCount = priorCount + (alreadyActive ? -1 : 1);
    const next: ReactionMap = { ...prior };
    if (nextCount <= 0) delete next[args.emoji];
    else next[args.emoji] = nextCount;

    return { active: !alreadyActive, reactions: next };
  });
}

/**
 * Returns the set of reactions the given user has placed across a list
 * of (scope, docId, emoji) triples. Used by the renderer to pre-fill
 * "you reacted" highlights on initial load. Batched read for cheapness.
 */
export async function listUserReactionsServer(args: {
  userId: string;
  targets: Array<{
    scope: ReactionScope;
    docId: string;
  }>;
}): Promise<Set<string>> {
  if (args.targets.length === 0) return new Set();
  const db = adminDbOrThrow();
  const ids: string[] = [];
  for (const t of args.targets) {
    for (const emoji of REACTION_EMOJIS) {
      ids.push(trackerIdFor(args.userId, t.scope, t.docId, emoji));
    }
  }
  // Firestore getAll caps at 100 refs per call. Chunk if needed.
  const out = new Set<string>();
  const refs = ids.map((id) => db.collection(TRACKERS_COLLECTION).doc(id));
  const CHUNK = 100;
  for (let i = 0; i < refs.length; i += CHUNK) {
    const slice = refs.slice(i, i + CHUNK);
    const snaps = await db.getAll(...slice);
    for (const snap of snaps) {
      if (snap.exists) {
        const data = snap.data() as ReactionTracker;
        const idx = REACTION_EMOJIS.indexOf(data.reaction);
        if (idx >= 0) {
          out.add(`${data.scope}|${data.docId}|${idx}`);
        }
      }
    }
  }
  return out;
}
