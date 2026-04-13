/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import { resolveHackASprint2026CreditForUser } from "@/lib/hackathon-asprint-2026-credit-eligibility";
import { sendEmail } from "@/lib/mailgun";
import { checkRateLimit, getClientIdentifier, rateLimitConfigs } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE = rateLimitConfigs.hackathonShowcaseCreditEmail;

export async function POST(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request as unknown as Request);
    const rate = checkRateLimit(`hack-asprint-credit-email:${clientId}`, RATE);
    if (!rate.success) {
      return NextResponse.json(
        { error: "Too many requests", retryAfterSeconds: rate.retryAfter },
        { status: 429 }
      );
    }

    const user = await getVerifiedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getAdminDb();
    const auth = getAdminAuth();
    if (!db || !auth) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const uidRate = checkRateLimit(`hack-asprint-credit-email-uid:${user.uid}`, RATE);
    if (!uidRate.success) {
      return NextResponse.json(
        { error: "Too many requests", retryAfterSeconds: uidRate.retryAfter },
        { status: 429 }
      );
    }

    const resolved = await resolveHackASprint2026CreditForUser(
      db,
      user.uid,
      user.email
    );
    if (!resolved.ok) {
      return NextResponse.json(
        { ok: false, reason: resolved.reason },
        { status: 400 }
      );
    }

    const userRef = db.collection("users").doc(user.uid);
    const existing = (await userRef.get()).data();
    if (existing?.hackASprint2026CreditEmailSentAt) {
      return NextResponse.json({
        ok: true,
        alreadySent: true,
        message: "Credit link was already emailed to you.",
      });
    }

    const record = await auth.getUser(user.uid);
    const to = record.email?.trim();
    if (!to) {
      return NextResponse.json(
        { error: "No email on your account." },
        { status: 400 }
      );
    }

    const display =
      typeof existing?.displayName === "string" && existing.displayName.trim()
        ? existing.displayName.trim()
        : "there";

    await sendEmail({
      to,
      subject: "Your Hack-a-Sprint Cursor credit link",
      text: `Hi ${display},\n\nHere is your personal Cursor credit link (do not share):\n${resolved.creditUrl}\n\n— Cursor Boston`,
      html: `<p>Hi ${display},</p><p>Here is your personal Cursor credit link — <strong>do not share it</strong>:</p><p><a href="${resolved.creditUrl}">${resolved.creditUrl}</a></p><p>— Cursor Boston</p>`,
    });

    await userRef.set(
      {
        hackASprint2026CreditEmailSentAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true, emailedTo: to });
  } catch (e) {
    console.error("[credit-email POST]", e);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
