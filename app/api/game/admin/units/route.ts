/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

// Temporary admin-only testing helper. Drops a stack of units onto a tile to
// bootstrap PR 3 attack testing before unit production is fully real.

import { NextRequest, NextResponse } from "next/server";
import { apiError, apiSuccess, parseRequestBody } from "@/lib/api-response";
import { mapGameError } from "@/lib/game/api-error-map";
import { adminGrantUnitsServer } from "@/lib/game/data-server";
import type { UnitType } from "@/lib/game/types";
import { getVerifiedUser } from "@/lib/server-auth";

const VALID_UNIT_TYPES: UnitType[] = ["ground", "siege", "air"];

export async function POST(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);
    if (!user.isAdmin) return apiError("Admin only", 403);

    const bodyOrError = await parseRequestBody<{
      ownerId?: unknown;
      tileId?: unknown;
      unitType?: unknown;
      count?: unknown;
    }>(request);
    if (bodyOrError instanceof NextResponse) return bodyOrError;

    const ownerId =
      typeof bodyOrError.ownerId === "string" && bodyOrError.ownerId
        ? bodyOrError.ownerId
        : user.uid;
    const tileId =
      typeof bodyOrError.tileId === "string" ? bodyOrError.tileId : null;
    const unitTypeRaw =
      typeof bodyOrError.unitType === "string" ? bodyOrError.unitType : null;
    const count =
      typeof bodyOrError.count === "number" ? bodyOrError.count : NaN;

    if (!tileId) return apiError("tileId is required", 400);
    if (!unitTypeRaw || !VALID_UNIT_TYPES.includes(unitTypeRaw as UnitType)) {
      return apiError(
        `unitType must be one of: ${VALID_UNIT_TYPES.join(", ")}`,
        400
      );
    }
    if (!Number.isInteger(count) || count < 0) {
      return apiError("count must be a non-negative integer", 400);
    }

    const result = await adminGrantUnitsServer({
      ownerId,
      tileId,
      unitType: unitTypeRaw as UnitType,
      count,
    });
    return apiSuccess({ player: result.player, tile: result.tile });
  } catch (error) {
    return mapGameError(error);
  }
}
