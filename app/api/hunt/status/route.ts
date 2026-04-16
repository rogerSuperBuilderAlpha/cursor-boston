/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import {
  checkTreasureHuntEligibility,
  treasureHuntEnabled,
} from "@/lib/treasure-hunt-eligibility";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!treasureHuntEnabled()) {
    return NextResponse.json({ enabled: false });
  }
  try {
    const user = await getVerifiedUser(request);
    if (!user) {
      return NextResponse.json({ enabled: true, eligible: false, reason: "not_signed_in" });
    }
    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const eligibility = await checkTreasureHuntEligibility(db, user.uid);

    const [poolSnap, pathWinnersSnap] = await Promise.all([
      db.collection("treasureHuntPrizes").where("status", "==", "available").count().get(),
      db.collection("treasureHuntPathWinners").count().get(),
    ]);

    return NextResponse.json({
      enabled: true,
      eligible: eligibility.ok,
      reason: eligibility.ok ? null : eligibility.reason,
      prizesRemaining: poolSnap.data().count,
      pathsClaimed: pathWinnersSnap.data().count,
    });
  } catch (e) {
    console.error("[hunt/status]", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
