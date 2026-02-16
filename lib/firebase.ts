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
  firebaseConfig.apiKey === "your-api-key" ||
  (firebaseConfig.projectId?.startsWith("your-") ?? false);

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let rtdb: Database | undefined;
let storage: FirebaseStorage | undefined;
let analytics: Analytics | undefined;

if (isConfigured && typeof window !== "undefined") {
  // Only initialize on client side with valid config
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
  rtdb = getDatabase(app);
  storage = getStorage(app);

  // Initialize analytics only when we have real credentials (not .env.example placeholders)
  if (!isPlaceholderKey) {
    isSupported().then((supported) => {
      if (supported && app) {
        analytics = getAnalytics(app);
      }
    });
  }
}

export { app, auth, db, rtdb, storage, analytics };
