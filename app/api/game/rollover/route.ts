/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

// Cron-only: invoked from .github/workflows/game-weekly-rollover.yml at
// Sunday 05:00 UTC (= Sunday 00:00 EST). Authenticated by the
// `x-rollover-secret` header matching the GAME_ROLLOVER_SECRET env var.
// Idempotent per (player × weekStartIso): re-running the same weekStart is
// a no-op for any player already granted that week.

import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { mapGameError } from "@/lib/game/api-error-map";
import { runWeeklyRolloverServer } from "@/lib/game/data-server";

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

    const summary = await runWeeklyRolloverServer(weekStartIso);
    return apiSuccess({ summary });
  } catch (error) {
    return mapGameError(error);
  }
}
