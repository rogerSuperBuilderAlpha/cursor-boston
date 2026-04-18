/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/server-auth";
import { getQuestionsService } from "@/lib/questions/service";
import { logger } from "@/lib/logger";
import { parseRequestBody } from "@/lib/api-response";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { sanitizeText } from "@/lib/sanitize";
import { getDisplayName } from "@/lib/utils";
import { QUESTION_TAGS, type QuestionTag } from "@/types/questions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_LIMIT = { windowMs: 60_000, maxRequests: 10 };

export async function POST(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request as unknown as Request);
    const rateResult = checkRateLimit(`questions-post:${clientId}`, RATE_LIMIT);
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

    const { title, body, tags } = bodyOrError as {
      title?: string;
      body?: string;
      tags?: string[];
    };

    const sanitizedTitle = sanitizeText(title ?? "");
    const sanitizedBody = sanitizeText(body ?? "");

    if (sanitizedTitle.length < 10 || sanitizedTitle.length > 200) {
      return NextResponse.json(
        { error: "Title must be between 10 and 200 characters" },
        { status: 400 }
      );
    }

    if (sanitizedBody.length < 20 || sanitizedBody.length > 5000) {
      return NextResponse.json(
        { error: "Body must be between 20 and 5000 characters" },
        { status: 400 }
      );
    }

    const validTags = (tags ?? [])
      .filter((t): t is QuestionTag => (QUESTION_TAGS as readonly string[]).includes(t))
      .slice(0, 10);

    const service = getQuestionsService();
    const questionId = await service.createQuestion(
      user.uid,
      getDisplayName(user),
      user.picture ?? null,
      { title: sanitizedTitle, body: sanitizedBody, tags: validTags }
    );

    return NextResponse.json({ questionId }, { status: 201 });
  } catch (error) {
    logger.logError(error, { endpoint: "POST /api/questions/post" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
