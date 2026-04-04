import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import {
  HACK_A_SPRINT_2026_EVENT_ID,
  fetchShowcaseSubmissionsFromGitHub,
} from "@/lib/hackathon-showcase";
import { userIsHackASprint2026Judge } from "@/lib/hackathon-showcase-admin";
import { getHackASprint2026Phase } from "@/lib/hackathon-asprint-2026-schedule";
import { hackASprint2026ScoreDocId } from "@/lib/hackathon-asprint-2026-state";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE = { windowMs: 60 * 1000, maxRequests: 40 };

export async function POST(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request as unknown as Request);
    const rate = checkRateLimit(`hack-asprint-judge:${clientId}`, RATE);
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
        { error: "Judge scoring is only open during the judging window." },
        { status: 403 }
      );
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const okJudge = await userIsHackASprint2026Judge(db, user.uid, user.email);
    if (!okJudge) {
      return NextResponse.json({ error: "Not a judge" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const submissionId = String(
      (body as { submissionId?: string }).submissionId ?? ""
    )
      .trim()
      .toLowerCase();
    const score = Number((body as { score?: number }).score);

    if (!submissionId || !Number.isInteger(score) || score < 1 || score > 10) {
      return NextResponse.json(
        { error: "submissionId and integer score 1-10 required" },
        { status: 400 }
      );
    }

    const submissions = await fetchShowcaseSubmissionsFromGitHub();
    if (!submissions.some((s) => s.submissionId === submissionId)) {
      return NextResponse.json({ error: "Unknown submission" }, { status: 400 });
    }

    const ref = db
      .collection("hackathonShowcaseScores")
      .doc(hackASprint2026ScoreDocId(submissionId));

    await ref.set(
      {
        eventId: HACK_A_SPRINT_2026_EVENT_ID,
        submissionId,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await ref.update({
      [`judgeScores.${user.uid}`]: score,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[hack-a-sprint judge-score]", e);
    return NextResponse.json({ error: "Failed to save judge score" }, { status: 500 });
  }
}
