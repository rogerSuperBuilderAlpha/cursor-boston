/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * POST /api/community/moderate
 *
 * Admin-only endpoint that resolves a `communityReports` doc.
 * Actions:
 *   - dismiss   → mark report status: "dismissed"
 *   - hide      → set communityMessages/{id}.hidden = true
 *   - suspend   → set users/{authorId}.suspended = true
 *
 * Feed-side filtering (skipping `hidden` messages or `suspended` users
 * in feed queries) is a follow-up; see TODO at end of file.
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import { logger } from "@/lib/logger";
import { parseRequestBody } from "@/lib/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_ACTIONS = new Set(["dismiss", "hide", "suspend"]);
const LIST_PAGE_SIZE = 50;

/**
 * GET /api/community/moderate
 * Admin-only: list open reports ordered by createdAt (oldest first so the
 * queue surfaces stale items). Optional `?status=` query (defaults to
 * "open"; pass "all" to list every report).
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!user.isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const db = getAdminDb();
    if (!db) return NextResponse.json({ error: "Server not configured" }, { status: 500 });

    const status = request.nextUrl.searchParams.get("status") ?? "open";
    let query = db.collection("communityReports").orderBy("createdAt", "asc");
    if (status !== "all") {
      query = query.where("status", "==", status);
    }
    const snap = await query.limit(LIST_PAGE_SIZE).get();

    const reports = snap.docs.map((d) => {
      const data = d.data();
      return {
        reportId: d.id,
        reporterUid: data.reporterUid,
        reporterDisplayName: data.reporterDisplayName,
        targetMessageId: data.targetMessageId,
        targetAuthorId: data.targetAuthorId,
        reason: data.reason,
        notes: data.notes,
        status: data.status,
        action: data.action ?? null,
        actionedBy: data.actionedBy ?? null,
        // Convert Firestore Timestamp → ISO string for client serialization
        createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
        actionedAt: data.actionedAt?.toDate?.()?.toISOString() ?? null,
      };
    });

    return NextResponse.json({ reports });
  } catch (err) {
    logger.logError(err, { endpoint: "/api/community/moderate", area: "community-safety", method: "GET" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!user.isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const bodyOrError = await parseRequestBody(request);
    if (bodyOrError instanceof NextResponse) return bodyOrError;
    const { reportId, action } = bodyOrError;

    if (typeof reportId !== "string" || !reportId) {
      return NextResponse.json({ error: "reportId is required" }, { status: 400 });
    }
    if (typeof action !== "string" || !VALID_ACTIONS.has(action)) {
      return NextResponse.json(
        { error: `action must be one of: ${Array.from(VALID_ACTIONS).join(", ")}` },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    if (!db) return NextResponse.json({ error: "Server not configured" }, { status: 500 });

    const reportRef = db.collection("communityReports").doc(reportId);
    const reportSnap = await reportRef.get();
    if (!reportSnap.exists) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }
    const report = reportSnap.data()!;

    const batch = db.batch();
    batch.update(reportRef, {
      status: action === "dismiss" ? "dismissed" : "actioned",
      action,
      actionedBy: user.uid,
      actionedAt: FieldValue.serverTimestamp(),
    });

    if (action === "hide") {
      const messageRef = db.collection("communityMessages").doc(report.targetMessageId);
      batch.update(messageRef, {
        hidden: true,
        hiddenBy: user.uid,
        hiddenAt: FieldValue.serverTimestamp(),
        hiddenReason: report.reason,
      });
    } else if (action === "suspend") {
      const targetAuthorId = report.targetAuthorId as string | undefined;
      if (!targetAuthorId) {
        return NextResponse.json(
          { error: "Cannot suspend: report has no targetAuthorId" },
          { status: 400 }
        );
      }
      const userRef = db.collection("users").doc(targetAuthorId);
      batch.update(userRef, {
        suspended: true,
        suspendedBy: user.uid,
        suspendedAt: FieldValue.serverTimestamp(),
        suspendedReason: report.reason,
      });
    }

    await batch.commit();
    return NextResponse.json({ success: true, action, reportId });
  } catch (err) {
    logger.logError(err, { endpoint: "/api/community/moderate", area: "community-safety" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// TODO(P1 follow-up): filter community feed queries to exclude messages
// where `hidden == true` and posts where the author has
// `suspended == true`. Lives in the feed-fetcher module. Tracked
// separately under Chunk D follow-up.
