import { NextRequest } from "next/server";
import { getAdminAuth } from "./firebase-admin";

export interface VerifiedUser {
  uid: string;
  name?: string;
  email?: string;
  picture?: string;
}

export async function getVerifiedUser(request: NextRequest): Promise<VerifiedUser | null> {
  const match = (request.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/);
  const tokenFromAuth = match ? match[1].trim() : "";
  const tokenFromHeader = request.headers.get("x-firebase-id-token")?.trim() || "";
  const token = tokenFromAuth || tokenFromHeader;

  if (!token) return null;

  const adminAuth = getAdminAuth();
  if (!adminAuth) {
    throw new Error("Firebase Admin Auth is not configured");
  }

  const decoded = await adminAuth.verifyIdToken(token, false);
  return {
    uid: decoded.uid,
    name: decoded.name,
    email: decoded.email,
    picture: decoded.picture,
  };
}
