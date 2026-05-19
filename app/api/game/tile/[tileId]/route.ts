/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { mapGameError } from "@/lib/game/api-error-map";
import { getTileServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";
import { gameContract } from "@/lib/api-schemas/game";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tileId: string }> }
) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);

    const params = await context.params;
    const parsed = gameContract.getTile.pathParams.safeParse(params);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? "Invalid tileId", 400);
    }
    const tile = await getTileServer(parsed.data.tileId);
    if (!tile) return apiError("Tile not found", 404);
    return apiSuccess({ tile });
  } catch (error) {
    return mapGameError(error);
  }
}
