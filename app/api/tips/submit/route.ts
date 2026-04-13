/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest } from "next/server";
import { getVerifiedUser } from "@/lib/server-auth";
import { createTip } from "@/lib/tips";
import { sanitizeText } from "@/lib/sanitize";
import { apiSuccess, apiError } from "@/lib/api-response";
import { withRateLimit, rateLimitConfigs } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { TIP_CATEGORIES, type TipCategory } from "@/types/tips";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TITLE_LENGTH = 120;
const MAX_CONTENT_LENGTH = 500;

async function handler(request: Request) {
  try {
    const user = await getVerifiedUser(request as NextRequest);
    if (!user) return apiError("Unauthorized", 401);

    const body = await request.json();
    const { title, content, category } = body;

    if (!title || !content) {
      return apiError("Title and content are required", 400);
    }

    const sanitizedTitle = sanitizeText(title).slice(0, MAX_TITLE_LENGTH);
    const sanitizedContent = sanitizeText(content).slice(0, MAX_CONTENT_LENGTH);

    if (!sanitizedTitle || !sanitizedContent) {
      return apiError("Title and content cannot be empty after sanitization", 400);
    }

    const validCategory: TipCategory =
      category && TIP_CATEGORIES.includes(category) ? category : "General";

    const status = user.isAdmin ? "published" : "pending";

    const id = await createTip({
      title: sanitizedTitle,
      content: sanitizedContent,
      category: validCategory,
      authorId: user.uid,
      authorName: user.name || "Anonymous",
      status,
    });

    return apiSuccess({ id, status }, 201);
  } catch (error) {
    logger.logError(error, { endpoint: "/api/tips/submit POST" });
    return apiError("Internal server error", 500);
  }
}

export const POST = withRateLimit(rateLimitConfigs.standard, handler);
