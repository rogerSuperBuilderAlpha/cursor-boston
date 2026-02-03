import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { sanitizeDocId } from "@/lib/sanitize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HACKATHON_RATE_LIMIT = { windowMs: 60 * 1000, maxRequests: 10 };

/**
 * POST /api/hackathons/team/leave
 * Body: { teamId }
 * Leave the team: remove current user from memberIds. If team had a registered repo for this hackathon, disqualify submission and write hackathonLeftTeam for leaver (lockout until next month).
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request as unknown as Request);
    const rateResult = checkRateLimit(`hackathon-team-leave:${clientId}`, HACKATHON_RATE_LIMIT);
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

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const { teamId } = await request.json().catch(() => ({}));
    
    // Validate and sanitize teamId
    const sanitizedTeamId = sanitizeDocId(teamId);
    if (!sanitizedTeamId) {
      return NextResponse.json({ error: "Invalid teamId format" }, { status: 400 });
    }

    const teamRef = db.collection("hackathonTeams").doc(sanitizedTeamId);
    const teamSnap = await teamRef.get();
    if (!teamSnap.exists) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const team = teamSnap.data()!;
    const memberIds: string[] = team.memberIds || [];
    if (!memberIds.includes(user.uid)) {
      return NextResponse.json({ error: "You are not on this team" }, { status: 403 });
    }

    const hackathonId = team.hackathonId;

    const submissionSnap = await db
      .collection("hackathonSubmissions")
      .where("teamId", "==", sanitizedTeamId)
      .where("hackathonId", "==", hackathonId)
      .limit(1)
      .get();

    const hadSubmission = !submissionSnap.empty;
    const submissionRef = submissionSnap.docs[0]?.ref;

    await db.runTransaction(async (tx) => {
      const newMemberIds = memberIds.filter((id) => id !== user.uid);
      if (newMemberIds.length <= 1) {
        tx.delete(teamRef);
      } else {
        tx.update(teamRef, {
          memberIds: newMemberIds,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      if (hadSubmission && submissionRef) {
        tx.update(submissionRef, {
          disqualified: true,
          disqualifiedReason: "Member left",
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      if (hadSubmission) {
        const leftTeamDocId = `${user.uid}_${hackathonId}`;
        tx.set(db.collection("hackathonLeftTeam").doc(leftTeamDocId), {
          userId: user.uid,
          hackathonId,
          leftAt: FieldValue.serverTimestamp(),
        });
      }
    });

    return NextResponse.json({
      left: true,
      disqualified: hadSubmission,
      lockoutUntilNextMonth: hadSubmission,
    });
  } catch (e) {
    console.error("[hackathons/team/leave]", e);
    return NextResponse.json({ error: "Failed to leave team" }, { status: 500 });
  }
}
