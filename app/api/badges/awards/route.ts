import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import { getClientIdentifier } from "@/lib/rate-limit";
import { buildRateLimitHeaders, checkServerRateLimit } from "@/lib/rate-limit-server";
import { BADGE_IDS } from "@/lib/badges/definitions";
import { evaluateBadgeEligibility } from "@/lib/badges/eligibility";
import { logger } from "@/lib/logger";
import type {
  BadgeAwardSource,
  BadgeEligibilityInput,
  BadgeId,
  UserBadge,
} from "@/lib/badges/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const BADGE_AWARDS_POST_RATE_LIMIT = { windowMs: 60 * 1000, maxRequests: 30 };

const BADGE_ID_SET = new Set<BadgeId>(BADGE_IDS);
const TRUSTED_AWARD_SOURCES = new Set<BadgeAwardSource>(["system", "migration", "manual"]);

function toIsoDate(value: unknown): string | null {
  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  if (value && typeof value === "object") {
    const maybeTimestamp = value as { toDate?: () => Date };
    if (typeof maybeTimestamp.toDate === "function") {
      return maybeTimestamp.toDate().toISOString();
    }
  }

  return null;
}

function toUserBadgeFromDoc(
  docId: string,
  data: Record<string, unknown>
): UserBadge | null {
  const badgeIdValue = data.badgeId;
  const userIdValue = data.userId;
  const awardSourceValue = data.awardSource;
  const awardedAt = toIsoDate(data.awardedAt);

  if (
    typeof badgeIdValue !== "string" ||
    !BADGE_ID_SET.has(badgeIdValue as BadgeId) ||
    typeof userIdValue !== "string" ||
    typeof awardSourceValue !== "string" ||
    !TRUSTED_AWARD_SOURCES.has(awardSourceValue as BadgeAwardSource) ||
    !awardedAt
  ) {
    return null;
  }

  return {
    id: typeof data.id === "string" ? data.id : docId,
    userId: userIdValue,
    badgeId: badgeIdValue as BadgeId,
    awardedAt,
    awardSource: awardSourceValue as BadgeAwardSource,
    awardedBy: typeof data.awardedBy === "string" ? data.awardedBy : undefined,
  };
}

async function buildEligibilityInput(
  userId: string
): Promise<BadgeEligibilityInput> {
  // Keep this input assembly aligned with getBadgeEligibilityData in
  // lib/badges/getBadgeEligibilityInput.ts to avoid profile vs awards drift.
  const db = getAdminDb();
  if (!db) {
    return {};
  }

  const userRef = db.collection("users").doc(userId);
  const eventRegistrationsRef = db.collection("eventRegistrations");
  const talksRef = db.collection("talkSubmissions");
  const communityMessagesRef = db.collection("communityMessages");
  const pullRequestsRef = db.collection("pullRequests");
  const hackathonTeamsRef = db.collection("hackathonTeams");
  const hackathonPoolRef = db.collection("hackathonPool");
  const showcaseSubmissionsRef = db.collection("showcaseSubmissions");

  const [
    userSnap,
    eventRegistrationsSnap,
    talksSnap,
    communityMessagesSnap,
    mergedPrsSnap,
    hackathonTeamsSnap,
    hackathonPoolSnap,
    showcaseSubmissionsSnap,
  ] = await Promise.all([
    userRef.get(),
    eventRegistrationsRef.where("userId", "==", userId).get(),
    talksRef.where("userId", "==", userId).get(),
    communityMessagesRef.where("authorId", "==", userId).get(),
    pullRequestsRef
      .where("userId", "==", userId)
      .where("state", "==", "merged")
      .get(),
    hackathonTeamsRef.where("memberIds", "array-contains", userId).get(),
    hackathonPoolRef.where("userId", "==", userId).get(),
    showcaseSubmissionsRef.where("userId", "==", userId).get(),
  ]);

  const userData = userSnap.exists ? userSnap.data() || {} : {};
  const talksGiven = talksSnap.docs.filter((doc) => doc.data()?.status === "completed").length;
  const eventsAttended = eventRegistrationsSnap.docs.filter(
    (doc) => doc.data()?.status === "attended"
  ).length;

  return {
    hasDisplayName: Boolean(
      typeof userData.displayName === "string" && userData.displayName.trim()
    ),
    isPublicProfile: Boolean(
      userData.visibility &&
        typeof userData.visibility === "object" &&
        (userData.visibility as { isPublic?: boolean }).isPublic
    ),
    hasBio: Boolean(typeof userData.bio === "string" && userData.bio.trim()),
    hasAvatar: Boolean(userData.photoURL),
    hasDiscordConnected: Boolean(userData.discord),
    hasGithubConnected: Boolean(userData.github),
    eventsAttendedCount: eventsAttended,
    talksSubmittedCount: talksSnap.size,
    talksGivenCount: talksGiven,
    // Trust boundary: Contributor eligibility must come from repo-trusted merged PR evidence.
    // Never use users.pullRequestsCount as source of truth for awards.
    pullRequestsCount: mergedPrsSnap.size,
    communityMessagesCount: communityMessagesSnap.size,
    communityPostsCount: communityMessagesSnap.docs.filter((doc) => !doc.data()?.parentId)
      .length,
    hackathonParticipationCount: Math.max(hackathonTeamsSnap.size, hackathonPoolSnap.size),
    showcaseSubmissionsCount: showcaseSubmissionsSnap.docs.filter(
      (doc) => doc.data()?.status === "approved"
    ).length,
    mentorMatchesCount: 0,
  };
}

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

    const input = await buildEligibilityInput(user.uid);
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
      .map((doc) => toUserBadgeFromDoc(doc.id, doc.data()))
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
