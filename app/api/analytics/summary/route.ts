/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { logger } from "@/lib/logger";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import type { AnalyticsSummary } from "@/lib/analytics-snapshot-compute";
import { EMPTY_ANALYTICS_SUMMARY } from "@/lib/analytics-snapshot-compute";

const RATE_LIMIT = { windowMs: 60 * 1000, maxRequests: 60 };

/** Re-export type for consumers (e.g. AnalyticsDashboard). */
export type { AnalyticsSummary };

const cacheHeaders = {
  "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
};

export async function GET(request: NextRequest) {
  const clientId = getClientIdentifier(request as unknown as Request);
  const rateResult = checkRateLimit(`analytics-summary:${clientId}`, RATE_LIMIT);
  if (!rateResult.success) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSeconds: rateResult.retryAfter },
      { status: 429, headers: { "Retry-After": String(rateResult.retryAfter || 60) } }
    );
  }

  let db;
  try {
    db = getAdminDb();
  } catch (initError) {
    logger.logError(initError, { endpoint: "/api/analytics/summary", phase: "init" });
    return NextResponse.json(
      { ...EMPTY_ANALYTICS_SUMMARY, generatedAt: new Date().toISOString() },
      { headers: cacheHeaders }
    );
  }

  if (!db) {
    return NextResponse.json(
      { ...EMPTY_ANALYTICS_SUMMARY, generatedAt: new Date().toISOString() },
      { headers: cacheHeaders }
    );
  }

  try {
    const cacheRef = db.collection("analytics_snapshots").doc("latest");
    const cacheDoc = await cacheRef.get();

    if (!cacheDoc.exists) {
      return NextResponse.json(
        { ...EMPTY_ANALYTICS_SUMMARY, generatedAt: new Date().toISOString() },
        { headers: cacheHeaders }
      );
    }

    const cached = cacheDoc.data();
    const summary = cached?.summary as AnalyticsSummary | undefined;
    if (!summary || typeof summary !== "object") {
      return NextResponse.json(
        { ...EMPTY_ANALYTICS_SUMMARY, generatedAt: new Date().toISOString() },
        { headers: cacheHeaders }
      );
    }

    const expiresAt = cached?.expiresAt?.toDate ? (cached.expiresAt.toDate() as Date) : null;
    const isStale = !expiresAt || expiresAt <= new Date();
    const headers: Record<string, string> = { ...cacheHeaders };
    if (isStale) {
      headers["X-Analytics-Snapshot-Stale"] = "true";
    }

    return NextResponse.json(summary, { headers });
  } catch (error) {
    logger.logError(error, { endpoint: "/api/analytics/summary" });
    return NextResponse.json(
      { ...EMPTY_ANALYTICS_SUMMARY, generatedAt: new Date().toISOString() },
      { headers: cacheHeaders }
    );
  }
}
