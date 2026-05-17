/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import {
  HeroLoreForbiddenError,
  HeroLoreNotFoundError,
  deleteHeroEpitaphServer,
} from "@/lib/game/hero-lore";
import { getVerifiedUser } from "@/lib/server-auth";

// DELETE /api/game/heroes/[heroId]/epitaph/[epitaphId]
//
// Soft-delete an epitaph. Author can delete their own; admins can
// delete any.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ heroId: string; epitaphId: string }> }
) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);
    const { heroId, epitaphId } = await params;
    if (!heroId || !epitaphId) return apiError("Missing path params", 400);
    const epitaph = await deleteHeroEpitaphServer({
      heroId,
      epitaphId,
      callerUserId: user.uid,
      callerIsAdmin: user.isAdmin === true,
    });
    return apiSuccess({ epitaph });
  } catch (error) {
    if (error instanceof HeroLoreNotFoundError) return apiError(error.message, 404);
    if (error instanceof HeroLoreForbiddenError) return apiError(error.message, 403);
    return apiError(
      error instanceof Error ? error.message : "Server error",
      500
    );
  }
}
