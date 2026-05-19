/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import {
  HACK_A_SPRINT_2026_EVENT_ID,
  fetchShowcaseSubmissionsFromGitHub,
} from "@/lib/hackathon-showcase";
import { hackASprint2026ScoreDocId } from "@/lib/hackathon-asprint-2026-state";
import { getClientIdentifier, rateLimitConfigs } from "@/lib/rate-limit";
import { checkUpstashRateLimit } from "@/lib/upstash-rate-limit";
import { hackathonsContract } from "@/lib/api-schemas/hackathons";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE = rateLimitConfigs.hackathonShowcaseAiScore;

export async function POST(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request as unknown as Request);
    const rate = await checkUpstashRateLimit(`hack-asprint-ai-score:${clientId}`, RATE);
    if (!rate.success) {
      return NextResponse.json(
        { error: "Too many requests", retryAfterSeconds: rate.retryAfter },
        { status: 429 }
      );
    }

    const user = await getVerifiedUser(request);
    if (!user?.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }
    const parsed = hackathonsContract.hackASprintAiScore.body.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid body" },
        { status: 400 }
      );
    }
    const submissionId = parsed.data.submissionId.trim().toLowerCase();
    const aiScore = parsed.data.aiScore;

    if (!submissionId || !Number.isInteger(aiScore) || aiScore < 1 || aiScore > 10) {
      return NextResponse.json(
        { error: "submissionId and integer aiScore 1-10 required" },
        { status: 400 }
      );
    }

    const submissions = await fetchShowcaseSubmissionsFromGitHub();
    if (!submissions.some((s) => s.submissionId === submissionId)) {
      return NextResponse.json({ error: "Unknown submission" }, { status: 400 });
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const ref = db
      .collection("hackathonShowcaseScores")
      .doc(hackASprint2026ScoreDocId(submissionId));

    const reasoningRaw =
      typeof parsed.data.aiReasoning === "string" ? parsed.data.aiReasoning.trim() : "";
    const payload: Record<string, unknown> = {
      eventId: HACK_A_SPRINT_2026_EVENT_ID,
      submissionId,
      aiScore,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (reasoningRaw) {
      payload.aiReasoning =
        reasoningRaw.length > 8000
          ? `${reasoningRaw.slice(0, 7997)}…`
          : reasoningRaw;
    }

    await ref.set(payload, { merge: true });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[hack-a-sprint ai-score]", e);
    return NextResponse.json({ error: "Failed to save AI score" }, { status: 500 });
  }
}
