/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { type NextRequest, NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/server-auth";
import { isSummerCohortAdminEmail } from "@/lib/summer-cohort-admin-access";
import { summerCohortContract } from "@/lib/api-schemas/summer-cohort";

// Contract reference (no runtime inputs to validate on this probe).
void summerCohortContract.adminAccess;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/summer-cohort/admin/access
 *
 * Probe endpoint the dashboard page calls on mount to decide whether to
 * render. Returns `{ allowed: boolean }` for the verified caller. The
 * actual data endpoints enforce the same gate independently — this is just
 * a UX hint so non-allowed users get redirected instead of staring at a
 * permissions error.
 */
export async function GET(request: NextRequest) {
  const user = await getVerifiedUser(request).catch(() => null);
  if (!user) {
    return NextResponse.json({ allowed: false }, { status: 401 });
  }
  return NextResponse.json({
    allowed: isSummerCohortAdminEmail(user.email),
  });
}
