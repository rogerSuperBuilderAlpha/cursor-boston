/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { apiError, apiSuccess, parseRequestBody } from "@/lib/api-response";
import { mapGameError } from "@/lib/game/api-error-map";
import { armDefenseSpellServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";

export async function POST(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);

    const bodyOrError = await parseRequestBody<{
      tileId?: unknown;
      spellId?: unknown;
    }>(request);
    if (bodyOrError instanceof NextResponse) return bodyOrError;

    const tileId =
      typeof bodyOrError.tileId === "string" ? bodyOrError.tileId : null;
    const spellId =
      typeof bodyOrError.spellId === "string" ? bodyOrError.spellId : null;
    if (!tileId) return apiError("tileId is required", 400);
    if (!spellId) return apiError("spellId is required", 400);

    const result = await armDefenseSpellServer(user.uid, tileId, spellId);
    return apiSuccess({ player: result.player, tile: result.tile });
  } catch (error) {
    return mapGameError(error);
  }
}
