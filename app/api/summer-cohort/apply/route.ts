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
  SUMMER_COHORT_COLLECTION,
  SUMMER_COHORT_SITE_ID,
  isValidCohortId,
  type SummerCohortId,
} from "@/lib/summer-cohort";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_NAME = 200;
const MAX_PHONE = 50;

function serializeApplication(data: Record<string, unknown>) {
  const createdAt = data.createdAt;
  const updatedAt = data.updatedAt;
  return {
    userId: data.userId ?? null,
    email: data.email ?? null,
    name: data.name ?? null,
    phone: data.phone ?? null,
    cohorts: Array.isArray(data.cohorts) ? data.cohorts : [],
    siteId: data.siteId ?? null,
    status: data.status ?? "pending",
    createdAt:
      createdAt && typeof (createdAt as { toMillis?: () => number }).toMillis === "function"
        ? (createdAt as { toMillis: () => number }).toMillis()
        : null,
    updatedAt:
      updatedAt && typeof (updatedAt as { toMillis?: () => number }).toMillis === "function"
        ? (updatedAt as { toMillis: () => number }).toMillis()
        : null,
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

  const snap = await db.collection(SUMMER_COHORT_COLLECTION).doc(user.uid).get();
  if (!snap.exists) {
    return NextResponse.json({ application: null });
  }
  return NextResponse.json({ application: serializeApplication(snap.data() || {}) });
}

async function handlePost(request: NextRequest) {
  const user = await getVerifiedUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!user.email) {
    return NextResponse.json(
      { error: "Your account is missing an email address." },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = (body || {}) as Record<string, unknown>;
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  const phone = typeof raw.phone === "string" ? raw.phone.trim() : "";
  const cohortsInput = Array.isArray(raw.cohorts) ? raw.cohorts : [];

  if (!name || name.length > MAX_NAME) {
    return NextResponse.json(
      { error: `Name is required and must be 1-${MAX_NAME} characters.` },
      { status: 400 }
    );
  }
  if (!phone || phone.length > MAX_PHONE) {
    return NextResponse.json(
      { error: `Phone is required and must be 1-${MAX_PHONE} characters.` },
      { status: 400 }
    );
  }

  const cohorts: SummerCohortId[] = [];
  const seen = new Set<SummerCohortId>();
  for (const value of cohortsInput) {
    if (isValidCohortId(value) && !seen.has(value)) {
      seen.add(value);
      cohorts.push(value);
    }
  }
  if (cohorts.length === 0) {
    return NextResponse.json(
      { error: "Pick at least one cohort." },
      { status: 400 }
    );
  }

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  try {
    const ref = db.collection(SUMMER_COHORT_COLLECTION).doc(user.uid);
    const existing = await ref.get();
    const baseFields = {
      userId: user.uid,
      email: user.email,
      name,
      phone,
      cohorts,
      siteId: SUMMER_COHORT_SITE_ID,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (existing.exists) {
      await ref.set(baseFields, { merge: true });
    } else {
      await ref.set({
        ...baseFields,
        status: "pending",
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    const fresh = await ref.get();
    return NextResponse.json({ application: serializeApplication(fresh.data() || {}) });
  } catch (error) {
    logger.logError(error, {
      endpoint: "/api/summer-cohort/apply",
      method: "POST",
    });
    return NextResponse.json(
      { error: "Failed to save application" },
      { status: 500 }
    );
  }
}

export const GET = withMiddleware(rateLimitConfigs.standard, handleGet);
export const POST = withMiddleware(rateLimitConfigs.standard, handlePost);
