import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import { getCurrentVirtualHackathonId } from "@/lib/hackathons";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/hackathons/pool/join
 * Join the hackathon pool for the current (or specified) virtual month.
 * Checks eligibility server-side before creating the pool doc.
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

    const userRef = db.collection("users").doc(user.uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: "Profile not found" }, { status: 400 });
    }

    const profile = userSnap.data();
    const visibility = profile?.visibility ?? {};
    if (visibility.isPublic !== true) {
      return NextResponse.json(
        { error: "Make your profile public in Settings to join the pool." },
        { status: 400 }
      );
    }
    if (!profile?.github) {
      return NextResponse.json(
        { error: "Connect GitHub in your profile to join the pool." },
        { status: 400 }
      );
    }
    if (!profile?.discord) {
      return NextResponse.json(
        { error: "Connect Discord in your profile to join the pool." },
        { status: 400 }
      );
    }
    if (visibility.showDiscord !== true) {
      return NextResponse.json(
        { error: "Turn on “Show Discord” in your public profile to join the pool." },
        { status: 400 }
      );
    }

    const leftTeamRef = db.collection("hackathonLeftTeam").doc(`${user.uid}_${hackathonId}`);
    const leftTeamSnap = await leftTeamRef.get();
    if (leftTeamSnap.exists) {
      return NextResponse.json(
        { error: "You left a team that had registered a repo this month. You can join a new team next month." },
        { status: 400 }
      );
    }

    const poolDocId = `${user.uid}_${hackathonId}`;
    const poolRef = db.collection("hackathonPool").doc(poolDocId);
    const poolSnap = await poolRef.get();
    if (poolSnap.exists) {
      return NextResponse.json({ joined: true, hackathonId }, { status: 200 });
    }

    await poolRef.set({
      userId: user.uid,
      hackathonId,
      joinedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ joined: true, hackathonId }, { status: 200 });
  } catch (e) {
    console.error("[hackathons/pool/join]", e);
    return NextResponse.json({ error: "Failed to join pool" }, { status: 500 });
  }
}
