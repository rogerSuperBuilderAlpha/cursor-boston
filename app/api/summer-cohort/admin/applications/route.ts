/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { type NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import { isSummerCohortAdminEmail } from "@/lib/summer-cohort-admin-access";
import { summerCohortContract } from "@/lib/api-schemas/summer-cohort";
import {
  SUMMER_COHORT_COLLECTION,
  type SummerCohortId,
  type SummerCohortStatus,
} from "@/lib/summer-cohort";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_STATUSES = new Set<SummerCohortStatus>([
  "pending",
  "admitted",
  "rejected",
  "waitlist",
]);

function toMillis(value: unknown): number | null {
  if (
    value &&
    typeof (value as { toMillis?: () => number }).toMillis === "function"
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }
  return null;
}

interface AdminApplicationRow {
  userId: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  cohorts: SummerCohortId[];
  status: SummerCohortStatus;
  isLocal: boolean | null;
  wantsToPresent: boolean | null;
  createdAt: number | null;
  updatedAt: number | null;
}

/**
 * GET /api/summer-cohort/admin/applications
 *   ?cohortId=cohort-1|cohort-2 (optional — filter to one cohort)
 *   ?status=pending|admitted|rejected|waitlist|all (default all)
 *
 * Admin only. Returns full application docs (PII included) so admins can
 * triage in one place.
 */
export async function GET(request: NextRequest) {
  const user = await getVerifiedUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSummerCohortAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const params = request.nextUrl.searchParams;
  const parsedQuery = summerCohortContract.adminApplications.query.safeParse({
    cohortId: params.get("cohortId") ?? undefined,
    status: params.get("status") ?? undefined,
  });
  if (!parsedQuery.success) {
    return NextResponse.json(
      {
        error:
          parsedQuery.error.issues[0]?.message ?? "Invalid query parameters",
      },
      { status: 400 }
    );
  }
  const cohortFilter = parsedQuery.data.cohortId ?? null;
  const statusFilter = parsedQuery.data.status ?? null;

  let query: FirebaseFirestore.Query = db.collection(SUMMER_COHORT_COLLECTION);
  if (cohortFilter) {
    query = query.where("cohorts", "array-contains", cohortFilter);
  }
  if (statusFilter) {
    query = query.where("status", "==", statusFilter);
  }

  const snap = await query.get();
  const rows: AdminApplicationRow[] = snap.docs.map((doc) => {
    const data = doc.data();
    const cohorts = Array.isArray(data.cohorts)
      ? (data.cohorts as unknown[]).filter(
          (c): c is SummerCohortId => c === "cohort-1" || c === "cohort-2"
        )
      : [];
    const status =
      typeof data.status === "string" &&
      VALID_STATUSES.has(data.status as SummerCohortStatus)
        ? (data.status as SummerCohortStatus)
        : "pending";
    return {
      userId: doc.id,
      email: typeof data.email === "string" ? data.email : null,
      name: typeof data.name === "string" ? data.name : null,
      phone: typeof data.phone === "string" ? data.phone : null,
      cohorts,
      status,
      isLocal: typeof data.isLocal === "boolean" ? data.isLocal : null,
      wantsToPresent:
        typeof data.wantsToPresent === "boolean" ? data.wantsToPresent : null,
      createdAt: toMillis(data.createdAt),
      updatedAt: toMillis(data.updatedAt),
    };
  });

  rows.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

  return NextResponse.json({
    applications: rows,
    total: rows.length,
    filters: { cohortId: cohortFilter, status: statusFilter },
  });
}
