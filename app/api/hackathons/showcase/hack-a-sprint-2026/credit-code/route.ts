/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import {
  HACK_A_SPRINT_2026_EVENT_ID,
  githubUserHasMergedLabeledShowcasePr,
} from "@/lib/hackathon-showcase";
import { hackathonEventSignupDocId } from "@/lib/hackathon-event-signup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EVENT_ID = HACK_A_SPRINT_2026_EVENT_ID;

/**
 * Returns the user's Cursor credit code URL.
 *
 * Gates:
 *   1. Authenticated
 *   2. Checked in (checkedInAt on signup doc)
 *   3. Has submitted showcase project (merged labeled PR)
 *
 * If any gate fails, returns { eligible: false, reason } with 200.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const signupDocId = hackathonEventSignupDocId(EVENT_ID, user.uid);
    const signupSnap = await db
      .collection("hackathonEventSignups")
      .doc(signupDocId)
      .get();

    if (!signupSnap.exists) {
      return NextResponse.json({
        eligible: false,
        reason: "not_signed_up",
      });
    }

    const signupData = signupSnap.data()!;

    if (!signupData.checkedInAt) {
      return NextResponse.json({
        eligible: false,
        reason: "not_checked_in",
      });
    }

    if (!signupData.frozenRank || !signupData.confirmedAt) {
      return NextResponse.json({
        eligible: false,
        reason: "not_confirmed",
      });
    }

    const userSnap = await db.collection("users").doc(user.uid).get();
    const ud = userSnap.data();
    const githubLogin =
      ud?.github && typeof ud.github === "object"
        ? (ud.github as { login?: string }).login
        : null;

    if (!githubLogin) {
      return NextResponse.json({
        eligible: false,
        reason: "no_github",
      });
    }

    const hasSubmitted =
      await githubUserHasMergedLabeledShowcasePr(githubLogin);
    if (!hasSubmitted) {
      return NextResponse.json({
        eligible: false,
        reason: "not_submitted",
      });
    }

    const rank = signupData.frozenRank as number;
    const codeDoc = await db
      .collection("hackathonCreditCodes")
      .doc(`${EVENT_ID}__${rank}`)
      .get();

    if (!codeDoc.exists) {
      return NextResponse.json({
        eligible: false,
        reason: "no_code_assigned",
      });
    }

    return NextResponse.json({
      eligible: true,
      creditUrl: codeDoc.data()!.creditUrl,
      rank,
    });
  } catch (e) {
    console.error("[credit-code GET]", e);
    return NextResponse.json(
      { error: "Failed to load credit code" },
      { status: 500 }
    );
  }
}
