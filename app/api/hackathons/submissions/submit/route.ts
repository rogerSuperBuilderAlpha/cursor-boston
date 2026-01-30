import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import {
  getCurrentVirtualHackathonId,
  getSubmissionCutoffForMonth,
  isVirtualHackathonId,
} from "@/lib/hackathons";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/hackathons/submissions/submit
 * Body: { hackathonId? }
 * Lock submission: set submittedAt and cutoffAt (1st of next month 00:00 Boston).
 * Only allowed before cutoff.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const hackathonId = (body.hackathonId as string) || getCurrentVirtualHackathonId();

    if (!isVirtualHackathonId(hackathonId)) {
      return NextResponse.json(
        { error: "Submit is only for virtual (monthly) hackathons" },
        { status: 400 }
      );
    }

    const match = hackathonId.match(/^virtual-(\d{4})-(\d{2})$/);
    const year = match ? parseInt(match[1], 10) : 0;
    const month1 = match ? parseInt(match[2], 10) : 0;
    const cutoff = getSubmissionCutoffForMonth(year, month1);

    if (new Date() >= cutoff) {
      return NextResponse.json(
        { error: "Submission period has ended. No more submissions for this month." },
        { status: 400 }
      );
    }

    const teamSnap = await db
      .collection("hackathonTeams")
      .where("hackathonId", "==", hackathonId)
      .where("memberIds", "array-contains", user.uid)
      .limit(1)
      .get();

    if (teamSnap.empty) {
      return NextResponse.json({ error: "You are not on a team for this hackathon" }, { status: 403 });
    }

    const teamId = teamSnap.docs[0].id;
    const submissionId = `${hackathonId}_${teamId}`;
    const submissionRef = db.collection("hackathonSubmissions").doc(submissionId);
    const submissionSnap = await submissionRef.get();

    if (!submissionSnap.exists) {
      return NextResponse.json(
        { error: "Register a repo first before submitting" },
        { status: 400 }
      );
    }

    const sub = submissionSnap.data()!;
    if (sub.submittedAt) {
      return NextResponse.json(
        { error: "Already submitted", submittedAt: sub.submittedAt },
        { status: 200 }
      );
    }

    await submissionRef.update({
      submittedAt: FieldValue.serverTimestamp(),
      cutoffAt: cutoff,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      submitted: true,
      submissionId,
      cutoffAt: cutoff.toISOString(),
    });
  } catch (e) {
    console.error("[hackathons/submissions/submit]", e);
    return NextResponse.json({ error: "Failed to submit" }, { status: 500 });
  }
}
