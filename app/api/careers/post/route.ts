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
import { sanitizeText, sanitizeUrl } from "@/lib/sanitize";
import { JOB_TYPES, EXPERIENCE_LEVELS, type JobType, type ExperienceLevel } from "@/types/careers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POST_RATE_LIMIT = { windowMs: 60 * 1000, maxRequests: 5 };

/** Creates a new job listing. Admin-only. */
export async function POST(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request as unknown as Request);
    const rateResult = checkRateLimit(`careers-post:${clientId}`, POST_RATE_LIMIT);
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
    if (!user.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

    const title = sanitizeText(String(body.title ?? "")).slice(0, 200);
    const company = sanitizeText(String(body.company ?? "")).slice(0, 100);
    const description = sanitizeText(String(body.description ?? "")).slice(0, 5000);
    const location = sanitizeText(String(body.location ?? "")).slice(0, 200);
    const rawType = String(body.type ?? "");
    const rawExperience = String(body.experienceLevel ?? "");

    if (!title || !company || !description || !location) {
      return NextResponse.json(
        { error: "title, company, description, and location are required" },
        { status: 400 }
      );
    }

    const type: JobType = JOB_TYPES.includes(rawType as JobType)
      ? (rawType as JobType)
      : "full-time";
    const experienceLevel: ExperienceLevel = EXPERIENCE_LEVELS.includes(
      rawExperience as ExperienceLevel
    )
      ? (rawExperience as ExperienceLevel)
      : "any";

    const salaryMin =
      typeof body.salaryMin === "number" && body.salaryMin >= 0
        ? body.salaryMin
        : undefined;
    const salaryMax =
      typeof body.salaryMax === "number" && body.salaryMax >= 0
        ? body.salaryMax
        : undefined;

    const remote = body.remote === true;
    const featured = body.featured === true;

    const rawTags = Array.isArray(body.tags)
      ? body.tags.filter((t): t is string => typeof t === "string").slice(0, 10)
      : [];
    const tags = rawTags.map((t) => sanitizeText(t).slice(0, 50)).filter(Boolean);

    const rawApplyUrl = typeof body.applyUrl === "string" ? body.applyUrl : "";
    const applyUrl = rawApplyUrl ? sanitizeUrl(rawApplyUrl) : null;

    const listing = {
      title,
      company,
      description,
      location,
      type,
      experienceLevel,
      ...(salaryMin !== undefined && { salaryMin }),
      ...(salaryMax !== undefined && { salaryMax }),
      remote,
      tags,
      ...(applyUrl && { applyUrl }),
      postedById: user.uid,
      postedAt: FieldValue.serverTimestamp(),
      featured,
      status: "active" as const,
    };

    const docRef = await db.collection("jobListings").add(listing);

    return NextResponse.json({
      id: docRef.id,
      ...listing,
      postedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.logError(error, { endpoint: "/api/careers/post POST" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
