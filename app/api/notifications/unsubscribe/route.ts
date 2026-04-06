import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe-token";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { FieldValue } from "firebase-admin/firestore";

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

  const email = request.nextUrl.searchParams.get("email")?.toLowerCase().trim();
  const token = request.nextUrl.searchParams.get("token");

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
