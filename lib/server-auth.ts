/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest } from "next/server";
import { getAdminAuth } from "./firebase-admin";

export interface VerifiedUser {
  uid: string;
  name?: string;
  email?: string;
  picture?: string;
  isAdmin?: boolean;
  role?: string;
  roles?: string[];
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function hasAdminClaim(decoded: Record<string, unknown>): boolean {
  if (decoded.admin === true || decoded.isAdmin === true) {
    return true;
  }

  const role = typeof decoded.role === "string" ? decoded.role : undefined;
  if (role === "admin") {
    return true;
  }

  const roles = toStringArray(decoded.roles);
  return roles.includes("admin");
}

function hasExplicitAdminClaimFields(decoded: Record<string, unknown>): boolean {
  return (
    Object.prototype.hasOwnProperty.call(decoded, "admin") ||
    Object.prototype.hasOwnProperty.call(decoded, "isAdmin") ||
    Object.prototype.hasOwnProperty.call(decoded, "role") ||
    Object.prototype.hasOwnProperty.call(decoded, "roles")
  );
}

function getLegacyAdminEmailSet(): Set<string> {
  const csv = process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "";
  return new Set(
    csv
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

function isLegacyAdminEmail(email?: string): boolean {
  if (!email) return false;
  return getLegacyAdminEmailSet().has(email.trim().toLowerCase());
}

function extractFirebaseIdToken(request: NextRequest): string {
  const authHeader = request.headers.get("authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/);
  const tokenFromAuth = match ? match[1].trim() : "";
  const tokenFromHeader = request.headers.get("x-firebase-id-token")?.trim() || "";
  return tokenFromAuth || tokenFromHeader;
}

async function verifyRequestUser(
  request: NextRequest,
  checkRevoked: boolean
): Promise<VerifiedUser | null> {
  const token = extractFirebaseIdToken(request);
  if (!token) {
    return null;
  }

  const adminAuth = getAdminAuth();
  if (!adminAuth) {
    throw new Error("Firebase Admin Auth is not configured");
  }

  // checkRevoked=false: revocation check can fail (tenant/API issues).
  const decoded = await adminAuth.verifyIdToken(token, checkRevoked);
  const role = typeof decoded.role === "string" ? decoded.role : undefined;
  const roles = toStringArray(decoded.roles);
  const hasExplicitAdminClaims = hasExplicitAdminClaimFields(decoded);
  const claimAdmin = hasAdminClaim(decoded);
  // Migration bridge: claim-based admin is authoritative; legacy email fallback
  // only applies when token has no explicit admin-role claim fields.
  const isAdmin = claimAdmin || (!hasExplicitAdminClaims && isLegacyAdminEmail(decoded.email));

  return {
    uid: decoded.uid,
    name: decoded.name,
    email: decoded.email,
    picture: decoded.picture,
    isAdmin,
    role,
    roles,
  };
}

/**
 * Verify the Firebase ID token from the request and return the authenticated user.
 * Checks both Authorization Bearer header and x-firebase-id-token header.
 * @param request - The incoming Next.js request
 * @returns The verified user object, or null if no token is provided
 * @throws Error if Firebase Admin Auth is not configured
 */
export async function getVerifiedUser(request: NextRequest): Promise<VerifiedUser | null> {
  // Keep the default path non-revocation checked for ordinary user reads.
  return verifyRequestUser(request, false);
}

/**
 * Verify the Firebase ID token with revocation checks for sensitive non-admin
 * flows such as financial benefit delivery.
 */
export async function getVerifiedUserWithRevocation(
  request: NextRequest
): Promise<VerifiedUser | null> {
  return verifyRequestUser(request, true);
}

export async function isCurrentIdTokenRevoked(request: NextRequest): Promise<boolean> {
  const token = extractFirebaseIdToken(request);
  if (!token) {
    return false;
  }

  const adminAuth = getAdminAuth();
  if (!adminAuth) {
    return false;
  }

  try {
    await adminAuth.verifyIdToken(token, true);
    return false;
  } catch (error) {
    return isRevokedIdTokenError(error);
  }
}

/**
 * Verify the Firebase ID token AND require admin status. Combines the auth
 * + role gate that admin routes used to spell out in two steps.
 *
 * Returns null when the request has no token, the token is missing the admin
 * claim, OR the resolved user is not in the admin role set. Callers should
 * treat null as 401/403 (route returns 401 to avoid leaking admin status).
 *
 * Throws when Firebase Admin Auth is not configured.
 */
export async function getVerifiedAdminUser(
  request: NextRequest
): Promise<VerifiedUser | null> {
  const user = await verifyRequestUser(request, false);
  if (!user || !user.isAdmin) {
    return null;
  }
  return user;
}

export function isRevokedIdTokenError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const err = error as {
    code?: unknown;
    message?: unknown;
    errorInfo?: { code?: unknown };
  };
  const code =
    typeof err.code === "string"
      ? err.code
      : typeof err.errorInfo?.code === "string"
      ? err.errorInfo.code
      : "";
  if (code === "auth/id-token-revoked") {
    return true;
  }

  const message = typeof err.message === "string" ? err.message : "";
  return message.toLowerCase().includes("id token has been revoked");
}

/**
 * Like getVerifiedUser, but returns null if the token is missing or invalid.
 * For public API handlers that optionally personalize the response.
 * @param request - The incoming Next.js request
 * @returns The verified user object, or null if the token is missing, invalid, or Auth is not configured
 */
export async function getOptionalVerifiedUser(
  request: NextRequest
): Promise<VerifiedUser | null> {
  try {
    return await verifyRequestUser(request, false);
  } catch {
    return null;
  }
}
