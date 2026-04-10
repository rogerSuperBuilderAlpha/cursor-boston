/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import { HACK_A_SPRINT_2026_EVENT_ID } from "@/lib/hackathon-showcase";
import { getHackASprint2026Phase } from "@/lib/hackathon-asprint-2026-schedule";
import { hackathonEventSignupDocId } from "@/lib/hackathon-event-signup";
import { checkRateLimit, getClientIdentifier, rateLimitConfigs } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE = rateLimitConfigs.hackathonShowcaseUnlock;

function passcodesMatch(expected: string, provided: string): boolean {
  if (expected.length !== provided.length) return false;
  let ok = 0;
  for (let i = 0; i < expected.length; i++) {
    ok |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  return ok === 0;
}

export async function POST(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request as unknown as Request);
    const rate = checkRateLimit(`hack-asprint-unlock:${clientId}`, RATE);
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

    const phase = getHackASprint2026Phase();
    if (phase === "preUnlock") {
      return NextResponse.json(
        { error: "Event passcode is not available yet." },
        { status: 403 }
      );
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const signupId = hackathonEventSignupDocId(HACK_A_SPRINT_2026_EVENT_ID, user.uid);
    const signupSnap = await db.collection("hackathonEventSignups").doc(signupId).get();
    if (!signupSnap.exists) {
      return NextResponse.json(
        { error: "You must complete website signup for this event first." },
        { status: 403 }
      );
    }

    const expected = (process.env.HACK_A_SPRINT_2026_EVENT_PASSCODE || "").trim();
    if (!expected) {
      return NextResponse.json(
        { error: "Passcode is not configured on the server." },
        { status: 503 }
      );
    }

    let body: { passcode?: string };
    try {
      body = (await request.json()) as { passcode?: string };
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }
    const provided = String(body.passcode ?? "").trim();

    const uidRate = checkRateLimit(
      `hack-asprint-unlock-uid:${user.uid}`,
      rateLimitConfigs.hackathonShowcaseUnlockAttempts
    );
    if (!uidRate.success) {
      return NextResponse.json(
        { error: "Too many attempts", retryAfterSeconds: uidRate.retryAfter },
        { status: 429 }
      );
    }

    if (!passcodesMatch(expected, provided)) {
      return NextResponse.json({ error: "Invalid passcode." }, { status: 400 });
    }

    await db
      .collection("users")
      .doc(user.uid)
      .set(
        {
          hackASprint2026Unlocked: true,
          hackASprint2026UnlockedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    return NextResponse.json({ ok: true, unlocked: true });
  } catch (e) {
    console.error("[hack-a-sprint unlock]", e);
    return NextResponse.json({ error: "Unlock failed" }, { status: 500 });
  }
}
