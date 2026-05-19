/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  fetchSummerCohortSubmissions,
  getVoteWeekById,
} from "@/lib/summer-cohort-submissions";
import { isValidCohortId, type SummerCohortId } from "@/lib/summer-cohort";
import { summerCohortContract } from "@/lib/api-schemas/summer-cohort";

interface RouteParams {
  params: Promise<{ weekId: string }>;
}

/**
 * Public read-only feed of merged submissions on a vote-format week.
 * Source of truth is the week's submission branch in GitHub; this route just
 * caches the GitHub Contents API call so the client tab can render counts.
 *
 * Accepts an optional `?cohortId=cohort-1|cohort-2` query so the same
 * "week-1" / "week-2" / "week-3" path maps to the right cohort's submission
 * branch. Defaults to cohort-1 for back-compat with older clients.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { weekId } = await params;
  const parsedParams = summerCohortContract.submissionsByWeek.pathParams.safeParse({ weekId });
  if (!parsedParams.success) {
    return NextResponse.json(
      { error: "Unknown weekId — vote-format weeks are week-1, week-2, week-3." },
      { status: 404 }
    );
  }

  const cohortIdParam = req.nextUrl.searchParams.get("cohortId");
  const cohortId: SummerCohortId = isValidCohortId(cohortIdParam)
    ? cohortIdParam
    : "cohort-1";

  const week = getVoteWeekById(parsedParams.data.weekId, cohortId);
  if (!week) {
    return NextResponse.json(
      { error: "Unknown weekId — vote-format weeks are week-1, week-2, week-3." },
      { status: 404 }
    );
  }

  const summary = await fetchSummerCohortSubmissions(week, weekId);
  return NextResponse.json(summary, {
    headers: {
      // Mirror the upstream cache window — clients can re-fetch every minute.
      "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
