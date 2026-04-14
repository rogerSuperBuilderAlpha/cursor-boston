/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { Firestore } from "firebase-admin/firestore";
import type { UserStats, EventRegistration } from "@/lib/registrations";
import {
  getBaseBadgeEligibilityInput,
  buildBadgeDataStatus,
  type BadgeEligibilityDataResult,
  type BadgeDataSource,
} from "@/lib/badges/getBadgeEligibilityInput";
import type { BadgeEligibilityInput } from "@/lib/badges/types";
import type { UserBadge, BadgeId, BadgeAwardSource } from "@/lib/badges/types";
import type { UserBadgeMap } from "@/lib/badges/data";
import type {
  ProfileDataApiResponse,
  ProfileRegistrationJson,
} from "@/lib/profile-data-types";

const TRUSTED_AWARD_SOURCES = new Set<BadgeAwardSource>(["system", "migration", "manual"]);

function logBadgeDataSourceError(source: BadgeDataSource, userId: string, error: unknown) {
  console.warn("[badges] data source load failed", {
    source,
    userId,
    error: error instanceof Error ? error.message : String(error),
  });
}

function parseUserBadgeAdmin(docId: string, data: Record<string, unknown>): UserBadge | null {
  const rawAwardedAt = data.awardedAt as
    | string
    | { toDate?: () => Date; seconds?: number }
    | undefined;

  let awardedAt: string | null = null;
  if (typeof rawAwardedAt === "string") {
    awardedAt = rawAwardedAt;
  } else if (rawAwardedAt && typeof rawAwardedAt.toDate === "function") {
    awardedAt = rawAwardedAt.toDate().toISOString();
  } else if (rawAwardedAt && typeof rawAwardedAt.seconds === "number") {
    awardedAt = new Date(rawAwardedAt.seconds * 1000).toISOString();
  }

  if (!data.userId || !data.badgeId || !awardedAt || !data.awardSource) {
    return null;
  }

  if (
    typeof data.awardSource !== "string" ||
    !TRUSTED_AWARD_SOURCES.has(data.awardSource as BadgeAwardSource)
  ) {
    return null;
  }

  return {
    id: (data.id as string) || docId,
    userId: data.userId as string,
    badgeId: data.badgeId as BadgeId,
    awardedAt,
    awardSource: data.awardSource as BadgeAwardSource,
    awardedBy: data.awardedBy as string | undefined,
  };
}

