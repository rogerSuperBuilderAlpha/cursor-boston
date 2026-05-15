/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import { withMiddleware, rateLimitConfigs } from "@/lib/middleware";
import { logger } from "@/lib/logger";
import { SUMMER_COHORT_COLLECTION } from "@/lib/summer-cohort";
import { summerCohortContract } from "@/lib/api-schemas/summer-cohort";

// @contracts: summerCohortContract.confirmDevEnv

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/summer-cohort/confirm-dev-env
 *
 * Auth-required. Stamps `cohort1DevEnvConfirmedAt` on the current user's
 * cohort application. Gated to ANY admitted cohort applicant — the readiness
 * modal already hides the affordance from anyone else, but we re-check here
 * so the API can't be poked from a stale tab.
 *
 * Field name still says "cohort1" for back-compat with existing data; it's
 * the cohort-agnostic dev-env confirmation timestamp now.
 *
 * Idempotent: re-stamps the timestamp on every call. The modal closes once
 * the timestamp is non-null, so re-clicks have no UX consequence.
 */
async function handlePost(request: NextRequest) {
  // Touch the imported contract so the import isn't tree-shaken in any
  // tooling that scans the source. The body is empty by contract.
  void summerCohortContract.confirmDevEnv;

  const user = await getVerifiedUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = getAdminDb();
  if (!db) {
    return NextResponse.json(
      { error: "Server not configured" },
      { status: 500 }
    );
  }

  const appRef = db.collection(SUMMER_COHORT_COLLECTION).doc(user.uid);
  const appSnap = await appRef.get();
  if (!appSnap.exists) {
    return NextResponse.json(
      { error: "No application on file" },
      { status: 403 }
    );
  }
  const app = appSnap.data() || {};
  const status = typeof app.status === "string" ? app.status : "pending";
  const cohorts = Array.isArray(app.cohorts) ? (app.cohorts as string[]) : [];
  if (status !== "admitted" || cohorts.length === 0) {
    return NextResponse.json(
      { error: "Only admitted cohort applicants can confirm dev env" },
      { status: 403 }
    );
  }

  await appRef.update({
    cohort1DevEnvConfirmedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Re-read so we can return the resolved server timestamp as millis.
  const refreshed = await appRef.get();
  const data = refreshed.data() || {};
  const stamp = data.cohort1DevEnvConfirmedAt;
  const millis =
    stamp && typeof (stamp as { toMillis?: () => number }).toMillis === "function"
      ? (stamp as { toMillis: () => number }).toMillis()
      : Date.now();

  logger.info("[summer-cohort/confirm-dev-env] confirmed", {
    uid: user.uid,
    at: millis,
  });

  return NextResponse.json({ ok: true, cohort1DevEnvConfirmedAt: millis });
}

export const POST = withMiddleware(rateLimitConfigs.standard, handlePost);
