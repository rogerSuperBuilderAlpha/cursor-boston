/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import { getClientIdentifier } from "@/lib/rate-limit";
import { buildRateLimitHeaders, checkServerRateLimit } from "@/lib/rate-limit-server";
import { sanitizeDocId } from "@/lib/sanitize";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const TALK_SUBMISSION_MODERATE_GET_RATE_LIMIT = { windowMs: 60 * 1000, maxRequests: 60 };
const TALK_SUBMISSION_MODERATE_POST_RATE_LIMIT = { windowMs: 60 * 1000, maxRequests: 30 };

type TalkModerationAction = "approve" | "complete";
type AdminDb = NonNullable<ReturnType<typeof getAdminDb>>;

function toIsoDate(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const timestamp = value as { toDate?: () => Date };
  if (typeof timestamp.toDate !== "function") return undefined;
  return timestamp.toDate().toISOString();
}

function getPendingAgeBuckets(isoDates: Array<string | undefined>): Record<string, number> {
  const now = Date.now();
  const buckets = {
    lt1d: 0,
    d1to3: 0,
    d3to7: 0,
    d7plus: 0,
    unknown: 0,
  };

  for (const iso of isoDates) {
    if (!iso) {
      buckets.unknown += 1;
      continue;
    }

    const parsed = Date.parse(iso);
    if (Number.isNaN(parsed)) {
      buckets.unknown += 1;
      continue;
    }

    const ageMs = Math.max(0, now - parsed);
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    if (ageDays < 1) {
      buckets.lt1d += 1;
    } else if (ageDays < 3) {
      buckets.d1to3 += 1;
    } else if (ageDays < 7) {
      buckets.d3to7 += 1;
    } else {
      buckets.d7plus += 1;
    }
  }

  return buckets;
}

