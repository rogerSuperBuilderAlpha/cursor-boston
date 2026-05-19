/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { gameContract } from "@/lib/api-schemas/game";
import {
  CommunityMessageForbiddenError,
  CommunityMessageNotFoundError,
  deleteCommunityMessage,
} from "@/lib/game/community";
import { getVerifiedUser } from "@/lib/server-auth";

// @contracts: gameContract.deleteCommunityChat
void gameContract.deleteCommunityChat;

// DELETE /api/game/community/chat/[messageId]
//
// Soft-delete a chat message. Author can delete their own; admins can
// delete any. Sets `deletedAt` (and `deletedByAdmin` for admin deletes)
// rather than hard-deleting so the audit trail is preserved.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);
    const { messageId } = await params;
    if (!messageId) return apiError("messageId is required", 400);

    const message = await deleteCommunityMessage({
      messageId,
      callerUserId: user.uid,
      callerIsAdmin: user.isAdmin === true,
    });
    return apiSuccess({ message });
  } catch (error) {
    if (error instanceof CommunityMessageNotFoundError) {
      return apiError(error.message, 404);
    }
    if (error instanceof CommunityMessageForbiddenError) {
      return apiError(error.message, 403);
    }
    return apiError(
      error instanceof Error ? error.message : "Server error",
      500
    );
  }
}
