import { cert, getApps, initializeApp, App } from "firebase-admin/app";
import { getAuth, Auth } from "firebase-admin/auth";
import { getFirestore, Firestore } from "firebase-admin/firestore";

let adminDb: Firestore | null = null;
let adminAuth: Auth | null = null;

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
    return initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return initializeApp();
  }

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
