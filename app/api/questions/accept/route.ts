/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/server-auth";
import {
  getQuestionsService,
  QuestionNotFoundError,
  AnswerNotFoundError,
  UnauthorizedError,
} from "@/lib/questions/service";
import { logger } from "@/lib/logger";
import { parseRequestBody } from "@/lib/api-response";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { sanitizeDocId } from "@/lib/sanitize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_LIMIT = { windowMs: 60_000, maxRequests: 20 };

export async function POST(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request as unknown as Request);
    const rateResult = checkRateLimit(`questions-accept:${clientId}`, RATE_LIMIT);
    if (!rateResult.success) {
      return NextResponse.json(
        { error: "Too many requests", retryAfterSeconds: rateResult.retryAfter },
        { status: 429, headers: { "Retry-After": String(rateResult.retryAfter || 60) } }
      );
    }

    const user = await getVerifiedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bodyOrError = await parseRequestBody(request);
    if (bodyOrError instanceof NextResponse) return bodyOrError;

    const { questionId: rawQId, answerId: rawAId } = bodyOrError as {
      questionId?: string;
      answerId?: string;
    };

    const questionId = sanitizeDocId(rawQId ?? "");
    const answerId = sanitizeDocId(rawAId ?? "");
    if (!questionId || !answerId) {
      return NextResponse.json({ error: "Invalid question or answer ID" }, { status: 400 });
    }

    const service = getQuestionsService();
    await service.acceptAnswer(questionId, answerId, user.uid);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof QuestionNotFoundError) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }
    if (error instanceof AnswerNotFoundError) {
      return NextResponse.json({ error: "Answer not found" }, { status: 404 });
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    logger.logError(error, { endpoint: "POST /api/questions/accept" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
