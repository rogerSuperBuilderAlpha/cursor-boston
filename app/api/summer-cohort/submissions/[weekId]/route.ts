/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextResponse } from "next/server";
import {
  fetchSummerCohortSubmissions,
  getVoteWeekById,
} from "@/lib/summer-cohort-submissions";

interface RouteParams {
  params: Promise<{ weekId: string }>;
}

/**
 * Public read-only feed of merged submissions on a Cohort 1 vote-format week.
 * Source of truth is the week's submission branch in GitHub; this route just
 * caches the GitHub Contents API call so the client tab can render counts.
 */
export async function GET(_req: Request, { params }: RouteParams) {
  const { weekId } = await params;
  const week = getVoteWeekById(weekId);
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
