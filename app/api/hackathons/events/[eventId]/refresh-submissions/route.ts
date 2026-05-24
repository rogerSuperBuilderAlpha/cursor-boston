/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getVerifiedUser, isCurrentIdTokenRevoked } from "@/lib/server-auth";
import {
  getRankingModelForEvent,
  isHackathonEventSignupId,
} from "@/lib/hackathon-event-signup";
import { refreshSnapshot } from "@/lib/hackathon-leaderboard-snapshot";
import { SPORTS_HACK_2026_SUBMISSION_AUTHORS_CACHE_TAG } from "@/lib/sports-hack-2026-submission-prs";
import {
  checkRateLimit,
  getClientIdentifier,
  rateLimitConfigs,
} from "@/lib/rate-limit";
// @contracts: hackathonsContract.eventRefreshSubmissions
import { hackathonsContract } from "@/lib/api-schemas/hackathons";

void hackathonsContract;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ eventId: string }> };

/**
 * POST /api/hackathons/events/[eventId]/refresh-submissions
 *
 * Admin-only force-refresh for the three-tier ranking submission lookup.
 * The submission-author set is cached for 60s by `unstable_cache`; during
 * the event a maintainer may want to flip a just-opened PR through to the
 * `hasSubmission` flag (and the credit-eligibility gate) immediately.
 *
 * Steps:
 *   1. `revalidateTag` the cache so the next read goes back to GitHub.
 *   2. `refreshSnapshot(eventId)` so the new state is durable in Firestore
 *      and visible to all future GETs without another GitHub round-trip.
 *
 * Gated on `getRankingModelForEvent(eventId) === "three-tier"` — events on
 * the historical freeze model have no submission detection to refresh and
 * return 404 here.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const clientId = getClientIdentifier(request as unknown as Request);
    const rate = checkRateLimit(
      `hackathon-event-refresh-submissions:${clientId}`,
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
        { status: 401 },
      );
    }

    const { eventId: raw } = await context.params;
    const eventId = raw?.trim() ?? "";
    if (!isHackathonEventSignupId(eventId)) {
      return NextResponse.json({ error: "Unknown event" }, { status: 404 });
    }
    if (getRankingModelForEvent(eventId) !== "three-tier") {
      return NextResponse.json(
        {
          error:
            "This event does not use the three-tier ranking model — nothing to refresh.",
        },
        { status: 404 },
      );
    }

    revalidateTag(SPORTS_HACK_2026_SUBMISSION_AUTHORS_CACHE_TAG, { expire: 0 });
    const snapshot = await refreshSnapshot(eventId);
    const submissionCount = snapshot.entries.filter((e) => e.hasSubmission).length;

    return NextResponse.json({
      ok: true,
      eventId,
      submissionAuthorCount: submissionCount,
      generatedAt: snapshot.generatedAt,
    });
  } catch (e) {
    console.error("[hackathon event refresh-submissions]", e);
    return NextResponse.json(
      { error: "Failed to refresh submission cache" },
      { status: 500 },
    );
  }
}
