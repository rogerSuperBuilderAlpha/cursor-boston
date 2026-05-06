/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { apiError, apiSuccess, parseRequestBody } from "@/lib/api-response";
import { mapGameError } from "@/lib/game/api-error-map";
import { parseBatchCount, runBatch } from "@/lib/game/api-batch";
import { exploreNextTileServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";

export async function POST(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);

    let count = 1;
    if (request.headers.get("content-length")) {
      const body = await parseRequestBody<{ count?: unknown }>(request);
      if (body instanceof NextResponse) return body;
      count = parseBatchCount(body.count);
    }

    const { reports, lastResult, stoppedEarly } = await runBatch(count, () =>
      exploreNextTileServer(user.uid)
    );
    return apiSuccess({
      player: lastResult.player,
      tile: lastResult.tile,
      report: lastResult.report,
      reports,
      stoppedEarly,
    });
  } catch (error) {
    return mapGameError(error);
  }
}
