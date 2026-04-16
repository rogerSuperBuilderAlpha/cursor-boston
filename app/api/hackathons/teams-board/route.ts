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
import { loadHackathonTeamsBoard } from "@/lib/hackathon-teams-board-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_LIMIT = rateLimitConfigs.hackathonEligibility;

export async function GET(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request as unknown as Request);
    const rateResult = checkRateLimit(`hackathon-teams-board:${clientId}`, RATE_LIMIT);
    if (!rateResult.success) {
      return NextResponse.json(
        { error: "Too many requests", retryAfterSeconds: rateResult.retryAfter },
        { status: 429, headers: { "Retry-After": String(rateResult.retryAfter || 60) } }
      );
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const hackathonId =
      request.nextUrl.searchParams.get("hackathonId") ?? getCurrentVirtualHackathonId();

    const user = await getVerifiedUser(request);
    const uid = user?.uid ?? null;

    const payload = await loadHackathonTeamsBoard(db, uid, hackathonId);
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "private, max-age=30" },
    });
  } catch (e) {
    console.error("[api/hackathons/teams-board]", e);
    return NextResponse.json({ error: "Failed to load teams board" }, { status: 500 });
  }
}
