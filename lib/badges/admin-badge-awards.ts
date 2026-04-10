/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { BADGE_IDS } from "@/lib/badges/definitions";
import { evaluateBadgeEligibility } from "@/lib/badges/eligibility";
import type {
  BadgeAwardSource,
  BadgeEligibilityInput,
  BadgeId,
  UserBadge,
} from "@/lib/badges/types";

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

export function userBadgeFromFirestoreDoc(
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

/**
 * Builds badge eligibility input using the Admin SDK (same shape as /api/badges/awards POST).
 * Keep aligned with client-side getBadgeEligibilityData where fields overlap.
 */
export async function buildAdminBadgeEligibilityInput(
  userId: string
): Promise<BadgeEligibilityInput> {
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

export type SyncUserBadgesResult = {
  eligibleBadgeIds: BadgeId[];
  newlyAwardedBadgeIds: BadgeId[];
};

/**
 * Awards any missing badges for which the user is eligible (Admin SDK, trusted source).
 * Also refreshes users.earnedBadgeIds to match persisted user_badges rows.
 */
export async function syncUserBadgesForUser(
  userId: string,
  options: { awardedBy: string }
): Promise<SyncUserBadgesResult> {
  const db = getAdminDb();
  if (!db) {
    return { eligibleBadgeIds: [], newlyAwardedBadgeIds: [] };
  }

  const input = await buildAdminBadgeEligibilityInput(userId);
  const eligibilityMap = evaluateBadgeEligibility(input);
  const eligibleBadgeIds = (Object.entries(eligibilityMap) as Array<
    [BadgeId, { isEligible: boolean }]
  >)
    .filter(([, eligibility]) => eligibility.isEligible)
    .map(([badgeId]) => badgeId);

  const userBadgesRef = db.collection("user_badges");
  const existingSnapshot = await userBadgesRef.where("userId", "==", userId).get();
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
      const docId = `${userId}_${badgeId}`;
      const docRef = userBadgesRef.doc(docId);
      batch.set(docRef, {
        id: docId,
        userId,
        badgeId,
        awardedAt: FieldValue.serverTimestamp(),
        awardSource: "migration",
        awardedBy: options.awardedBy,
      });
    }
    await batch.commit();
  }

  const finalSnapshot =
    missingEligibleBadgeIds.length > 0
      ? await userBadgesRef.where("userId", "==", userId).get()
      : existingSnapshot;

  const userBadges = finalSnapshot.docs
    .map((doc) => userBadgeFromFirestoreDoc(doc.id, doc.data()))
    .filter((badge): badge is UserBadge => badge !== null);
  const persistedEarnedBadgeIds = BADGE_IDS.filter((badgeId) =>
    userBadges.some((badge) => badge.badgeId === badgeId)
  );

  await db.collection("users").doc(userId).set(
    {
      earnedBadgeIds: persistedEarnedBadgeIds,
    },
    { merge: true }
  );

  return {
    eligibleBadgeIds,
    newlyAwardedBadgeIds: missingEligibleBadgeIds,
  };
}
