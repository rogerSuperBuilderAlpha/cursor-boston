/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * Retries delivery of treasure-hunt prize emails where the claim transaction
 * committed but Mailgun failed. Scans treasureHuntProgress docs with a prize
 * assigned but no emailSentAt, re-sends, and marks them delivered.
 *
 * Invoke via Vercel cron (schedule in vercel.json) with CRON_SECRET header.
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { sendEmail } from "@/lib/mailgun";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET;

function getCronSecret(request: NextRequest): string | null {
  return (
    request.headers.get("x-cron-secret") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    null
  );
}

async function handle(request: NextRequest) {
  if (!CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET missing" }, { status: 500 });
  }
  const provided = getCronSecret(request);
  if (provided !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = getAdminDb();
  if (!db) return NextResponse.json({ error: "No DB" }, { status: 500 });

  const stuckSnap = await db
    .collection("treasureHuntProgress")
    .where("prizeEmailSentAt", "==", null)
    .limit(25)
    .get();

  let sent = 0;
  let failed = 0;
  for (const doc of stuckSnap.docs) {
    const d = doc.data();
    const to = typeof d.winnerEmail === "string" ? d.winnerEmail : "";
    const url = typeof d.prizeCreditUrl === "string" ? d.prizeCreditUrl : "";
    if (!to || !url) continue;
    try {
      await sendEmail({
        to,
        subject: "🗺️ Your Cursor credit (retry)",
        text: `Here is your Cursor credit link:\n\n${url}\n\n— Cursor Boston`,
        html: `<p>Here is your Cursor credit link:</p><p><a href="${url}">${url}</a></p><p>— Cursor Boston</p>`,
      });
      await doc.ref.set(
        { prizeEmailSentAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
      sent += 1;
    } catch (e) {
      logger.warn("[hunt/email-retry] send failed", { uid: doc.id, error: String(e) });
      failed += 1;
    }
  }

  return NextResponse.json({ scanned: stuckSnap.size, sent, failed });
}

export const GET = handle;
export const POST = handle;
