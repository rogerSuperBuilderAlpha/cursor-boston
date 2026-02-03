import { NextRequest } from "next/server";
import { getAdminAuth } from "./firebase-admin";

export interface VerifiedUser {
  uid: string;
  name?: string;
  email?: string;
  picture?: string;
}

export async function getVerifiedUser(request: NextRequest): Promise<VerifiedUser | null> {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return null;
  }

  const adminAuth = getAdminAuth();
  if (!adminAuth) {
    throw new Error("Firebase Admin Auth is not configured");
  }

  // SECURITY: checkRevoked=true ensures revoked tokens are rejected
  // This catches scenarios where users have been disabled or signed out
  const decoded = await adminAuth.verifyIdToken(token, true);
  return {
    uid: decoded.uid,
    name: decoded.name,
    email: decoded.email,
    picture: decoded.picture,
  };
}
