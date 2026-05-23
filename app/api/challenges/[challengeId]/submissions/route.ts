/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { monthlyChallengesContract } from "@/lib/api-schemas/monthly-challenges";
import { getAdminDb } from "@/lib/firebase-admin";
import { logger } from "@/lib/logger";
import {
  activeChallengeSubmissionStatuses,
  isMonthlyChallengeSubmissionWindowOpen,
  MONTHLY_CHALLENGE_SUBMISSIONS_COLLECTION,
  MONTHLY_CHALLENGES_COLLECTION,
  normalizeMonthlyChallengeSubmission,
  sanitizeChallengeId,
  type MonthlyChallengeWindow,
} from "@/lib/monthly-challenge-submissions";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { getVerifiedUser } from "@/lib/server-auth";

// @contracts: monthlyChallengesContract.createSubmission (lib/api-schemas/monthly-challenges.ts)

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHALLENGE_SUBMIT_RATE_LIMIT = { windowMs: 60 * 1000, maxRequests: 6 };

type RouteContext = {
  params: Promise<{ challengeId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { challengeId: rawChallengeId } = await context.params;
    const parsedParams = monthlyChallengesContract.createSubmission.pathParams.safeParse({
      challengeId: rawChallengeId,
    });
    const challengeId = parsedParams.success
      ? sanitizeChallengeId(parsedParams.data.challengeId)
      : null;
    if (!challengeId) {
      return NextResponse.json({ error: "invalid_challenge_id" }, { status: 400 });
    }

    const clientId = getClientIdentifier(request as unknown as Request);
    const rateResult = checkRateLimit(
      `monthly-challenge-submit:${challengeId}:${clientId}`,
      CHALLENGE_SUBMIT_RATE_LIMIT
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

    const parsedBody = monthlyChallengesContract.createSubmission.body.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }

    const normalized = normalizeMonthlyChallengeSubmission(parsedBody.data);
    if (!normalized.data) {
      return NextResponse.json(
        { error: "invalid_submission", errors: normalized.errors },
        { status: 400 }
      );
    }

    const challengeRef = db.collection(MONTHLY_CHALLENGES_COLLECTION).doc(challengeId);
    const challengeSnap = await challengeRef.get();
    if (!challengeSnap.exists) {
      return NextResponse.json({ error: "challenge_not_found" }, { status: 404 });
    }

    const challenge = challengeSnap.data() as MonthlyChallengeWindow;
    if (!isMonthlyChallengeSubmissionWindowOpen(challenge)) {
      return NextResponse.json(
        { error: "challenge_not_accepting_submissions" },
        { status: 409 }
      );
    }

    const existingSnap = await db
      .collection(MONTHLY_CHALLENGE_SUBMISSIONS_COLLECTION)
      .where("challengeId", "==", challengeId)
      .where("ownerUid", "==", user.uid)
      .where("status", "in", activeChallengeSubmissionStatuses())
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      return NextResponse.json({ error: "active_submission_exists" }, { status: 409 });
    }

    const docRef = db.collection(MONTHLY_CHALLENGE_SUBMISSIONS_COLLECTION).doc();
    const now = FieldValue.serverTimestamp();
    const responseTimestamp = new Date().toISOString();
    const submittedAt =
      normalized.data.status === "submitted" ? now : undefined;
    const submission = {
      id: docRef.id,
      challengeId,
      ownerUid: user.uid,
      title: normalized.data.title,
      summary: normalized.data.summary,
      repositoryUrl: normalized.data.repositoryUrl,
      demoUrl: normalized.data.demoUrl,
      writeup: normalized.data.writeup,
      cursorWorkflow: normalized.data.cursorWorkflow,
      status: normalized.data.status,
      createdAt: now,
      updatedAt: now,
      ...(submittedAt ? { submittedAt } : {}),
    };

    await docRef.set(submission);

    return NextResponse.json(
      {
        ok: true,
        submission: {
          ...submission,
          createdAt: responseTimestamp,
          updatedAt: responseTimestamp,
          ...(submittedAt ? { submittedAt: responseTimestamp } : {}),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    logger.logError(error, { endpoint: "/api/challenges/[challengeId]/submissions POST" });
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
