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
} from "@/lib/questions/service";
import { logger } from "@/lib/logger";
import { parseRequestBody } from "@/lib/api-response";
import { getClientIdentifier } from "@/lib/rate-limit";
import { checkUpstashRateLimit } from "@/lib/upstash-rate-limit";
import { sanitizeDocId } from "@/lib/sanitize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_LIMIT = { windowMs: 60_000, maxRequests: 60 };

export async function POST(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request as unknown as Request);
    const rateResult = await checkUpstashRateLimit(`questions-vote:${clientId}`, RATE_LIMIT);
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

    const { targetType, targetId: rawTargetId, questionId: rawQId, type } = bodyOrError as {
      targetType?: string;
      targetId?: string;
      questionId?: string;
      type?: string;
    };

    if (targetType !== "question" && targetType !== "answer") {
      return NextResponse.json({ error: "targetType must be 'question' or 'answer'" }, { status: 400 });
    }

    const targetId = sanitizeDocId(rawTargetId ?? "");
    if (!targetId) {
      return NextResponse.json({ error: "Invalid target ID" }, { status: 400 });
    }

    if (type !== "up" && type !== "down") {
      return NextResponse.json({ error: "type must be 'up' or 'down'" }, { status: 400 });
    }

    let questionId: string | undefined;
    if (targetType === "answer") {
      questionId = sanitizeDocId(rawQId ?? "") ?? undefined;
      if (!questionId) {
        return NextResponse.json({ error: "questionId required for answer votes" }, { status: 400 });
      }
    }

    const service = getQuestionsService();
    const result = await service.vote(targetType, targetId, user.uid, type, questionId);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof QuestionNotFoundError || error instanceof AnswerNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    logger.logError(error, { endpoint: "POST /api/questions/vote" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) {
      return NextResponse.json({ userVotes: {} });
    }

    const service = getQuestionsService();
    const userVotes = await service.getUserVotes(user.uid);

    return NextResponse.json({ userVotes });
  } catch (error) {
    logger.logError(error, { endpoint: "GET /api/questions/vote" });
    return NextResponse.json({ userVotes: {} });
  }
}
