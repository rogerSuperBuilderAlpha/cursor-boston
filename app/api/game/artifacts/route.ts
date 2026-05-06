/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { mapGameError } from "@/lib/game/api-error-map";
import { listArtifactsServer } from "@/lib/game/data-server";
import { ARTIFACTS_BY_ID } from "@/lib/game/content";
import { getVerifiedUser } from "@/lib/server-auth";

export async function GET(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);
    const artifacts = await listArtifactsServer(user.uid);
    const enriched = artifacts.map((a) => {
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
            }
          : null,
      };
    });
    return apiSuccess({ artifacts: enriched });
  } catch (error) {
    return mapGameError(error);
  }
}
