/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import { logger } from "@/lib/logger";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { sanitizeText, sanitizeDocId } from "@/lib/sanitize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APPLY_RATE_LIMIT = { windowMs: 60 * 1000, maxRequests: 3 };

/** Submits an application for a job listing. Authenticated users only. */
export async function POST(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request as unknown as Request);
    const rateResult = checkRateLimit(`careers-apply:${clientId}`, APPLY_RATE_LIMIT);
    if (!rateResult.success) {
      return NextResponse.json(
        { error: "Too many requests", retryAfterSeconds: rateResult.retryAfter },
        { status: 429, headers: { "Retry-After": String(rateResult.retryAfter || 60) } }
      );
    }

    const user = await getVerifiedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const rawBody = await request.json();
    if (typeof rawBody !== "object" || rawBody === null) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const body = rawBody as Record<string, unknown>;

    const rawJobId = typeof body.jobId === "string" ? body.jobId.trim() : "";
    const jobId = sanitizeDocId(rawJobId);
    if (!jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }

    const name = sanitizeText(String(body.name ?? "")).slice(0, 100);
    const email = sanitizeText(String(body.email ?? "")).slice(0, 254);
    const message = sanitizeText(String(body.message ?? "")).slice(0, 2000);

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "name, email, and message are required" },
        { status: 400 }
      );
    }

    // Validate job exists and is active
    const jobDoc = await db.collection("jobListings").doc(jobId).get();
    if (!jobDoc.exists || jobDoc.data()?.status !== "active") {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Prevent duplicate applications
    const duplicateSnap = await db
      .collection("applications")
      .where("jobId", "==", jobId)
      .where("userId", "==", user.uid)
      .limit(1)
      .get();

    if (!duplicateSnap.empty) {
      return NextResponse.json(
        { error: "You have already applied to this job" },
        { status: 409 }
      );
    }

    const application = {
      jobId,
      userId: user.uid,
      name,
      email,
      message,
      appliedAt: FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection("applications").add(application);

    return NextResponse.json({
      applicationId: docRef.id,
      appliedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.logError(error, { endpoint: "/api/careers/apply POST" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
