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
} from "@/lib/questions/service";
import { logger } from "@/lib/logger";
import { parseRequestBody } from "@/lib/api-response";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { sanitizeText, sanitizeDocId } from "@/lib/sanitize";
import { getDisplayName } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_LIMIT = { windowMs: 60_000, maxRequests: 20 };

export async function POST(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request as unknown as Request);
    const rateResult = checkRateLimit(`questions-answer:${clientId}`, RATE_LIMIT);
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

    const { questionId: rawQId, body } = bodyOrError as {
      questionId?: string;
      body?: string;
    };

    const questionId = sanitizeDocId(rawQId ?? "");
    if (!questionId) {
      return NextResponse.json({ error: "Invalid question ID" }, { status: 400 });
    }

    const sanitizedBody = sanitizeText(body ?? "");
    if (sanitizedBody.length < 20 || sanitizedBody.length > 5000) {
      return NextResponse.json(
        { error: "Answer must be between 20 and 5000 characters" },
        { status: 400 }
      );
    }

    const service = getQuestionsService();
    const answerId = await service.createAnswer(
      questionId,
      user.uid,
      getDisplayName(user),
      user.picture ?? null,
      sanitizedBody
    );

    return NextResponse.json({ answerId }, { status: 201 });
  } catch (error) {
    if (error instanceof QuestionNotFoundError) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }
    logger.logError(error, { endpoint: "POST /api/questions/answer" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
