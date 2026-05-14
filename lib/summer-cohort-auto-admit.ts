/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "./firebase-admin";
import { logger } from "./logger";
import {
  SUMMER_COHORT_C1_AUTO_ADMIT_DEADLINE_MS,
  SUMMER_COHORT_C1_CAP,
  SUMMER_COHORT_COLLECTION,
  isWithinSummerCohortC1AutoAdmitWindow,
} from "./summer-cohort";

export type AutoAdmitOutcome =
  | { kind: "skipped"; reason: string }
  | { kind: "promoted"; userId: string; applicationId: string };

/**
 * Hook called from the GitHub PR-merge webhook. If the PR author has a
 * pending Cohort 1 application and we're still within the auto-admit window
 * (≤ May 9, 2026), flip their status to admitted.
 *
 * Side effects on success:
 *   - summerCohortApplications/{uid}.status: "pending" → "admitted"
 *   - .admittedAt: serverTimestamp
 *   - .admittedVia: "pr-merge"
 *   - .admittedFromPR: PR number (for traceability)
 *
 * Idempotent — second merged PR for the same user is a no-op (already admitted).
 * Non-throwing — failures are logged and returned, not re-raised, so the
 * webhook flow is unaffected.
 */
export async function maybeAutoAdmitOnPRMerge(args: {
  authorLogin: string;
  prNumber: number;
}): Promise<AutoAdmitOutcome> {
  const { authorLogin, prNumber } = args;

  if (!authorLogin) {
    return { kind: "skipped", reason: "no-author-login" };
  }

  if (!isWithinSummerCohortC1AutoAdmitWindow()) {
    return {
      kind: "skipped",
      reason: "outside-auto-admit-window",
    };
  }

  const db = getAdminDb();
  if (!db) {
    return { kind: "skipped", reason: "no-admin-db" };
  }

  try {
    // 1. github.login → userId via the users collection.
    const usersSnap = await db
      .collection("users")
      .where("github.login", "==", authorLogin)
      .limit(5)
      .get();

    // GitHub login matching is case-insensitive in practice. The Firestore
    // exact-equality query is case-sensitive — also try the lowercase form
    // if the first lookup misses.
    let userDocs = usersSnap.docs;
    if (userDocs.length === 0 && authorLogin !== authorLogin.toLowerCase()) {
      const fallback = await db
        .collection("users")
        .where("github.login", "==", authorLogin.toLowerCase())
        .limit(5)
        .get();
      userDocs = fallback.docs;
    }

    if (userDocs.length === 0) {
      return { kind: "skipped", reason: "no-user-with-this-github-login" };
    }

    // 2. Find the cohort-1 pending application across matching users.
    let promotedFor: { userId: string; applicationId: string } | null = null;
    for (const userDoc of userDocs) {
      const userId = userDoc.id;
      const appRef = db.collection(SUMMER_COHORT_COLLECTION).doc(userId);

      const result = await db.runTransaction(async (tx) => {
        const appSnap = await tx.get(appRef);
        if (!appSnap.exists) {
          return { changed: false as const, reason: "no-application" };
        }
        const data = appSnap.data() ?? {};
        const status = typeof data.status === "string" ? data.status : "pending";
        if (status !== "pending") {
          return { changed: false as const, reason: `status-is-${status}` };
        }
        const cohorts = Array.isArray(data.cohorts) ? data.cohorts : [];
        if (!cohorts.includes("cohort-1")) {
          return { changed: false as const, reason: "not-in-cohort-1" };
        }

        // Re-check the deadline inside the transaction in case we're racing
        // close to midnight. Belt-and-suspenders.
        if (!isWithinSummerCohortC1AutoAdmitWindow()) {
          return { changed: false as const, reason: "deadline-passed" };
        }

        // Cap check — count current admitted in cohort-1 inside the txn.
        // The aggregation count() is the cheap path here.
        const admittedCountSnap = await db
          .collection(SUMMER_COHORT_COLLECTION)
          .where("cohorts", "array-contains", "cohort-1")
          .where("status", "==", "admitted")
          .count()
          .get();
        const admittedCount = admittedCountSnap.data().count;
        if (admittedCount >= SUMMER_COHORT_C1_CAP) {
          return { changed: false as const, reason: "cohort-1-full" };
        }

        tx.update(appRef, {
          status: "admitted",
          admittedAt: FieldValue.serverTimestamp(),
          admittedVia: "pr-merge",
          admittedFromPR: prNumber,
          updatedAt: FieldValue.serverTimestamp(),
        });
        return { changed: true as const };
      });

      if (result.changed) {
        promotedFor = { userId, applicationId: userId };
        break;
      } else {
        logger.info("auto-admit: skipped a candidate user", {
          authorLogin,
          userId,
          reason: result.reason,
        });
      }
    }

    if (!promotedFor) {
      return { kind: "skipped", reason: "no-eligible-application" };
    }

    logger.info("auto-admit: promoted pending → admitted", {
      authorLogin,
      prNumber,
      userId: promotedFor.userId,
      deadlineMs: SUMMER_COHORT_C1_AUTO_ADMIT_DEADLINE_MS,
    });

    return { kind: "promoted", ...promotedFor };
  } catch (error) {
    logger.warn("auto-admit: failed (non-fatal)", {
      authorLogin,
      prNumber,
      error: error instanceof Error ? error.message : String(error),
    });
    return { kind: "skipped", reason: "exception" };
  }
}
