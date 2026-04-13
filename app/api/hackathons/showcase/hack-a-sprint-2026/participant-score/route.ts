/**
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
import { getHackASprint2026Phase } from "@/lib/hackathon-asprint-2026-schedule";
import {
  hackASprint2026ParticipantScoresDocId,
  normalizeParticipantScores,
} from "@/lib/hackathon-asprint-2026-participant-scoring";
import {
  userHasHackASprint2026Signup,
  userIsCheckedInForHackASprint2026,
} from "@/lib/hackathon-asprint-2026-state";
import { checkRateLimit, getClientIdentifier, rateLimitConfigs } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE = rateLimitConfigs.hackathonShowcaseParticipantScore;

export async function POST(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request as unknown as Request);
    const rate = checkRateLimit(`hack-asprint-participant-score:${clientId}`, RATE);
    if (!rate.success) {
      return NextResponse.json(
        { error: "Too many requests", retryAfterSeconds: rate.retryAfter },
        { status: 429 }
      );
    }

    const user = await getVerifiedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const phase = getHackASprint2026Phase();
    if (phase !== "peerVotingOpen") {
      return NextResponse.json(
        { error: "Peer scoring is only open during the judging window." },
        { status: 403 }
      );
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const checkedIn = await userIsCheckedInForHackASprint2026(db, user.uid, user.email);
    if (!checkedIn) {
      return NextResponse.json({ error: "You must be checked in." }, { status: 403 });
    }

    const signedUp = await userHasHackASprint2026Signup(db, user.uid);
    if (!signedUp) {
      return NextResponse.json({ error: "Website event signup required." }, { status: 403 });
    }

    let body: { submissionId?: string; score?: number };
    try {
      body = (await request.json()) as { submissionId?: string; score?: number };
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    const submissionId = String(body.submissionId ?? "")
      .trim()
      .toLowerCase();
    const score = Number(body.score);

    if (!submissionId || !Number.isInteger(score) || score < 1 || score > 10) {
      return NextResponse.json(
        { error: "submissionId and integer score 1-10 required" },
        { status: 400 }
      );
    }

    const submissions = await fetchShowcaseSubmissionsFromGitHub();
    const target = submissions.find((s) => s.submissionId === submissionId);
    if (!target) {
      return NextResponse.json({ error: "Unknown submission" }, { status: 400 });
    }

    const userSnap = await db.collection("users").doc(user.uid).get();
    const ud = userSnap.data();
    const gh =
      ud?.github && typeof ud.github === "object"
        ? String((ud.github as { login?: string }).login ?? "")
            .trim()
            .toLowerCase()
        : "";
    if (!gh) {
      return NextResponse.json({ error: "Connect GitHub on your profile." }, { status: 403 });
    }

    if (target.githubLogin.trim().toLowerCase() === gh) {
      return NextResponse.json({ error: "You cannot score your own submission." }, { status: 400 });
    }

    const uidRate = checkRateLimit(
      `hack-asprint-participant-score-uid:${user.uid}`,
      RATE
    );
    if (!uidRate.success) {
      return NextResponse.json(
        { error: "Too many requests", retryAfterSeconds: uidRate.retryAfter },
        { status: 429 }
      );
    }

    const docId = hackASprint2026ParticipantScoresDocId(user.uid);
    const ref = db.collection("hackathonASprint2026ParticipantScores").doc(docId);
    const snap = await ref.get();
    const prev = normalizeParticipantScores(
      snap.exists ? (snap.data()?.scores as Record<string, unknown> | undefined) : undefined
    );
    const nextScores = { ...prev, [submissionId]: score };

    await ref.set(
      {
        eventId: HACK_A_SPRINT_2026_EVENT_ID,
        userId: user.uid,
        scores: nextScores,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true, submissionId, score });
  } catch (e) {
    console.error("[hack-a-sprint participant-score]", e);
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }
}
