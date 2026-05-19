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
import { meditateHeroServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";

const PostBody = z.object({
  tileId: z.string().min(1).max(200),
});

// POST /api/game/heroes/meditate
// Puts the hero on `tileId` into meditation for 24h. Always-on (any
// turn balance). Capped at 1 meditating hero per player at a time.
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

    const tile = await meditateHeroServer({
      callerUserId: user.uid,
      tileId: parsed.data.tileId,
    });
    return apiSuccess({ tile });
  } catch (error) {
    return mapGameError(error);
  }
}
