/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { getAdminDb } from "./firebase-admin";
import type { WeeklyTip, TipStatus } from "@/types/tips";

const COLLECTION = "weeklyTips";

export async function getPublishedTips(): Promise<WeeklyTip[]> {
  const db = getAdminDb();
  if (!db) return [];

  const snapshot = await db
    .collection(COLLECTION)
    .where("status", "==", "published")
    .orderBy("publishedAt", "desc")
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<WeeklyTip, "id">),
  }));
}

export async function getScheduledTipForWeek(weekOf: string): Promise<WeeklyTip | null> {
  const db = getAdminDb();
  if (!db) return null;

  const snapshot = await db
    .collection(COLLECTION)
    .where("status", "in", ["scheduled", "published"])
    .where("weekOf", "==", weekOf)
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { id: doc.id, ...(doc.data() as Omit<WeeklyTip, "id">) };
}

export async function getLatestScheduledTip(): Promise<WeeklyTip | null> {
  const db = getAdminDb();
  if (!db) return null;

  const snapshot = await db
    .collection(COLLECTION)
    .where("status", "==", "scheduled")
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { id: doc.id, ...(doc.data() as Omit<WeeklyTip, "id">) };
}

export async function createTip(data: {
  title: string;
  content: string;
  category: string;
  authorId: string;
  authorName: string;
  status: TipStatus;
}): Promise<string> {
  const db = getAdminDb();
  if (!db) throw new Error("Firestore not configured");

  const docRef = await db.collection(COLLECTION).add({
    ...data,
    createdAt: new Date().toISOString(),
  });

  return docRef.id;
}

export async function updateTipStatus(
  tipId: string,
  status: TipStatus,
  extra: Record<string, unknown> = {}
): Promise<void> {
  const db = getAdminDb();
  if (!db) throw new Error("Firestore not configured");

  await db
    .collection(COLLECTION)
    .doc(tipId)
    .update({ status, ...extra });
}
