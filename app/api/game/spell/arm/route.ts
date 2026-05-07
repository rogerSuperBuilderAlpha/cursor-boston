/**
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

const MAX_BULK_TILES = 200;

export async function POST(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);

    const bodyOrError = await parseRequestBody<{
      tileId?: unknown;
      tileIds?: unknown;
      spellId?: unknown;
      count?: unknown;
    }>(request);
    if (bodyOrError instanceof NextResponse) return bodyOrError;

    const spellId =
      typeof bodyOrError.spellId === "string" ? bodyOrError.spellId : null;
    if (!spellId) return apiError("spellId is required", 400);

    // Bulk form: { spellId, tileIds: string[] } — arms one tile per id, in
    // order, attempting every tile even if earlier ones fail. Returns a
    // partial-success summary so the UI can show "armed 7 of 10; 3 failed".
    if (Array.isArray(bodyOrError.tileIds)) {
      const tileIds = bodyOrError.tileIds.filter(
        (x): x is string => typeof x === "string" && x.length > 0
      );
      if (tileIds.length === 0) {
        return apiError("tileIds must be a non-empty array of strings", 400);
      }
      if (tileIds.length > MAX_BULK_TILES) {
        return apiError(
          `Too many tileIds (${tileIds.length}); cap is ${MAX_BULK_TILES}`,
          400
        );
      }

      const armed: Array<{ tileId: string; report: TurnReport }> = [];
      const failed: Array<{ tileId: string; reason: string }> = [];
      let lastResult: Awaited<ReturnType<typeof armDefenseSpellServer>> | null = null;
      for (const tileId of tileIds) {
        try {
          const out = await armDefenseSpellServer(user.uid, tileId, spellId);
          armed.push({ tileId, report: out.report });
          lastResult = out;
        } catch (err) {
          failed.push({
            tileId,
            reason: err instanceof Error ? err.message : String(err),
          });
        }
      }

      // If every single attempt failed, fall through to mapGameError so the
      // user gets a clean error response rather than a "0 armed" success.
      if (armed.length === 0 && failed.length > 0) {
        // Re-run the first attempt to surface its original GameError shape
        // (preserves error code + HTTP status). Only the first failure is
        // worth re-throwing; subsequent ones likely share the same root cause.
        return mapGameError(new Error(failed[0]!.reason));
      }

      return apiSuccess({
        player: lastResult?.player ?? null,
        armed: armed.length,
        failed,
        reports: armed.map((a) => a.report),
      });
    }

    // Single-tile form: { spellId, tileId, count? } — preserves existing
    // batch-arming behavior (same tile + spell, repeated `count` times).
    const tileId =
      typeof bodyOrError.tileId === "string" ? bodyOrError.tileId : null;
    if (!tileId) {
      return apiError("tileId or tileIds is required", 400);
    }
    const count = parseBatchCount(bodyOrError.count);
    const { reports, lastResult, stoppedEarly } = await runBatch(count, () =>
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
