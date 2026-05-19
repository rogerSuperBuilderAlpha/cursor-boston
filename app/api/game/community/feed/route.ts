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
  COMMUNITY_PAGE_SIZE,
  listRecentCommunityEvents,
} from "@/lib/game/community";
import { getVerifiedUser } from "@/lib/server-auth";

// @contracts: gameContract.getCommunityFeed (lib/api-schemas/game.ts)
void gameContract.getCommunityFeed;

// GET /api/game/community/feed
//
// Returns the most recent COMMUNITY_PAGE_SIZE events for the dashboard's
// CommunityPanel activity feed. Single ordered query (.orderBy(createdAt
// desc).limit) so the read cost is bounded regardless of total event
// count.
//
// Cache-Control mirrors the leaderboard route: short s-maxage so multiple
// dashboard mounts within the same minute hit the CDN, not Firestore.
export async function GET(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);
    const events = await listRecentCommunityEvents(COMMUNITY_PAGE_SIZE);
    const res = apiSuccess({ events });
    res.headers.set(
      "Cache-Control",
      "public, max-age=15, s-maxage=30, stale-while-revalidate=60"
    );
    return res;
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Server error",
      500
    );
  }
}
