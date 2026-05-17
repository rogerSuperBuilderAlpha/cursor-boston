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
  approveHeroChapterServer,
  deleteHeroChapterServer,
} from "@/lib/game/hero-lore";
import { getVerifiedUser } from "@/lib/server-auth";

// DELETE /api/game/heroes/[heroId]/chapter/[chapterId]
//
// Soft-delete a chapter. Author can delete their own; admins can delete
// any. Sets deletedAt + deletedByAdmin (audit trail preserved).
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ heroId: string; chapterId: string }> }
) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);
    const { heroId, chapterId } = await params;
    if (!heroId || !chapterId) return apiError("Missing path params", 400);
    const chapter = await deleteHeroChapterServer({
      heroId,
      chapterId,
      callerUserId: user.uid,
      callerIsAdmin: user.isAdmin === true,
    });
    return apiSuccess({ chapter });
  } catch (error) {
    if (error instanceof HeroLoreNotFoundError) return apiError(error.message, 404);
    if (error instanceof HeroLoreForbiddenError) return apiError(error.message, 403);
    return apiError(
      error instanceof Error ? error.message : "Server error",
      500
    );
  }
}

// PATCH /api/game/heroes/[heroId]/chapter/[chapterId]
//
// Admin-only: approve a pending chapter. Sets status='approved' +
// approvedAt + approvedBy. No-op if already approved.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ heroId: string; chapterId: string }> }
) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);
    if (!user.isAdmin) return apiError("Admin only", 403);
    const { heroId, chapterId } = await params;
    if (!heroId || !chapterId) return apiError("Missing path params", 400);
    const chapter = await approveHeroChapterServer({
      heroId,
      chapterId,
      approverUserId: user.uid,
    });
    return apiSuccess({ chapter });
  } catch (error) {
    if (error instanceof HeroLoreNotFoundError) return apiError(error.message, 404);
    return apiError(
      error instanceof Error ? error.message : "Server error",
      500
    );
  }
}
