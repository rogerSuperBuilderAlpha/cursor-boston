import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import {
  getJudgeUidSet,
  githubUserHasMergedLabeledShowcasePr,
} from "@/lib/hackathon-showcase";
import { userIsHackASprint2026Judge } from "@/lib/hackathon-showcase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let githubLogin: string | null = null;
    const db = getAdminDb();
    const judgeEligible = db
      ? await userIsHackASprint2026Judge(db, user.uid, user.email)
      : getJudgeUidSet().has(user.uid);

    if (db) {
      const doc = await db.collection("users").doc(user.uid).get();
      const login = doc.data()?.github?.login;
      if (typeof login === "string" && login.trim()) {
        githubLogin = login.trim();
      }
    }

    let participantEligible = false;
    if (githubLogin) {
      participantEligible =
        await githubUserHasMergedLabeledShowcasePr(githubLogin);
    }

    return NextResponse.json({
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
