/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  getVerifiedUser,
  getOptionalVerifiedUser,
} from "@/lib/server-auth";
import {
  getHackathonEventSignupBlockReason,
  hackathonEventSignupDocId,
  isHackathonEventSignupId,
} from "@/lib/hackathon-event-signup";
import { getClientIdentifier, rateLimitConfigs } from "@/lib/rate-limit";
import { checkUpstashRateLimit } from "@/lib/upstash-rate-limit";
import { hackathonsContract } from "@/lib/api-schemas/hackathons";
import {
  getSnapshotOrRefresh,
  refreshSnapshot,
} from "@/lib/hackathon-leaderboard-snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE = rateLimitConfigs.hackathonEventSignup;

type RouteContext = { params: Promise<{ eventId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const clientId = getClientIdentifier(request as unknown as Request);
    const rate = await checkUpstashRateLimit(`hackathon-event-signup-get:${clientId}`, RATE);
    if (!rate.success) {
      return NextResponse.json(
        { error: "Too many requests", retryAfterSeconds: rate.retryAfter },
        { status: 429, headers: { "Retry-After": String(rate.retryAfter || 60) } }
      );
    }

    const { eventId: raw } = await context.params;
    const eventId = raw?.trim() ?? "";
    if (!isHackathonEventSignupId(eventId)) {
      return NextResponse.json({ error: "Unknown event" }, { status: 404 });
    }

    const meUser = await getOptionalVerifiedUser(request);
    // Read the persisted snapshot. Mutations (POST/PATCH/DELETE below) refresh
    // it inline, so this returns the post-mutation state on the next GET without
    // re-running the Firestore + GitHub fan-out per page load.
    const payload = await getSnapshotOrRefresh(eventId);

    let me: {
      signedUp: boolean;
      rank: number | null;
      mergedPrCount: number | null;
      signedUpAt: string | null;
      creditEligible: boolean;
      willBeLate: boolean;
      queuingForSpot: boolean;
      lumaRegistered: boolean;
      attendingConfirmed: boolean;
      attendingConfirmedAt: string | null;
      attendanceRank: number | null;
    } | null = null;

    if (meUser) {
      const entry = payload.entries.find((e) => e.userId === meUser.uid);
      me = entry
        ? {
            signedUp: true,
            rank: entry.rank,
            mergedPrCount: entry.mergedPrCount,
            signedUpAt: entry.signedUpAt,
            creditEligible: entry.creditEligible,
            willBeLate: entry.willBeLate,
            queuingForSpot: entry.queuingForSpot,
            lumaRegistered: entry.lumaRegistered,
            attendingConfirmed: entry.attendingConfirmed,
            attendingConfirmedAt: entry.attendingConfirmedAt,
            attendanceRank: entry.attendanceRank,
          }
        : {
            signedUp: false,
            rank: null,
            mergedPrCount: null,
            signedUpAt: null,
            creditEligible: false,
            willBeLate: false,
            queuingForSpot: false,
            lumaRegistered: false,
            attendingConfirmed: false,
            attendingConfirmedAt: null,
            attendanceRank: null,
          };
    }

    return NextResponse.json({
      eventId,
      totalCount: payload.totalCount,
      websiteSignupCount: payload.websiteSignupCount,
      entries: payload.entries,
      creditTopN: payload.creditTopN,
      confirmedAttendeeCount: payload.confirmedAttendeeCount,
      attendanceLimit: payload.attendanceLimit,
      me,
    });
  } catch (e) {
    console.error("[hackathon event signup GET]", e);
    return NextResponse.json({ error: "Failed to load signups" }, { status: 500 });
  }
}

