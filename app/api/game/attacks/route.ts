/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import {
  clampLimit,
  parseCursor,
  DEFAULT_PAGE_LIMIT,
} from "@/lib/firestore-pagination";
import { mapGameError } from "@/lib/game/api-error-map";
import { getRecentAttacksServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";

const VALID_SIDES = ["sent", "received", "all"] as const;
type Side = (typeof VALID_SIDES)[number];

function parseSide(raw: string | null): Side {
  if (raw && (VALID_SIDES as readonly string[]).includes(raw)) return raw as Side;
  return "all";
}

export async function GET(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);

    const url = new URL(request.url);
    const side = parseSide(url.searchParams.get("side"));
    const limit = clampLimit(url.searchParams.get("limit"), DEFAULT_PAGE_LIMIT);
    const cursor = parseCursor(url.searchParams.get("cursor"));

    const { items, nextCursor, hasMore } = await getRecentAttacksServer({
      userId: user.uid,
      side,
      limit,
      cursor,
    });
    return apiSuccess({ attacks: items, nextCursor, hasMore });
  } catch (error) {
    return mapGameError(error);
  }
}
