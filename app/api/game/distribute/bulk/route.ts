/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { apiError, apiSuccess, parseRequestBody } from "@/lib/api-response";
import { mapGameError } from "@/lib/game/api-error-map";
import { bulkDistributeTilesServer } from "@/lib/game/data-server";
import type { LandType } from "@/lib/game/types";
import { getVerifiedUser } from "@/lib/server-auth";

const VALID_TYPES: LandType[] = ["military", "food", "magic", "unassigned"];
const MAX_TILES_PER_CALL = 100;

export async function POST(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);

    const bodyOrError = await parseRequestBody<{
      tileIds?: unknown;
      type?: unknown;
    }>(request);
    if (bodyOrError instanceof NextResponse) return bodyOrError;

    const tileIdsRaw = bodyOrError.tileIds;
    const typeRaw =
      typeof bodyOrError.type === "string" ? bodyOrError.type : null;

    if (!Array.isArray(tileIdsRaw) || tileIdsRaw.length === 0) {
      return apiError("tileIds must be a non-empty array of strings", 400);
    }
    if (tileIdsRaw.length > MAX_TILES_PER_CALL) {
      return apiError(
        `tileIds may not exceed ${MAX_TILES_PER_CALL} per call`,
        400
      );
    }
    const tileIds: string[] = [];
    for (const id of tileIdsRaw) {
      if (typeof id !== "string" || id.length === 0) {
        return apiError("tileIds must contain non-empty strings only", 400);
      }
      tileIds.push(id);
    }
    if (!typeRaw || !VALID_TYPES.includes(typeRaw as LandType)) {
      return apiError(`type must be one of: ${VALID_TYPES.join(", ")}`, 400);
    }

    const result = await bulkDistributeTilesServer(
      user.uid,
      tileIds,
      typeRaw as LandType
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
