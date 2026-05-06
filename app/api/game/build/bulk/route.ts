/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { apiError, apiSuccess, parseRequestBody } from "@/lib/api-response";
import { mapGameError } from "@/lib/game/api-error-map";
import {
  bulkBuildUnitsServer,
  type BulkBuildPlanEntry,
} from "@/lib/game/data-server";
import type { UnitType } from "@/lib/game/types";
import { getVerifiedUser } from "@/lib/server-auth";

const VALID_UNIT_TYPES: UnitType[] = ["ground", "siege", "air"];
const MAX_TOTAL_CYCLES = 100;

function parsePlan(raw: unknown): BulkBuildPlanEntry[] | string {
  if (!Array.isArray(raw) || raw.length === 0) {
    return "plan must be a non-empty array";
  }
  const out: BulkBuildPlanEntry[] = [];
  let totalCycles = 0;
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") {
      return "plan entries must be objects";
    }
    const e = entry as Record<string, unknown>;
    const tileId = typeof e.tileId === "string" ? e.tileId : null;
    const unitTypeRaw =
      typeof e.unitType === "string" ? e.unitType : null;
    const cyclesRaw = typeof e.cycles === "number" ? e.cycles : Number(e.cycles);
    if (!tileId) return "plan entry missing tileId";
    if (!unitTypeRaw || !VALID_UNIT_TYPES.includes(unitTypeRaw as UnitType)) {
      return `plan entry has invalid unitType: ${String(unitTypeRaw)}`;
    }
    if (
      !Number.isFinite(cyclesRaw) ||
      cyclesRaw <= 0 ||
      Math.floor(cyclesRaw) !== cyclesRaw
    ) {
      return "plan entry cycles must be a positive integer";
    }
    out.push({
      tileId,
      unitType: unitTypeRaw as UnitType,
      cycles: cyclesRaw,
    });
    totalCycles += cyclesRaw;
  }
  if (totalCycles > MAX_TOTAL_CYCLES) {
    return `plan total cycles ${totalCycles} exceeds max ${MAX_TOTAL_CYCLES}`;
  }
  return out;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);

    const bodyOrError = await parseRequestBody<{ plan?: unknown }>(request);
    if (bodyOrError instanceof NextResponse) return bodyOrError;

    const parsed = parsePlan(bodyOrError.plan);
    if (typeof parsed === "string") return apiError(parsed, 400);

    const result = await bulkBuildUnitsServer(user.uid, parsed);
    return apiSuccess({
      player: result.player,
      tiles: result.tiles,
      produced: result.produced,
      reports: result.reports,
      stoppedEarly: result.stoppedEarly,
    });
  } catch (error) {
    return mapGameError(error);
  }
}
