import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import {
  HACK_A_SPRINT_2026_EVENT_ID,
  fetchShowcaseSubmissionsFromGitHub,
  githubUserHasMergedLabeledShowcasePr,
} from "@/lib/hackathon-showcase";
import { userIsHackASprint2026Judge } from "@/lib/hackathon-showcase-admin";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VOTE_RATE = { windowMs: 60 * 1000, maxRequests: 40 };

type Channel = "participant" | "community" | "judge";

function voteDocId(
  eventId: string,
  channel: Channel,
  submissionId: string,
  userId: string
): string {
  return `${eventId}__${channel}__${submissionId}__${userId}`;
}

export async function POST(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request as unknown as Request);
    const rate = checkRateLimit(`showcase-vote:${clientId}`, VOTE_RATE);
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

    const body = await request.json().catch(() => ({}));
    const submissionId = (body.submissionId as string)?.trim().toLowerCase();
    const channel = body.channel as Channel;
    const value = body.value as number;

    if (!submissionId || !["participant", "community", "judge"].includes(channel)) {
      return NextResponse.json({ error: "Invalid submissionId or channel" }, { status: 400 });
    }
    if (value !== 1 && value !== -1 && value !== 0) {
      return NextResponse.json({ error: "value must be 1, -1, or 0" }, { status: 400 });
    }

    const submissions = await fetchShowcaseSubmissionsFromGitHub();
    const allowed = new Set(submissions.map((s) => s.submissionId));
    if (!allowed.has(submissionId)) {
      return NextResponse.json({ error: "Unknown submission" }, { status: 400 });
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    if (channel === "community") {
      // any authenticated user
    } else if (channel === "judge") {
      const okJudge = await userIsHackASprint2026Judge(
        db,
        user.uid,
        user.email
      );
      if (!okJudge) {
        return NextResponse.json({ error: "Not a judge" }, { status: 403 });
      }
    } else {
      const userDoc = await db.collection("users").doc(user.uid).get();
      const login = userDoc.data()?.github?.login;
      const ghLogin = typeof login === "string" ? login.trim() : "";
      if (!ghLogin) {
        return NextResponse.json(
          { error: "Connect GitHub on your profile to use participant voting" },
          { status: 403 }
        );
      }
      const ok = await githubUserHasMergedLabeledShowcasePr(ghLogin);
      if (!ok) {
        return NextResponse.json(
          {
            error:
              "Participant voting requires a merged PR with label hack-a-sprint-2026 that adds your submission",
          },
          { status: 403 }
        );
      }
    }

    const uidRate = checkRateLimit(`showcase-vote-uid:${user.uid}`, VOTE_RATE);
    if (!uidRate.success) {
      return NextResponse.json(
        { error: "Too many requests", retryAfterSeconds: uidRate.retryAfter },
        { status: 429 }
      );
    }

    const docId = voteDocId(HACK_A_SPRINT_2026_EVENT_ID, channel, submissionId, user.uid);
    const ref = db.collection("hackathonShowcaseVotes").doc(docId);

    if (value === 0) {
      await ref.delete().catch(() => undefined);
    } else {
      await ref.set({
        eventId: HACK_A_SPRINT_2026_EVENT_ID,
        channel,
        submissionId,
        userId: user.uid,
        value,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[showcase vote]", e);
    return NextResponse.json({ error: "Vote failed" }, { status: 500 });
  }
}
