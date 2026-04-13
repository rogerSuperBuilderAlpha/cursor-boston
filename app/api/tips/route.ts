/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { getPublishedTips } from "@/lib/tips";
import { apiSuccess, apiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const tips = await getPublishedTips();
    return apiSuccess({ tips });
  } catch (error) {
    logger.logError(error, { endpoint: "/api/tips GET" });
    return apiError("Internal server error", 500);
  }
}
