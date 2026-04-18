/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { getQuestionsService } from "@/lib/questions/service";
import { logger } from "@/lib/logger";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import type { QuestionSort } from "@/types/questions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_LIMIT = { windowMs: 60_000, maxRequests: 100 };

export async function GET(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request as unknown as Request);
    const rateResult = checkRateLimit(`questions-list:${clientId}`, RATE_LIMIT);
    if (!rateResult.success) {
      return NextResponse.json(
        { error: "Too many requests", retryAfterSeconds: rateResult.retryAfter },
        { status: 429, headers: { "Retry-After": String(rateResult.retryAfter || 60) } }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const sort = (searchParams.get("sort") || "newest") as QuestionSort;
    const tag = searchParams.get("tag") || undefined;
    const search = searchParams.get("search") || undefined;
    const limit = Math.min(Number(searchParams.get("limit")) || 20, 50);
    const cursor = searchParams.get("cursor") || undefined;

    let service;
    try {
      service = getQuestionsService();
    } catch {
      return NextResponse.json({ questions: [], nextCursor: null });
    }
    const result = await service.listQuestions({ sort, tag, search, limit, cursor });

    return NextResponse.json(result);
  } catch (error) {
    logger.logError(error, { endpoint: "GET /api/questions" });
    return NextResponse.json({ questions: [], nextCursor: null });
  }
}
