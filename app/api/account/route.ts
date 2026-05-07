/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * DELETE /api/account
 *
 * Implements the GDPR Article 17 right-to-erasure promise made in
 * `app/privacy/page.tsx`. Cascades user-keyed data via the registry in
 * `lib/account-deletion/registry.ts`, then revokes Firebase Auth.
 *
 * Safety controls:
 *   1. Token must be authenticated (`getVerifiedUser`).
 *   2. Token must be FRESH — `auth_time` within the last 5 minutes. The
 *      client should re-prompt for sign-in immediately before submitting
 *      the deletion request. Mirrors the standard `requires-recent-login`
 *      pattern used by Firebase Admin's `deleteUser` itself.
 *   3. Body must include `confirmText: "DELETE"` (matches the literal
 *      string the user typed in the confirmation modal).
 *   4. One deletion attempt per UID per 24h via Upstash rate limit.
 *
 * The cascade is idempotent (see `lib/account-deletion/cascade.ts`) so a
 * partial failure is safe to retry. The 30-day purge job in
 * `app/api/account/purge/route.ts` resumes any incomplete cascades and
 * drops the progress doc once everything is clean.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import { logger } from "@/lib/logger";
import { parseRequestBody } from "@/lib/api-response";
import { checkUpstashRateLimit } from "@/lib/upstash-rate-limit";
import { deleteUserData } from "@/lib/account-deletion/cascade";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DELETE_RATE_LIMIT = { windowMs: 24 * 60 * 60 * 1000, maxRequests: 1 };
const FRESH_AUTH_WINDOW_S = 5 * 60; // 5 minutes
const REQUIRED_CONFIRMATION = "DELETE";

export async function DELETE(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Re-fetch the decoded token to inspect `auth_time`. The wrapper
    // doesn't expose it. Fresh auth means the user proved possession of
    // credentials within the last 5 minutes — protects against an
    // attacker with a long-lived stolen ID token from torching an account.
    const adminAuth = getAdminAuth();
    if (!adminAuth) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }
    const auth = request.headers.get("authorization") || "";
    const tokenFromAuth = auth.match(/^Bearer\s+(.+)$/)?.[1] ?? "";
    const tokenFromHeader = request.headers.get("x-firebase-id-token") ?? "";
    const token = tokenFromAuth || tokenFromHeader;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const decoded = await adminAuth.verifyIdToken(token, false);
    const ageS = Math.floor(Date.now() / 1000) - Number(decoded.auth_time ?? 0);
    if (!Number.isFinite(ageS) || ageS > FRESH_AUTH_WINDOW_S) {
      return NextResponse.json(
        {
          error: "Recent re-authentication required",
          retryAfter: "Please sign in again, then retry.",
        },
        { status: 403 }
      );
    }

    const rl = await checkUpstashRateLimit(`account-delete:${user.uid}`, DELETE_RATE_LIMIT);
    if (!rl.success) {
      return NextResponse.json(
        { error: "An account deletion is already in progress for this account." },
        { status: 429 }
      );
    }

    const bodyOrError = await parseRequestBody(request);
    if (bodyOrError instanceof NextResponse) return bodyOrError;
    const { confirmText } = bodyOrError;
    if (confirmText !== REQUIRED_CONFIRMATION) {
      return NextResponse.json(
        { error: `Type ${REQUIRED_CONFIRMATION} to confirm.` },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const report = await deleteUserData(user.uid, db);

    // Revoke refresh tokens BEFORE deleting the auth record so any active
    // session is invalidated even if the auth-delete step fails.
    try {
      await adminAuth.revokeRefreshTokens(user.uid);
    } catch (err) {
      logger.logError(err, {
        endpoint: "/api/account",
        area: "account-deletion",
        step: "revokeRefreshTokens",
        uid: user.uid,
      });
    }

    try {
      await adminAuth.deleteUser(user.uid);
    } catch (err) {
      // Non-fatal: the cascade already ran and the progress doc retains
      // the state. The 30-day purge will retry.
      logger.logError(err, {
        endpoint: "/api/account",
        area: "account-deletion",
        step: "deleteAuthUser",
        uid: user.uid,
      });
    }

    return NextResponse.json({
      success: true,
      uid: user.uid,
      stepsCompleted: report.steps.length,
      errors: report.errors.length,
      message:
        "Your account has been deleted. Some content (community messages, cookbook entries) is retained but anonymized so other users' threads aren't broken.",
    });
  } catch (err) {
    logger.logError(err, { endpoint: "/api/account", area: "account-deletion" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
