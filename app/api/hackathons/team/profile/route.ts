import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/hackathons/team/profile
 * Body: { teamId, name?, logoUrl? }
 * Update team profile (name and logo). Only allowed when team has wins >= 1 and caller is a member.
 */
export async function PATCH(request: NextRequest) {
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
    const { teamId, name, logoUrl } = body;
    if (!teamId) {
      return NextResponse.json({ error: "teamId required" }, { status: 400 });
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

    const wins = team.wins ?? 0;
    if (wins < 1) {
      return NextResponse.json(
        { error: "Team profile is unlocked after winning a hackathon (wins >= 1)" },
        { status: 403 }
      );
    }

    const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    if (typeof name === "string") {
      updates.name = name.trim() || null;
    }
    if (typeof logoUrl === "string") {
      updates.logoUrl = logoUrl.trim() || null;
    }
    if (Object.keys(updates).length <= 1) {
      return NextResponse.json({ error: "Provide name and/or logoUrl" }, { status: 400 });
    }

    await teamRef.update(updates);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[hackathons/team/profile]", e);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
