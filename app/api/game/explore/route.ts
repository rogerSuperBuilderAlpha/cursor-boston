/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { apiError, apiSuccess, parseRequestBody } from "@/lib/api-response";
import { mapGameError } from "@/lib/game/api-error-map";
import { parseBatchCount, runBatch } from "@/lib/game/api-batch";
import { frontierExploreServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";
import { gameContract } from "@/lib/api-schemas/game";

export async function POST(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);

    let count = 1;
    if (request.headers.get("content-length")) {
      const body = await parseRequestBody(request);
      if (body instanceof NextResponse) return body;
      const parsed = gameContract.explore.body.safeParse(body);
      if (!parsed.success) {
        return apiError(parsed.error.issues[0]?.message ?? "Invalid body", 400);
      }
      count = parseBatchCount(parsed.data.count);
    }

    const { reports, lastResult, stoppedEarly } = await runBatch(count, () =>
      frontierExploreServer(user.uid)
    );
    return apiSuccess({
      player: lastResult.player,
      tile: lastResult.tile,
      report: lastResult.report,
      reports,
      frontier: lastResult.frontier,
      stoppedEarly,
    });
  } catch (error) {
    return mapGameError(error);
  }
}
