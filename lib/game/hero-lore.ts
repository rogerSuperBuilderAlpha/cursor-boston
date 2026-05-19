/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * In-game lore contributions on heroes. Two surfaces:
 *
 *   - Chapters: long-form chronicle entries (≤2000 chars). The hero's
 *     current owner auto-publishes; any other player's submission lands
 *     as `status: 'pending'` until an admin approves.
 *   - Epitaphs: ≤280-char eulogies on deceased / limbo heroes. Anyone
 *     can submit; no approval gate (just admin soft-delete).
 *
 * Storage: subcollections `game_heroes/{heroId}/chapters` and
 *          `game_heroes/{heroId}/epitaphs`.
 *
 * Moderation pattern matches chat: `deletedAt` + `deletedByAdmin` for
 * soft-delete. Hard deletes are never used so the audit trail survives.
 */

import { randomUUID } from "node:crypto";
import type { Firestore, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { sanitizeText } from "@/lib/sanitize";
import type { Caste, GameHeroDoc } from "./types";

const HEROES = "game_heroes";
const CHAPTERS = "chapters";
const EPITAPHS = "epitaphs";

export const MAX_CHAPTER_LENGTH = 2000;
export const MAX_EPITAPH_LENGTH = 280;

export type ChapterStatus = "pending" | "approved";

export interface HeroChapter {
  id: string;
  heroId: string;
  authorId: string;
  authorDisplayName: string;
  authorCaste: Caste | null;
  body: string;
  status: ChapterStatus;
  createdAt: Timestamp | Date;
  approvedAt?: Timestamp | Date;
  approvedBy?: string;
  deletedAt?: Timestamp | Date;
  deletedByAdmin?: boolean;
}

export interface HeroEpitaph {
  id: string;
  heroId: string;
  authorId: string;
  authorDisplayName: string;
  authorCaste: Caste | null;
  body: string;
  createdAt: Timestamp | Date;
  deletedAt?: Timestamp | Date;
  deletedByAdmin?: boolean;
}

export class HeroLoreNotFoundError extends Error {
  constructor() {
    super("Lore entry not found");
    this.name = "HeroLoreNotFoundError";
  }
}
export class HeroLoreEmptyError extends Error {
  constructor() {
    super("Body cannot be empty");
    this.name = "HeroLoreEmptyError";
  }
}
export class HeroLoreTooLongError extends Error {
  constructor(max: number) {
    super(`Body exceeds ${max} characters`);
    this.name = "HeroLoreTooLongError";
  }
}
export class HeroLoreForbiddenError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "HeroLoreForbiddenError";
  }
}
export class HeroNotFoundError extends Error {
  constructor() {
    super("Hero not found");
    this.name = "HeroNotFoundError";
  }
}

function adminDbOrThrow(): Firestore {
  const db = getAdminDb();
  if (!db) throw new Error("Firebase Admin not initialized");
  return db;
}

async function loadHero(db: Firestore, heroId: string): Promise<GameHeroDoc> {
  const snap = await db.collection(HEROES).doc(heroId).get();
  if (!snap.exists) throw new HeroNotFoundError();
  return snap.data() as GameHeroDoc;
}

// ─────────────── Chapters ───────────────

export async function createHeroChapterServer(args: {
  heroId: string;
  authorId: string;
  authorDisplayName: string;
  authorCaste: Caste | null;
  rawBody: string;
  now?: Date;
}): Promise<HeroChapter> {
  const cleaned = sanitizeText(args.rawBody);
  if (cleaned.length === 0) throw new HeroLoreEmptyError();
  if (cleaned.length > MAX_CHAPTER_LENGTH) {
    throw new HeroLoreTooLongError(MAX_CHAPTER_LENGTH);
  }
  const now = args.now ?? new Date();
  const db = adminDbOrThrow();
  const hero = await loadHero(db, args.heroId);
  const isOwner = hero.currentOwnerId === args.authorId;
  const status: ChapterStatus = isOwner ? "approved" : "pending";
  const id = randomUUID();
  const ref = db
    .collection(HEROES)
    .doc(args.heroId)
    .collection(CHAPTERS)
    .doc(id);
  const chapter: HeroChapter = {
    id,
    heroId: args.heroId,
    authorId: args.authorId,
    authorDisplayName: args.authorDisplayName,
    authorCaste: args.authorCaste,
    body: cleaned,
    status,
    createdAt: now,
    ...(isOwner ? { approvedAt: now, approvedBy: args.authorId } : {}),
  };
  await ref.set(chapter);
  return chapter;
}

export async function listHeroChaptersServer(args: {
  heroId: string;
  /** Pass true to include `pending` chapters (admin view). */
  includePending?: boolean;
}): Promise<HeroChapter[]> {
  const db = adminDbOrThrow();
  const snap = await db
    .collection(HEROES)
    .doc(args.heroId)
    .collection(CHAPTERS)
    .orderBy("createdAt", "asc")
    .get();
  const out: HeroChapter[] = [];
  for (const doc of snap.docs) {
    const data = doc.data() as HeroChapter;
    if (data.deletedAt) continue;
    if (!args.includePending && data.status !== "approved") continue;
    out.push(data);
  }
  return out;
}

