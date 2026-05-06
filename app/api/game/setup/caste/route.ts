/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { apiError, apiSuccess, parseRequestBody } from "@/lib/api-response";
import { mapGameError } from "@/lib/game/api-error-map";
import { chooseCasteServer } from "@/lib/game/data-server";
import type { Caste } from "@/lib/game/types";
import { getVerifiedUser } from "@/lib/server-auth";

const VALID_CASTES: Caste[] = ["black", "red", "white", "green", "blue"];

export async function POST(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);

    const bodyOrError = await parseRequestBody<{ caste?: unknown }>(request);
    if (bodyOrError instanceof NextResponse) return bodyOrError;

    const casteRaw =
      typeof bodyOrError.caste === "string" ? bodyOrError.caste : null;
    if (!casteRaw || !VALID_CASTES.includes(casteRaw as Caste)) {
      return apiError(
        `caste must be one of: ${VALID_CASTES.join(", ")}`,
        400
      );
    }

    const player = await chooseCasteServer(user.uid, casteRaw as Caste);
    return apiSuccess({ player });
  } catch (error) {
    return mapGameError(error);
  }
}
