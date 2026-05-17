/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import {
  PactForbiddenError,
  PactNotFoundError,
  deletePactServer,
} from "@/lib/game/pacts";
import { getVerifiedUser } from "@/lib/server-auth";

// DELETE /api/game/pacts/[pactId] — soft-delete (author or admin).
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ pactId: string }> }
) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);
    const { pactId } = await params;
    if (!pactId) return apiError("pactId is required", 400);
    const pact = await deletePactServer({
      pactId,
      callerUserId: user.uid,
      callerIsAdmin: user.isAdmin === true,
    });
    return apiSuccess({ pact });
  } catch (error) {
    if (error instanceof PactNotFoundError) return apiError(error.message, 404);
    if (error instanceof PactForbiddenError) return apiError(error.message, 403);
    return apiError(
      error instanceof Error ? error.message : "Server error",
      500
    );
  }
}
