/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { getQuestionsService } from "@/lib/questions/service";
import { logger } from "@/lib/logger";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { sanitizeDocId } from "@/lib/sanitize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_LIMIT = { windowMs: 60_000, maxRequests: 100 };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ questionId: string }> }
) {
  try {
    const clientId = getClientIdentifier(request as unknown as Request);
    const rateResult = checkRateLimit(`question-detail:${clientId}`, RATE_LIMIT);
    if (!rateResult.success) {
      return NextResponse.json(
        { error: "Too many requests", retryAfterSeconds: rateResult.retryAfter },
        { status: 429, headers: { "Retry-After": String(rateResult.retryAfter || 60) } }
      );
    }

    const { questionId: rawId } = await params;
    const questionId = sanitizeDocId(rawId);
    if (!questionId) {
      return NextResponse.json({ error: "Invalid question ID" }, { status: 400 });
    }

    const service = getQuestionsService();
    const [question, answers] = await Promise.all([
      service.getQuestion(questionId),
      service.getAnswersForQuestion(questionId, "top"),
    ]);

    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    const relatedCookbook = await service.getRelatedCookbookEntries(question.tags);

    return NextResponse.json({ question, answers, relatedCookbook });
  } catch (error) {
    logger.logError(error, { endpoint: "GET /api/questions/[questionId]" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
