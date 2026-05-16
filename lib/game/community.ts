/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Community feed + chat data-server. Surfaces:
 *
 *   - Append-only event log (`game_community_events`) consumed by the
 *     dashboard's CommunityPanel activity feed. Each entry is a
 *     denormalized snapshot — no joins required at read-time.
 *   - Chat collection (`game_community_messages`) with create + soft-
 *     delete by author + admin force-delete.
 *
 * Event writes are append-only and live inside existing game-action
 * transactions (chooseCasteServer, attackTileServer, etc.) — see
 * `logCommunityEventInTx`. Read paths are POST-less GET endpoints with
 * Cache-Control headers so the dashboard's "Refresh" button doesn't
 * hammer Firestore.
 */

import { randomUUID } from "node:crypto";
import type { Firestore, Transaction } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import type {
  AttackOutcome,
  Caste,
  CommunityEvent,
  CommunityMessage,
  HeroClass,
  HeroSpecialty,
} from "./types";

function adminDbOrThrow(): Firestore {
  const db = getAdminDb();
  if (!db) throw new Error("Firebase Admin not initialized");
  return db;
}

const COMMUNITY_EVENTS = "game_community_events";
const COMMUNITY_MESSAGES = "game_community_messages";

/** Maximum chat-message body length. Anything longer is rejected at the
 *  route layer with a 400. Keeps the listener payload small and
 *  discourages walls-of-text spam. */
export const MAX_MESSAGE_LENGTH = 500;

/** How many of the most-recent events / messages the public read paths
 *  return. Picked to fit on a single dashboard panel without paging. */
export const COMMUNITY_PAGE_SIZE = 50;

interface BaseEventInput {
  actorUserId: string;
  actorDisplayName: string;
  actorCaste: Caste | null;
}

interface PlayerJoinEvent extends BaseEventInput {
  kind: "player_join";
}

interface CastePickEvent extends BaseEventInput {
  kind: "caste_pick";
}

interface CasteChangeEvent extends BaseEventInput {
  kind: "caste_change";
  fromCaste: Caste;
  toCaste: Caste;
}

interface AttackEvent extends BaseEventInput {
  kind: "attack";
  targetUserId: string;
  targetDisplayName: string;
  tileId: string;
  outcome: AttackOutcome;
}

interface MilestoneEvent extends BaseEventInput {
  kind: "milestone_1k_tiles";
}

interface SealBrokenEvent extends BaseEventInput {
  kind: "seal_broken";
  sealIndex: number;       // 0..6
  seasonNumber: number;
}

interface ArmageddonStartedEvent extends BaseEventInput {
  kind: "armageddon_started";
  seasonNumber: number;
}

interface ArmageddonCompletedEvent extends BaseEventInput {
  kind: "armageddon_completed";
  seasonNumber: number;
}

interface ArmageddonWinnerEvent extends BaseEventInput {
  kind: "armageddon_winner";
  seasonNumber: number;
  winnerRank: number;      // 1..10
  tilesHeld: number;
  sealsBroken: number;
  tickets: number;
}

interface ArmageddonCastFailedEvent extends BaseEventInput {
  kind: "armageddon_cast_failed";
  seasonNumber: number;
}

interface HeroEmergedEvent extends BaseEventInput {
  kind: "hero_emerged";
  tileId: string;
  heroId: string;
  heroName: string;
  heroClass: HeroClass;
  heroSpecialty: HeroSpecialty;
}

interface HeroDefectedEvent extends BaseEventInput {
  kind: "hero_defected";
  tileId: string;
  heroId: string;
  heroName: string;
  heroClass: HeroClass;
  heroSpecialty: HeroSpecialty;
  // Original owner whose hero defected to the actor.
  otherUserId: string;
  otherDisplayName: string;
  otherCaste: Caste | null;
}

interface HeroSlainEvent extends BaseEventInput {
  kind: "hero_slain";
  tileId: string;
  heroId: string;
  heroName: string;
  heroClass: HeroClass;
  heroSpecialty: HeroSpecialty;
  // Attacker who chose the kill outcome.
  otherUserId: string;
  otherDisplayName: string;
  otherCaste: Caste | null;
}

export type CommunityEventInput =
  | PlayerJoinEvent
  | CastePickEvent
  | CasteChangeEvent
  | AttackEvent
  | MilestoneEvent
  | SealBrokenEvent
  | ArmageddonStartedEvent
  | ArmageddonCompletedEvent
  | ArmageddonWinnerEvent
  | ArmageddonCastFailedEvent
  | HeroEmergedEvent
  | HeroDefectedEvent
  | HeroSlainEvent;

