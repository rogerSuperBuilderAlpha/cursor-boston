/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { apiError, apiSuccess, parseRequestBody } from "@/lib/api-response";
import { mapGameError } from "@/lib/game/api-error-map";
import { parseBatchCount, runBatch } from "@/lib/game/api-batch";
import { armDefenseSpellServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";
import type { TurnReport } from "@/lib/game/types";
import { gameContract } from "@/lib/api-schemas/game";

const MAX_BULK_TILES = 200;

export async function POST(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);

    const bodyOrError = await parseRequestBody(request);
    if (bodyOrError instanceof NextResponse) return bodyOrError;

    const parsed = gameContract.spellArm.body.safeParse(bodyOrError);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? "Invalid body", 400);
    }
    const { spellId, tileId, tileIds, count } = parsed.data;

    // Bulk form: { spellId, tileIds: string[] } — arms one tile per id, in
    // order, attempting every tile even if earlier ones fail. Returns a
    // partial-success summary so the UI can show "armed 7 of 10; 3 failed".
    if (Array.isArray(tileIds) && tileIds.length > 0) {
      if (tileIds.length > MAX_BULK_TILES) {
        return apiError(
          `Too many tileIds (${tileIds.length}); cap is ${MAX_BULK_TILES}`,
          400
        );
      }

      const armed: Array<{ tileId: string; report: TurnReport }> = [];
      const failed: Array<{ tileId: string; reason: string }> = [];
      let lastResult: Awaited<ReturnType<typeof armDefenseSpellServer>> | null = null;
      for (const id of tileIds) {
        try {
          const out = await armDefenseSpellServer(user.uid, id, spellId);
          armed.push({ tileId: id, report: out.report });
          lastResult = out;
        } catch (err) {
          failed.push({
            tileId: id,
            reason: err instanceof Error ? err.message : String(err),
          });
        }
      }

      // If every single attempt failed, fall through to mapGameError so the
      // user gets a clean error response rather than a "0 armed" success.
      if (armed.length === 0 && failed.length > 0) {
        return mapGameError(new Error(failed[0]!.reason));
      }

      return apiSuccess({
        player: lastResult?.player ?? null,
        armed: armed.length,
        failed,
        reports: armed.map((a) => a.report),
      });
    }

    // Single-tile form. The contract refine() guarantees tileId is set when
    // tileIds is empty/absent, but TS can't narrow that.
    if (!tileId) {
      return apiError("tileId or tileIds is required", 400);
    }
    const batchCount = parseBatchCount(count);
    const { reports, lastResult, stoppedEarly } = await runBatch(batchCount, () =>
      armDefenseSpellServer(user.uid, tileId, spellId)
    );
    return apiSuccess({
      player: lastResult.player,
      tile: lastResult.tile,
      report: lastResult.report,
      reports,
      stoppedEarly,
    });
  } catch (error) {
    return mapGameError(error);
  }
}
