/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextResponse } from "next/server";
import { BADGE_DEFINITIONS } from "@/lib/badges/definitions";

export const runtime = "nodejs";

/**
 * Badge definitions are static config — serve from the local BADGE_DEFINITIONS
 * constant instead of scanning the entire Firestore `badges` collection on
 * every request.  Previous implementation did a full collection .get() with
 * force-dynamic, which was a major source of unnecessary Firestore reads.
 *
 * Cache for 1 hour (s-maxage) with 5-minute stale-while-revalidate.
 */
export async function GET() {
  return NextResponse.json(
    { definitions: BADGE_DEFINITIONS, source: "local" },
    {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=300",
      },
    }
  );
}
