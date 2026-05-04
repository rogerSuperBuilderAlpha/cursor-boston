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
import {
  PYDATA_2026_REGISTRATIONS_COLLECTION,
  validatePydataRegistration,
  type PydataRegistration,
  type PydataRegistrationStatus,
} from "@/lib/pydata-2026";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function tsToMs(value: unknown): number | null {
  if (value && typeof (value as { toMillis?: () => number }).toMillis === "function") {
    return (value as { toMillis: () => number }).toMillis();
  }
  return null;
}

function serializeDoc(uid: string, data: Record<string, unknown>): PydataRegistration | null {
  const createdMs = tsToMs(data.createdAt);
  const updatedMs = tsToMs(data.updatedAt);
  if (createdMs === null) return null;
  const status = (typeof data.status === "string" ? data.status : "awaiting-badge") as
    | PydataRegistrationStatus
    | string;
  return {
    uid,
    firstName: typeof data.firstName === "string" ? data.firstName : "",
    lastName: typeof data.lastName === "string" ? data.lastName : "",
    email: typeof data.email === "string" ? data.email : "",
    organization: typeof data.organization === "string" ? data.organization : "",
    attendingConfirmed: true,
    status: (["awaiting-badge", "badge-ready", "checked-in", "cancelled"].includes(status)
      ? status
      : "awaiting-badge") as PydataRegistrationStatus,
    createdAt: createdMs,
    updatedAt: updatedMs ?? createdMs,
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
    .collection(PYDATA_2026_REGISTRATIONS_COLLECTION)
    .doc(user.uid)
    .get();
  if (!snap.exists) {
    return NextResponse.json({ registered: false, registration: null });
  }
  const reg = serializeDoc(user.uid, snap.data() || {});
  return NextResponse.json({
    registered: reg !== null,
    registration: reg,
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

  const result = validatePydataRegistration(body);
  if (!result.ok) {
    return NextResponse.json(
      { error: "Validation failed", missingFields: result.errors },
      { status: 400 }
    );
  }

  const docRef = db.collection(PYDATA_2026_REGISTRATIONS_COLLECTION).doc(user.uid);
  const existing = await docRef.get();
  const isFirstSubmission = !existing.exists;

  await docRef.set(
    {
      ...result.data,
      uid: user.uid,
      // Preserve original createdAt + status across edits.
      ...(isFirstSubmission
        ? {
            createdAt: FieldValue.serverTimestamp(),
            status: "awaiting-badge",
          }
        : {}),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  logger.info("[pydata-2026/registration] submission", {
    uid: user.uid,
    isFirstSubmission,
    email: result.data.email,
  });

  return NextResponse.json({ ok: true, isFirstSubmission });
}

export const GET = withMiddleware(rateLimitConfigs.standard, handleGet);
export const POST = withMiddleware(rateLimitConfigs.standard, handlePost);
