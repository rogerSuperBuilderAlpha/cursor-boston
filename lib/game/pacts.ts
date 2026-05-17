/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Public non-aggression pacts. No combat enforcement — if the author
 * attacks the target inside the window, the attack handler is
 * responsible for marking the pact broken + posting the feed event
 * (see `markPactsBrokenInTx` below). Reputation system, not a rules
 * system.
 */

import { randomUUID } from "node:crypto";
import type { Firestore, Transaction } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { sanitizeText } from "@/lib/sanitize";
import type { Caste, Pact } from "./types";
import { logCommunityEventInTx } from "./community";

const PACTS = "game_pacts";
export const MAX_PACT_STATEMENT_LENGTH = 200;
const DEFAULT_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export class PactEmptyError extends Error {
  constructor() {
    super("Pact statement cannot be empty");
    this.name = "PactEmptyError";
  }
}
export class PactTooLongError extends Error {
  constructor() {
    super(`Pact statement exceeds ${MAX_PACT_STATEMENT_LENGTH} characters`);
    this.name = "PactTooLongError";
  }
}
export class PactSelfTargetError extends Error {
  constructor() {
    super("Cannot file a pact with yourself");
    this.name = "PactSelfTargetError";
  }
}
export class PactTargetNotFoundError extends Error {
  constructor() {
    super("Target player not found");
    this.name = "PactTargetNotFoundError";
  }
}
export class PactForbiddenError extends Error {
  constructor() {
    super("Forbidden");
    this.name = "PactForbiddenError";
  }
}
export class PactNotFoundError extends Error {
  constructor() {
    super("Pact not found");
    this.name = "PactNotFoundError";
  }
}

function adminDbOrThrow(): Firestore {
  const db = getAdminDb();
  if (!db) throw new Error("Firebase Admin not initialized");
  return db;
}

interface PlayerDenorm {
  userId: string;
  displayName: string;
  caste: Caste | null;
}

export async function createPactServer(args: {
  author: PlayerDenorm;
  targetId: string;
  rawStatement: string;
  durationMs?: number;
  now?: Date;
}): Promise<Pact> {
  if (args.author.userId === args.targetId) throw new PactSelfTargetError();
  const cleaned = sanitizeText(args.rawStatement);
  if (cleaned.length === 0) throw new PactEmptyError();
  if (cleaned.length > MAX_PACT_STATEMENT_LENGTH) throw new PactTooLongError();
  const now = args.now ?? new Date();
  const db = adminDbOrThrow();
  const targetSnap = await db.collection("game_players").doc(args.targetId).get();
  if (!targetSnap.exists) throw new PactTargetNotFoundError();
  const targetData = targetSnap.data() as {
    displayName?: string;
    caste?: Caste | null;
  };
  const id = randomUUID();
  const expiresAt = new Date(now.getTime() + (args.durationMs ?? DEFAULT_DURATION_MS));
  const ref = db.collection(PACTS).doc(id);
  const pact: Pact = {
    id,
    authorId: args.author.userId,
    authorDisplayName: args.author.displayName,
    authorCaste: args.author.caste,
    targetId: args.targetId,
    targetDisplayName: targetData.displayName?.trim() || "Unknown general",
    targetCaste: targetData.caste ?? null,
    statement: cleaned,
    createdAt: now,
    expiresAt,
  };
  await ref.set(pact);
  return pact;
}

export async function listPactsForPlayerServer(
  playerId: string
): Promise<Pact[]> {
  const db = adminDbOrThrow();
  const [authoredSnap, targetedSnap] = await Promise.all([
    db.collection(PACTS).where("authorId", "==", playerId).get(),
    db.collection(PACTS).where("targetId", "==", playerId).get(),
  ]);
  const out: Pact[] = [];
  for (const doc of [...authoredSnap.docs, ...targetedSnap.docs]) {
    const data = doc.data() as Pact;
    if (data.deletedAt) continue;
    out.push(data);
  }
  // Dedup by id (a player might be both author and target — shouldn't
  // happen but defensive).
  const dedup = new Map<string, Pact>();
  for (const p of out) dedup.set(p.id, p);
  return Array.from(dedup.values()).sort((a, b) => {
    const aExp = pactExpiresAtMs(a);
    const bExp = pactExpiresAtMs(b);
    return bExp - aExp;
  });
}

export async function deletePactServer(args: {
  pactId: string;
  callerUserId: string;
  callerIsAdmin: boolean;
  now?: Date;
}): Promise<Pact> {
  const now = args.now ?? new Date();
  const db = adminDbOrThrow();
  const ref = db.collection(PACTS).doc(args.pactId);
  const snap = await ref.get();
  if (!snap.exists) throw new PactNotFoundError();
  const data = snap.data() as Pact;
  if (data.authorId !== args.callerUserId && !args.callerIsAdmin) {
    throw new PactForbiddenError();
  }
  const updates = {
    deletedAt: now,
    deletedByAdmin:
      args.callerIsAdmin && data.authorId !== args.callerUserId,
  };
  await ref.update(updates);
  return { ...data, ...updates };
}

function pactExpiresAtMs(p: Pact): number {
  if (p.expiresAt instanceof Date) return p.expiresAt.getTime();
  if (
    typeof p.expiresAt === "object" &&
    p.expiresAt !== null &&
    "seconds" in p.expiresAt
  ) {
    return (p.expiresAt as { seconds: number }).seconds * 1000;
  }
  return 0;
}

/**
 * Called inside attackTileServer's transaction. Scans the attacker's
 * active pacts targeting the defender; for each not-yet-broken pact
 * still inside its window, sets `brokenAt` and posts a `pact_broken`
 * community event. No-op if no matching pact exists.
 */
export async function markPactsBrokenInTx(args: {
  tx: Transaction;
  db: Firestore;
  attackerId: string;
  attackerDisplayName: string;
  attackerCaste: Caste | null;
  defenderId: string;
  defenderDisplayName: string;
  now: Date;
}): Promise<void> {
  const snap = await args.db
    .collection(PACTS)
    .where("authorId", "==", args.attackerId)
    .where("targetId", "==", args.defenderId)
    .get();
  if (snap.empty) return;
  const nowMs = args.now.getTime();
  for (const doc of snap.docs) {
    const pact = doc.data() as Pact;
    if (pact.deletedAt) continue;
    if (pact.brokenAt) continue;
    const expiresMs = pactExpiresAtMs(pact);
    if (expiresMs < nowMs) continue;
    args.tx.update(doc.ref, { brokenAt: args.now });
    logCommunityEventInTx(
      args.tx,
      args.db,
      {
        kind: "pact_broken",
        actorUserId: args.attackerId,
        actorDisplayName: args.attackerDisplayName,
        actorCaste: args.attackerCaste,
        targetUserId: args.defenderId,
        targetDisplayName: args.defenderDisplayName,
        pactId: pact.id,
        pactStatement: pact.statement,
      },
      args.now
    );
  }
}
