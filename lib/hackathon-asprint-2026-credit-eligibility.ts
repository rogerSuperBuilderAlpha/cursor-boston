/**
 * SPDX-License-Identifier: GPL-3.0-only
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
import {
  checkEventMembership,
  checkPullRequestThreshold,
} from "@/lib/eligibility-base";

const EVENT_ID = HACK_A_SPRINT_2026_EVENT_ID;

/** @internal */
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
    const membership = checkEventMembership({ exists: false });
    if (!membership.ok) return membership;
  }

  const signupData = signupSnap.data()!;

  const userSnap = await db.collection("users").doc(uid).get();
  const ud = userSnap.data();

  const membership = checkEventMembership({
    exists: true,
    checkedInAt: signupData.checkedInAt,
    checkInExempt: profileMatchesHackathonJudgeCheckinException(
      tokenEmail ?? null,
      ud as Record<string, unknown> | undefined
    ),
    confirmedAt: signupData.confirmedAt,
    rank: signupData.frozenRank,
  });
  if (!membership.ok) return membership;

  const githubLogin =
    ud?.github && typeof ud.github === "object"
      ? (ud.github as { login?: string }).login
      : null;

  if (!githubLogin) {
    return { ok: false, reason: "no_github" };
  }

  const hasSubmitted = await githubUserHasMergedLabeledShowcasePr(githubLogin);
  const submitted = checkPullRequestThreshold({
    pullRequestsCount: Number(hasSubmitted),
    target: 1,
    reason: "not_submitted",
  });
  if (!submitted.isEligible) {
    return { ok: false, reason: submitted.reason ?? "not_submitted" };
  }

  const rank = membership.rank;
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
