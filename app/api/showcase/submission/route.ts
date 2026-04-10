/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import { getClientIdentifier } from "@/lib/rate-limit";
import { buildRateLimitHeaders, checkServerRateLimit } from "@/lib/rate-limit-server";
import { sanitizeDocId } from "@/lib/sanitize";
import { logger } from "@/lib/logger";
import showcaseData from "@/content/showcase.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SHOWCASE_SUBMISSION_POST_RATE_LIMIT = { windowMs: 60 * 1000, maxRequests: 20 };
const SHOWCASE_SUBMISSION_GET_RATE_LIMIT = { windowMs: 60 * 1000, maxRequests: 60 };
type ShowcaseSubmissionStatus = "pending" | "approved" | "rejected";
type ShowcaseDecisionAction = "submitted" | "approved" | "rejected" | "resubmitted";
type ShowcaseDecisionSource = "manual" | "auto" | "user";
type AdminDb = NonNullable<ReturnType<typeof getAdminDb>>;

function historyEntry(params: {
  action: ShowcaseDecisionAction;
  source: ShowcaseDecisionSource;
  by: string;
  reason?: string;
}) {
  return {
    action: params.action,
    at: Timestamp.now(),
    by: params.by,
    source: params.source,
    ...(params.reason ? { reason: params.reason } : {}),
  };
}

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

async function logShowcasePendingAgeSummary(
  db: AdminDb,
  source: "submission_created" | "submission_resubmitted"
) {
  try {
    const pendingSnapshot = await db
      .collection("showcaseSubmissions")
      .where("status", "==", "pending")
      .limit(100)
      .get();

    const pendingDates = pendingSnapshot.docs.map((doc) => {
      const data = doc.data() as { createdAt?: unknown; resubmittedAt?: unknown };
      return toIsoDate(data.resubmittedAt) || toIsoDate(data.createdAt);
    });

    logger.info("moderation_pending_age_summary", {
      metric: "pending_age_distribution",
      queue: "showcase_submissions",
      source,
      pendingCount: pendingSnapshot.size,
      ageBuckets: getPendingAgeBuckets(pendingDates),
    });
  } catch (error) {
    logger.warn("moderation_pending_age_summary_failed", {
      metric: "pending_age_distribution",
      queue: "showcase_submissions",
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
      scope: "showcase-submission-get",
      windowMs: SHOWCASE_SUBMISSION_GET_RATE_LIMIT.windowMs,
      maxRequests: SHOWCASE_SUBMISSION_GET_RATE_LIMIT.maxRequests,
      identifier: `uid:${user.uid}|ip:${getClientIdentifier(request as unknown as Request)}`,
      fallbackMode: "strict-memory",
      fallbackMaxRequests: 20,
    });
    if (!rateResult.success) {
      return NextResponse.json(
        { error: "Too many requests", retryAfterSeconds: rateResult.retryAfter },
        {
          status: rateResult.statusCode ?? 429,
          headers: buildRateLimitHeaders(
            rateResult,
            SHOWCASE_SUBMISSION_GET_RATE_LIMIT.maxRequests
          ),
        }
      );
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const snapshot = await db
      .collection("showcaseSubmissions")
      .where("userId", "==", user.uid)
      .get();

    const submissions = snapshot.docs
      .map((doc) => {
        const data = doc.data() as {
          projectId?: unknown;
          status?: unknown;
        };
        if (typeof data.projectId !== "string") return null;

        const status: ShowcaseSubmissionStatus =
          data.status === "approved"
            ? "approved"
            : data.status === "rejected"
            ? "rejected"
            : "pending";
        return {
          projectId: data.projectId,
          status,
        };
      })
      .filter((submission): submission is { projectId: string; status: ShowcaseSubmissionStatus } => submission !== null);

    return NextResponse.json({ submissions });
  } catch (error) {
    logger.logError(error, {
      endpoint: "/api/showcase/submission",
      method: "GET",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request as unknown as Request);
    const rateResult = await checkServerRateLimit(request as unknown as Request, {
      scope: "showcase-submission-post",
      windowMs: SHOWCASE_SUBMISSION_POST_RATE_LIMIT.windowMs,
      maxRequests: SHOWCASE_SUBMISSION_POST_RATE_LIMIT.maxRequests,
      identifier: `ip:${clientId}`,
      fallbackMode: "strict-memory",
      fallbackMaxRequests: 5,
    });
    if (!rateResult.success) {
      return NextResponse.json(
        { error: "Too many requests", retryAfterSeconds: rateResult.retryAfter },
        {
          status: rateResult.statusCode ?? 429,
          headers: buildRateLimitHeaders(
            rateResult,
            SHOWCASE_SUBMISSION_POST_RATE_LIMIT.maxRequests
          ),
        }
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

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }
    const sanitizedProjectId = sanitizeDocId(
      typeof body.projectId === "string" ? body.projectId : ""
    );
    if (!sanitizedProjectId) {
      return NextResponse.json({ error: "Invalid projectId" }, { status: 400 });
    }

    const projectExists = (showcaseData.projects || []).some(
      (project) => project.id === sanitizedProjectId
    );
    if (!projectExists) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const docId = `${user.uid}_${sanitizedProjectId}`;
    const submissionRef = db.collection("showcaseSubmissions").doc(docId);
    const existing = await submissionRef.get();

    if (existing.exists) {
      const existingData = existing.data() as { status?: unknown } | undefined;
      const status: ShowcaseSubmissionStatus =
        existingData?.status === "approved"
          ? "approved"
          : existingData?.status === "rejected"
          ? "rejected"
          : "pending";

      if (status === "rejected") {
        await submissionRef.set(
          {
            status: "pending",
            updatedAt: FieldValue.serverTimestamp(),
            resubmittedAt: FieldValue.serverTimestamp(),
            decisionSource: "user",
            decisionHistory: FieldValue.arrayUnion(
              historyEntry({
                action: "resubmitted",
                source: "user",
                by: user.uid,
              })
            ),
          },
          { merge: true }
        );
        await logShowcasePendingAgeSummary(db, "submission_resubmitted");

        return NextResponse.json({
          created: false,
          resubmitted: true,
          projectId: sanitizedProjectId,
          status: "pending" as ShowcaseSubmissionStatus,
        });
      }

      return NextResponse.json({
        created: false,
        projectId: sanitizedProjectId,
        status,
      });
    }

    const autoApproved = Boolean(user.isAdmin);
    const submittedEvent = historyEntry({
      action: "submitted",
      source: "user",
      by: user.uid,
    });
    const approvedEvent = autoApproved
      ? historyEntry({
          action: "approved",
          source: "auto",
          by: user.uid,
        })
      : null;

    await submissionRef.set({
      userId: user.uid,
      projectId: sanitizedProjectId,
      status: autoApproved ? "approved" : "pending",
      createdAt: FieldValue.serverTimestamp(),
      decisionHistory: approvedEvent
        ? [submittedEvent, approvedEvent]
        : [submittedEvent],
      ...(autoApproved
        ? {
            approvedAt: FieldValue.serverTimestamp(),
            decisionSource: "auto",
            approvedBy: user.uid,
          }
        : {}),
    });

    if (!autoApproved) {
      await logShowcasePendingAgeSummary(db, "submission_created");
    }

    return NextResponse.json({
      created: true,
      projectId: sanitizedProjectId,
      status: (autoApproved ? "approved" : "pending") as ShowcaseSubmissionStatus,
    });
  } catch (error) {
    logger.logError(error, {
      endpoint: "/api/showcase/submission",
      method: "POST",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
