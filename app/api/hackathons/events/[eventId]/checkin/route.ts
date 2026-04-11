/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import {
  hackathonEventSignupDocId,
  isHackathonEventSignupId,
} from "@/lib/hackathon-event-signup";
import { checkRateLimit, getClientIdentifier, rateLimitConfigs } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ eventId: string }> };

/**
 * POST /api/hackathons/events/[eventId]/checkin
 * Body: { userId, checkedIn: boolean }
 * Admin-only. Sets or clears `checkedInAt` on the signup doc.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const clientId = getClientIdentifier(request as unknown as Request);
    const rate = checkRateLimit(
      `hackathon-event-checkin:${clientId}`,
      rateLimitConfigs.hackathonEventSignup,
    );
    if (!rate.success) {
      return NextResponse.json(
        { error: "Too many requests", retryAfterSeconds: rate.retryAfter },
        { status: 429, headers: { "Retry-After": String(rate.retryAfter || 60) } },
      );
    }

    const user = await getVerifiedUser(request);
    if (!user?.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { eventId: raw } = await context.params;
    const eventId = raw?.trim() ?? "";
    if (!isHackathonEventSignupId(eventId)) {
      return NextResponse.json({ error: "Unknown event" }, { status: 404 });
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const targetUserId = typeof body.userId === "string" ? body.userId.trim() : "";
    if (!targetUserId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const checkedIn = body.checkedIn !== false;

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const docId = hackathonEventSignupDocId(eventId, targetUserId);
    const ref = db.collection("hackathonEventSignups").doc(docId);
    const snap = await ref.get();

    if (!snap.exists && checkedIn) {
      // Admin privilege: create the signup doc on the fly for walk-ins /
      // waitlisters who have a site account but haven't done the website signup.
      const userDoc = await db.collection("users").doc(targetUserId).get();
      if (!userDoc.exists) {
        return NextResponse.json(
          { error: "User does not exist — they need a cursorboston.com account first" },
          { status: 404 },
        );
      }
      await ref.set({
        eventId,
        userId: targetUserId,
        signedUpAt: FieldValue.serverTimestamp(),
        checkedInAt: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ ok: true, checkedIn: true, created: true });
    }

    if (!snap.exists) {
      return NextResponse.json(
        { error: "User is not signed up for this event" },
        { status: 404 },
      );
    }

    if (checkedIn) {
      await ref.update({ checkedInAt: FieldValue.serverTimestamp() });
    } else {
      await ref.update({ checkedInAt: FieldValue.delete() });
    }

    return NextResponse.json({ ok: true, checkedIn });
  } catch (e) {
    console.error("[hackathon event checkin]", e);
    return NextResponse.json({ error: "Failed to update check-in" }, { status: 500 });
  }
}
