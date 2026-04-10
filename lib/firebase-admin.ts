/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { cert, getApps, initializeApp, App } from "firebase-admin/app";
import { getAuth, Auth } from "firebase-admin/auth";
import { getDatabase, Database } from "firebase-admin/database";
import { getFirestore, Firestore } from "firebase-admin/firestore";

let adminDb: Firestore | null = null;
let adminAuth: Auth | null = null;
let adminRtdb: Database | null = null;

function parseServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON");
  }
}

function getAdminApp(): App | null {
  const existingApp = getApps()[0];
  if (existingApp) {
    return existingApp;
  }

  const serviceAccount = parseServiceAccount();

  if (serviceAccount) {
    console.log("[Firebase Admin] Initializing with service account for project:", serviceAccount.project_id);
    return initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id,
      databaseURL:
        process.env.FIREBASE_DATABASE_URL || process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
    });
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.log("[Firebase Admin] Initializing with GOOGLE_APPLICATION_CREDENTIALS");
    return initializeApp({
      databaseURL:
        process.env.FIREBASE_DATABASE_URL || process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
    });
  }

  console.warn("[Firebase Admin] No credentials found - FIREBASE_SERVICE_ACCOUNT_JSON not set");
  return null;
}

export function getAdminDb(): Firestore | null {
  if (adminDb) {
    return adminDb;
  }

  const app = getAdminApp();
  if (!app) {
    return null;
  }

  adminDb = getFirestore(app);
  return adminDb;
}

export function getAdminAuth(): Auth | null {
  if (adminAuth) {
    return adminAuth;
  }

  const app = getAdminApp();
  if (!app) {
    return null;
  }

  adminAuth = getAuth(app);
  return adminAuth;
}

export function getAdminRtdb(): Database | null {
  if (adminRtdb) {
    return adminRtdb;
  }

  const app = getAdminApp();
  if (!app) {
    return null;
  }

  adminRtdb = getDatabase(app);
  return adminRtdb;
}
