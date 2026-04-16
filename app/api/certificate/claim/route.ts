/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import { getClientIdentifier } from "@/lib/rate-limit";
import { buildRateLimitHeaders, checkServerRateLimit } from "@/lib/rate-limit-server";
import { reconcileMergedPrCreditForUser } from "@/lib/github-merged-pr-reconcile";
import {
  CERTIFICATES_COLLECTION,
  CERTIFICATE_PR_THRESHOLD,
  CERTIFICATE_NAME,
  getCertificateDocId,
  getCertVerifyUrl,
  parseCertificateFromFirestore,
  buildLinkedInAddToProfileUrl,
} from "@/lib/certificate";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_LIMIT = { windowMs: 60 * 1000, maxRequests: 10 };

export async function POST(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateResult = await checkServerRateLimit(request as unknown as Request, {
      scope: "certificate-claim",
      windowMs: RATE_LIMIT.windowMs,
      maxRequests: RATE_LIMIT.maxRequests,
      identifier: `uid:${user.uid}|ip:${getClientIdentifier(request as unknown as Request)}`,
      fallbackMode: "strict-memory",
      fallbackMaxRequests: 5,
    });
    if (!rateResult.success) {
      return NextResponse.json(
        { error: "Too many requests", retryAfterSeconds: rateResult.retryAfter },
        {
          status: rateResult.statusCode ?? 429,
          headers: buildRateLimitHeaders(rateResult, RATE_LIMIT.maxRequests),
        }
      );
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    // Fetch user profile to get GitHub login
    const userDoc = await db.collection("users").doc(user.uid).get();
    const userData = userDoc.data();
    const githubLogin =
      userData?.github &&
      typeof userData.github === "object" &&
      typeof (userData.github as { login?: string }).login === "string"
        ? (userData.github as { login: string }).login.trim()
        : "";

    if (!githubLogin) {
      return NextResponse.json(
        { error: "GitHub account must be connected to claim a certificate" },
        { status: 400 }
      );
    }

    // Check if certificate already exists (idempotent)
    const certDocId = getCertificateDocId(user.uid);
    const existingDoc = await db.collection(CERTIFICATES_COLLECTION).doc(certDocId).get();
    if (existingDoc.exists) {
      const existing = parseCertificateFromFirestore(
        certDocId,
        existingDoc.data() as Record<string, unknown>
      );
      if (existing) {
        return NextResponse.json({
          certificate: existing,
          linkedInAddToProfileUrl: buildLinkedInAddToProfileUrl(existing),
        });
      }
    }

    // Verify merged PR count via real-time GitHub reconciliation
    const { mergedPrCount } = await reconcileMergedPrCreditForUser(user.uid, githubLogin);

    if (mergedPrCount < CERTIFICATE_PR_THRESHOLD) {
      return NextResponse.json(
        {
          error: "Not enough merged pull requests",
          eligible: false,
          pullRequestsCount: mergedPrCount,
          required: CERTIFICATE_PR_THRESHOLD,
        },
        { status: 403 }
      );
    }

    // Create certificate
    const displayName = userData?.displayName || user.name || githubLogin;
    const certUrl = getCertVerifyUrl(certDocId);

    await db.collection(CERTIFICATES_COLLECTION).doc(certDocId).set({
      id: certDocId,
      userId: user.uid,
      displayName,
      githubLogin,
      pullRequestsCount: mergedPrCount,
      issuedAt: FieldValue.serverTimestamp(),
      certName: CERTIFICATE_NAME,
      certUrl,
    });

    // Read back to get the server timestamp resolved
    const createdDoc = await db.collection(CERTIFICATES_COLLECTION).doc(certDocId).get();
    const certificate = parseCertificateFromFirestore(
      certDocId,
      createdDoc.data() as Record<string, unknown>
    );

    if (!certificate) {
      return NextResponse.json({ error: "Failed to create certificate" }, { status: 500 });
    }

    logger.info("Certificate claimed", {
      userId: user.uid,
      githubLogin,
      mergedPrCount,
      certDocId,
    });

    return NextResponse.json({
      certificate,
      linkedInAddToProfileUrl: buildLinkedInAddToProfileUrl(certificate),
    });
  } catch (error) {
    logger.logError(error, {
      endpoint: "/api/certificate/claim",
      method: "POST",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
