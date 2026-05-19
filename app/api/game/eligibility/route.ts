/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { mapGameError } from "@/lib/game/api-error-map";
import { getPlayerEligibilityServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";

// @contracts: gameContract.getEligibility (lib/api-schemas/game.ts)
export async function GET(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) return apiError("Authentication required", 401);
    const eligibility = await getPlayerEligibilityServer(user.uid);
    return apiSuccess(eligibility);
  } catch (error) {
    return mapGameError(error);
  }
}
