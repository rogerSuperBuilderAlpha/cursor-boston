/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess, parseRequestBody } from "@/lib/api-response";
import { mapGameError } from "@/lib/game/api-error-map";
import { redistributeUnitsServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";

const UnitStackSchema = z.object({
  ground: z.number().int().min(0),
  siege: z.number().int().min(0),
  air: z.number().int().min(0),
});

const PostBody = z.object({
  sourceTileId: z.string().min(1).max(200),
  destTileId: z.string().min(1).max(200),
  units: UnitStackSchema,
});

// POST /api/game/redistribute
// Moves units between two adjacent owned tiles with an 8% transit loss.
// Rate-limit (3/day) is enforced server-side via the player doc counter
// (recentRedistributions); no Upstash key needed.
export async function POST(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);

    const bodyOrError = await parseRequestBody(request);
    if (bodyOrError instanceof NextResponse) return bodyOrError;
    const parsed = PostBody.safeParse(bodyOrError);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? "Invalid body", 400);
    }
    const total =
      parsed.data.units.ground +
      parsed.data.units.siege +
      parsed.data.units.air;
    if (total < 1) {
      return apiError("Must move at least 1 unit", 400);
    }

    const result = await redistributeUnitsServer({
      callerUserId: user.uid,
      sourceTileId: parsed.data.sourceTileId,
      destTileId: parsed.data.destTileId,
      units: parsed.data.units,
    });
    return apiSuccess(result);
  } catch (error) {
    return mapGameError(error);
  }
}
