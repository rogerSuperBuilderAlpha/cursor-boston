/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Pre-filed predictions about specific Armageddon seal breaks. A
 * prophecy is "fulfilled" when its target seal breaks — no NLP, no
 * matching on the prediction text; the text is purely cosmetic.
 *
 * Resolution path: `resolveProphesiesForSealInTx` is invoked from the
 * Armageddon cast handler inside the same transaction that increments
 * `sealsBroken`. It scans unresolved prophecies for the breaking seal,
 * stamps `resolvedAt` + `fulfilledBy`, posts `prophecy_fulfilled`
 * community events, and increments the author's
 * `prophecyFulfilledCount` (drives the Seer title).
 */

import { randomUUID } from "node:crypto";
import type { Firestore, Transaction } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { sanitizeText } from "@/lib/sanitize";
import type { Caste, GameWorldMeta, Prophecy } from "./types";
import { logCommunityEventInTx } from "./community";

const PROPHECIES = "game_prophecies";
const PLAYERS = "game_players";
const WORLD_META = "game_world_meta";
export const MAX_PROPHECY_LENGTH = 200;
const SEAL_COUNT = 7;

export class ProphecyEmptyError extends Error {
  constructor() {
    super("Prophecy text cannot be empty");
    this.name = "ProphecyEmptyError";
  }
}
export class ProphecyTooLongError extends Error {
  constructor() {
    super(`Prophecy exceeds ${MAX_PROPHECY_LENGTH} characters`);
    this.name = "ProphecyTooLongError";
  }
}
export class ProphecyInvalidSealError extends Error {
  constructor() {
    super("Target seal number must be 1..7");
    this.name = "ProphecyInvalidSealError";
  }
}
export class ProphecySealAlreadyBrokenError extends Error {
  constructor() {
    super("That seal has already broken — too late to prophesy.");
    this.name = "ProphecySealAlreadyBrokenError";
  }
}
export class ProphecyForbiddenError extends Error {
  constructor() {
    super("Forbidden");
    this.name = "ProphecyForbiddenError";
  }
}
export class ProphecyNotFoundError extends Error {
  constructor() {
    super("Prophecy not found");
    this.name = "ProphecyNotFoundError";
  }
}

function adminDbOrThrow(): Firestore {
  const db = getAdminDb();
  if (!db) throw new Error("Firebase Admin not initialized");
  return db;
}

export async function createProphecyServer(args: {
  author: { userId: string; displayName: string; caste: Caste | null };
  targetSealNumber: number;
  rawPrediction: string;
  now?: Date;
}): Promise<Prophecy> {
  if (
    !Number.isInteger(args.targetSealNumber) ||
    args.targetSealNumber < 1 ||
    args.targetSealNumber > SEAL_COUNT
  ) {
    throw new ProphecyInvalidSealError();
  }
  const cleaned = sanitizeText(args.rawPrediction);
  if (cleaned.length === 0) throw new ProphecyEmptyError();
  if (cleaned.length > MAX_PROPHECY_LENGTH) throw new ProphecyTooLongError();
  const now = args.now ?? new Date();
  const db = adminDbOrThrow();
  // Check current sealsBroken — if the target seal already broke, reject.
  const metaSnap = await db.collection(WORLD_META).doc("singleton").get();
  const meta = metaSnap.exists ? (metaSnap.data() as GameWorldMeta) : null;
  const sealsBroken = meta?.sealsBroken ?? 0;
  if (args.targetSealNumber <= sealsBroken) {
    throw new ProphecySealAlreadyBrokenError();
  }
  const id = randomUUID();
  const ref = db.collection(PROPHECIES).doc(id);
  const prophecy: Prophecy = {
    id,
    authorId: args.author.userId,
    authorDisplayName: args.author.displayName,
    authorCaste: args.author.caste,
    targetSealNumber: args.targetSealNumber,
    prediction: cleaned,
    createdAt: now,
  };
  await ref.set(prophecy);
  return prophecy;
}

export async function listPropheciesForSealServer(
  targetSealNumber: number
): Promise<Prophecy[]> {
  const db = adminDbOrThrow();
  const snap = await db
    .collection(PROPHECIES)
    .where("targetSealNumber", "==", targetSealNumber)
    .orderBy("createdAt", "desc")
    .get();
  return snap.docs
    .map((d) => d.data() as Prophecy)
    .filter((p) => !p.deletedAt);
}

export async function listPropheciesByAuthorServer(
  authorId: string
): Promise<Prophecy[]> {
  const db = adminDbOrThrow();
  const snap = await db
    .collection(PROPHECIES)
    .where("authorId", "==", authorId)
    .get();
  return snap.docs
    .map((d) => d.data() as Prophecy)
    .filter((p) => !p.deletedAt);
}

export async function deleteProphecyServer(args: {
  prophecyId: string;
  callerUserId: string;
  callerIsAdmin: boolean;
  now?: Date;
}): Promise<Prophecy> {
  const now = args.now ?? new Date();
  const db = adminDbOrThrow();
  const ref = db.collection(PROPHECIES).doc(args.prophecyId);
  const snap = await ref.get();
  if (!snap.exists) throw new ProphecyNotFoundError();
  const data = snap.data() as Prophecy;
  if (data.authorId !== args.callerUserId && !args.callerIsAdmin) {
    throw new ProphecyForbiddenError();
  }
  const updates = {
    deletedAt: now,
    deletedByAdmin: args.callerIsAdmin && data.authorId !== args.callerUserId,
  };
  await ref.update(updates);
  return { ...data, ...updates };
}

/**
 * Called inside the Armageddon cast transaction immediately after the
 * seal break is committed. Reads prophecies whose targetSealNumber
 * matches the just-broken seal, stamps each as resolved (denormalizing
 * the breaker), and posts `prophecy_fulfilled` community events.
 *
 * IMPORTANT: this performs Firestore reads — the caller's transaction
 * must do all its other reads BEFORE calling this. We use a `getAll`
 * with the tx so we don't double-read.
 */
export async function resolveProphesiesForSealInTx(args: {
  tx: Transaction;
  db: Firestore;
  brokenSealNumber: number;
  brokenBy: {
    userId: string;
    displayName: string;
    caste: Caste;
  };
  now: Date;
}): Promise<void> {
  // We can't use `where()` inside a tx, so fetch outside the tx first
  // (acceptable: prophecies for this seal can't be modified between the
  // fetch and the tx because the seal break is the only thing that
  // resolves them).
  const snap = await args.db
    .collection(PROPHECIES)
    .where("targetSealNumber", "==", args.brokenSealNumber)
    .get();
  for (const doc of snap.docs) {
    const data = doc.data() as Prophecy;
    if (data.deletedAt) continue;
    if (data.resolvedAt) continue;
    args.tx.update(doc.ref, {
      resolvedAt: args.now,
      fulfilledBy: args.brokenBy,
    });
    // Bump the author's seer counter.
    args.tx.update(
      args.db.collection(PLAYERS).doc(data.authorId),
      { prophecyFulfilledCount: FieldValue.increment(1) }
    );
    logCommunityEventInTx(
      args.tx,
      args.db,
      {
        kind: "prophecy_fulfilled",
        actorUserId: data.authorId,
        actorDisplayName: data.authorDisplayName,
        actorCaste: data.authorCaste,
        prophecyId: data.id,
        prophecyPrediction: data.prediction,
        prophecyTargetSealNumber: data.targetSealNumber,
      },
      args.now
    );
  }
}
