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
import { listArtifactsServer } from "@/lib/game/data-server";
import { ARTIFACTS_BY_ID } from "@/lib/game/content";
import { getVerifiedUser } from "@/lib/server-auth";
import { gameContract } from "@/lib/api-schemas/game";

export async function GET(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);

    const url = new URL(request.url);
    const queryParse = gameContract.getArtifacts.query.safeParse({
      limit: url.searchParams.get("limit") ?? undefined,
      cursor: url.searchParams.get("cursor") ?? undefined,
    });
    if (!queryParse.success) {
      return apiError(queryParse.error.issues[0]?.message ?? "Invalid query", 400);
    }
    const limit = clampLimit(queryParse.data.limit ?? null, DEFAULT_PAGE_LIMIT);
    const cursor = parseCursor(queryParse.data.cursor ?? null);

    const { items, nextCursor, hasMore } = await listArtifactsServer({
      userId: user.uid,
      limit,
      cursor,
    });
    const enriched = items.map((a) => {
      const def = ARTIFACTS_BY_ID.get(a.definitionId);
      return {
        ...a,
        definition: def
          ? {
              id: def.id,
              name: def.name,
              description: def.description,
              flavorOnFind: def.flavorOnFind,
              baseStrength: def.baseStrength,
              lore: def.lore,
              imageUrl: def.imageUrl,
            }
          : null,
      };
    });
    return apiSuccess({ artifacts: enriched, nextCursor, hasMore });
  } catch (error) {
    return mapGameError(error);
  }
}
