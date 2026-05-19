/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { apiError, apiSuccess, parseRequestBody } from "@/lib/api-response";
import { mapGameError } from "@/lib/game/api-error-map";
import { bulkBuildUnitsServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";
import { gameContract } from "@/lib/api-schemas/game";

const MAX_TOTAL_CYCLES = 100;

export async function POST(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);

    const bodyOrError = await parseRequestBody(request);
    if (bodyOrError instanceof NextResponse) return bodyOrError;

    const parsed = gameContract.buildBulk.body.safeParse(bodyOrError);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? "Invalid plan", 400);
    }

    // Business-rule check beyond pure schema validation.
    const totalCycles = parsed.data.plan.reduce((sum, e) => sum + e.cycles, 0);
    if (totalCycles > MAX_TOTAL_CYCLES) {
      return apiError(
        `plan total cycles ${totalCycles} exceeds max ${MAX_TOTAL_CYCLES}`,
        400
      );
    }

    const result = await bulkBuildUnitsServer(user.uid, parsed.data.plan);
    return apiSuccess({
      player: result.player,
      tiles: result.tiles,
      produced: result.produced,
      reports: result.reports,
      stoppedEarly: result.stoppedEarly,
    });
  } catch (error) {
    return mapGameError(error);
  }
}
