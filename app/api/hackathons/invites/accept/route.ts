import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { sanitizeDocId } from "@/lib/sanitize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HACKATHON_RATE_LIMIT = { windowMs: 60 * 1000, maxRequests: 20 };

/**
 * POST /api/hackathons/invites/accept
 * Body: { inviteId }
 * Accept an invite: add current user to the team (if team has < 3 and user not already on another team), update invite status.
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request as unknown as Request);
    const rateResult = checkRateLimit(`hackathon-invite-accept:${clientId}`, HACKATHON_RATE_LIMIT);
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

    const { inviteId } = await request.json().catch(() => ({}));
    
    // Validate and sanitize inviteId
    const sanitizedInviteId = sanitizeDocId(inviteId);
    if (!sanitizedInviteId) {
      return NextResponse.json({ error: "Invalid inviteId format" }, { status: 400 });
    }

    const inviteRef = db.collection("hackathonInvites").doc(sanitizedInviteId);
    const inviteSnap = await inviteRef.get();
    if (!inviteSnap.exists) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    const invite = inviteSnap.data()!;
    if (invite.toUserId !== user.uid) {
      return NextResponse.json({ error: "Not your invite" }, { status: 403 });
    }
    if (invite.status !== "pending") {
      return NextResponse.json({ error: "Invite already handled" }, { status: 400 });
    }

    const teamRef = db.collection("hackathonTeams").doc(invite.teamId);
    const teamSnap = await teamRef.get();
    if (!teamSnap.exists) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const team = teamSnap.data()!;
    const memberIds: string[] = team.memberIds || [];
    if (memberIds.length >= 3) {
      return NextResponse.json({ error: "Team is full" }, { status: 400 });
    }
    if (memberIds.includes(user.uid)) {
      await inviteRef.update({ status: "accepted" });
      return NextResponse.json({ accepted: true }, { status: 200 });
    }

    const hackathonId = team.hackathonId;

    await db.runTransaction(async (tx) => {
      // Check inside transaction to prevent race condition where user
      // accepts two invites concurrently and joins multiple teams
      const existingTeamSnap = await db
        .collection("hackathonTeams")
        .where("hackathonId", "==", hackathonId)
        .where("memberIds", "array-contains", user.uid)
        .limit(1)
        .get();
      if (!existingTeamSnap.empty) {
        throw new Error("ALREADY_ON_TEAM");
      }

      // Re-check team size inside transaction
      const freshTeamSnap = await tx.get(teamRef);
      const freshTeam = freshTeamSnap.data();
      if (!freshTeam || (freshTeam.memberIds || []).length >= 3) {
        throw new Error("TEAM_FULL");
      }

      tx.update(teamRef, {
        memberIds: FieldValue.arrayUnion(user.uid),
        updatedAt: FieldValue.serverTimestamp(),
      });
      tx.update(inviteRef, { status: "accepted" });
    });

    return NextResponse.json({ accepted: true }, { status: 200 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    if (message === "ALREADY_ON_TEAM") {
      return NextResponse.json(
        { error: "You are already on a team for this hackathon" },
        { status: 400 }
      );
    }
    if (message === "TEAM_FULL") {
      return NextResponse.json({ error: "Team is full" }, { status: 400 });
    }
    console.error("[hackathons/invites/accept]", e);
    return NextResponse.json({ error: "Failed to accept invite" }, { status: 500 });
  }
}
