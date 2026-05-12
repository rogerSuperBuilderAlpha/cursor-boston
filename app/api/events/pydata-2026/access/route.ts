/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import { withMiddleware, rateLimitConfigs } from "@/lib/middleware";
import {
  PYDATA_2026_ACCESS_LIST_COLLECTION,
  normalizePydataEmail,
} from "@/lib/pydata-2026-access";
import { PYDATA_2026_REGISTRATIONS_COLLECTION } from "@/lib/pydata-2026";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Gate the May 13 PyData event page to the 150-person door list we handed
 * Moderna. A user is allowed if any of these emails matches an entry in the
 * private `pydataHack2026AccessList` collection:
 *
 *   1. Their Firebase auth email (decoded from the ID token).
 *   2. The email on their saved pydata registration form (may differ from
 *      the auth email — the form is editable; e.g. someone signs in with a
 *      .edu address but registered with their personal Gmail).
 *   3. Any verified entry in their `users/{uid}.additionalEmails`.
 *
 * The endpoint always returns 200 with `{ allowed }` so the gate UI can
 * branch without distinguishing transport errors from negative answers.
 */
async function handleGet(request: NextRequest) {
  const user = await getVerifiedUser(request);
  if (!user) {
    return NextResponse.json({ allowed: false, reason: "unauthenticated" });
  }
  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const candidates = new Set<string>();
  const authEmail = normalizePydataEmail(user.email);
  if (authEmail) candidates.add(authEmail);

  const [regSnap, userSnap] = await Promise.all([
    db.collection(PYDATA_2026_REGISTRATIONS_COLLECTION).doc(user.uid).get(),
    db.collection("users").doc(user.uid).get(),
  ]);

  if (regSnap.exists) {
    const data = regSnap.data() as { email?: unknown } | undefined;
    if (typeof data?.email === "string") {
      const normalized = normalizePydataEmail(data.email);
      if (normalized) candidates.add(normalized);
    }
  }

  if (userSnap.exists) {
    const data = userSnap.data() as
      | { additionalEmails?: Array<{ email?: unknown; verified?: unknown }> }
      | undefined;
    for (const entry of data?.additionalEmails ?? []) {
      if (entry?.verified === true && typeof entry.email === "string") {
        const normalized = normalizePydataEmail(entry.email);
        if (normalized) candidates.add(normalized);
      }
    }
  }

  if (candidates.size === 0) {
    return NextResponse.json({ allowed: false });
  }

  const lookups = await Promise.all(
    Array.from(candidates).map((email) =>
      db.collection(PYDATA_2026_ACCESS_LIST_COLLECTION).doc(email).get()
    )
  );
  const allowed = lookups.some((snap) => snap.exists);
  return NextResponse.json({ allowed });
}

export const GET = withMiddleware(rateLimitConfigs.standard, handleGet);
