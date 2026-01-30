import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/hackathons/requests/accept
 * Body: { requestId }
 * Accept a join request: add requester to the team (if team has < 3 and requester not on another team), update request status.
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

    const { requestId } = await request.json().catch(() => ({}));
    if (!requestId) {
      return NextResponse.json({ error: "requestId required" }, { status: 400 });
    }

    const reqRef = db.collection("hackathonJoinRequests").doc(requestId);
    const reqSnap = await reqRef.get();
    if (!reqSnap.exists) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    const reqData = reqSnap.data()!;
    const fromUserId = reqData.fromUserId;
    const teamId = reqData.teamId;
    if (reqData.status !== "pending") {
      return NextResponse.json({ error: "Request already handled" }, { status: 400 });
    }

    const teamRef = db.collection("hackathonTeams").doc(teamId);
    const teamSnap = await teamRef.get();
    if (!teamSnap.exists) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const team = teamSnap.data()!;
    const memberIds: string[] = team.memberIds || [];
    if (!memberIds.includes(user.uid)) {
      return NextResponse.json({ error: "You are not a member of this team" }, { status: 403 });
    }
    if (memberIds.length >= 3) {
      return NextResponse.json({ error: "Team is full" }, { status: 400 });
    }
    if (memberIds.includes(fromUserId)) {
      await reqRef.update({ status: "accepted" });
      return NextResponse.json({ accepted: true }, { status: 200 });
    }

    const hackathonId = team.hackathonId;
    const existingTeamSnap = await db
      .collection("hackathonTeams")
      .where("hackathonId", "==", hackathonId)
      .where("memberIds", "array-contains", fromUserId)
      .limit(1)
      .get();
    if (!existingTeamSnap.empty) {
      return NextResponse.json(
        { error: "That user is already on a team for this hackathon" },
        { status: 400 }
      );
    }

    await db.runTransaction(async (tx) => {
      tx.update(teamRef, {
        memberIds: FieldValue.arrayUnion(fromUserId),
        updatedAt: FieldValue.serverTimestamp(),
      });
      tx.update(reqRef, { status: "accepted" });
    });

    return NextResponse.json({ accepted: true }, { status: 200 });
  } catch (e) {
    console.error("[hackathons/requests/accept]", e);
    return NextResponse.json({ error: "Failed to accept request" }, { status: 500 });
  }
}