function tsToIso(value: unknown): string | null {
  if (value && typeof value === "object" && "toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
    const d = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

/**
 * One consolidated read path for profile overview + badges (Admin SDK).
 * Replaces multiple client getDocs chains and duplicate queries.
 */
export async function fetchProfileDataBundleJson(
  db: Firestore,
  uid: string
): Promise<ProfileDataApiResponse> {
  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();
  const userData = userSnap.exists ? (userSnap.data() as Record<string, unknown>) : {};

  const displayName = (userData.displayName as string | undefined) ?? null;
  const visibility = (userData.visibility as { isPublic?: boolean } | undefined) ?? null;
  const bio = (userData.bio as string | undefined) ?? null;
  const photoURL = (userData.photoURL as string | undefined) ?? null;
  const discord = userData.discord;
  const github = userData.github;

  const base = getBaseBadgeEligibilityInput({
    displayName,
    visibility,
    bio,
    photoURL,
    discord,
    github,
  });

  const sourceStates: Record<BadgeDataSource, "ok" | "error"> = {
    stats: "error",
    showcaseSubmissions: "error",
    communityMessages: "error",
    pullRequests: "error",
    hackathonParticipation: "error",
  };

  const [
    regSnap,
    talksSnap,
    mergedPrSnap,
    showcaseSnap,
    messagesSnap,
    teamsSnap,
    poolSnap,
    userBadgesSnap,
  ] = await Promise.all([
    db.collection("eventRegistrations").where("userId", "==", uid).get(),
    db.collection("talkSubmissions").where("userId", "==", uid).get(),
    db
      .collection("pullRequests")
      .where("userId", "==", uid)
      .where("state", "==", "merged")
      .get(),
    db.collection("showcaseSubmissions").where("userId", "==", uid).get(),
    db.collection("communityMessages").where("authorId", "==", uid).get(),
    db.collection("hackathonTeams").where("memberIds", "array-contains", uid).get(),
    db.collection("hackathonPool").where("userId", "==", uid).get(),
    db.collection("user_badges").where("userId", "==", uid).get(),
  ]);

  const registrations: ProfileRegistrationJson[] = regSnap.docs.map((doc) => {
    const d = doc.data() as Record<string, unknown>;
    return {
      id: (d.id as string) || doc.id,
      eventId: d.eventId as string,
      eventTitle: d.eventTitle as string,
      eventDate: d.eventDate as string | undefined,
      userId: d.userId as string,
      userEmail: d.userEmail as string,
      userName: d.userName as string | undefined,
      registeredAt: tsToIso(d.registeredAt) ?? tsToIso(d.createdAt),
      source: d.source as EventRegistration["source"],
      lumaGuestId: d.lumaGuestId as string | undefined,
      status: d.status as EventRegistration["status"],
    };
  });

  const eventsRegistered = registrations.length;
  const eventsAttended = registrations.filter((r) => r.status === "attended").length;
  const talksSubmitted = talksSnap.size;
  const talksGiven = talksSnap.docs.filter((doc) => doc.data().status === "completed").length;
  const pullRequestsCount = mergedPrSnap.size;

  const stats: UserStats = {
    eventsRegistered,
    eventsAttended,
    talksSubmitted,
    talksGiven,
    pullRequestsCount,
  };

  try {
    base.eventsAttendedCount = stats.eventsAttended || 0;
    base.talksSubmittedCount = stats.talksSubmitted || 0;
    base.talksGivenCount = stats.talksGiven || 0;
    base.pullRequestsCount = stats.pullRequestsCount || 0;
    sourceStates.stats = "ok";
  } catch (error) {
    logBadgeDataSourceError("stats", uid, error);
  }

  const talks = talksSnap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      title: (d.title as string) || "",
      status: (d.status as string) || "",
      submittedAt: tsToIso(d.submittedAt),
    };
  });

  try {
    base.showcaseSubmissionsCount = showcaseSnap.docs.filter((doc) => {
      const data = doc.data() as { status?: string };
      return data.status === "approved";
    }).length;
    sourceStates.showcaseSubmissions = "ok";
  } catch (error) {
    logBadgeDataSourceError("showcaseSubmissions", uid, error);
  }

  try {
    base.communityMessagesCount = messagesSnap.size;
    base.communityPostsCount = messagesSnap.docs.filter((doc) => {
      const data = doc.data() as { parentId?: string | null };
      return !data.parentId;
    }).length;
    sourceStates.communityMessages = "ok";
  } catch (error) {
    logBadgeDataSourceError("communityMessages", uid, error);
  }

  try {
    base.pullRequestsCount = mergedPrSnap.size;
    sourceStates.pullRequests = "ok";
  } catch (error) {
    logBadgeDataSourceError("pullRequests", uid, error);
  }

  try {
    base.hackathonParticipationCount = Math.max(teamsSnap.size, poolSnap.size);
    sourceStates.hackathonParticipation = "ok";
  } catch (error) {
    logBadgeDataSourceError("hackathonParticipation", uid, error);
  }

  const badgeEligibility: BadgeEligibilityDataResult = {
    input: base as BadgeEligibilityInput,
    status: buildBadgeDataStatus(sourceStates),
  };

  const userBadgeMap: UserBadgeMap = {};
  userBadgesSnap.docs.forEach((doc) => {
    const badge = parseUserBadgeAdmin(doc.id, doc.data() as Record<string, unknown>);
    if (badge) {
      userBadgeMap[badge.badgeId] = badge;
    }
  });

  return {
    stats,
    registrations,
    talks,
    badgeEligibility,
    userBadgeMap,
  };
}
