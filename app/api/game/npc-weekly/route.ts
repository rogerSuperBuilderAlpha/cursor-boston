/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

// @contracts: gameContract.npcWeekly (lib/api-schemas/game.ts)
//
// Cron-only: invoked from .github/workflows/game-npc-weekly.yml at
// Sunday 05:30 UTC (= 30 min after the human-player rollover). Authenticated
// by the `x-rollover-secret` header matching GAME_ROLLOVER_SECRET. Idempotent
// per (NPC × weekStartIso): NPCs already granted that week are skipped.

import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { mapGameError } from "@/lib/game/api-error-map";
import { runNpcWeeklyServer } from "@/lib/game/npc-weekly";

// 50 NPCs × ~25 actions × Firestore txn round-trip can run several minutes;
// give the Vercel function room before timing out.
export const maxDuration = 300;

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function POST(request: NextRequest) {
  try {
    const expected = process.env.GAME_ROLLOVER_SECRET;
    if (!expected) {
      return apiError("Rollover secret not configured", 500);
    }
    const presented =
      request.headers.get("x-rollover-secret")?.trim() ??
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ??
      "";
    if (!presented || !timingSafeEqual(presented, expected)) {
      return apiError("Forbidden", 403);
    }

    const url = new URL(request.url);
    const weekStartIso = url.searchParams.get("weekStartIso") ?? undefined;
    const dryRun = url.searchParams.get("dryRun") === "1";
    const limitParam = url.searchParams.get("limit");
    const limit =
      limitParam !== null && Number.isFinite(Number.parseInt(limitParam, 10))
        ? Number.parseInt(limitParam, 10)
        : null;

    const summary = await runNpcWeeklyServer({ weekStartIso, dryRun, limit });
    return apiSuccess({ summary });
  } catch (error) {
    return mapGameError(error);
  }
}
