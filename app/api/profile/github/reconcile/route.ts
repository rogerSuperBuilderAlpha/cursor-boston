import { NextRequest, NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/server-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { getClientIdentifier, checkRateLimit } from "@/lib/rate-limit";
import { reconcileMergedPrCreditForUser } from "@/lib/github-merged-pr-reconcile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_LIMIT = { windowMs: 60 * 1000, maxRequests: 10 };

export async function POST(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request as unknown as Request);
    const rateResult = checkRateLimit(`profile-github-reconcile:${clientId}`, RATE_LIMIT);
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

    const userSnap = await db.collection("users").doc(user.uid).get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const github =
      userSnap.data()?.github && typeof userSnap.data()?.github === "object" ?
        (userSnap.data()?.github as { login?: string })
      : null;
    const githubLogin =
      typeof github?.login === "string" && github.login.trim() ? github.login.trim() : null;

    if (!githubLogin) {
      return NextResponse.json({ error: "GitHub is not connected" }, { status: 400 });
    }

    const result = await reconcileMergedPrCreditForUser(user.uid, githubLogin);

    return NextResponse.json({
      success: true,
      githubLogin,
      mergedPrCount: result.mergedPrCount,
      syncedPrCount: result.syncedPrCount,
    });
  } catch (error) {
    console.error("[profile/github/reconcile]", error);
    return NextResponse.json(
      { error: "Failed to reconcile GitHub pull requests" },
      { status: 500 }
    );
  }
}
