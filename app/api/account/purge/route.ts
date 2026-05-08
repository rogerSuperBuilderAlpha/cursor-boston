/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * POST /api/account/purge
 *
 * 30-day purge job for the account-deletion lifecycle. Resumes any
 * cascade that left an `accountDeletions/{uid}` doc behind (transient
 * Firestore failures, partial completion). Idempotent — see
 * `lib/account-deletion/cascade.ts`.
 *
 * Triggered by an external scheduler (Vercel Cron, GitHub Actions
 * scheduled workflow, or a Cloud Scheduler job hitting this URL). Auth
 * is via HMAC of the request body using `ACCOUNT_PURGE_HMAC_SECRET`.
 *
 * Not used in normal account-deletion flow — `app/api/account/route.ts`
 * runs the cascade synchronously. This route exists to clean up state
 * if that synchronous run fails partway through.
 */

// @contracts: accountContract.purge (lib/api-schemas/account.ts)

import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { getAdminDb } from "@/lib/firebase-admin";
import { logger } from "@/lib/logger";
import { resumeStaleDeletions } from "@/lib/account-deletion/cascade";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Resume cascades for any accountDeletions doc older than 30 days.
const PURGE_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function hmacIsValid(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.ACCOUNT_PURGE_HMAC_SECRET;
  if (!secret || !signatureHeader) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected, "utf-8");
  const actualBuf = Buffer.from(signatureHeader, "utf-8");
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signatureHeader = request.headers.get("x-purge-signature");
    if (!hmacIsValid(rawBody, signatureHeader)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const completed = await resumeStaleDeletions(db, PURGE_AGE_MS);
    return NextResponse.json({
      success: true,
      completedCount: completed.length,
      completedUids: completed,
    });
  } catch (err) {
    logger.logError(err, { endpoint: "/api/account/purge", area: "account-deletion" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
