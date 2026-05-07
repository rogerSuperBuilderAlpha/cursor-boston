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
import { getVerifiedUser } from "@/lib/server-auth";
import { gameContract } from "@/lib/api-schemas/game";

export async function POST(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);
    if (!user.isAdmin) return apiError("Admin only", 403);

    const bodyOrError = await parseRequestBody(request);
    if (bodyOrError instanceof NextResponse) return bodyOrError;

    const parsed = gameContract.adminUnits.body.safeParse(bodyOrError);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? "Invalid body", 400);
    }

    // Schema accepts all four fields as optional, but the handler requires
    // tileId/unitType/count to actually drop units. Enforce here.
    if (!parsed.data.tileId) {
      return apiError("tileId is required", 400);
    }
    if (!parsed.data.unitType) {
      return apiError("unitType is required", 400);
    }
    if (parsed.data.count == null) {
      return apiError("count is required", 400);
    }

    const result = await adminGrantUnitsServer({
      ownerId: parsed.data.ownerId || user.uid,
      tileId: parsed.data.tileId,
      unitType: parsed.data.unitType,
      count: parsed.data.count,
    });
    return apiSuccess({ player: result.player, tile: result.tile });
  } catch (error) {
    return mapGameError(error);
  }
}
