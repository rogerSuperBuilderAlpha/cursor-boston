/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { apiError, apiSuccess, parseRequestBody } from "@/lib/api-response";
import { mapGameError } from "@/lib/game/api-error-map";
import { attackTileServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";
import { gameContract } from "@/lib/api-schemas/game";

export async function POST(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);

    const bodyOrError = await parseRequestBody(request);
    if (bodyOrError instanceof NextResponse) return bodyOrError;

    const parsed = gameContract.attack.body.safeParse(bodyOrError);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? "Invalid body", 400);
    }

    const result = await attackTileServer({
      attackerId: user.uid,
      sourceTileId: parsed.data.sourceTileId,
      targetTileId: parsed.data.targetTileId,
      units: parsed.data.units,
      offenseSpellId: parsed.data.offenseSpellId ?? null,
      heroAction: parsed.data.heroAction,
      heroActionOnConvertFail: parsed.data.heroActionOnConvertFail,
    });
    return apiSuccess({
      attack: result.attack,
      attackerPlayer: result.attackerPlayer,
      sourceTile: result.sourceTile,
      targetTile: result.targetTile,
      report: result.report,
      combat: result.combat,
      ...(result.intelReport ? { intelReport: result.intelReport } : {}),
    });
  } catch (error) {
    return mapGameError(error);
  }
}
