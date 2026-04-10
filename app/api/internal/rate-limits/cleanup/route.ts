/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CRON_SECRET = process.env.CRON_SECRET;
const DEFAULT_BATCH_SIZE = 500;
const MAX_BATCH_SIZE = 500;
const DEFAULT_MAX_BATCHES = 5;
const MAX_MAX_BATCHES = 20;

function getCronSecret(request: NextRequest): string | null {
  return (
    request.headers.get("x-cron-secret") ||
    request.headers.get("authorization")?.replace("Bearer ", "") ||
    null
  );
}

// Internal maintenance endpoint. Use cron/job runner with CRON_SECRET.
export async function POST(request: NextRequest) {
  try {
    const invocationId = crypto.randomUUID();
    if (!CRON_SECRET) {
      logger.error("Rate limit cleanup rejected: CRON_SECRET missing", {
        endpoint: "/api/internal/rate-limits/cleanup",
        invocationId,
      });
      return NextResponse.json(
        { error: "Server not configured: CRON_SECRET not set" },
        { status: 500 }
      );
    }

    const cronSecret = getCronSecret(request);
    if (!cronSecret || cronSecret !== CRON_SECRET) {
      logger.warn("Rate limit cleanup unauthorized invocation", {
        endpoint: "/api/internal/rate-limits/cleanup",
        invocationId,
      });
      return NextResponse.json(
        { error: "Unauthorized: Invalid or missing cron secret" },
        { status: 401 }
      );
    }

    const db = getAdminDb();
    if (!db) {
      logger.error("Rate limit cleanup failed: admin db unavailable", {
        endpoint: "/api/internal/rate-limits/cleanup",
        invocationId,
      });
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const batchSize = Math.min(
      Math.max(Number(request.nextUrl.searchParams.get("batchSize")) || DEFAULT_BATCH_SIZE, 1),
      MAX_BATCH_SIZE
    );
    const maxBatches = Math.min(
      Math.max(Number(request.nextUrl.searchParams.get("maxBatches")) || DEFAULT_MAX_BATCHES, 1),
      MAX_MAX_BATCHES
    );
    const dryRun = request.nextUrl.searchParams.get("dryRun") === "true";

    const now = Timestamp.now();
    let totalDeleted = 0;
    let totalMatched = 0;
    let batchesProcessed = 0;
    let hasMore = false;

    for (let i = 0; i < maxBatches; i++) {
      const snapshot = await db
        .collection("apiRateLimits")
        .where("expiresAt", "<=", now)
        .orderBy("expiresAt", "asc")
        .limit(batchSize)
        .get();

      if (snapshot.empty) {
        hasMore = false;
        break;
      }

      batchesProcessed++;
      totalMatched += snapshot.size;

      if (!dryRun) {
        const batch = db.batch();
        snapshot.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
      }

      totalDeleted += dryRun ? 0 : snapshot.size;
      hasMore = snapshot.size === batchSize;

      if (snapshot.size < batchSize) {
        hasMore = false;
        break;
      }
    }

    const response = {
      success: true,
      invocationId,
      dryRun,
      totalMatched,
      totalDeleted,
      batchesProcessed,
      batchSize,
      maxBatches,
      hasMore,
      cleanedAt: new Date().toISOString(),
    };
    logger.info("Rate limit cleanup completed", {
      endpoint: "/api/internal/rate-limits/cleanup",
      ...response,
    });
    return NextResponse.json(response);
  } catch {
    logger.error("Rate limit cleanup failed with exception", {
      endpoint: "/api/internal/rate-limits/cleanup",
    });
    return NextResponse.json({ error: "Failed to clean rate limit records" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed. Use POST for internal maintenance cleanup." },
    { status: 405 }
  );
}
