/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { getAdminDb } from "@/lib/firebase-admin";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe-token";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { FieldValue } from "firebase-admin/firestore";
import { notificationsContract } from "@/lib/api-schemas/notifications";

// Short, non-reversible fingerprint of the runtime's UNSUBSCRIBE_SECRET so
// failed token verifies can be audited against the env-pulled value
// without exposing the secret itself. Computed once at module load. Added
// 2026-05-25 during a debugging session where prod runtime appeared to
// reject tokens signed with the value `vercel env pull --environment=
// production` returned — this log lets us confirm which secret the
// runtime is actually holding.
const SECRET_FINGERPRINT = (() => {
  const s = process.env.UNSUBSCRIBE_SECRET ?? "";
  if (!s) return "<unset>";
  return createHash("sha256").update(s).digest("hex").slice(0, 12);
})();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE = { windowMs: 15 * 60 * 1000, maxRequests: 20 };

/**
 * GET /api/notifications/unsubscribe?email=...&token=...
 *
 * Validates the HMAC token and marks the contact as unsubscribed in Firestore,
 * then redirects to a confirmation page.
 */
export async function GET(request: NextRequest) {
  const clientId = getClientIdentifier(request as unknown as Request);
  const rateResult = checkRateLimit(`unsub:${clientId}`, RATE);
  if (!rateResult.success) {
    return NextResponse.redirect(
      new URL("/unsubscribe?status=rate-limited", request.url)
    );
  }

  // Some mail clients / link scanners deliver the href with the literal HTML
  // entity `&amp;` undecoded, so the second query param arrives named
  // `amp;token` (and a forwarded/encoded link can yield `amp;email`). Fall
  // back to those variants so a mangled separator doesn't break unsubscribe.
  const sp = request.nextUrl.searchParams;
  const param = (name: string) => sp.get(name) ?? sp.get(`amp;${name}`) ?? undefined;
  const parsedQuery = notificationsContract.unsubscribe.query.safeParse({
    email: param("email"),
    token: param("token"),
  });
  const email = parsedQuery.success
    ? parsedQuery.data.email?.toLowerCase().trim()
    : undefined;
  const token = parsedQuery.success ? parsedQuery.data.token : undefined;

  if (!email || !token) {
    return NextResponse.redirect(
      new URL("/unsubscribe?status=invalid", request.url)
    );
  }

  if (!/^[a-f0-9]{64}$/i.test(token)) {
    return NextResponse.redirect(
      new URL("/unsubscribe?status=invalid", request.url)
    );
  }

  if (!verifyUnsubscribeToken(email, token)) {
    // Audit log — captures who tried + which runtime secret is in play.
    // The email is already in the URL; pairing it with the secret
    // fingerprint lets us tell "user clicked a stale-secret link" from
    // "the runtime is on the wrong secret entirely". Both are silent
    // before this log line landed.
    console.warn(
      JSON.stringify({
        level: "warn",
        event: "unsubscribe_invalid",
        email,
        token_prefix: token.slice(0, 8),
        secret_fp: SECRET_FINGERPRINT,
      }),
    );
    return NextResponse.redirect(
      new URL("/unsubscribe?status=invalid", request.url)
    );
  }

  try {
    const db = getAdminDb();
    if (!db) {
      return NextResponse.redirect(
        new URL("/unsubscribe?status=error", request.url)
      );
    }

    const docRef = db.collection("eventContacts").doc(email);
    const doc = await docRef.get();

    if (!doc.exists) {
      // Contact not found — still show success (don't leak membership info)
      return NextResponse.redirect(
        new URL("/unsubscribe?status=success", request.url)
      );
    }

    await docRef.update({
      unsubscribed: true,
      unsubscribedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.redirect(
      new URL("/unsubscribe?status=success", request.url)
    );
  } catch {
    return NextResponse.redirect(
      new URL("/unsubscribe?status=error", request.url)
    );
  }
}
