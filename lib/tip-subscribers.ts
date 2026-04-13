/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { getAdminDb } from "./firebase-admin";
import type { TipSubscriber } from "@/types/tips";

const COLLECTION = "tipSubscribers";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function addSubscriber(email: string, name?: string): Promise<void> {
  const db = getAdminDb();
  if (!db) throw new Error("Firestore not configured");

  const normalized = normalizeEmail(email);
  const docRef = db.collection(COLLECTION).doc(normalized);
  const existing = await docRef.get();

  if (existing.exists) {
    const data = existing.data();
    if (data?.unsubscribed) {
      await docRef.update({
        unsubscribed: false,
        subscribedAt: new Date().toISOString(),
        ...(name && { name }),
      });
    }
    return;
  }

  await docRef.set({
    email: normalized,
    name: name || null,
    subscribedAt: new Date().toISOString(),
    unsubscribed: false,
  });
}

export async function removeSubscriber(email: string): Promise<void> {
  const db = getAdminDb();
  if (!db) throw new Error("Firestore not configured");

  const normalized = normalizeEmail(email);
  const docRef = db.collection(COLLECTION).doc(normalized);
  const existing = await docRef.get();

  if (!existing.exists) return;

  await docRef.update({
    unsubscribed: true,
    unsubscribedAt: new Date().toISOString(),
  });
}

export async function getActiveSubscribers(): Promise<TipSubscriber[]> {
  const db = getAdminDb();
  if (!db) return [];

  const snapshot = await db
    .collection(COLLECTION)
    .where("unsubscribed", "==", false)
    .get();

  return snapshot.docs.map((doc) => doc.data() as TipSubscriber);
}
