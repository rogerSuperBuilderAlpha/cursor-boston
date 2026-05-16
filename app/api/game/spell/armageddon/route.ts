/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

// @contracts: castArmageddon (lib/api-schemas/game.ts)
//
// POST with no body — Armageddon takes no parameters. All validation
// (tile gate, turn cost, season match, seal availability) lives in
// castArmageddonServer's transaction.

import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { mapGameError } from "@/lib/game/api-error-map";
import { castArmageddonServer } from "@/lib/game/data-server";
import { resolveArmageddon } from "@/lib/game/armageddon-resolve";
import { getVerifiedUser } from "@/lib/server-auth";
import { logger } from "@/lib/logger";

/**
 * POST /api/game/spell/armageddon
 *
 * No request body — Armageddon takes no parameters. Authentication is the
 * only gate the route enforces; everything else (tile gate, turn cost,
 * season check, seal-availability) lives inside castArmageddonServer's
 * transaction.
 *
 * When the cast breaks the 7th seal, the resolver is fired in the
 * background AFTER this response is sent. The casting player's UI doesn't
 * have to wait for the wipe to complete; it sees `shouldTriggerResolve:
 * true` in the response and can render a "you ended the world" moment
 * immediately.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);

    const result = await castArmageddonServer({ userId: user.uid });

    if (result.shouldTriggerResolve) {
      // Fire-and-forget. Errors are logged but don't fail the caster's
      // response. resolveArmageddon is idempotent — a follow-up call from
      // another player's later cast / a cron job would resume cleanly.
      void resolveArmageddon({
        expectedSeason: result.seasonNumber,
        triggeredBy: {
          userId: result.player.userId,
          displayName: result.player.displayName,
          caste: result.player.caste!,
        },
      }).catch((err) => {
        logger.error("[armageddon] resolveArmageddon failed", {
          message: err instanceof Error ? err.message : String(err),
          seasonNumber: result.seasonNumber,
        });
      });
    }

    return apiSuccess({
      // Renamed to avoid colliding with the api-wrapper's outer `success`
      // field (which is always true for 2xx). `sealBroken` is the actual
      // cast-roll outcome: true → a seal broke, false → the roll fizzled.
      sealBroken: result.success,
      successChance: result.successChance,
      sealsBroken: result.sealsBroken,
      seasonNumber: result.seasonNumber,
      player: result.player,
      shouldTriggerResolve: result.shouldTriggerResolve,
    });
  } catch (error) {
    return mapGameError(error);
  }
}
