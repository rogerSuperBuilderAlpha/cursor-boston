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
import { gameContract } from "@/lib/api-schemas/game";

export async function POST(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);
    if (!user.isAdmin) return apiError("Admin only", 403);

    const bodyOrError = await parseRequestBody(request);
    if (bodyOrError instanceof NextResponse) return bodyOrError;

    const parsed = gameContract.adminGrant.body.safeParse(bodyOrError);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? "Invalid body", 400);
    }

    const targetUserId =
      parsed.data.userId && parsed.data.userId.length > 0
        ? parsed.data.userId
        : user.uid;
    const player = await adminGrantTurnsServer(
      targetUserId,
      parsed.data.weekStartIso
    );
    return apiSuccess({ player });
  } catch (error) {
    return mapGameError(error);
  }
}