/**
 * Writes one community-event doc inside an existing transaction.
 * Called from the action-server txns so the event is created
 * atomically with the underlying state change. If a write outside the
 * txn is needed (e.g. player creation does its own txn already), use
 * `logCommunityEvent` instead.
 *
 * No-throw: a failed write here must NOT abort the parent txn. Errors
 * are swallowed and logged at the caller's discretion. (For now we let
 * Firestore reject and bubble up; adopt try/catch if it becomes a
 * source of phantom rollbacks.)
 */
export function logCommunityEventInTx(
  tx: Transaction,
  db: Firestore,
  input: CommunityEventInput,
  now: Date
): void {
  const id = randomUUID();
  const ref = db.collection(COMMUNITY_EVENTS).doc(id);
  // Build a doc shape with only the fields relevant to the kind so we
  // don't pollute Firestore with a bunch of `undefined`s.
  const base = {
    id,
    kind: input.kind,
    createdAt: now,
    actorUserId: input.actorUserId,
    actorDisplayName: input.actorDisplayName,
    actorCaste: input.actorCaste,
  };
  let extra: Partial<CommunityEvent> = {};
  if (input.kind === "attack") {
    extra = {
      targetUserId: input.targetUserId,
      targetDisplayName: input.targetDisplayName,
      tileId: input.tileId,
      outcome: input.outcome,
    };
  } else if (input.kind === "caste_change") {
    extra = { fromCaste: input.fromCaste, toCaste: input.toCaste };
  } else if (input.kind === "seal_broken") {
    extra = { sealIndex: input.sealIndex, seasonNumber: input.seasonNumber };
  } else if (
    input.kind === "armageddon_started" ||
    input.kind === "armageddon_completed" ||
    input.kind === "armageddon_cast_failed"
  ) {
    extra = { seasonNumber: input.seasonNumber };
  } else if (input.kind === "armageddon_winner") {
    extra = {
      seasonNumber: input.seasonNumber,
      winnerRank: input.winnerRank,
      tilesHeld: input.tilesHeld,
      sealsBroken: input.sealsBroken,
      tickets: input.tickets,
    };
  } else if (input.kind === "hero_emerged") {
    extra = {
      tileId: input.tileId,
      heroId: input.heroId,
      heroName: input.heroName,
      heroClass: input.heroClass,
      heroSpecialty: input.heroSpecialty,
    };
  } else if (input.kind === "hero_defected" || input.kind === "hero_slain") {
    extra = {
      tileId: input.tileId,
      heroId: input.heroId,
      heroName: input.heroName,
      heroClass: input.heroClass,
      heroSpecialty: input.heroSpecialty,
      otherUserId: input.otherUserId,
      otherDisplayName: input.otherDisplayName,
      otherCaste: input.otherCaste,
    };
  }
  tx.set(ref, { ...base, ...extra });
}

/** Out-of-transaction event writer for callers that aren't running
 *  inside a Firestore txn (e.g. seed scripts, simple `set` flows). */
export async function logCommunityEvent(
  input: CommunityEventInput,
  now: Date = new Date()
): Promise<void> {
  const db = adminDbOrThrow();
  const id = randomUUID();
  const ref = db.collection(COMMUNITY_EVENTS).doc(id);
  const base = {
    id,
    kind: input.kind,
    createdAt: now,
    actorUserId: input.actorUserId,
    actorDisplayName: input.actorDisplayName,
    actorCaste: input.actorCaste,
  };
  let extra: Partial<CommunityEvent> = {};
  if (input.kind === "attack") {
    extra = {
      targetUserId: input.targetUserId,
      targetDisplayName: input.targetDisplayName,
      tileId: input.tileId,
      outcome: input.outcome,
    };
  } else if (input.kind === "caste_change") {
    extra = { fromCaste: input.fromCaste, toCaste: input.toCaste };
  } else if (input.kind === "seal_broken") {
    extra = { sealIndex: input.sealIndex, seasonNumber: input.seasonNumber };
  } else if (
    input.kind === "armageddon_started" ||
    input.kind === "armageddon_completed" ||
    input.kind === "armageddon_cast_failed"
  ) {
    extra = { seasonNumber: input.seasonNumber };
  } else if (input.kind === "armageddon_winner") {
    extra = {
      seasonNumber: input.seasonNumber,
      winnerRank: input.winnerRank,
      tilesHeld: input.tilesHeld,
      sealsBroken: input.sealsBroken,
      tickets: input.tickets,
    };
  } else if (input.kind === "hero_emerged") {
    extra = {
      tileId: input.tileId,
      heroId: input.heroId,
      heroName: input.heroName,
      heroClass: input.heroClass,
      heroSpecialty: input.heroSpecialty,
    };
  } else if (input.kind === "hero_defected" || input.kind === "hero_slain") {
    extra = {
      tileId: input.tileId,
      heroId: input.heroId,
      heroName: input.heroName,
      heroClass: input.heroClass,
      heroSpecialty: input.heroSpecialty,
      otherUserId: input.otherUserId,
      otherDisplayName: input.otherDisplayName,
      otherCaste: input.otherCaste,
    };
  }
  await ref.set({ ...base, ...extra });
}

