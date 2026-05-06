/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { apiError, apiSuccess, parseRequestBody } from "@/lib/api-response";
import { mapGameError } from "@/lib/game/api-error-map";
import { castProductionSpellServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";

export async function POST(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);

    const bodyOrError = await parseRequestBody<{ spellId?: unknown }>(request);
    if (bodyOrError instanceof NextResponse) return bodyOrError;

    const spellId =
      typeof bodyOrError.spellId === "string" ? bodyOrError.spellId : null;
    if (!spellId) return apiError("spellId is required", 400);

    const player = await castProductionSpellServer(user.uid, spellId);
    return apiSuccess({ player });
  } catch (error) {
    return mapGameError(error);
  }
}
