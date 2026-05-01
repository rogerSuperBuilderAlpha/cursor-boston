/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { randomBytes } from "crypto";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { getAdminDb } from "./firebase-admin";
import { logger } from "./logger";
import {
  LUDWITT_TOKEN_URL,
  LUDWITT_TOKENS_COLLECTION,
  fetchLudwittWithTimeout,
  getLudwittClientId,
  getLudwittClientSecret,
} from "./ludwitt-config";

export interface LudwittTokens {
  accessToken: string;
  refreshToken: string;
  scope: string;
  accessExpiresAt: Date;
}

export interface LudwittTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

interface LudwittTokenDoc {
  accessToken: string;
  refreshToken: string;
  scope: string;
  tokenType: string;
  accessExpiresAt: FirebaseFirestore.Timestamp;
  refreshLockId?: string;
  refreshLockExpiresAt?: FirebaseFirestore.Timestamp;
  refreshedAt?: FirebaseFirestore.Timestamp;
  createdAt?: FirebaseFirestore.Timestamp;
  updatedAt?: FirebaseFirestore.Timestamp;
}

const LOCK_TTL_MS = 15_000;
const LOCK_WAIT_POLL_MS = 800;
const LOCK_WAIT_MAX_ATTEMPTS = 5;

function requireDb(): Firestore {
  const db = getAdminDb();
  if (!db) {
    throw new Error("Firebase Admin not configured");
  }
  return db;
}

function readDoc(snap: FirebaseFirestore.DocumentSnapshot): LudwittTokens | null {
  if (!snap.exists) return null;
  const data = snap.data() as LudwittTokenDoc | undefined;
  if (!data?.accessToken || !data?.refreshToken) return null;
  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    scope: data.scope || "",
    accessExpiresAt: data.accessExpiresAt?.toDate?.() ?? new Date(0),
  };
}

export async function getLudwittTokens(uid: string): Promise<LudwittTokens | null> {
  const snap = await requireDb().collection(LUDWITT_TOKENS_COLLECTION).doc(uid).get();
  return readDoc(snap);
}

export async function saveLudwittTokens(
  uid: string,
  raw: LudwittTokenResponse
): Promise<void> {
  const accessExpiresAt = new Date(Date.now() + raw.expires_in * 1000);
  await requireDb()
    .collection(LUDWITT_TOKENS_COLLECTION)
    .doc(uid)
    .set(
      {
        accessToken: raw.access_token,
        refreshToken: raw.refresh_token,
        scope: raw.scope,
        tokenType: raw.token_type,
        accessExpiresAt,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
}

export async function deleteLudwittTokens(uid: string): Promise<void> {
  await requireDb().collection(LUDWITT_TOKENS_COLLECTION).doc(uid).delete();
}

async function postRefresh(refreshToken: string): Promise<LudwittTokenResponse> {
  const clientId = getLudwittClientId();
  const clientSecret = getLudwittClientSecret();
  if (!clientId || !clientSecret) {
    throw new Error("Ludwitt OAuth not configured");
  }
  const res = await fetchLudwittWithTimeout(LUDWITT_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    logger.warn("Ludwitt refresh failed", { status: res.status, body: body.slice(0, 200) });
    throw new Error(`refresh_failed:${res.status}`);
  }
  return (await res.json()) as LudwittTokenResponse;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Refresh tokens with a soft Firestore lock. Single-flight: if another caller
 * is already refreshing, wait briefly and re-read the fresh tokens.
 */
export async function refreshLudwittTokens(uid: string): Promise<LudwittTokens> {
  const db = requireDb();
  const ref = db.collection(LUDWITT_TOKENS_COLLECTION).doc(uid);
  const lockId = randomBytes(8).toString("hex");

  const claimed = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error("ludwitt_tokens_missing");
    const data = snap.data() as LudwittTokenDoc;
    const existingLock = data.refreshLockId;
    const lockExpiresMs = data.refreshLockExpiresAt?.toMillis?.() ?? 0;
    if (existingLock && lockExpiresMs > Date.now()) {
      return false;
    }
    tx.update(ref, {
      refreshLockId: lockId,
      refreshLockExpiresAt: new Date(Date.now() + LOCK_TTL_MS),
    });
    return true;
  });

  if (!claimed) {
    for (let i = 0; i < LOCK_WAIT_MAX_ATTEMPTS; i++) {
      await sleep(LOCK_WAIT_POLL_MS);
      const snap = await ref.get();
      const data = snap.data() as LudwittTokenDoc | undefined;
      if (!data) throw new Error("ludwitt_tokens_missing");
      if (!data.refreshLockId || (data.refreshLockExpiresAt?.toMillis?.() ?? 0) < Date.now()) {
        const tokens = readDoc(snap);
        if (tokens) return tokens;
      }
    }
    throw new Error("ludwitt_refresh_lock_timeout");
  }

  try {
    const snap = await ref.get();
    const data = snap.data() as LudwittTokenDoc;
    const fresh = await postRefresh(data.refreshToken);
    const accessExpiresAt = new Date(Date.now() + fresh.expires_in * 1000);
    await ref.update({
      accessToken: fresh.access_token,
      refreshToken: fresh.refresh_token,
      scope: fresh.scope,
      tokenType: fresh.token_type,
      accessExpiresAt,
      refreshLockId: FieldValue.delete(),
      refreshLockExpiresAt: FieldValue.delete(),
      refreshedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return {
      accessToken: fresh.access_token,
      refreshToken: fresh.refresh_token,
      scope: fresh.scope,
      accessExpiresAt,
    };
  } catch (err) {
    await ref
      .update({
        refreshLockId: FieldValue.delete(),
        refreshLockExpiresAt: FieldValue.delete(),
      })
      .catch(() => {});
    throw err;
  }
}

/**
 * Run a Ludwitt API call with a fresh access token, refreshing once on 401.
 */
export async function withFreshLudwittAccessToken<T>(
  uid: string,
  call: (
    accessToken: string
  ) => Promise<{ status: number; body: T; headers: Headers }>
): Promise<{ status: number; body: T; headers: Headers }> {
  const tokens = await getLudwittTokens(uid);
  if (!tokens) throw new Error("ludwitt_not_connected");

  const first = await call(tokens.accessToken);
  if (first.status !== 401) return first;

  const refreshed = await refreshLudwittTokens(uid);
  return call(refreshed.accessToken);
}
