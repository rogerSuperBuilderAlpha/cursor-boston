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
import {
  SUMMER_COHORT_INTAKE_COLLECTION,
  SUMMER_COHORT_INTAKE_VERSION,
  validateIntakeSurvey,
  type IntakeSurveyDoc,
} from "@/lib/summer-cohort-intake";

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

async function handleGet(request: NextRequest) {
  const user = await getVerifiedUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }
  const snap = await db
    .collection(SUMMER_COHORT_INTAKE_COLLECTION)
    .doc(user.uid)
    .get();
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

  // Gate: only admitted Cohort 1 applicants can submit. Anyone else
  // POSTing is either a stale tab or someone poking at the API.
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = validateIntakeSurvey(body);
  if (!result.ok) {
    return NextResponse.json(
      { error: "Validation failed", missingFields: result.errors },
      { status: 400 }
    );
  }

  const docRef = db
    .collection(SUMMER_COHORT_INTAKE_COLLECTION)
    .doc(user.uid);
  const existing = await docRef.get();
  const isFirstSubmission = !existing.exists;

  await docRef.set(
    {
      ...result.data,
      uid: user.uid,
      surveyVersion: SUMMER_COHORT_INTAKE_VERSION,
      // Preserve the original submittedAt on re-submit so we always know
      // when the respondent first cleared the gate. lastUpdatedAt tracks edits.
      ...(isFirstSubmission ? { submittedAt: FieldValue.serverTimestamp() } : {}),
      lastUpdatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  logger.info("[summer-cohort/intake-survey] submission", {
    uid: user.uid,
    isFirstSubmission,
    version: SUMMER_COHORT_INTAKE_VERSION,
  });

  return NextResponse.json({ ok: true, isFirstSubmission });
}

export const GET = withMiddleware(rateLimitConfigs.standard, handleGet);
export const POST = withMiddleware(rateLimitConfigs.standard, handlePost);
