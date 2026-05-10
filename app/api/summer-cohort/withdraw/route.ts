/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { verifyWithdrawToken } from "@/lib/unsubscribe-token";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { isValidCohortId, SUMMER_COHORT_COLLECTION } from "@/lib/summer-cohort";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE = { windowMs: 15 * 60 * 1000, maxRequests: 20 };

/**
 * GET /api/summer-cohort/withdraw?email=...&cohortId=...&token=...
 *
 * Validates the HMAC token and marks the application as withdrawn in Firestore,
 * then redirects to a confirmation page. Mirrors the unsubscribe route shape
 * but writes to summerCohortApplications instead of eventContacts.
 */
export async function GET(request: NextRequest) {
  const clientId = getClientIdentifier(request as unknown as Request);
  const rateResult = checkRateLimit(`cohort-withdraw:${clientId}`, RATE);
  if (!rateResult.success) {
    return NextResponse.redirect(
      new URL("/cohort-withdraw?status=rate-limited", request.url)
    );
  }

  const email = request.nextUrl.searchParams.get("email")?.toLowerCase().trim();
  const cohortId = request.nextUrl.searchParams.get("cohortId")?.trim();
  const token = request.nextUrl.searchParams.get("token")?.trim();

  if (!email || !cohortId || !token) {
    return NextResponse.redirect(
      new URL("/cohort-withdraw?status=invalid", request.url)
    );
  }

  if (!isValidCohortId(cohortId)) {
    return NextResponse.redirect(
      new URL("/cohort-withdraw?status=invalid", request.url)
    );
  }

  if (!/^[a-f0-9]{64}$/i.test(token)) {
    return NextResponse.redirect(
      new URL("/cohort-withdraw?status=invalid", request.url)
    );
  }

  if (!verifyWithdrawToken(email, cohortId, token)) {
    return NextResponse.redirect(
      new URL("/cohort-withdraw?status=invalid", request.url)
    );
  }

  try {
    const db = getAdminDb();
    if (!db) {
      return NextResponse.redirect(
        new URL("/cohort-withdraw?status=error", request.url)
      );
    }

    const snap = await db
      .collection(SUMMER_COHORT_COLLECTION)
      .where("email", "==", email)
      .limit(1)
      .get();

    if (snap.empty) {
      // Don't leak existence — same success page either way.
      return NextResponse.redirect(
        new URL("/cohort-withdraw?status=success", request.url)
      );
    }

    await snap.docs[0].ref.update({
      status: "withdrawn",
      statusUpdatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.redirect(
      new URL("/cohort-withdraw?status=success", request.url)
    );
  } catch {
    return NextResponse.redirect(
      new URL("/cohort-withdraw?status=error", request.url)
    );
  }
}
