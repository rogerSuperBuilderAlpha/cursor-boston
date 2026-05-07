/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { mapGameError } from "@/lib/game/api-error-map";
import {
  createPlayerWithSpawnServer,
  getOwnedMapTilesServer,
  getPlayerServer,
  setGeneralNameServer,
} from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";

export async function GET(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);
    const player = await getPlayerServer(user.uid);
    // Surface server-evaluated admin status so the dashboard can gate the
    // admin-only "Grant 100 turns" button. The client otherwise has no
    // reliable way to read this — `users/{uid}.isAdmin` is never written;
    // admin is decided by token claims + legacy email allowlist server-side.
    const isAdmin = Boolean(user.isAdmin);
    if (!player) return apiSuccess({ player: null, tiles: [], isAdmin });
    const tiles = await getOwnedMapTilesServer(user.uid);
    return apiSuccess({ player, tiles, isAdmin });
  } catch (error) {
    return mapGameError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);
    const body = (await request.json().catch(() => ({}))) as {
      displayName?: unknown;
    };
    if (typeof body.displayName !== "string") {
      return apiError("displayName is required", 400);
    }
    const result = await createPlayerWithSpawnServer(user.uid, body.displayName);
    return apiSuccess(
      { player: result.player, tileIds: result.tileIds },
      201
    );
  } catch (error) {
    return mapGameError(error);
  }
}

// Rename. Accepts { displayName: string }; same validation/uniqueness rules
// as initial spawn.
export async function PATCH(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);
    const body = (await request.json().catch(() => ({}))) as {
      displayName?: unknown;
    };
    if (typeof body.displayName !== "string") {
      return apiError("displayName is required", 400);
    }
    const player = await setGeneralNameServer(user.uid, body.displayName);
    return apiSuccess({ player });
  } catch (error) {
    return mapGameError(error);
  }
}
