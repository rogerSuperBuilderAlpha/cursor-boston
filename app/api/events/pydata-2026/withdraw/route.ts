/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { getAdminDb } from "@/lib/firebase-admin";
import {
  PYDATA_2026_REGISTRATIONS_COLLECTION,
  type PydataRegistrationStatus,
} from "@/lib/pydata-2026";
import { verifyPydataWithdrawToken } from "@/lib/unsubscribe-token";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE = { windowMs: 15 * 60 * 1000, maxRequests: 20 };

/**
 * POST /api/events/pydata-2026/withdraw
 *
 * Form-encoded body: { email, token }
 *
 * Confirmation page at /pydata-withdraw posts here after the user clicks
 * "Yes, withdraw me". Validates the HMAC token (namespaced "withdraw-pydata-2026"),
 * marks the PyData registration as cancelled, then 303-redirects back to the
 * confirmation page with a status query param.
 *
 * Two-step (page → POST) by design — the email link lands on a confirmation
 * UI rather than auto-withdrawing on first click. This avoids accidental
 * withdrawals from email-client link-previews.
 */
export async function POST(request: NextRequest) {
  const clientId = getClientIdentifier(request as unknown as Request);
  const rateResult = checkRateLimit(`pydata-withdraw:${clientId}`, RATE);
  if (!rateResult.success) {
    return NextResponse.redirect(
      new URL("/pydata-withdraw?status=rate-limited", request.url),
      303
    );
  }

  let email: string | undefined;
  let token: string | undefined;
  try {
    const form = await request.formData();
    const rawEmail = form.get("email");
    const rawToken = form.get("token");
    email = typeof rawEmail === "string" ? rawEmail.toLowerCase().trim() : undefined;
    token = typeof rawToken === "string" ? rawToken.trim() : undefined;
  } catch {
    return NextResponse.redirect(
      new URL("/pydata-withdraw?status=invalid", request.url),
      303
    );
  }

  if (!email || !token) {
    return NextResponse.redirect(
      new URL("/pydata-withdraw?status=invalid", request.url),
      303
    );
  }

  if (!/^[a-f0-9]{64}$/i.test(token)) {
    return NextResponse.redirect(
      new URL("/pydata-withdraw?status=invalid", request.url),
      303
    );
  }

  if (!verifyPydataWithdrawToken(email, token)) {
    return NextResponse.redirect(
      new URL("/pydata-withdraw?status=invalid", request.url),
      303
    );
  }

  try {
    const db = getAdminDb();
    if (!db) {
      return NextResponse.redirect(
        new URL("/pydata-withdraw?status=error", request.url),
        303
      );
    }

    const snap = await db
      .collection(PYDATA_2026_REGISTRATIONS_COLLECTION)
      .where("email", "==", email)
      .limit(1)
      .get();

    if (snap.empty) {
      // Don't leak existence — same success page either way.
      return NextResponse.redirect(
        new URL("/pydata-withdraw?status=success", request.url),
        303
      );
    }

    const cancelled: PydataRegistrationStatus = "cancelled";
    await snap.docs[0]!.ref.update({
      status: cancelled,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.redirect(
      new URL("/pydata-withdraw?status=success", request.url),
      303
    );
  } catch {
    return NextResponse.redirect(
      new URL("/pydata-withdraw?status=error", request.url),
      303
    );
  }
}
