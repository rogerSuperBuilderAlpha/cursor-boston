/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { mapGameError } from "@/lib/game/api-error-map";
import { getTileServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tileId: string }> }
) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);
    const { tileId } = await context.params;
    const tile = await getTileServer(tileId);
    if (!tile) return apiError("Tile not found", 404);
    return apiSuccess({ tile });
  } catch (error) {
    return mapGameError(error);
  }
}
