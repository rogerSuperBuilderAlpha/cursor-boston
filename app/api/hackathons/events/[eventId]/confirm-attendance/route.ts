/**
 * SPDX-License-Identifier: GPL-3.0-only
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
import { getClientIdentifier, rateLimitConfigs } from "@/lib/rate-limit";
import { checkUpstashRateLimit } from "@/lib/upstash-rate-limit";
import { refreshSnapshot } from "@/lib/hackathon-leaderboard-snapshot";
// @contracts: hackathonsContract.eventConfirmAttendancePost, hackathonsContract.eventConfirmAttendanceDelete
import { hackathonsContract } from "@/lib/api-schemas/hackathons";

void hackathonsContract;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE = rateLimitConfigs.hackathonEventSignup;

type RouteContext = { params: Promise<{ eventId: string }> };

interface ConfirmAttendanceResponse {
  ok: true;
  attendingConfirmed: boolean;
  attendingConfirmedAt: string | null;
  confirmedAttendeeCount: number;
  attendanceLimit: number;
}

async function handleRateLimit(request: NextRequest, scope: string) {
  const clientId = getClientIdentifier(request as unknown as Request);
  const rate = await checkUpstashRateLimit(
    `hackathon-event-confirm-attendance-${scope}:${clientId}`,
    RATE
  );
  if (!rate.success) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSeconds: rate.retryAfter },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter || 60) } }
    );
  }
  return null;
}

async function buildResponse(eventId: string, userId: string): Promise<ConfirmAttendanceResponse> {
  const snapshot = await refreshSnapshot(eventId);
  const entry = snapshot.entries.find((e) => e.userId === userId);
  return {
    ok: true,
    attendingConfirmed: entry?.attendingConfirmed ?? false,
    attendingConfirmedAt: entry?.attendingConfirmedAt ?? null,
    confirmedAttendeeCount: snapshot.confirmedAttendeeCount,
    attendanceLimit: snapshot.attendanceLimit,
  };
}

/**
 * POST — confirm attendance. Idempotent: setting attendingConfirmedAt twice
 * preserves the original timestamp. Returns the snapshot's confirmed-attendee
 * count and the per-event attendance limit so the client can refresh its UI
 * without a separate GET.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const limited = await handleRateLimit(request, "post");
    if (limited) return limited;

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
    const ref = db.collection("hackathonEventSignups").doc(docId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json(
        { error: "Claim your spot before confirming attendance" },
        { status: 404 }
      );
    }

    const data = snap.data() ?? {};
    if (!data.attendingConfirmedAt) {
      await ref.update({
        attendingConfirmedAt: FieldValue.serverTimestamp(),
        // Tag the provenance so the three-tier ranking can distinguish
        // proactive confirmations (Tier A) from admin door check-ins (Tier B).
        // See lib/hackathon-event-signup.ts getRankingModelForEvent.
        attendingConfirmedBy: "user",
      });
    }

    const response = await buildResponse(eventId, user.uid);
    return NextResponse.json(response, { status: 200 });
  } catch (e) {
    console.error("[hackathon event confirm-attendance POST]", e);
    return NextResponse.json(
      { error: "Failed to confirm attendance" },
      { status: 500 }
    );
  }
}

/**
 * DELETE — clear the attending-confirmation. Idempotent: clearing twice is a
 * no-op. The user keeps their signup; this only releases the second-step
 * confirmation, which removes them from the public confirmed-attendee count
 * until they re-confirm.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const limited = await handleRateLimit(request, "delete");
    if (limited) return limited;

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
    const ref = db.collection("hackathonEventSignups").doc(docId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json(
        { error: "Not signed up for this event" },
        { status: 404 }
      );
    }

    const data = snap.data() ?? {};
    if (data.attendingConfirmedAt) {
      await ref.update({
        attendingConfirmedAt: FieldValue.delete(),
        attendingConfirmedBy: FieldValue.delete(),
      });
    }

    const response = await buildResponse(eventId, user.uid);
    return NextResponse.json(response, { status: 200 });
  } catch (e) {
    console.error("[hackathon event confirm-attendance DELETE]", e);
    return NextResponse.json(
      { error: "Failed to un-confirm attendance" },
      { status: 500 }
    );
  }
}
