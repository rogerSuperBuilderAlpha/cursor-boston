/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/server-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { getCurrentVirtualHackathonId } from "@/lib/hackathons";
import { getClientIdentifier, checkRateLimit, rateLimitConfigs } from "@/lib/rate-limit";
import { loadHackathonTeamDashboard } from "@/lib/hackathon-team-dashboard-server";
import { hackathonsContract } from "@/lib/api-schemas/hackathons";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_LIMIT = rateLimitConfigs.hackathonEligibility;

export async function GET(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request as unknown as Request);
    const rateResult = checkRateLimit(`hackathon-team-dashboard:${clientId}`, RATE_LIMIT);
    if (!rateResult.success) {
      return NextResponse.json(
        { error: "Too many requests", retryAfterSeconds: rateResult.retryAfter },
        { status: 429, headers: { "Retry-After": String(rateResult.retryAfter || 60) } }
      );
    }

    const user = await getVerifiedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const queryParse = hackathonsContract.teamDashboard.query.safeParse({
      hackathonId: request.nextUrl.searchParams.get("hackathonId") ?? undefined,
    });
    if (!queryParse.success) {
      return NextResponse.json({ error: "Invalid query" }, { status: 400 });
    }
    const hackathonId = queryParse.data.hackathonId ?? getCurrentVirtualHackathonId();

    const payload = await loadHackathonTeamDashboard(db, user.uid, hackathonId);
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    console.error("[api/hackathons/team-dashboard]", e);
    return NextResponse.json({ error: "Failed to load team dashboard" }, { status: 500 });
  }
}
