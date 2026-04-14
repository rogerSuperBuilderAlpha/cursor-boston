/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/server-auth";
import { getUserGithubLoginFromFirestore } from "@/lib/maintainer-user";
import {
  hasMaintainerApplicationPullRequest,
  fetchMaintainerReviewQueue,
} from "@/lib/maintainer-github-queue";
import { getClientIdentifier, checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_LIMIT = { windowMs: 60 * 1000, maxRequests: 20 };

export async function GET(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request as unknown as Request);
    const rateResult = checkRateLimit(`maintainers-review-queue:${clientId}`, RATE_LIMIT);
    if (!rateResult.success) {
      return NextResponse.json(
        { error: "Too many requests", retryAfterSeconds: rateResult.retryAfter },
        { status: 429, headers: { "Retry-After": String(rateResult.retryAfter || 60) } }
      );
    }

    const user = await getVerifiedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const githubLogin = await getUserGithubLoginFromFirestore(user.uid);
    if (!githubLogin) {
      return NextResponse.json(
        { error: "GitHub is not connected on your profile" },
        { status: 403 }
      );
    }

    const allowed = await hasMaintainerApplicationPullRequest(githubLogin);
    if (!allowed) {
      return NextResponse.json(
        { error: "Maintainer application pull request required" },
        { status: 403 }
      );
    }

    const queue = await fetchMaintainerReviewQueue(githubLogin);

    return NextResponse.json({
      githubLogin,
      notApprovedCount: queue.notApproved.length,
      notCommentedCount: queue.notCommented.length,
      notApproved: queue.notApproved,
      notCommented: queue.notCommented,
      approvedNotMerged: queue.approvedNotMerged,
      githubConfigured: queue.githubConfigured,
    });
  } catch (e) {
    console.error("[api/maintainers/review-queue]", e);
    return NextResponse.json(
      { error: "Failed to load review queue" },
      { status: 500 }
    );
  }
}
