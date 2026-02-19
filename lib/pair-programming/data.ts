import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp,
  addDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type {
  PairProfile,
  PairRequest,
  PairSession,
  RequestStatus,
} from "./types";
import { getAdminDb } from "@/lib/firebase-admin";

// Collection names
const COLLECTIONS = {
  PROFILES: "pair_profiles",
  REQUESTS: "pair_requests",
  SESSIONS: "pair_sessions",
} as const;

// Client-side Firestore operations
export async function getPairProfile(userId: string): Promise<PairProfile | null> {
  if (!db) return null;
  const docRef = doc(db, COLLECTIONS.PROFILES, userId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  return { ...docSnap.data(), userId: docSnap.id } as PairProfile;
}

export async function createOrUpdatePairProfile(
  userId: string,
  profile: Omit<PairProfile, "userId" | "createdAt" | "updatedAt">
): Promise<void> {
  if (!db) throw new Error("Firestore not initialized");
  const docRef = doc(db, COLLECTIONS.PROFILES, userId);
  const existing = await getDoc(docRef);
  
  if (existing.exists()) {
    await updateDoc(docRef, {
      ...profile,
      updatedAt: serverTimestamp(),
    });
  } else {
    await setDoc(docRef, {
      ...profile,
      userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
}

export async function getAllActiveProfiles(): Promise<PairProfile[]> {
  if (!db) return [];
  const q = query(
    collection(db, COLLECTIONS.PROFILES),
    where("isActive", "==", true),
    orderBy("updatedAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    ...doc.data(),
    userId: doc.id,
  })) as PairProfile[];
}

export async function createPairRequest(
  request: Omit<PairRequest, "id" | "createdAt" | "updatedAt" | "status">
): Promise<string> {
  if (!db) throw new Error("Firestore not initialized");
  const docRef = await addDoc(collection(db, COLLECTIONS.REQUESTS), {
    ...request,
    status: "pending" as RequestStatus,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function getPairRequestsForUser(
  userId: string,
  type: "sent" | "received"
): Promise<PairRequest[]> {
  if (!db) return [];
  const field = type === "sent" ? "fromUserId" : "toUserId";
  const q = query(
    collection(db, COLLECTIONS.REQUESTS),
    where(field, "==", userId),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as PairRequest[];
}

export async function updatePairRequestStatus(
  requestId: string,
  status: RequestStatus
): Promise<void> {
  if (!db) throw new Error("Firestore not initialized");
  const docRef = doc(db, COLLECTIONS.REQUESTS, requestId);
  await updateDoc(docRef, {
    status,
    updatedAt: serverTimestamp(),
  });
}

export async function createPairSession(
  session: Omit<PairSession, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  if (!db) throw new Error("Firestore not initialized");
  const docRef = await addDoc(collection(db, COLLECTIONS.SESSIONS), {
    ...session,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function getPairSessionsForUser(userId: string): Promise<PairSession[]> {
  if (!db) return [];
  const q = query(
    collection(db, COLLECTIONS.SESSIONS),
    where("participantIds", "array-contains", userId),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as PairSession[];
}

export async function updatePairSession(
  sessionId: string,
  updates: Partial<PairSession>
): Promise<void> {
  if (!db) throw new Error("Firestore not initialized");
  const docRef = doc(db, COLLECTIONS.SESSIONS, sessionId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

// Server-side operations (for API routes)
export async function getPairProfileServer(userId: string): Promise<PairProfile | null> {
  const adminDb = getAdminDb();
  if (!adminDb) return null;
  const docRef = adminDb.collection(COLLECTIONS.PROFILES).doc(userId);
  const docSnap = await docRef.get();
  if (!docSnap.exists) return null;
  return { ...docSnap.data(), userId: docSnap.id } as PairProfile;
}

export async function getAllActiveProfilesServer(): Promise<PairProfile[]> {
  const adminDb = getAdminDb();
  if (!adminDb) return [];
  const snapshot = await adminDb
    .collection(COLLECTIONS.PROFILES)
    .where("isActive", "==", true)
    .orderBy("updatedAt", "desc")
    .get();
  return snapshot.docs.map((doc) => ({
    ...doc.data(),
    userId: doc.id,
  })) as PairProfile[];
}

export async function createOrUpdatePairProfileServer(
  userId: string,
  profile: Omit<PairProfile, "userId" | "createdAt" | "updatedAt">
): Promise<void> {
  const adminDb = getAdminDb();
  if (!adminDb) throw new Error("Firebase Admin not initialized");
  
  const docRef = adminDb.collection(COLLECTIONS.PROFILES).doc(userId);
  const existing = await docRef.get();
  
  if (existing.exists) {
    await docRef.update({
      ...profile,
      updatedAt: new Date(),
    });
  } else {
    await docRef.set({
      ...profile,
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}