export async function deleteHeroChapterServer(args: {
  heroId: string;
  chapterId: string;
  callerUserId: string;
  callerIsAdmin: boolean;
  now?: Date;
}): Promise<HeroChapter> {
  const now = args.now ?? new Date();
  const db = adminDbOrThrow();
  const ref = db
    .collection(HEROES)
    .doc(args.heroId)
    .collection(CHAPTERS)
    .doc(args.chapterId);
  const snap = await ref.get();
  if (!snap.exists) throw new HeroLoreNotFoundError();
  const data = snap.data() as HeroChapter;
  if (data.authorId !== args.callerUserId && !args.callerIsAdmin) {
    throw new HeroLoreForbiddenError(
      "Cannot delete this chapter: not the author and not an admin"
    );
  }
  const updates = {
    deletedAt: now,
    deletedByAdmin:
      args.callerIsAdmin && data.authorId !== args.callerUserId,
  };
  await ref.update(updates);
  return { ...data, ...updates };
}

export async function approveHeroChapterServer(args: {
  heroId: string;
  chapterId: string;
  approverUserId: string;
  now?: Date;
}): Promise<HeroChapter> {
  const now = args.now ?? new Date();
  const db = adminDbOrThrow();
  const ref = db
    .collection(HEROES)
    .doc(args.heroId)
    .collection(CHAPTERS)
    .doc(args.chapterId);
  const snap = await ref.get();
  if (!snap.exists) throw new HeroLoreNotFoundError();
  const data = snap.data() as HeroChapter;
  const updates = {
    status: "approved" as ChapterStatus,
    approvedAt: now,
    approvedBy: args.approverUserId,
  };
  await ref.update(updates);
  return { ...data, ...updates };
}

// ─────────────── Epitaphs ───────────────

export async function createHeroEpitaphServer(args: {
  heroId: string;
  authorId: string;
  authorDisplayName: string;
  authorCaste: Caste | null;
  rawBody: string;
  now?: Date;
}): Promise<HeroEpitaph> {
  const cleaned = sanitizeText(args.rawBody);
  if (cleaned.length === 0) throw new HeroLoreEmptyError();
  if (cleaned.length > MAX_EPITAPH_LENGTH) {
    throw new HeroLoreTooLongError(MAX_EPITAPH_LENGTH);
  }
  const now = args.now ?? new Date();
  const db = adminDbOrThrow();
  const hero = await loadHero(db, args.heroId);
  if (!hero.isDeceased && !hero.awaitingResurrection) {
    throw new HeroLoreForbiddenError(
      "Epitaphs can only be written for fallen or awaiting-resurrection heroes"
    );
  }
  const id = randomUUID();
  const ref = db
    .collection(HEROES)
    .doc(args.heroId)
    .collection(EPITAPHS)
    .doc(id);
  const epitaph: HeroEpitaph = {
    id,
    heroId: args.heroId,
    authorId: args.authorId,
    authorDisplayName: args.authorDisplayName,
    authorCaste: args.authorCaste,
    body: cleaned,
    createdAt: now,
  };
  await ref.set(epitaph);
  return epitaph;
}

export async function listHeroEpitaphsServer(
  heroId: string
): Promise<HeroEpitaph[]> {
  const db = adminDbOrThrow();
  const snap = await db
    .collection(HEROES)
    .doc(heroId)
    .collection(EPITAPHS)
    .orderBy("createdAt", "desc")
    .get();
  const out: HeroEpitaph[] = [];
  for (const doc of snap.docs) {
    const data = doc.data() as HeroEpitaph;
    if (data.deletedAt) continue;
    out.push(data);
  }
  return out;
}

export async function deleteHeroEpitaphServer(args: {
  heroId: string;
  epitaphId: string;
  callerUserId: string;
  callerIsAdmin: boolean;
  now?: Date;
}): Promise<HeroEpitaph> {
  const now = args.now ?? new Date();
  const db = adminDbOrThrow();
  const ref = db
    .collection(HEROES)
    .doc(args.heroId)
    .collection(EPITAPHS)
    .doc(args.epitaphId);
  const snap = await ref.get();
  if (!snap.exists) throw new HeroLoreNotFoundError();
  const data = snap.data() as HeroEpitaph;
  if (data.authorId !== args.callerUserId && !args.callerIsAdmin) {
    throw new HeroLoreForbiddenError(
      "Cannot delete this epitaph: not the author and not an admin"
    );
  }
  const updates = {
    deletedAt: now,
    deletedByAdmin:
      args.callerIsAdmin && data.authorId !== args.callerUserId,
  };
  await ref.update(updates);
  return { ...data, ...updates };
}
