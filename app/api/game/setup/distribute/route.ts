/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { apiError, apiSuccess, parseRequestBody } from "@/lib/api-response";
import { mapGameError } from "@/lib/game/api-error-map";
import { parseBatchCount, runBatch } from "@/lib/game/api-batch";
import { distributeTileServer } from "@/lib/game/data-server";
import type { LandType } from "@/lib/game/types";
import { getVerifiedUser } from "@/lib/server-auth";

const VALID_TYPES: LandType[] = ["military", "food", "magic", "unassigned"];

export async function POST(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);

    const bodyOrError = await parseRequestBody<{
      tileId?: unknown;
      type?: unknown;
      count?: unknown;
    }>(request);
    if (bodyOrError instanceof NextResponse) return bodyOrError;

    const tileId =
      typeof bodyOrError.tileId === "string" ? bodyOrError.tileId : null;
    const typeRaw =
      typeof bodyOrError.type === "string" ? bodyOrError.type : null;
    if (!tileId) return apiError("tileId is required", 400);
    if (!typeRaw || !VALID_TYPES.includes(typeRaw as LandType)) {
      return apiError(`type must be one of: ${VALID_TYPES.join(", ")}`, 400);
    }
    const count = parseBatchCount(bodyOrError.count);

    const { reports, lastResult, stoppedEarly } = await runBatch(count, () =>
      distributeTileServer(user.uid, tileId, typeRaw as LandType)
    );
    return apiSuccess({
      player: lastResult.player,
      tile: lastResult.tile,
      report: lastResult.report,
      reports,
      stoppedEarly,
    });
  } catch (error) {
    return mapGameError(error);
  }
}