/** Fetches the N most-recent community events. Single ordered query;
 *  no joins (events are denormalized at write-time). */
export async function listRecentCommunityEvents(
  limit: number = COMMUNITY_PAGE_SIZE
): Promise<CommunityEvent[]> {
  const db = adminDbOrThrow();
  const snap = await db
    .collection(COMMUNITY_EVENTS)
    .orderBy("createdAt", "desc")
    .limit(Math.max(1, Math.min(200, limit)))
    .get();
  return snap.docs.map((d) => d.data() as CommunityEvent);
}

// =====================================================================
// Chat
// =====================================================================

export class CommunityMessageNotFoundError extends Error {
  constructor() {
    super("Community message not found");
    this.name = "CommunityMessageNotFoundError";
  }
}
export class CommunityMessageForbiddenError extends Error {
  constructor() {
    super(
      "Cannot delete this message: not authored by you and not an admin"
    );
    this.name = "CommunityMessageForbiddenError";
  }
}
export class CommunityMessageEmptyError extends Error {
  constructor() {
    super("Message body cannot be empty");
    this.name = "CommunityMessageEmptyError";
  }
}
export class CommunityMessageTooLongError extends Error {
  constructor() {
    super(`Message body exceeds ${MAX_MESSAGE_LENGTH} characters`);
    this.name = "CommunityMessageTooLongError";
  }
}

/**
 * Creates a chat message authored by the given user. Validates
 * non-empty body + body length. Caller is responsible for any rate-
 * limiting (use checkUpstashRateLimit before calling this).
 */
export async function createCommunityMessage(args: {
  userId: string;
  displayName: string;
  caste: Caste | null;
  body: string;
  now?: Date;
}): Promise<CommunityMessage> {
  const trimmed = args.body.trim();
  if (trimmed.length === 0) throw new CommunityMessageEmptyError();
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    throw new CommunityMessageTooLongError();
  }
  const now = args.now ?? new Date();
  const db = adminDbOrThrow();
  const id = randomUUID();
  const ref = db.collection(COMMUNITY_MESSAGES).doc(id);
  const message: CommunityMessage = {
    id,
    userId: args.userId,
    displayName: args.displayName,
    caste: args.caste,
    body: trimmed,
    createdAt: now,
  };
  await ref.set(message);
  return message;
}

/**
 * Soft-deletes a chat message. Author can delete their own; an admin
 * can delete any. Sets `deletedAt` (and `deletedByAdmin` for admin
 * deletes) so the audit trail is preserved.
 */
export async function deleteCommunityMessage(args: {
  messageId: string;
  callerUserId: string;
  callerIsAdmin: boolean;
  now?: Date;
}): Promise<CommunityMessage> {
  const now = args.now ?? new Date();
  const db = adminDbOrThrow();
  const ref = db.collection(COMMUNITY_MESSAGES).doc(args.messageId);
  const snap = await ref.get();
  if (!snap.exists) throw new CommunityMessageNotFoundError();
  const data = snap.data() as CommunityMessage;
  if (data.userId !== args.callerUserId && !args.callerIsAdmin) {
    throw new CommunityMessageForbiddenError();
  }
  const updates: Partial<CommunityMessage> = {
    deletedAt: now,
    deletedByAdmin: args.callerIsAdmin && data.userId !== args.callerUserId,
  };
  await ref.update(updates);
  return { ...data, ...updates };
}

/** Returns the N most-recent non-deleted chat messages. */
export async function listRecentCommunityMessages(
  limit: number = COMMUNITY_PAGE_SIZE
): Promise<CommunityMessage[]> {
  const db = adminDbOrThrow();
  // Fetch overhead — we want N visible messages, but some may have been
  // soft-deleted. Overfetch a bit so the result still has N when there
  // are recent deletes. Cheap (~0.06¢ per 100 reads).
  const overFetch = Math.max(1, Math.min(300, limit * 2));
  const snap = await db
    .collection(COMMUNITY_MESSAGES)
    .orderBy("createdAt", "desc")
    .limit(overFetch)
    .get();
  const out: CommunityMessage[] = [];
  for (const doc of snap.docs as ReadonlyArray<FirebaseFirestore.QueryDocumentSnapshot>) {
    const data = doc.data() as CommunityMessage;
    if (data.deletedAt) continue;
    out.push(data);
    if (out.length >= limit) break;
  }
  return out;
}
