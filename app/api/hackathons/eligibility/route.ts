import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import { getCurrentVirtualHackathonId } from "@/lib/hackathons";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/hackathons/eligibility
 * Returns whether the authenticated user can join the hackathon pool.
 * Requires: public profile, GitHub connected, Discord connected, Discord visible.
 * Also checks left-team lockout for current month.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json(
        { eligible: false, reason: "Server not configured" },
        { status: 200 }
      );
    }

    const hackathonId = request.nextUrl.searchParams.get("hackathonId") ?? getCurrentVirtualHackathonId();

    const userRef = db.collection("users").doc(user.uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return NextResponse.json(
        { eligible: false, reason: "Profile not found" },
        { status: 200 }
      );
    }

    const profile = userSnap.data();
    const visibility = profile?.visibility ?? {};
    const isPublic = visibility.isPublic === true;
    const hasGithub = Boolean(profile?.github);
    const hasDiscord = Boolean(profile?.discord);
    const showDiscord = visibility.showDiscord === true;

    if (!isPublic) {
      return NextResponse.json(
        { eligible: false, reason: "Make your profile public in Settings to join the pool." },
        { status: 200 }
      );
    }
    if (!hasGithub) {
      return NextResponse.json(
        { eligible: false, reason: "Connect GitHub in your profile to join the pool." },
        { status: 200 }
      );
    }
    if (!hasDiscord) {
      return NextResponse.json(
        { eligible: false, reason: "Connect Discord in your profile to join the pool." },
        { status: 200 }
      );
    }
    if (!showDiscord) {
      return NextResponse.json(
        { eligible: false, reason: "Turn on “Show Discord” in your public profile to join the pool." },
        { status: 200 }
      );
    }

    const leftTeamRef = db.collection("hackathonLeftTeam").doc(`${user.uid}_${hackathonId}`);
    const leftTeamSnap = await leftTeamRef.get();
    if (leftTeamSnap.exists) {
      return NextResponse.json(
        { eligible: false, reason: "You left a team that had registered a repo this month. You can join a new team next month." },
        { status: 200 }
      );
    }

    return NextResponse.json({ eligible: true }, { status: 200 });
  } catch (e) {
    console.error("[hackathons/eligibility]", e);
    return NextResponse.json(
      { eligible: false, reason: "Could not check eligibility." },
      { status: 200 }
    );
  }
}
