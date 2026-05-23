/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import { getClientIdentifier } from "@/lib/rate-limit";
import {
  buildRateLimitHeaders,
  checkServerRateLimit,
} from "@/lib/rate-limit-server";
import { fetchProfileDataBundleJson } from "@/lib/profile-bundle-server";
import { BADGE_DEFINITIONS } from "@/lib/badges/definitions";
import { evaluateBadgeEligibility } from "@/lib/badges/eligibility";
import { getEarnedBadgeIds } from "@/lib/badges/utils";
import { buildSkillsProgress } from "@/lib/skills-progress";

// @contracts: skillsContract.progress (lib/api-schemas/skills.ts)

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SKILLS_PROGRESS_RATE_LIMIT = { windowMs: 60 * 1000, maxRequests: 60 };

export async function GET(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateResult = await checkServerRateLimit(request as unknown as Request, {
      scope: "skills-progress-get",
      windowMs: SKILLS_PROGRESS_RATE_LIMIT.windowMs,
      maxRequests: SKILLS_PROGRESS_RATE_LIMIT.maxRequests,
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
            SKILLS_PROGRESS_RATE_LIMIT.maxRequests
          ),
        }
      );
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const profileBundle = await fetchProfileDataBundleJson(db, user.uid);
    const eligibilityMap = evaluateBadgeEligibility(
      profileBundle.badgeEligibility.input
    );
    const earnedBadgeIds = getEarnedBadgeIds(
      BADGE_DEFINITIONS,
      eligibilityMap,
      profileBundle.userBadgeMap
    );

    const payload = buildSkillsProgress({
      eligibilityMap,
      earnedBadgeIds,
      badgeDataStatus: profileBundle.badgeEligibility.status,
    });

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[api/skills/progress]", error);
    return NextResponse.json(
      { error: "Failed to load skills progress" },
      { status: 500 }
    );
  }
}
