/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Queued orders (zero-turn gameplay).
 *
 * Players plan a battle plan when they're out of turns; the orders fire
 * automatically at the next weekly turn grant. Each order carries its
 * normal turn cost when it fires; orders that can't execute (insufficient
 * turns, tile lost, etc.) are marked `failed` with a one-line reason and
 * surfaced in the player's report feed.
 *
 * Storage: `game_order_queue/{orderId}` — one doc per order. Server-write
 * only. Players list their queue via /api/game/orders.
 */

import { randomUUID } from "node:crypto";
import type { Firestore, Transaction } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import type {
  QueuedOrder,
  QueuedOrderKind,
  QueuedOrderParams,
  QueuedOrderStatus,
} from "./types";
import { QUEUED_ORDERS_MAX_PER_PLAYER } from "./types";

const ORDER_QUEUE = "game_order_queue";

// Errors -----------------------------------------------------------------

export class QueuedOrderQueueFullError extends Error {
  constructor(public cap: number) {
    super(`Order queue full — cap is ${cap} pending orders.`);
    this.name = "QueuedOrderQueueFullError";
  }
}
export class QueuedOrderNotFoundError extends Error {
  constructor() {
    super("Queued order not found.");
    this.name = "QueuedOrderNotFoundError";
  }
}
export class QueuedOrderForbiddenError extends Error {
  constructor() {
    super("That order is not yours.");
    this.name = "QueuedOrderForbiddenError";
  }
}
export class QueuedOrderInvalidParamsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QueuedOrderInvalidParamsError";
  }
}

function adminDbOrThrow(): Firestore {
  const db = getAdminDb();
  if (!db) throw new Error("Firebase Admin not initialized");
  return db;
}

// Param validation -------------------------------------------------------

function validateParamsForKind(
  kind: QueuedOrderKind,
  params: QueuedOrderParams
): void {
  if (params.kind !== kind) {
    throw new QueuedOrderInvalidParamsError("Params kind mismatch");
  }
  switch (params.kind) {
    case "recruit_on_tile":
      if (!params.tileId) {
        throw new QueuedOrderInvalidParamsError("tileId required");
      }
      if (!["ground", "siege", "air"].includes(params.unitType)) {
        throw new QueuedOrderInvalidParamsError("Invalid unitType");
      }
      break;
    case "attack_adjacent":
      if (!params.sourceTileId || !params.targetTileId) {
        throw new QueuedOrderInvalidParamsError("source/target tileIds required");
      }
      if (
        params.units.ground < 0 ||
        params.units.siege < 0 ||
        params.units.air < 0
      ) {
        throw new QueuedOrderInvalidParamsError("Unit counts must be >= 0");
      }
      if (
        params.units.ground + params.units.siege + params.units.air <
        1
      ) {
        throw new QueuedOrderInvalidParamsError("Must send at least 1 unit");
      }
      break;
    case "cast_spell_on_tile":
      if (!params.tileId || !params.spellId) {
        throw new QueuedOrderInvalidParamsError("tileId + spellId required");
      }
      break;
  }
}

// Server actions ---------------------------------------------------------

export async function enqueueOrderServer(args: {
  playerId: string;
  kind: QueuedOrderKind;
  params: QueuedOrderParams;
  now?: Date;
}): Promise<QueuedOrder> {
  validateParamsForKind(args.kind, args.params);
  const now = args.now ?? new Date();
  const db = adminDbOrThrow();
  // Count current "queued" orders for this player.
  const snap = await db
    .collection(ORDER_QUEUE)
    .where("playerId", "==", args.playerId)
    .where("status", "==", "queued")
    .get();
  if (snap.size >= QUEUED_ORDERS_MAX_PER_PLAYER) {
    throw new QueuedOrderQueueFullError(QUEUED_ORDERS_MAX_PER_PLAYER);
  }
  const id = randomUUID();
  const order: QueuedOrder = {
    id,
    playerId: args.playerId,
    kind: args.kind,
    params: args.params,
    sequenceIndex: snap.size, // append to end of queue
    status: "queued",
    createdAt: now,
    updatedAt: now,
  };
  await db.collection(ORDER_QUEUE).doc(id).set(order);
  return order;
}

export async function listOrdersForPlayerServer(
  playerId: string,
  includeExecuted: boolean = false
): Promise<QueuedOrder[]> {
  const db = adminDbOrThrow();
  let query = db.collection(ORDER_QUEUE).where("playerId", "==", playerId);
  if (!includeExecuted) {
    query = query.where("status", "==", "queued");
  }
  const snap = await query.get();
  return snap.docs
    .map((d) => d.data() as QueuedOrder)
    .sort((a, b) => a.sequenceIndex - b.sequenceIndex);
}

export async function cancelOrderServer(args: {
  orderId: string;
  callerUserId: string;
  now?: Date;
}): Promise<QueuedOrder> {
  const now = args.now ?? new Date();
  const db = adminDbOrThrow();
  const ref = db.collection(ORDER_QUEUE).doc(args.orderId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new QueuedOrderNotFoundError();
    const data = snap.data() as QueuedOrder;
    if (data.playerId !== args.callerUserId) {
      throw new QueuedOrderForbiddenError();
    }
    if (data.status !== "queued") {
      // Already executed/failed/cancelled — return as-is, no error.
      return data;
    }
    const updates: Partial<QueuedOrder> = {
      status: "cancelled" as QueuedOrderStatus,
      updatedAt: now,
      executedAt: now,
      resultSummary: "Cancelled by player",
    };
    tx.update(ref, updates);
    return { ...data, ...updates };
  });
}

/**
 * Mark a queued order as `executed` or `failed` inside the caller's
 * transaction. Used by the weekly-rollover executor.
 */
export function markOrderResultInTx(args: {
  tx: Transaction;
  db: Firestore;
  order: QueuedOrder;
  status: "executed" | "failed";
  resultSummary: string;
  resultRefId?: string;
  now: Date;
}): void {
  const ref = args.db.collection(ORDER_QUEUE).doc(args.order.id);
  const updates: Partial<QueuedOrder> = {
    status: args.status,
    resultSummary: args.resultSummary,
    executedAt: args.now,
    updatedAt: args.now,
    ...(args.resultRefId ? { resultRefId: args.resultRefId } : {}),
  };
  args.tx.update(ref, updates);
}

/**
 * Reads (outside any transaction) all queued orders for one player,
 * sorted by sequenceIndex. The weekly-rollover executor calls this once
 * per player, then iterates and dispatches each order to its handler.
 *
 * Kept here (not inlined into the executor) so the queued-orders unit
 * tests can mock the read independently of the dispatch logic.
 */
export async function readQueuedOrdersForPlayer(
  db: Firestore,
  playerId: string
): Promise<QueuedOrder[]> {
  const snap = await db
    .collection(ORDER_QUEUE)
    .where("playerId", "==", playerId)
    .where("status", "==", "queued")
    .get();
  return snap.docs
    .map((d) => d.data() as QueuedOrder)
    .sort((a, b) => a.sequenceIndex - b.sequenceIndex);
}
