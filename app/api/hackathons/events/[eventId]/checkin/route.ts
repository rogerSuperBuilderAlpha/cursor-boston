/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser, isCurrentIdTokenRevoked } from "@/lib/server-auth";
import {
  hackathonEventSignupDocId,
  isHackathonEventSignupId,
} from "@/lib/hackathon-event-signup";
import { checkRateLimit, getClientIdentifier, rateLimitConfigs } from "@/lib/rate-limit";
import { hackathonsContract } from "@/lib/api-schemas/hackathons";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Kept in sync with the same constant in the signup route. */
const HACKATHON_SIGNUP_CACHE_TAG = "hackathon-event-signup";

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
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!user.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (await isCurrentIdTokenRevoked(request)) {
      return NextResponse.json(
        { error: "Session revoked. Please sign in again." },
        { status: 401 }
      );
    }

    const { eventId: raw } = await context.params;
    const eventId = raw?.trim() ?? "";
    if (!isHackathonEventSignupId(eventId)) {
      return NextResponse.json({ error: "Unknown event" }, { status: 404 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const parsed = hackathonsContract.eventCheckin.body.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid body" },
        { status: 400 }
      );
    }

    const targetUserId = parsed.data.userId.trim();
    if (!targetUserId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const checkedIn = parsed.data.checkedIn !== false;

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
      // Door check-in also marks the user as attending-confirmed. This catches
      // walk-ins / late-RSVPs who never clicked Confirm on the site so they
      // show up in the public confirmed-attendee count and attendanceRank.
      // The provenance is tagged `admin` so the three-tier ranking can keep
      // door-only confirmations in Tier B (only proactive user clicks earn
      // Tier A). See lib/hackathon-event-signup.ts getRankingModelForEvent.
      await ref.set({
        eventId,
        userId: targetUserId,
        signedUpAt: FieldValue.serverTimestamp(),
        checkedInAt: FieldValue.serverTimestamp(),
        attendingConfirmedAt: FieldValue.serverTimestamp(),
        attendingConfirmedBy: "admin",
      });
      revalidateTag(HACKATHON_SIGNUP_CACHE_TAG, { expire: 0 });
      return NextResponse.json({ ok: true, checkedIn: true, created: true });
    }

    if (!snap.exists) {
      return NextResponse.json(
        { error: "User is not signed up for this event" },
        { status: 404 },
      );
    }

    if (checkedIn) {
      // Preserve any existing attendingConfirmedAt (don't overwrite the user's
      // earlier confirm time). Only set it when currently unset, so walk-ins
      // who never clicked Confirm still get counted as attending. Un-check-in
      // does NOT clear attendingConfirmedAt — un-check-in is an admin
      // correction, not an attendance revocation.
      const data = snap.data() ?? {};
      const update: Record<string, unknown> = {
        checkedInAt: FieldValue.serverTimestamp(),
      };
      if (!data.attendingConfirmedAt) {
        // First-time confirmation via admin check-in — tag the provenance so
        // the three-tier ranking keeps this row in Tier B (only proactive
        // user clicks earn Tier A).
        update.attendingConfirmedAt = FieldValue.serverTimestamp();
        update.attendingConfirmedBy = "admin";
      }
      await ref.update(update);
    } else {
      await ref.update({ checkedInAt: FieldValue.delete() });
    }
    revalidateTag(HACKATHON_SIGNUP_CACHE_TAG, { expire: 0 });

    return NextResponse.json({ ok: true, checkedIn });
  } catch (e) {
    console.error("[hackathon event checkin]", e);
    return NextResponse.json({ error: "Failed to update check-in" }, { status: 500 });
  }
}
