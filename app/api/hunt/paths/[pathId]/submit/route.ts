/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import { checkTreasureHuntEligibility } from "@/lib/treasure-hunt-eligibility";
import { claimTreasureHuntPrize } from "@/lib/treasure-hunt-claim";
import { getPath } from "@/lib/treasure-hunt-paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_WRONG_PER_HOUR = 5;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ pathId: string }> }
) {
  try {
    const { pathId } = await params;
    const path = getPath(pathId);
    if (!path) {
      return NextResponse.json({ error: "Unknown path" }, { status: 404 });
    }

    const user = await getVerifiedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const eligibility = await checkTreasureHuntEligibility(db, user.uid);
    if (!eligibility.ok) {
      return NextResponse.json(
        { ok: false, reason: eligibility.reason },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const answer = typeof body?.answer === "string" ? body.answer : "";
    if (!answer) {
      return NextResponse.json({ error: "Missing answer" }, { status: 400 });
    }

    const rateKey = `${user.uid}__${pathId}`;
    const rateRef = db.collection("treasureHuntRateLimit").doc(rateKey);
    const rateSnap = await rateRef.get();
    const now = Date.now();
    const windowStart = now - 3600_000;
    const wrongAttempts = ((rateSnap.data()?.wrongAt as number[]) || []).filter(
      (t) => t >= windowStart
    );
    if (wrongAttempts.length >= MAX_WRONG_PER_HOUR) {
      return NextResponse.json(
        { ok: false, reason: "rate_limited" },
        { status: 429 }
      );
    }

    const ok = await path.verify(answer, {
      uid: user.uid,
      email: user.email || "",
    });
    if (!ok) {
      await rateRef.set(
        {
          wrongAt: [...wrongAttempts, now],
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return NextResponse.json({ ok: false, reason: "wrong_answer" });
    }

    const claim = await claimTreasureHuntPrize(db, {
      uid: user.uid,
      email: user.email || "",
      displayName: user.name || "",
      pathId,
    });
    if (!claim.ok) {
      return NextResponse.json(
        { ok: false, reason: claim.reason },
        { status: 409 }
      );
    }
    return NextResponse.json({
      ok: true,
      pathId,
      message: "You cracked it. Check your email for the credit link.",
    });
  } catch (e) {
    console.error("[hunt/paths/submit]", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
