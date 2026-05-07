/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { mapGameError } from "@/lib/game/api-error-map";
import {
  getAllMapTilesServer,
  getAllOwnerSummariesServer,
} from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";

// Global map fetch: every tile in the world plus a per-owner summary
// (displayName, caste, shielded). The client joins owner info onto tiles by
// ownerId. Today this is ~500 tiles + 4 owners. If the population grows past
// a few thousand tiles, switch to a viewport bounding-box query.
export async function GET(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);
    const [tiles, owners] = await Promise.all([
      getAllMapTilesServer(),
      getAllOwnerSummariesServer(),
    ]);
    return apiSuccess({ tiles, owners });
  } catch (error) {
    return mapGameError(error);
  }
}
