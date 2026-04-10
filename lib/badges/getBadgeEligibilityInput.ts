/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { getUserStats } from "../registrations";
import type { BadgeEligibilityInput } from "./types";

interface BadgeEligibilityUserContext {
  displayName?: string | null;
  visibility?: { isPublic?: boolean } | null;
  bio?: string | null;
  photoURL?: string | null;
  discord?: unknown;
  github?: unknown;
}

type BadgeDataSource =
  | "stats"
  | "showcaseSubmissions"
  | "communityMessages"
  | "pullRequests"
  | "hackathonParticipation";

export type BadgeEligibilityDataState = "complete" | "partial" | "failed";

export interface BadgeEligibilityDataStatus {
  state: BadgeEligibilityDataState;
  isAuthoritative: boolean;
  failedSources: BadgeDataSource[];
  message?: string;
}

export interface BadgeEligibilityDataResult {
  input: BadgeEligibilityInput;
  status: BadgeEligibilityDataStatus;
}

export function getBaseBadgeEligibilityInput(
  user: BadgeEligibilityUserContext
): BadgeEligibilityInput {
  return {
    hasDisplayName: Boolean(user.displayName?.trim()),
    isPublicProfile: Boolean(user.visibility?.isPublic),
    hasBio: Boolean(user.bio?.trim()),
    hasAvatar: Boolean(user.photoURL),
    hasDiscordConnected: Boolean(user.discord),
    hasGithubConnected: Boolean(user.github),
    eventsAttendedCount: 0,
    talksSubmittedCount: 0,
    talksGivenCount: 0,
    pullRequestsCount: 0,
    communityPostsCount: 0,
    communityMessagesCount: 0,
    hackathonParticipationCount: 0,
    showcaseSubmissionsCount: 0,
    mentorMatchesCount: 0,
  };
}

function buildBadgeDataStatus(
  sourceStates: Record<BadgeDataSource, "ok" | "error">
): BadgeEligibilityDataStatus {
  const failedSources = (Object.entries(sourceStates) as Array<
    [BadgeDataSource, "ok" | "error"]
  >)
    .filter(([, state]) => state === "error")
    .map(([source]) => source);

  const okCount = Object.values(sourceStates).filter((state) => state === "ok").length;

  if (failedSources.length === 0) {
    return {
      state: "complete",
      isAuthoritative: true,
      failedSources: [],
    };
  }

  if (okCount === 0) {
    return {
      state: "failed",
      isAuthoritative: false,
      failedSources,
      message:
        "Badge data is currently unavailable. Showing limited fallback values.",
    };
  }

  return {
    state: "partial",
    isAuthoritative: false,
    failedSources,
    message:
      "Some badge data could not be loaded. Badge progress may be incomplete.",
  };
}

function logBadgeDataSourceError(
  source: BadgeDataSource,
  userId: string,
  error: unknown
) {
  console.warn("[badges] data source load failed", {
    source,
    userId,
    error: error instanceof Error ? error.message : String(error),
  });
}

export async function getBadgeEligibilityData(user: {
  uid: string;
} & BadgeEligibilityUserContext): Promise<BadgeEligibilityDataResult> {
  const base = getBaseBadgeEligibilityInput(user);
  const sourceStates: Record<BadgeDataSource, "ok" | "error"> = {
    stats: "error",
    showcaseSubmissions: "error",
    communityMessages: "error",
    pullRequests: "error",
    hackathonParticipation: "error",
  };

  if (!user.uid) {
    return {
      input: base,
      status: buildBadgeDataStatus(sourceStates),
    };
  }

  try {
    const stats = await getUserStats(user.uid);
    base.eventsAttendedCount = stats.eventsAttended || 0;
    base.talksSubmittedCount = stats.talksSubmitted || 0;
    base.talksGivenCount = stats.talksGiven || 0;
    sourceStates.stats = "ok";
  } catch (error) {
    logBadgeDataSourceError("stats", user.uid, error);
  }

  if (!db) {
    const status = buildBadgeDataStatus(sourceStates);
    if (status.state !== "complete") {
      console.warn("[badges] badge data not fully available", {
        userId: user.uid,
        state: status.state,
        failedSources: status.failedSources,
      });
    }
    return {
      input: base,
      status,
    };
  }

  try {
    const showcaseSubmissionsRef = collection(db, "showcaseSubmissions");
    const showcaseSubmissionsQuery = query(
      showcaseSubmissionsRef,
      where("userId", "==", user.uid)
    );
    const showcaseSubmissionsSnapshot = await getDocs(showcaseSubmissionsQuery);
    // Only approved submissions count toward badge eligibility. Client must never be able to set status = 'approved'.
    base.showcaseSubmissionsCount = showcaseSubmissionsSnapshot.docs.filter((doc) => {
      const data = doc.data() as { status?: string };
      return data.status === "approved";
    }).length;
    sourceStates.showcaseSubmissions = "ok";
  } catch (error) {
    logBadgeDataSourceError("showcaseSubmissions", user.uid, error);
  }

  try {
    const messagesRef = collection(db, "communityMessages");
    const postsQuery = query(messagesRef, where("authorId", "==", user.uid));
    const snapshot = await getDocs(postsQuery);
    base.communityMessagesCount = snapshot.size;

    base.communityPostsCount = snapshot.docs.filter((doc) => {
      const data = doc.data() as { parentId?: string | null };
      return !data.parentId;
    }).length;
    sourceStates.communityMessages = "ok";
  } catch (error) {
    logBadgeDataSourceError("communityMessages", user.uid, error);
  }

  try {
    const mergedPrsRef = collection(db, "pullRequests");
    const mergedPrsQuery = query(
      mergedPrsRef,
      where("userId", "==", user.uid),
      where("state", "==", "merged")
    );
    const mergedPrsSnapshot = await getDocs(mergedPrsQuery);
    // Trust boundary: Contributor eligibility must come from merged PR evidence only.
    // users.pullRequestsCount must not be treated as source of truth.
    base.pullRequestsCount = mergedPrsSnapshot.size;
    sourceStates.pullRequests = "ok";
  } catch (error) {
    logBadgeDataSourceError("pullRequests", user.uid, error);
  }

  try {
    const hackathonTeamsRef = collection(db, "hackathonTeams");
    const teamsQuery = query(hackathonTeamsRef, where("memberIds", "array-contains", user.uid));
    const teamsSnapshot = await getDocs(teamsQuery);

    const hackathonPoolRef = collection(db, "hackathonPool");
    const poolQuery = query(hackathonPoolRef, where("userId", "==", user.uid));
    const poolSnapshot = await getDocs(poolQuery);

    base.hackathonParticipationCount = Math.max(teamsSnapshot.size, poolSnapshot.size);
    sourceStates.hackathonParticipation = "ok";
  } catch (error) {
    logBadgeDataSourceError("hackathonParticipation", user.uid, error);
  }

  const status = buildBadgeDataStatus(sourceStates);
  if (status.state !== "complete") {
    console.warn("[badges] badge data not fully available", {
      userId: user.uid,
      state: status.state,
      failedSources: status.failedSources,
    });
  }

  return {
    input: base,
    status,
  };
}

export async function getBadgeEligibilityInput(user: {
  uid: string;
} & BadgeEligibilityUserContext): Promise<BadgeEligibilityInput> {
  const result = await getBadgeEligibilityData(user);
  return result.input;
}
