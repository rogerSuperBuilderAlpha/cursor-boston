/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { Firestore } from "firebase-admin/firestore";
import {
  HACK_A_SPRINT_2026_EVENT_ID,
  githubUserHasMergedLabeledShowcasePr,
} from "@/lib/hackathon-showcase";
import {
  hackathonEventSignupDocId,
  profileMatchesHackathonJudgeCheckinException,
} from "@/lib/hackathon-event-signup";

const EVENT_ID = HACK_A_SPRINT_2026_EVENT_ID;

export type CreditEligibilityResult =
  | { ok: true; creditUrl: string; rank: number }
  | { ok: false; reason: string };

/**
 * Same gates as GET /credit-code — shared by credit-email.
 */
export async function resolveHackASprint2026CreditForUser(
  db: Firestore,
  uid: string,
  tokenEmail?: string | null
): Promise<CreditEligibilityResult> {
  const signupDocId = hackathonEventSignupDocId(EVENT_ID, uid);
  const signupSnap = await db.collection("hackathonEventSignups").doc(signupDocId).get();

  if (!signupSnap.exists) {
    return { ok: false, reason: "not_signed_up" };
  }

  const signupData = signupSnap.data()!;

  const userSnap = await db.collection("users").doc(uid).get();
  const ud = userSnap.data();

  if (!signupData.checkedInAt) {
    if (
      !profileMatchesHackathonJudgeCheckinException(
        tokenEmail ?? null,
        ud as Record<string, unknown> | undefined
      )
    ) {
      return { ok: false, reason: "not_checked_in" };
    }
  }

  if (!signupData.frozenRank || !signupData.confirmedAt) {
    return { ok: false, reason: "not_confirmed" };
  }
  const githubLogin =
    ud?.github && typeof ud.github === "object"
      ? (ud.github as { login?: string }).login
      : null;

  if (!githubLogin) {
    return { ok: false, reason: "no_github" };
  }

  const hasSubmitted = await githubUserHasMergedLabeledShowcasePr(githubLogin);
  if (!hasSubmitted) {
    return { ok: false, reason: "not_submitted" };
  }

  const rank = signupData.frozenRank as number;
  const codeDoc = await db
    .collection("hackathonCreditCodes")
    .doc(`${EVENT_ID}__${rank}`)
    .get();

  if (!codeDoc.exists) {
    return { ok: false, reason: "no_code_assigned" };
  }

  return {
    ok: true,
    creditUrl: codeDoc.data()!.creditUrl as string,
    rank,
  };
}
