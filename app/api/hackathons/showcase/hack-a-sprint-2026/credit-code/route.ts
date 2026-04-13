/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import { resolveHackASprint2026CreditForUser } from "@/lib/hackathon-asprint-2026-credit-eligibility";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Returns the user's Cursor credit code URL.
 *
 * Gates:
 *   1. Authenticated
 *   2. Checked in (checkedInAt on signup doc)
 *   3. Has submitted showcase project (merged labeled PR)
 *
 * If any gate fails, returns { eligible: false, reason } with 200.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const resolved = await resolveHackASprint2026CreditForUser(
      db,
      user.uid,
      user.email
    );
    if (!resolved.ok) {
      return NextResponse.json({
        eligible: false,
        reason: resolved.reason,
      });
    }

    return NextResponse.json({
      eligible: true,
      creditUrl: resolved.creditUrl,
      rank: resolved.rank,
    });
  } catch (e) {
    console.error("[credit-code GET]", e);
    return NextResponse.json(
      { error: "Failed to load credit code" },
      { status: 500 }
    );
  }
}