/**
 * POST does not enforce capacity — it always accepts a new signup into the
 * waitlist. The confirmed/waitlisted cut happens later when the ranking
 * snapshot script writes `frozenRank` + `confirmedAt` on the top N docs
 * (N = event-specific capacity). Keep it that way: turning this into a
 * "first N wins" gate causes a capacity race condition (two clients posting
 * concurrently near the cap) that the current design avoids by deferring to
 * the offline snapshot.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const clientId = getClientIdentifier(request as unknown as Request);
    const rate = await checkUpstashRateLimit(`hackathon-event-signup-post:${clientId}`, RATE);
    if (!rate.success) {
      return NextResponse.json(
        { error: "Too many requests", retryAfterSeconds: rate.retryAfter },
        { status: 429, headers: { "Retry-After": String(rate.retryAfter || 60) } }
      );
    }

    const user = await getVerifiedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { eventId: raw } = await context.params;
    const eventId = raw?.trim() ?? "";
    if (!isHackathonEventSignupId(eventId)) {
      return NextResponse.json({ error: "Unknown event" }, { status: 404 });
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const userRef = db.collection("users").doc(user.uid);
    const userSnap = await userRef.get();
    const block = getHackathonEventSignupBlockReason(userSnap.data());
    if (block) {
      return NextResponse.json({ error: block }, { status: 400 });
    }

    const docId = hackathonEventSignupDocId(eventId, user.uid);
    const ref = db.collection("hackathonEventSignups").doc(docId);
    const existing = await ref.get();
    if (existing.exists) {
      return NextResponse.json({ signedUp: true, alreadySignedUp: true }, { status: 200 });
    }

    await ref.set({
      eventId,
      userId: user.uid,
      signedUpAt: FieldValue.serverTimestamp(),
    });
    // Block on snapshot refresh so the next GET reflects this claim.
    await refreshSnapshot(eventId);

    return NextResponse.json({ signedUp: true }, { status: 200 });
  } catch (e) {
    console.error("[hackathon event signup POST]", e);
    return NextResponse.json({ error: "Failed to sign up" }, { status: 500 });
  }
}

/**
 * PATCH RSVP flags on the user's own signup doc.
 * Body: { willBeLate?: boolean, queuingForSpot?: boolean, giveUpSpot?: true }
 * - willBeLate: only when confirmed (confirmedAt set)
 * - queuingForSpot: only when waitlisted (no confirmedAt)
 * - giveUpSpot: confirmed attendee releases their spot (clears confirmedAt)
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const clientId = getClientIdentifier(request as unknown as Request);
    const rate = await checkUpstashRateLimit(`hackathon-event-signup-patch:${clientId}`, RATE);
    if (!rate.success) {
      return NextResponse.json(
        { error: "Too many requests", retryAfterSeconds: rate.retryAfter },
        { status: 429, headers: { "Retry-After": String(rate.retryAfter || 60) } }
      );
    }

    const user = await getVerifiedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    const parsed = hackathonsContract.eventSignupPatch.body.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid body" },
        { status: 400 }
      );
    }
    const parsedBody = parsed.data;

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const docId = hackathonEventSignupDocId(eventId, user.uid);
    const ref = db.collection("hackathonEventSignups").doc(docId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Not signed up for this event" }, { status: 404 });
    }

    const data = snap.data() ?? {};
    const isConfirmed = Boolean(data.confirmedAt);

    if (parsedBody.giveUpSpot === true) {
      if (!isConfirmed) {
        return NextResponse.json(
          { error: "Only confirmed attendees can give up their spot" },
          { status: 400 }
        );
      }
      await ref.update({
        confirmedAt: FieldValue.delete(),
        gaveUpSpotAt: FieldValue.serverTimestamp(),
        willBeLate: FieldValue.delete(),
      });
      await refreshSnapshot(eventId);
      return NextResponse.json({ ok: true, gaveUpSpot: true }, { status: 200 });
    }

    const patch: Record<string, unknown> = {};
    if (parsedBody.willBeLate !== undefined) {
      if (parsedBody.willBeLate && !isConfirmed) {
        return NextResponse.json(
          { error: "Only confirmed attendees can mark that they will be late" },
          { status: 400 }
        );
      }
      if (parsedBody.willBeLate) {
        patch.willBeLate = true;
      } else {
        patch.willBeLate = FieldValue.delete();
      }
    }

    if (parsedBody.queuingForSpot !== undefined) {
      if (parsedBody.queuingForSpot && isConfirmed) {
        return NextResponse.json(
          { error: "Waitlisted attendees only can mark that they will queue for a spot" },
          { status: 400 }
        );
      }
      if (parsedBody.queuingForSpot) {
        patch.queuingForSpot = true;
      } else {
        patch.queuingForSpot = FieldValue.delete();
      }
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    await ref.update(patch);
    await refreshSnapshot(eventId);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error("[hackathon event signup PATCH]", e);
    return NextResponse.json({ error: "Failed to update RSVP" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const clientId = getClientIdentifier(request as unknown as Request);
    const rate = await checkUpstashRateLimit(`hackathon-event-signup-del:${clientId}`, RATE);
    if (!rate.success) {
      return NextResponse.json(
        { error: "Too many requests", retryAfterSeconds: rate.retryAfter },
        { status: 429, headers: { "Retry-After": String(rate.retryAfter || 60) } }
      );
    }

    const user = await getVerifiedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { eventId: raw } = await context.params;
    const eventId = raw?.trim() ?? "";
    if (!isHackathonEventSignupId(eventId)) {
      return NextResponse.json({ error: "Unknown event" }, { status: 404 });
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const docId = hackathonEventSignupDocId(eventId, user.uid);
    await db.collection("hackathonEventSignups").doc(docId).delete().catch(() => undefined);
    await refreshSnapshot(eventId);

    return NextResponse.json({ left: true }, { status: 200 });
  } catch (e) {
    console.error("[hackathon event signup DELETE]", e);
    return NextResponse.json({ error: "Failed to leave list" }, { status: 500 });
  }
}
