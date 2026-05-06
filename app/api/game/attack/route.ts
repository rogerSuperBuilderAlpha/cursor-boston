/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { apiError, apiSuccess, parseRequestBody } from "@/lib/api-response";
import { mapGameError } from "@/lib/game/api-error-map";
import { attackTileServer } from "@/lib/game/data-server";
import type { UnitStack } from "@/lib/game/types";
import { getVerifiedUser } from "@/lib/server-auth";

function parseUnits(raw: unknown): UnitStack | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const ground = typeof obj.ground === "number" ? obj.ground : NaN;
  const siege = typeof obj.siege === "number" ? obj.siege : NaN;
  const air = typeof obj.air === "number" ? obj.air : NaN;
  if (![ground, siege, air].every(Number.isFinite)) return null;
  if (![ground, siege, air].every(Number.isInteger)) return null;
  if ([ground, siege, air].some((n) => n < 0)) return null;
  return { ground, siege, air };
}

export async function POST(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);

    const bodyOrError = await parseRequestBody<{
      sourceTileId?: unknown;
      targetTileId?: unknown;
      units?: unknown;
      offenseSpellId?: unknown;
    }>(request);
    if (bodyOrError instanceof NextResponse) return bodyOrError;

    const sourceTileId =
      typeof bodyOrError.sourceTileId === "string"
        ? bodyOrError.sourceTileId
        : null;
    const targetTileId =
      typeof bodyOrError.targetTileId === "string"
        ? bodyOrError.targetTileId
        : null;
    const units = parseUnits(bodyOrError.units);
    const offenseSpellId =
      typeof bodyOrError.offenseSpellId === "string"
        ? bodyOrError.offenseSpellId
        : null;

    if (!sourceTileId) return apiError("sourceTileId is required", 400);
    if (!targetTileId) return apiError("targetTileId is required", 400);
    if (!units) {
      return apiError(
        "units must be { ground, siege, air } as non-negative integers",
        400
      );
    }

    const result = await attackTileServer({
      attackerId: user.uid,
      sourceTileId,
      targetTileId,
      units,
      offenseSpellId,
    });
    return apiSuccess({
      attack: result.attack,
      attackerPlayer: result.attackerPlayer,
      sourceTile: result.sourceTile,
      targetTile: result.targetTile,
    });
  } catch (error) {
    return mapGameError(error);
  }
}
