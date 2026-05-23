/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { promptTemplatesContract } from "@/lib/api-schemas/prompt-templates";
import { getAdminDb } from "@/lib/firebase-admin";
import { logger } from "@/lib/logger";
import {
  normalizePromptTemplateSubmission,
  PROMPT_TEMPLATES_COLLECTION,
  slugifyPromptTemplateTitle,
} from "@/lib/prompt-template-submissions";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { getVerifiedUser } from "@/lib/server-auth";

// @contracts: promptTemplatesContract.createTemplate (lib/api-schemas/prompt-templates.ts)

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEMPLATE_SUBMIT_RATE_LIMIT = { windowMs: 60 * 1000, maxRequests: 8 };

export async function POST(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request as unknown as Request);
    const rateResult = checkRateLimit(
      `prompt-template-submit:${clientId}`,
      TEMPLATE_SUBMIT_RATE_LIMIT
    );
    if (!rateResult.success) {
      return NextResponse.json(
        {
          error: "rate_limited",
          retryAfterSeconds: rateResult.retryAfter,
        },
        {
          status: 429,
          headers: { "Retry-After": String(rateResult.retryAfter || 60) },
        }
      );
    }

    const user = await getVerifiedUser(request);
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "not_configured" }, { status: 500 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }

    const parsedBody = promptTemplatesContract.createTemplate.body.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }

    const normalized = normalizePromptTemplateSubmission(parsedBody.data);
    if (!normalized.data) {
      return NextResponse.json(
        { error: "invalid_template", errors: normalized.errors },
        { status: 400 }
      );
    }

    const docRef = db.collection(PROMPT_TEMPLATES_COLLECTION).doc();
    const slugSuffix = docRef.id.slice(0, 8).toLowerCase();
    const slug = `${slugifyPromptTemplateTitle(normalized.data.title)}-${slugSuffix}`;
    const now = FieldValue.serverTimestamp();
    const responseTimestamp = new Date().toISOString();
    const template = {
      id: docRef.id,
      slug,
      ownerUid: user.uid,
      title: normalized.data.title,
      summary: normalized.data.summary,
      category: normalized.data.category,
      useCase: normalized.data.useCase,
      prompt: normalized.data.prompt,
      placeholders: normalized.data.placeholders,
      tags: normalized.data.tags,
      moderationStatus: normalized.data.moderationStatus,
      visibility: normalized.data.visibility,
      voteScore: 0,
      variantCount: 0,
      forkCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(template);

    return NextResponse.json(
      {
        ok: true,
        template: {
          ...template,
          createdAt: responseTimestamp,
          updatedAt: responseTimestamp,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    logger.logError(error, { endpoint: "/api/templates POST" });
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
