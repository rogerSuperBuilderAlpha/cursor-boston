/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

// @contracts: getWorldMeta (lib/api-schemas/game.ts)
//
// Pure GET, no body / query / path params — the contract entry exists
// for OpenAPI coverage but the route has no runtime input to validate.

import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { mapGameError } from "@/lib/game/api-error-map";
import { getWorldMetaServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";

/**
 * GET /api/game/world-meta
 *
 * Returns the global game-world singleton: season number, seals broken,
 * per-seal audit, armageddonState. Used by the dashboard to render the
 * SealsPanel and to gate the Armageddon spell card. Auth required (same
 * gate as the rest of /api/game/*).
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);

    const worldMeta = await getWorldMetaServer();
    const res = apiSuccess({ worldMeta });
    // Short cache: seals change rarely, but the resolving-state flip
    // needs to propagate within ~30s so the banner appears for
    // everyone shortly after seal 7 breaks.
    res.headers.set(
      "Cache-Control",
      "private, max-age=15, stale-while-revalidate=30"
    );
    return res;
  } catch (error) {
    return mapGameError(error);
  }
}
