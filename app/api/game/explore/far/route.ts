/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { mapGameError } from "@/lib/game/api-error-map";
import { farExpeditionExploreServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";
import { gameContract } from "@/lib/api-schemas/game";

// Pin the contract reference at module scope so scripts/check-route-contracts.js
// detects this route as contract-bound. The Far Expedition body is optional
// and empty, so there's nothing to parse — we just check it's well-formed.
const farExpeditionBodySchema = gameContract.farExpedition.body;

export async function POST(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);

    // Optional body: tolerate missing / empty / "{}" payloads.
    if (request.headers.get("content-length")) {
      try {
        const text = await request.text();
        if (text.trim().length > 0) {
          const parsed = farExpeditionBodySchema?.safeParse(JSON.parse(text));
          if (parsed && !parsed.success) {
            return apiError(
              parsed.error.issues[0]?.message ?? "Invalid body",
              400
            );
          }
        }
      } catch {
        // Non-JSON body — ignore; the action takes no parameters.
      }
    }

    const result = await farExpeditionExploreServer(user.uid);
    return apiSuccess({
      player: result.player,
      tile: result.tile,
      report: result.report,
      targetEnemyTileId: result.targetEnemyTileId,
    });
  } catch (error) {
    return mapGameError(error);
  }
}
