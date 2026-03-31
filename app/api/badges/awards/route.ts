import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import { getClientIdentifier } from "@/lib/rate-limit";
import { buildRateLimitHeaders, checkServerRateLimit } from "@/lib/rate-limit-server";
import { BADGE_IDS } from "@/lib/badges/definitions";
import { evaluateBadgeEligibility } from "@/lib/badges/eligibility";
import {
  buildAdminBadgeEligibilityInput,
  userBadgeFromFirestoreDoc,
} from "@/lib/badges/admin-badge-awards";
import { logger } from "@/lib/logger";
import type { BadgeId, UserBadge } from "@/lib/badges/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const BADGE_AWARDS_POST_RATE_LIMIT = { windowMs: 60 * 1000, maxRequests: 30 };

export async function POST(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateResult = await checkServerRateLimit(request as unknown as Request, {
      scope: "badges-awards-post",
      windowMs: BADGE_AWARDS_POST_RATE_LIMIT.windowMs,
      maxRequests: BADGE_AWARDS_POST_RATE_LIMIT.maxRequests,
      identifier: `uid:${user.uid}|ip:${getClientIdentifier(request as unknown as Request)}`,
      fallbackMode: "strict-memory",
      fallbackMaxRequests: 10,
    });
    if (!rateResult.success) {
      return NextResponse.json(
        { error: "Too many requests", retryAfterSeconds: rateResult.retryAfter },
        {
          status: rateResult.statusCode ?? 429,
          headers: buildRateLimitHeaders(
            rateResult,
            BADGE_AWARDS_POST_RATE_LIMIT.maxRequests
          ),
        }
      );
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const input = await buildAdminBadgeEligibilityInput(user.uid);
    const eligibilityMap = evaluateBadgeEligibility(input);
    const eligibleBadgeIds = (Object.entries(eligibilityMap) as Array<
      [BadgeId, { isEligible: boolean }]
    >)
      .filter(([, eligibility]) => eligibility.isEligible)
      .map(([badgeId]) => badgeId);

    const userBadgesRef = db.collection("user_badges");
    const existingSnapshot = await userBadgesRef.where("userId", "==", user.uid).get();
    const existingByBadgeId = new Set<string>(
      existingSnapshot.docs
        .map((doc) => doc.data()?.badgeId)
        .filter((badgeId): badgeId is string => typeof badgeId === "string")
    );

    const missingEligibleBadgeIds = eligibleBadgeIds.filter(
      (badgeId) => !existingByBadgeId.has(badgeId)
    );

    if (missingEligibleBadgeIds.length > 0) {
      const batch = db.batch();
      for (const badgeId of missingEligibleBadgeIds) {
        const docId = `${user.uid}_${badgeId}`;
        const docRef = userBadgesRef.doc(docId);
        batch.set(docRef, {
          id: docId,
          userId: user.uid,
          badgeId,
          awardedAt: FieldValue.serverTimestamp(),
          awardSource: "system",
          awardedBy: "badge-awards-api",
        });
      }
      await batch.commit();
    }

    const finalSnapshot =
      missingEligibleBadgeIds.length > 0
        ? await userBadgesRef.where("userId", "==", user.uid).get()
        : existingSnapshot;

    const userBadges = finalSnapshot.docs
      .map((doc) => userBadgeFromFirestoreDoc(doc.id, doc.data()))
      .filter((badge): badge is UserBadge => badge !== null);
    const persistedEarnedBadgeIds = BADGE_IDS.filter((badgeId) =>
      userBadges.some((badge) => badge.badgeId === badgeId)
    );

    await db.collection("users").doc(user.uid).set(
      {
        earnedBadgeIds: persistedEarnedBadgeIds,
      },
      { merge: true }
    );

    return NextResponse.json({
      userBadges,
      eligibleBadgeIds,
    });
  } catch (error) {
    logger.logError(error, {
      endpoint: "/api/badges/awards",
      method: "POST",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