async function logTalkPendingAgeSummary(
  db: AdminDb,
  source: "queue_read" | "moderation_approved" | "moderation_completed"
) {
  try {
    const pendingSnapshot = await db
      .collection("talkSubmissions")
      .where("status", "==", "pending")
      .limit(100)
      .get();

    const pendingDates = pendingSnapshot.docs.map((doc) => {
      const data = doc.data() as { createdAt?: unknown };
      return toIsoDate(data.createdAt);
    });

    logger.info("moderation_pending_age_summary", {
      metric: "pending_age_distribution",
      queue: "talk_submissions",
      source,
      pendingCount: pendingSnapshot.size,
      ageBuckets: getPendingAgeBuckets(pendingDates),
    });
  } catch (error) {
    logger.warn("moderation_pending_age_summary_failed", {
      metric: "pending_age_distribution",
      queue: "talk_submissions",
      source,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateResult = await checkServerRateLimit(request as unknown as Request, {
      scope: "talk-submission-moderate-get",
      windowMs: TALK_SUBMISSION_MODERATE_GET_RATE_LIMIT.windowMs,
      maxRequests: TALK_SUBMISSION_MODERATE_GET_RATE_LIMIT.maxRequests,
      identifier: `uid:${user.uid}|ip:${getClientIdentifier(request as unknown as Request)}`,
      fallbackMode: "deny",
    });
    if (!rateResult.success) {
      return NextResponse.json(
        {
          error:
            rateResult.statusCode === 503
              ? "Rate limit service unavailable"
              : "Too many requests",
          retryAfterSeconds: rateResult.retryAfter,
        },
        {
          status: rateResult.statusCode ?? 429,
          headers: buildRateLimitHeaders(
            rateResult,
            TALK_SUBMISSION_MODERATE_GET_RATE_LIMIT.maxRequests
          ),
        }
      );
    }

    if (!user.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const [pendingSnapshot, approvedSnapshot, completedSnapshot] = await Promise.all([
      db.collection("talkSubmissions").where("status", "==", "pending").limit(100).get(),
      db.collection("talkSubmissions").where("status", "==", "approved").limit(100).get(),
      db.collection("talkSubmissions").where("status", "==", "completed").limit(100).get(),
    ]);

    const talkSubmissions = [...pendingSnapshot.docs, ...approvedSnapshot.docs, ...completedSnapshot.docs]
      .map((doc) => {
        const data = doc.data() as {
          userId?: unknown;
          title?: unknown;
          status?: unknown;
          createdAt?: unknown;
        };
        const status =
          data.status === "approved"
            ? "approved"
            : data.status === "completed"
            ? "completed"
            : data.status === "pending"
            ? "pending"
            : "unknown";

        return {
          submissionId: doc.id,
          userId: typeof data.userId === "string" ? data.userId : "",
          title: typeof data.title === "string" ? data.title : "",
          status,
          createdAt: toIsoDate(data.createdAt),
        };
      });

    await logTalkPendingAgeSummary(db, "queue_read");

    return NextResponse.json({ talkSubmissions });
  } catch (error) {
    logger.logError(error, {
      endpoint: "/api/talks/submission/moderate",
      method: "GET",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateResult = await checkServerRateLimit(request as unknown as Request, {
      scope: "talk-submission-moderate-post",
      windowMs: TALK_SUBMISSION_MODERATE_POST_RATE_LIMIT.windowMs,
      maxRequests: TALK_SUBMISSION_MODERATE_POST_RATE_LIMIT.maxRequests,
      identifier: `uid:${user.uid}|ip:${getClientIdentifier(request as unknown as Request)}`,
      fallbackMode: "deny",
    });
    if (!rateResult.success) {
      return NextResponse.json(
        {
          error:
            rateResult.statusCode === 503
              ? "Rate limit service unavailable"
              : "Too many requests",
          retryAfterSeconds: rateResult.retryAfter,
        },
        {
          status: rateResult.statusCode ?? 429,
          headers: buildRateLimitHeaders(
            rateResult,
            TALK_SUBMISSION_MODERATE_POST_RATE_LIMIT.maxRequests
          ),
        }
      );
    }

    if (!user.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }
    const submissionId = sanitizeDocId(
      typeof body.submissionId === "string" ? body.submissionId : ""
    );
    const action: TalkModerationAction = body.action === "complete" ? "complete" : "approve";
    if (!submissionId) {
      return NextResponse.json({ error: "Invalid submissionId" }, { status: 400 });
    }

    const submissionRef = db.collection("talkSubmissions").doc(submissionId);
    const snapshot = await submissionRef.get();
    if (!snapshot.exists) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    const existing = snapshot.data() as { status?: unknown };

    if (action === "approve") {
      if (existing.status === "approved") {
        return NextResponse.json({
          approved: true,
          alreadyApproved: true,
          submissionId,
          status: "approved",
        });
      }

      if (existing.status === "completed") {
        return NextResponse.json({
          approved: true,
          alreadyCompleted: true,
          submissionId,
          status: "completed",
        });
      }

      await submissionRef.set(
        {
          status: "approved",
          approvedAt: FieldValue.serverTimestamp(),
          approvedBy: user.uid,
        },
        { merge: true }
      );

      logger.info("moderation_action", {
        metric: "moderation_approval_throughput",
        entityType: "talk_submission",
        action: "approve",
        resultStatus: "approved",
        submissionId,
        moderatorUid: user.uid,
      });
      await logTalkPendingAgeSummary(db, "moderation_approved");

      return NextResponse.json({
        approved: true,
        submissionId,
        status: "approved",
      });
    }

    if (existing.status !== "approved") {
      return NextResponse.json(
        { error: "Talk submission must be approved before marking delivered." },
        { status: 400 }
      );
    }

    await submissionRef.set(
      {
        status: "completed",
        completedAt: FieldValue.serverTimestamp(),
        completedBy: user.uid,
      },
      { merge: true }
    );

    logger.info("moderation_action", {
      metric: "moderation_approval_throughput",
      entityType: "talk_submission",
      action: "complete",
      resultStatus: "completed",
      submissionId,
      moderatorUid: user.uid,
    });
    await logTalkPendingAgeSummary(db, "moderation_completed");

    return NextResponse.json({
      approved: true,
      submissionId,
      status: "completed",
    });
  } catch (error) {
    logger.logError(error, {
      endpoint: "/api/talks/submission/moderate",
      method: "POST",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
