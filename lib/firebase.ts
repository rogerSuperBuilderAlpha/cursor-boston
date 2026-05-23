/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { getDatabase, Database } from "firebase/database";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { getAnalytics, Analytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Check if Firebase config is available
const isConfigured = firebaseConfig.apiKey && firebaseConfig.projectId;

// Skip Analytics when using placeholder env (avoids "API key not valid" console errors)
const isPlaceholderKey =
  !firebaseConfig.apiKey ||
  firebaseConfig.apiKey.startsWith("your-") ||
  firebaseConfig.apiKey.startsWith("demo-") ||
  firebaseConfig.apiKey === "your-api-key" ||
  (firebaseConfig.projectId?.startsWith("your-") ?? false) ||
  (firebaseConfig.projectId?.startsWith("demo-") ?? false);

/**
 * Client-side Firebase app singleton.
 *
 * Available only in the browser when public Firebase config is present.
 * Remains `undefined` during server rendering, tests, and local runs that use
 * placeholder env values. Server-side code that needs privileged Firebase
 * access should use `lib/firebase-admin` instead.
 */
let app: FirebaseApp | undefined;

/**
 * Client-side Firebase Auth singleton.
 *
 * Use from browser components and hooks after checking it is defined. This is
 * not an Admin SDK auth instance and cannot verify or manage users on the
 * server.
 */
let auth: Auth | undefined;

/**
 * Client-side Firestore singleton.
 *
 * Use from browser code that should obey Firestore security rules. It is
 * `undefined` outside the browser or when public Firebase env is missing.
 */
let db: Firestore | undefined;

/**
 * Client-side Realtime Database singleton.
 *
 * Use from browser code that should obey database security rules. It is
 * `undefined` outside the browser or when public Firebase env is missing.
 */
let rtdb: Database | undefined;

/**
 * Client-side Firebase Storage singleton.
 *
 * Use from browser code that should obey Storage security rules. It is
 * `undefined` outside the browser or when public Firebase env is missing.
 */
let storage: FirebaseStorage | undefined;

/**
 * Client-side Firebase Analytics singleton.
 *
 * Analytics is loaded only in supported browsers with non-placeholder public
 * Firebase config, so callers must handle `undefined`.
 */
let analytics: Analytics | undefined;

/**
 * Promise that resolves to Analytics when browser support and config allow it.
 *
 * Resolves to `undefined` on the server, in unsupported browsers, or when local
 * placeholder Firebase env values are configured.
 */
const analyticsReady: Promise<Analytics | undefined> = (async () => {
  if (!isConfigured || typeof window === "undefined" || isPlaceholderKey) {
    return undefined;
  }
  const supported = await isSupported();
  if (supported && app) {
    analytics = getAnalytics(app);
    return analytics;
  }
  return undefined;
})();

if (isConfigured && typeof window !== "undefined") {
  // Only initialize on client side with valid config
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
  rtdb = getDatabase(app);
  storage = getStorage(app);
}

export { app, auth, db, rtdb, storage, analytics, analyticsReady };
