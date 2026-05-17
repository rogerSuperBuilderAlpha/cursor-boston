/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess, parseRequestBody } from "@/lib/api-response";
import { mapGameError } from "@/lib/game/api-error-map";
import {
  cancelOrderServer,
  enqueueOrderServer,
  listOrdersForPlayerServer,
} from "@/lib/game/orders";
import { getVerifiedUser } from "@/lib/server-auth";

const UnitStackSchema = z.object({
  ground: z.number().int().min(0),
  siege: z.number().int().min(0),
  air: z.number().int().min(0),
});

const RecruitParams = z.object({
  kind: z.literal("recruit_on_tile"),
  tileId: z.string().min(1).max(200),
  unitType: z.enum(["ground", "siege", "air"]),
});
const AttackParams = z.object({
  kind: z.literal("attack_adjacent"),
  sourceTileId: z.string().min(1).max(200),
  targetTileId: z.string().min(1).max(200),
  units: UnitStackSchema,
  offenseSpellId: z.string().nullable(),
});
const SpellParams = z.object({
  kind: z.literal("cast_spell_on_tile"),
  tileId: z.string().min(1).max(200),
  spellId: z.string().min(1).max(200),
});

const PostBody = z.discriminatedUnion("kind", [
  RecruitParams,
  AttackParams,
  SpellParams,
]);

// GET /api/game/orders[?includeExecuted=true]
// Lists the caller's queued orders.
export async function GET(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);
    const includeExecuted =
      new URL(request.url).searchParams.get("includeExecuted") === "true";
    const orders = await listOrdersForPlayerServer(user.uid, includeExecuted);
    return apiSuccess({ orders });
  } catch (error) {
    return mapGameError(error);
  }
}

// POST /api/game/orders
// Enqueues one queued order. Body is a discriminated union on `kind`.
export async function POST(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);

    const bodyOrError = await parseRequestBody(request);
    if (bodyOrError instanceof NextResponse) return bodyOrError;
    const parsed = PostBody.safeParse(bodyOrError);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? "Invalid body", 400);
    }

    const order = await enqueueOrderServer({
      playerId: user.uid,
      kind: parsed.data.kind,
      params: parsed.data,
    });
    return apiSuccess({ order });
  } catch (error) {
    return mapGameError(error);
  }
}

// DELETE /api/game/orders?orderId=...
// Cancels a queued order (the caller's own).
export async function DELETE(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);
    const orderId = new URL(request.url).searchParams.get("orderId");
    if (!orderId) return apiError("orderId required", 400);
    const order = await cancelOrderServer({
      orderId,
      callerUserId: user.uid,
    });
    return apiSuccess({ order });
  } catch (error) {
    return mapGameError(error);
  }
}
