import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import { getClientIdentifier } from "@/lib/rate-limit";
import { buildRateLimitHeaders, checkServerRateLimit } from "@/lib/rate-limit-server";
import { sanitizeDocId } from "@/lib/sanitize";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const SHOWCASE_SUBMISSION_APPROVE_RATE_LIMIT = { windowMs: 60 * 1000, maxRequests: 30 };
const SHOWCASE_SUBMISSION_APPROVE_GET_RATE_LIMIT = { windowMs: 60 * 1000, maxRequests: 60 };
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
  source: "queue_read" | "moderation_approved" | "moderation_rejected"
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
      scope: "showcase-submission-approve-get",
      windowMs: SHOWCASE_SUBMISSION_APPROVE_GET_RATE_LIMIT.windowMs,
      maxRequests: SHOWCASE_SUBMISSION_APPROVE_GET_RATE_LIMIT.maxRequests,
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
            SHOWCASE_SUBMISSION_APPROVE_GET_RATE_LIMIT.maxRequests
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

    const pendingSnapshot = await db
      .collection("showcaseSubmissions")
      .where("status", "==", "pending")
      .limit(100)
      .get();

    const pendingSubmissions = pendingSnapshot.docs.map((doc) => {
      const data = doc.data() as {
        userId?: unknown;
        projectId?: unknown;
        createdAt?: unknown;
        resubmittedAt?: unknown;
      };
      return {
        submissionId: doc.id,
        userId: typeof data.userId === "string" ? data.userId : "",
        projectId: typeof data.projectId === "string" ? data.projectId : "",
        createdAt: toIsoDate(data.createdAt),
        resubmittedAt: toIsoDate(data.resubmittedAt),
      };
    });

    await logShowcasePendingAgeSummary(db, "queue_read");

    return NextResponse.json({ pendingSubmissions });
  } catch (error) {
    logger.logError(error, {
      endpoint: "/api/showcase/submission/approve",
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
      scope: "showcase-submission-approve-post",
      windowMs: SHOWCASE_SUBMISSION_APPROVE_RATE_LIMIT.windowMs,
      maxRequests: SHOWCASE_SUBMISSION_APPROVE_RATE_LIMIT.maxRequests,
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
            SHOWCASE_SUBMISSION_APPROVE_RATE_LIMIT.maxRequests
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
    const action = body.action === "reject" ? "reject" : "approve";
    const reason =
      typeof body.reason === "string" && body.reason.trim()
        ? body.reason.trim()
        : undefined;
    if (!submissionId) {
      return NextResponse.json({ error: "Invalid submissionId" }, { status: 400 });
    }

    const submissionRef = db.collection("showcaseSubmissions").doc(submissionId);
    const snapshot = await submissionRef.get();
    if (!snapshot.exists) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    const existing = snapshot.data() as {
      status?: unknown;
      approvedAt?: unknown;
      decisionSource?: unknown;
      approvalSource?: unknown;
      approvedBy?: unknown;
    };
    if (existing.status === "approved") {
      return NextResponse.json({
        approved: true,
        alreadyApproved: true,
        submissionId,
        status: "approved",
        approvedAt:
          existing.approvedAt && typeof existing.approvedAt === "object" &&
          typeof (existing.approvedAt as { toDate?: () => Date }).toDate === "function"
            ? (existing.approvedAt as { toDate: () => Date }).toDate().toISOString()
            : undefined,
        decisionSource:
          typeof existing.decisionSource === "string"
            ? existing.decisionSource
            : typeof existing.approvalSource === "string"
            ? existing.approvalSource
            : undefined,
        approvedBy:
          typeof existing.approvedBy === "string" ? existing.approvedBy : undefined,
      });
    }

    if (action === "reject") {
      await submissionRef.set(
        {
          status: "rejected",
          rejectedAt: FieldValue.serverTimestamp(),
          rejectedBy: user.uid,
          decisionSource: "manual",
          decisionHistory: FieldValue.arrayUnion(
            historyEntry({
              action: "rejected",
              source: "manual",
              by: user.uid,
              reason,
            })
          ),
        },
        { merge: true }
      );

      logger.info("moderation_action", {
        metric: "moderation_approval_throughput",
        entityType: "showcase_submission",
        action: "reject",
        resultStatus: "rejected",
        submissionId,
        moderatorUid: user.uid,
      });
      await logShowcasePendingAgeSummary(db, "moderation_rejected");

      return NextResponse.json({
        approved: false,
        rejected: true,
        submissionId,
        status: "rejected",
      });
    }

    await submissionRef.set(
      {
        status: "approved",
        approvedAt: FieldValue.serverTimestamp(),
        decisionSource: "manual",
        approvedBy: user.uid,
        decisionHistory: FieldValue.arrayUnion(
          historyEntry({
            action: "approved",
            source: "manual",
            by: user.uid,
            reason,
          })
        ),
      },
      { merge: true }
    );

    logger.info("moderation_action", {
      metric: "moderation_approval_throughput",
      entityType: "showcase_submission",
      action: "approve",
      resultStatus: "approved",
      submissionId,
      moderatorUid: user.uid,
    });
    await logShowcasePendingAgeSummary(db, "moderation_approved");

    return NextResponse.json({
      approved: true,
      submissionId,
      status: "approved",
    });
  } catch (error) {
    logger.logError(error, {
      endpoint: "/api/showcase/submission/approve",
      method: "POST",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
