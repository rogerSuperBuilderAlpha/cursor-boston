/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getAdminDb } from "@/lib/firebase-admin";
import type { GameAttack } from "@/lib/game/types";
import { getVerifiedUser } from "@/lib/server-auth";

// GET /api/game/attacks/[attackId]
// Returns the full attack record for the Battle Autopsy page. Only the
// attacker or defender on the record can read it (combat events are
// public via the feed, but the detail view is a per-participant lens).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ attackId: string }> }
) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);

    const { attackId } = await params;
    if (!attackId) return apiError("attackId required", 400);

    const db = getAdminDb();
    if (!db) return apiError("Server not configured", 500);
    const snap = await db.collection("game_attacks").doc(attackId).get();
    if (!snap.exists) return apiError("Attack not found", 404);
    const attack = snap.data() as GameAttack;

    if (attack.attackerId !== user.uid && attack.defenderId !== user.uid) {
      return apiError("Forbidden", 403);
    }

    return apiSuccess({ attack });
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Server error",
      500
    );
  }
}
