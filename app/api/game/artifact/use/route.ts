/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { apiError, apiSuccess, parseRequestBody } from "@/lib/api-response";
import { mapGameError } from "@/lib/game/api-error-map";
import { spendArtifactServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";

export async function POST(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);

    const bodyOrError = await parseRequestBody<{
      artifactId?: unknown;
      targetTileId?: unknown;
    }>(request);
    if (bodyOrError instanceof NextResponse) return bodyOrError;

    const artifactId =
      typeof bodyOrError.artifactId === "string"
        ? bodyOrError.artifactId
        : null;
    const targetTileId =
      typeof bodyOrError.targetTileId === "string"
        ? bodyOrError.targetTileId
        : null;
    if (!artifactId) return apiError("artifactId is required", 400);

    const result = await spendArtifactServer({
      userId: user.uid,
      artifactId,
      targetTileId,
    });
    return apiSuccess({ artifact: result.artifact });
  } catch (error) {
    return mapGameError(error);
  }
}
