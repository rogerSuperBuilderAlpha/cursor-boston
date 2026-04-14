/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/server-auth";
import { getUserGithubLoginFromFirestore } from "@/lib/maintainer-user";
import { hasMaintainerApplicationPullRequest } from "@/lib/maintainer-github-queue";
import { getClientIdentifier, checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_LIMIT = { windowMs: 60 * 1000, maxRequests: 30 };

export async function GET(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request as unknown as Request);
    const rateResult = checkRateLimit(`maintainers-status:${clientId}`, RATE_LIMIT);
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
      return NextResponse.json({
        eligible: false,
        githubConnected: false,
        hasApplicationPr: false,
      });
    }

    const hasApplicationPr = await hasMaintainerApplicationPullRequest(githubLogin);

    return NextResponse.json({
      eligible: hasApplicationPr,
      githubConnected: true,
      githubLogin,
      hasApplicationPr,
    });
  } catch (e) {
    console.error("[api/maintainers/status]", e);
    return NextResponse.json({ error: "Failed to load maintainer status" }, { status: 500 });
  }
}
