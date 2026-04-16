/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * Rebuilds read-heavy Firestore snapshots (analytics summary, public members directory).
 * Invoke via cron or CLI with CRON_SECRET — never from user browsers.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { logger } from "@/lib/logger";
import {
  computeAnalyticsSummary,
  ANALYTICS_SNAPSHOT_CACHE_TTL_MS,
} from "@/lib/analytics-snapshot-compute";
import {
  computePublicMembersSnapshot,
  MEMBERS_SNAPSHOT_CACHE_TTL_MS,
} from "@/lib/members-public-snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET;

function getCronSecret(request: NextRequest): string | null {
  return (
    request.headers.get("x-cron-secret") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    null
  );
}

async function handleRebuild(request: NextRequest): Promise<NextResponse> {
  const invocationId = crypto.randomUUID();

  if (!CRON_SECRET) {
    logger.error("Snapshots rebuild rejected: CRON_SECRET missing", {
      endpoint: "/api/internal/snapshots/rebuild",
      invocationId,
    });
    return NextResponse.json(
      { error: "Server not configured: CRON_SECRET not set" },
      { status: 500 }
    );
  }

  const secret = getCronSecret(request);
  if (!secret || secret !== CRON_SECRET) {
    logger.warn("Snapshots rebuild unauthorized", {
      endpoint: "/api/internal/snapshots/rebuild",
      invocationId,
    });
    return NextResponse.json(
      { error: "Unauthorized: Invalid or missing cron secret" },
      { status: 401 }
    );
  }

  const db = getAdminDb();
  if (!db) {
    logger.error("Snapshots rebuild failed: admin db unavailable", {
      endpoint: "/api/internal/snapshots/rebuild",
      invocationId,
    });
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const only = request.nextUrl.searchParams.get("only");
  let runAnalytics = !only || only === "analytics" || only === "all";
  let runMembers = !only || only === "members" || only === "all";

  try {
    const result: {
      analytics?: { ok: boolean; error?: string };
      members?: { ok: boolean; count?: number; error?: string };
    } = {};

    // Skip rebuild if the existing snapshot is still fresh (avoids redundant
    // full-collection scans when cron fires or endpoint is hit multiple times).
    const FRESHNESS_MS = 5 * 60 * 60 * 1000; // 5 hours (cron runs every 6h)
    const force = request.nextUrl.searchParams.get("force") === "true";

    if (runAnalytics) {
      try {
        if (!force) {
          const existing = await db.collection("analytics_snapshots").doc("latest").get();
          const updatedAt = existing.data()?.updatedAt;
          if (updatedAt && (Date.now() - new Date(updatedAt.toDate?.() ?? updatedAt).getTime()) < FRESHNESS_MS) {
            result.analytics = { ok: true, error: "skipped: snapshot still fresh" };
            runAnalytics = false;
          }
        }
        if (runAnalytics) {
          const summary = await computeAnalyticsSummary(db);
          const expiresAt = new Date(Date.now() + ANALYTICS_SNAPSHOT_CACHE_TTL_MS);
          await db.collection("analytics_snapshots").doc("latest").set({
            summary,
            expiresAt,
            updatedAt: new Date(),
          });
          result.analytics = { ok: true };
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logger.logError(e, { endpoint: "/api/internal/snapshots/rebuild", phase: "analytics" });
        result.analytics = { ok: false, error: msg };
      }
    }

    if (runMembers) {
      try {
        if (!force) {
          const existing = await db.collection("members_snapshots").doc("latest").get();
          const updatedAt = existing.data()?.updatedAt;
          if (updatedAt && (Date.now() - new Date(updatedAt.toDate?.() ?? updatedAt).getTime()) < FRESHNESS_MS) {
            result.members = { ok: true, error: "skipped: snapshot still fresh" };
            runMembers = false;
          }
        }
        if (runMembers) {
          const members = await computePublicMembersSnapshot(db);
          const expiresAt = new Date(Date.now() + MEMBERS_SNAPSHOT_CACHE_TTL_MS);
          await db.collection("members_snapshots").doc("latest").set({
            members,
            expiresAt,
            updatedAt: new Date(),
          });
          result.members = { ok: true, count: members.length };
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logger.logError(e, { endpoint: "/api/internal/snapshots/rebuild", phase: "members" });
        result.members = { ok: false, error: msg };
      }
    }

    const ok =
      (!runAnalytics || result.analytics?.ok) && (!runMembers || result.members?.ok);
    return NextResponse.json({ ok, invocationId, ...result }, { status: ok ? 200 : 500 });
  } catch (error) {
    logger.logError(error, { endpoint: "/api/internal/snapshots/rebuild", invocationId });
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error), invocationId },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return handleRebuild(request);
}

/** Vercel Cron and some runners issue GET. */
export async function GET(request: NextRequest) {
  return handleRebuild(request);
}
