/**
 * SPDX-License-Identifier: GPL-3.0-only
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
import {
  SUMMER_COHORT_COLLECTION,
  isValidCohortId,
  type SummerCohortId,
} from "@/lib/summer-cohort";
import {
  SUMMER_COHORT_INTAKE_COLLECTION,
  SUMMER_COHORT_INTAKE_VERSION,
  intakeSurveyDocId,
  validateIntakeSurvey,
  type IntakeSurveyDoc,
} from "@/lib/summer-cohort-intake";

// @contracts: summerCohortContract.intakeSurveyGet, summerCohortContract.intakeSurveyPost (lib/api-schemas/summer-cohort.ts) — body shape is owned by lib/summer-cohort-intake#validateIntakeSurvey for backwards-compat with the existing field-list contract.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function serializeDoc(uid: string, data: Record<string, unknown>): IntakeSurveyDoc | null {
  const submittedAt = data.submittedAt;
  const lastUpdatedAt = data.lastUpdatedAt;
  const submittedMs =
    submittedAt && typeof (submittedAt as { toMillis?: () => number }).toMillis === "function"
      ? (submittedAt as { toMillis: () => number }).toMillis()
      : null;
  const updatedMs =
    lastUpdatedAt && typeof (lastUpdatedAt as { toMillis?: () => number }).toMillis === "function"
      ? (lastUpdatedAt as { toMillis: () => number }).toMillis()
      : null;
  if (!submittedMs) return null;
  return {
    ...(data as unknown as Omit<IntakeSurveyDoc, "uid" | "submittedAt" | "lastUpdatedAt">),
    uid,
    submittedAt: submittedMs,
    lastUpdatedAt: updatedMs ?? submittedMs,
  };
}

/** Parses ?cohortId= from the URL or `cohortId` from the JSON body. */
function readCohortId(value: unknown): SummerCohortId | null {
  return isValidCohortId(value) ? value : null;
}

async function handleGet(request: NextRequest) {
  const user = await getVerifiedUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }
  const cohortId = readCohortId(request.nextUrl.searchParams.get("cohortId"));
  // Default to cohort-1 to match the pre-v2 contract (callers that don't pass
  // a cohort want the legacy "did this user fill out the intake survey?"
  // answer, which only existed for cohort-1).
  const effectiveCohort: SummerCohortId = cohortId ?? "cohort-1";

  const col = db.collection(SUMMER_COHORT_INTAKE_COLLECTION);
  const docId = intakeSurveyDocId(user.uid, effectiveCohort);
  let snap = await col.doc(docId).get();
  // Back-compat: pre-v2 cohort-1 surveys were keyed by uid alone. Fall back
  // to that legacy doc so already-completed c1 respondents aren't shown the
  // survey again. Writes always go to the new key.
  if (!snap.exists && effectiveCohort === "cohort-1") {
    snap = await col.doc(user.uid).get();
  }
  if (!snap.exists) {
    return NextResponse.json({ completed: false, response: null });
  }
  const doc = serializeDoc(user.uid, snap.data() || {});
  return NextResponse.json({
    completed: doc !== null,
    response: doc,
  });
}

async function handlePost(request: NextRequest) {
  const user = await getVerifiedUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Cohort comes from the request body. We trust it for routing but only
  // after verifying the user is actually admitted to that cohort below.
  const bodyObj = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const cohortId = readCohortId(bodyObj.cohort);
  if (!cohortId) {
    return NextResponse.json(
      { error: "Missing or invalid cohort id" },
      { status: 400 }
    );
  }

  // Gate: user must be admitted AND include this cohort on their application.
  // Each cohort gets its own intake survey — a c1 admit who hasn't been
  // accepted to c2 can't submit a c2 survey.
  const appSnap = await db
    .collection(SUMMER_COHORT_COLLECTION)
    .doc(user.uid)
    .get();
  if (!appSnap.exists) {
    return NextResponse.json(
      { error: "No application on file" },
      { status: 403 }
    );
  }
  const app = appSnap.data() || {};
  const status = typeof app.status === "string" ? app.status : "pending";
  if (status !== "admitted") {
    return NextResponse.json(
      { error: "Only admitted applicants can submit the intake survey" },
      { status: 403 }
    );
  }
  const appCohorts = Array.isArray(app.cohorts) ? app.cohorts : [];
  if (!appCohorts.includes(cohortId)) {
    return NextResponse.json(
      { error: `Not admitted to ${cohortId}` },
      { status: 403 }
    );
  }
  // Server-authoritative: was this user admitted to cohort-1? Used to fill
  // the "participated in Cohort 1?" question on c2 surveys regardless of
  // anything the client sent.
  const wasInCohort1 = appCohorts.includes("cohort-1");

  const result = validateIntakeSurvey(body);
  if (!result.ok) {
    return NextResponse.json(
      { error: "Validation failed", missingFields: result.errors },
      { status: 400 }
    );
  }

  const docId = intakeSurveyDocId(user.uid, cohortId);
  const docRef = db.collection(SUMMER_COHORT_INTAKE_COLLECTION).doc(docId);
  const existing = await docRef.get();
  const isFirstSubmission = !existing.exists;

  await docRef.set(
    {
      ...result.data,
      // Force-override server-authoritative fields so clients can't lie about
      // their cohort linkage or cross-cohort participation.
      cohort: cohortId,
      participatedInCohort1: cohortId === "cohort-2" ? wasInCohort1 : null,
      uid: user.uid,
      surveyVersion: SUMMER_COHORT_INTAKE_VERSION,
      // Preserve the original submittedAt on re-submit so we always know
      // when the respondent first cleared the gate. lastUpdatedAt tracks edits.
      ...(isFirstSubmission ? { submittedAt: FieldValue.serverTimestamp() } : {}),
      lastUpdatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  // Pre-v2 cohort-1 surveys were keyed by uid alone. On the first v2 write
  // for cohort-1, clean up the legacy doc so aggregate counts don't double.
  if (cohortId === "cohort-1") {
    const legacy = await db
      .collection(SUMMER_COHORT_INTAKE_COLLECTION)
      .doc(user.uid)
      .get();
    if (legacy.exists) {
      await legacy.ref.delete();
    }
  }

  logger.info("[summer-cohort/intake-survey] submission", {
    uid: user.uid,
    cohortId,
    isFirstSubmission,
    version: SUMMER_COHORT_INTAKE_VERSION,
  });

  return NextResponse.json({ ok: true, isFirstSubmission });
}

export const GET = withMiddleware(rateLimitConfigs.standard, handleGet);
export const POST = withMiddleware(rateLimitConfigs.standard, handlePost);
