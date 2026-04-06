import { NextRequest, NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/server-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_LIMIT = { windowMs: 60 * 1000, maxRequests: 20 };

/**
 * Find the eventContacts doc for a user by checking their primary email
 * and any additional verified emails.
 */
async function findContactDoc(
  db: FirebaseFirestore.Firestore,
  uid: string,
  primaryEmail: string | null
) {
  // Try primary email first
  if (primaryEmail) {
    const ref = db.collection("eventContacts").doc(primaryEmail.toLowerCase());
    const snap = await ref.get();
    if (snap.exists) return { ref, data: snap.data()! };
  }

  // Try additional emails from the user doc
  const userDoc = await db.collection("users").doc(uid).get();
  const userData = userDoc.data();
  const additionalEmails: { email: string; verified: boolean }[] =
    userData?.additionalEmails || [];

  for (const entry of additionalEmails) {
    if (!entry.verified || !entry.email) continue;
    const ref = db
      .collection("eventContacts")
      .doc(entry.email.toLowerCase());
    const snap = await ref.get();
    if (snap.exists) return { ref, data: snap.data()! };
  }

  return null;
}

/**
 * GET /api/profile/subscription
 * Returns the user's email subscription status.
 */
export async function GET(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request as unknown as Request);
    const rateResult = checkRateLimit(`profile-sub:${clientId}`, RATE_LIMIT);
    if (!rateResult.success) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429 }
      );
    }

    const user = await getVerifiedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const result = await findContactDoc(db, user.uid, user.email ?? null);

    if (!result) {
      // User has no eventContacts record — they're not on the list
      return NextResponse.json({ onList: false, subscribed: false });
    }

    return NextResponse.json({
      onList: true,
      subscribed: result.data.unsubscribed !== true,
    });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * PATCH /api/profile/subscription
 * Body: { subscribed: boolean }
 * Updates the user's subscription preference in eventContacts.
 */
export async function PATCH(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request as unknown as Request);
    const rateResult = checkRateLimit(`profile-sub:${clientId}`, RATE_LIMIT);
    if (!rateResult.success) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429 }
      );
    }

    const user = await getVerifiedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    let body: { subscribed?: boolean };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (typeof body.subscribed !== "boolean") {
      return NextResponse.json(
        { error: "subscribed must be a boolean" },
        { status: 400 }
      );
    }

    const result = await findContactDoc(db, user.uid, user.email ?? null);

    if (!result) {
      return NextResponse.json(
        { error: "No event contact record found for your email" },
        { status: 404 }
      );
    }

    if (body.subscribed) {
      await result.ref.update({
        unsubscribed: false,
        unsubscribedAt: FieldValue.delete(),
        resubscribedAt: FieldValue.serverTimestamp(),
      });
    } else {
      await result.ref.update({
        unsubscribed: true,
        unsubscribedAt: FieldValue.serverTimestamp(),
      });
    }

    return NextResponse.json({ subscribed: body.subscribed });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
