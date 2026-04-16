/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { getAdminDb } from "@/lib/firebase-admin";

export async function getUserGithubLoginFromFirestore(
  uid: string
): Promise<string | null> {
  const db = getAdminDb();
  if (!db) return null;
  const snap = await db.collection("users").doc(uid).get();
  if (!snap.exists) return null;
  const github = snap.data()?.github;
  if (!github || typeof github !== "object") return null;
  const login = (github as { login?: string }).login;
  if (typeof login !== "string" || !login.trim()) return null;
  return login.trim();
}
