import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import {
  getJudgeUidSet,
  githubUserHasMergedLabeledShowcasePr,
} from "@/lib/hackathon-showcase";
import { userIsHackASprint2026Judge } from "@/lib/hackathon-showcase-admin";
import { getHackASprint2026Phase } from "@/lib/hackathon-asprint-2026-schedule";
import {
  userHasHackASprint2026Signup,
  userHackASprint2026PeerVoteComplete,
} from "@/lib/hackathon-asprint-2026-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getAdminDb();
    let githubLogin: string | null = null;
    let unlocked = false;
    let signedUp = false;
    let hasCompletedPeerVoting = false;

    const judgeEligible = db
      ? await userIsHackASprint2026Judge(db, user.uid, user.email)
      : getJudgeUidSet().has(user.uid);

    if (db) {
      const userSnap = await db.collection("users").doc(user.uid).get();
      const ud = userSnap.data();
      const login = ud?.github?.login;
      if (typeof login === "string" && login.trim()) {
        githubLogin = login.trim();
      }
      unlocked = ud?.hackASprint2026Unlocked === true;
      signedUp = await userHasHackASprint2026Signup(db, user.uid);
      hasCompletedPeerVoting = await userHackASprint2026PeerVoteComplete(
        db,
        user.uid
      );
    }

    let participantEligible = false;
    if (githubLogin) {
      participantEligible =
        await githubUserHasMergedLabeledShowcasePr(githubLogin);
    }

    const phase = getHackASprint2026Phase();

    return NextResponse.json({
      phase,
      signedUp,
      unlocked,
      hasCompletedPeerVoting,
      participantEligible,
      judgeEligible,
      githubLogin,
    });
  } catch (e) {
    console.error("[showcase me]", e);
    return NextResponse.json(
      { error: "Failed to load eligibility" },
      { status: 500 }
    );
  }
}
