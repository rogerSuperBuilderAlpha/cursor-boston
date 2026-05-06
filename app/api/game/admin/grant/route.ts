/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

// Temporary admin-only testing helper. Removed in PR 4 once the cron rollover
// at `/api/game/rollover` is live.

import { NextRequest, NextResponse } from "next/server";
import { apiError, apiSuccess, parseRequestBody } from "@/lib/api-response";
import { mapGameError } from "@/lib/game/api-error-map";
import { adminGrantTurnsServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";

export async function POST(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);
    if (!user.isAdmin) return apiError("Admin only", 403);

    const bodyOrError = await parseRequestBody<{
      userId?: unknown;
      weekStartIso?: unknown;
    }>(request);
    if (bodyOrError instanceof NextResponse) return bodyOrError;

    const targetUserId =
      typeof bodyOrError.userId === "string" && bodyOrError.userId.length > 0
        ? bodyOrError.userId
        : user.uid;
    const weekStartIso =
      typeof bodyOrError.weekStartIso === "string"
        ? bodyOrError.weekStartIso
        : undefined;

    const player = await adminGrantTurnsServer(targetUserId, weekStartIso);
    return apiSuccess({ player });
  } catch (error) {
    return mapGameError(error);
  }
}
