/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import {
  ProphecyForbiddenError,
  ProphecyNotFoundError,
  deleteProphecyServer,
} from "@/lib/game/prophecies";
import { getVerifiedUser } from "@/lib/server-auth";

// DELETE /api/game/prophecies/[prophecyId] — soft-delete (author or admin).
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ prophecyId: string }> }
) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);
    const { prophecyId } = await params;
    if (!prophecyId) return apiError("prophecyId is required", 400);
    const prophecy = await deleteProphecyServer({
      prophecyId,
      callerUserId: user.uid,
      callerIsAdmin: user.isAdmin === true,
    });
    return apiSuccess({ prophecy });
  } catch (error) {
    if (error instanceof ProphecyNotFoundError) return apiError(error.message, 404);
    if (error instanceof ProphecyForbiddenError) return apiError(error.message, 403);
    return apiError(
      error instanceof Error ? error.message : "Server error",
      500
    );
  }
}
