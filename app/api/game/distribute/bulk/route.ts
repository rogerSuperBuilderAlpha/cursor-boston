/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { apiError, apiSuccess, parseRequestBody } from "@/lib/api-response";
import { mapGameError } from "@/lib/game/api-error-map";
import { bulkDistributeTilesServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";
import { gameContract } from "@/lib/api-schemas/game";

const MAX_TILES_PER_CALL = 100;

export async function POST(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);

    const bodyOrError = await parseRequestBody(request);
    if (bodyOrError instanceof NextResponse) return bodyOrError;

    const parsed = gameContract.distributeBulk.body.safeParse(bodyOrError);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? "Invalid body", 400);
    }
    if (parsed.data.tileIds.length > MAX_TILES_PER_CALL) {
      return apiError(
        `tileIds may not exceed ${MAX_TILES_PER_CALL} per call`,
        400
      );
    }

    const result = await bulkDistributeTilesServer(
      user.uid,
      parsed.data.tileIds,
      parsed.data.type
    );
    return apiSuccess({
      player: result.player,
      tiles: result.tiles,
      reports: result.reports,
      stoppedEarly: result.stoppedEarly,
    });
  } catch (error) {
    return mapGameError(error);
  }
}
