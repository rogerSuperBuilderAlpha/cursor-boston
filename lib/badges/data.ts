/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import {
  BadgeDefinition,
  BadgeId,
  BadgeCategory,
  BadgeAwardSource,
  BadgeEligibilityMap,
  UserBadge,
} from "./types";

/**
 * Firestore collection names
 */
export const BADGES_COLLECTION = "badges";
export const USER_BADGES_COLLECTION = "user_badges";

/**
 * Firestore document shapes
 * (kept identical to domain types for PR 1 simplicity)
 */
export interface BadgeDefinitionDocument {
  id: BadgeId;
  name: string;
  description: string;
  category: BadgeCategory;
  howToEarn: string;
  sortOrder: number;
  iconKey?: string;
}

export interface UserBadgeDocument {
  id: string;
  userId: string;
  badgeId: BadgeId;
  awardedAt: string;
  awardSource: BadgeAwardSource;
  awardedBy?: string;
}

/**
 * Deterministic document ID helpers
 *
 * @param badgeId - Canonical badge id.
 * @returns Document id string for `badges/{id}`.
 */
export function getBadgeDocumentId(badgeId: BadgeId): string {
  return badgeId;
}

/**
 * Deterministic id for a user's award row: `{userId}_{badgeId}`.
 *
 * @param userId - Firebase user uid.
 * @param badgeId - Badge being awarded.
 * @returns Composite document id for `user_badges`.
 */
export function getUserBadgeDocumentId(
  userId: string,
  badgeId: BadgeId
): string {
  return `${userId}_${badgeId}`;
}

/**
 * Mapping helpers (domain -> storage)
 * Pure functions, no Firebase usage
 *
 * @param definition - App-layer badge definition.
 * @returns Serializable fields for `badges` collection writes.
 */
export function toBadgeDefinitionDocument(
  definition: BadgeDefinition
): BadgeDefinitionDocument {
  return {
    id: definition.id,
    name: definition.name,
    description: definition.description,
    category: definition.category,
    howToEarn: definition.howToEarn,
    sortOrder: definition.sortOrder,
    iconKey: definition.iconKey,
  };
}

/**
 * Maps a domain {@link UserBadge} to the Firestore document shape.
 *
 * @param userBadge - Award record including id and metadata.
 * @returns Serializable fields for `user_badges` collection writes.
 */
export function toUserBadgeDocument(
  userBadge: UserBadge
): UserBadgeDocument {
  return {
    id: userBadge.id,
    userId: userBadge.userId,
    badgeId: userBadge.badgeId,
    awardedAt: userBadge.awardedAt,
    awardSource: userBadge.awardSource,
    awardedBy: userBadge.awardedBy,
  };
}

export type UserBadgeMap = Partial<Record<BadgeId, UserBadge>>;
export type BadgeAwardPersistenceState = "complete" | "degraded" | "failed";

export interface BadgeAwardPersistenceStatus {
  state: BadgeAwardPersistenceState;
  message?: string;
}

export interface EnsureUserBadgesResult {
  userBadgeMap: UserBadgeMap;
  status: BadgeAwardPersistenceStatus;
}

const TRUSTED_AWARD_SOURCES = new Set<BadgeAwardSource>([
  "system",
  "migration",
  "manual",
]);

function toUserBadgeFromDocument(
  docId: string,
  data: Partial<UserBadgeDocument>
): UserBadge | null {
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
    id: data.id || docId,
    userId: data.userId,
    badgeId: data.badgeId,
    awardedAt,
    awardSource: data.awardSource,
    awardedBy: data.awardedBy,
  };
}

/**
 * Loads all persisted user badge rows for a user from Firestore (client SDK).
 *
 * @param userId - Firebase uid; empty string yields `{}`.
 * @returns Map of badge id → {@link UserBadge}, or `{}` when Firestore is unavailable.
 */
export async function getUserBadgeMap(userId: string): Promise<UserBadgeMap> {
  if (!db || !userId) {
    return {};
  }

  const badgesRef = collection(db, USER_BADGES_COLLECTION);
  const badgesQuery = query(badgesRef, where("userId", "==", userId));
  const snapshot = await getDocs(badgesQuery);

  const badgeMap: UserBadgeMap = {};
  snapshot.docs.forEach((badgeDoc) => {
    const badge = toUserBadgeFromDocument(
      badgeDoc.id,
      badgeDoc.data() as Partial<UserBadgeDocument>
    );
    if (badge) {
      badgeMap[badge.badgeId] = badge;
    }
  });

  return badgeMap;
}

/**
 * Ensures Firestore reflects awards for every badge the user is eligible for but missing locally.
 * Delegates to {@link ensureUserBadgesForEligibleWithStatus} and returns only the merged map.
 *
 * @param userId - Current user uid (must match signed-in client for POST awards).
 * @param eligibilityMap - Output of {@link evaluateBadgeEligibility}.
 * @param existingBadgeMap - Known awards before sync (defaults to empty).
 * @returns Updated badge map after best-effort persistence.
 */
export async function ensureUserBadgesForEligible(
  userId: string,
  eligibilityMap: BadgeEligibilityMap,
  existingBadgeMap: UserBadgeMap = {}
): Promise<UserBadgeMap> {
  const result = await ensureUserBadgesForEligibleWithStatus(
    userId,
    eligibilityMap,
    existingBadgeMap
  );
  return result.userBadgeMap;
}

/**
 * Like {@link ensureUserBadgesForEligible} but includes persistence status for UI messaging when degraded.
 *
 * @param userId - Current user uid.
 * @param eligibilityMap - Eligibility snapshot.
 * @param existingBadgeMap - Prior awards map.
 * @returns Merged map plus `complete` | `degraded` | `failed` persistence state.
 */
export async function ensureUserBadgesForEligibleWithStatus(
  userId: string,
  eligibilityMap: BadgeEligibilityMap,
  existingBadgeMap: UserBadgeMap = {}
): Promise<EnsureUserBadgesResult> {
  if (!userId) {
    return {
      userBadgeMap: existingBadgeMap,
      status: { state: "failed", message: "Badge awards could not be saved right now." },
    };
  }

  const missingEligibleBadgeIds = (Object.entries(eligibilityMap) as Array<
    [BadgeId, BadgeEligibilityMap[BadgeId]]
  >)
    .filter(([badgeId, eligibility]) => eligibility.isEligible && !existingBadgeMap[badgeId])
    .map(([badgeId]) => badgeId);

  if (missingEligibleBadgeIds.length === 0) {
    return {
      userBadgeMap: existingBadgeMap,
      status: { state: "complete" },
    };
  }

  if (!auth?.currentUser || auth.currentUser.uid !== userId) {
    return {
      userBadgeMap: existingBadgeMap,
      status: {
        state: "degraded",
        message:
          "Some earned badges could not be saved yet. Earned dates may appear after a refresh.",
      },
    };
  }

  try {
    const idToken = await auth.currentUser.getIdToken();
    const response = await fetch("/api/badges/awards", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
    });

    if (!response.ok) {
      return {
        userBadgeMap: existingBadgeMap,
        status: {
          state: "failed",
          message:
            "Badge award persistence is temporarily unavailable. Earned dates may be delayed.",
        },
      };
    }

    const payload = (await response.json()) as {
      userBadges?: Array<Partial<UserBadgeDocument>>;
    };
    if (!Array.isArray(payload.userBadges)) {
      return {
        userBadgeMap: existingBadgeMap,
        status: {
          state: "failed",
          message:
            "Badge award persistence returned an invalid response. Earned dates may be delayed.",
        },
      };
    }

    const mergedBadgeMap: UserBadgeMap = { ...existingBadgeMap };
    for (const badgeData of payload.userBadges) {
      const parsedBadge = toUserBadgeFromDocument(
        typeof badgeData.id === "string" ? badgeData.id : "",
        badgeData
      );
      if (parsedBadge) {
        mergedBadgeMap[parsedBadge.badgeId] = parsedBadge;
      }
    }

    const unresolvedEligible = missingEligibleBadgeIds.filter(
      (badgeId) => !mergedBadgeMap[badgeId]
    );

    if (unresolvedEligible.length > 0) {
      return {
        userBadgeMap: mergedBadgeMap,
        status: {
          state: "degraded",
          message:
            "Some earned badges are not yet persisted. Earned dates may appear later.",
        },
      };
    }

    return {
      userBadgeMap: mergedBadgeMap,
      status: { state: "complete" },
    };
  } catch {
    return {
      userBadgeMap: existingBadgeMap,
      status: {
        state: "failed",
        message:
          "Badge award persistence failed. Earned status may be shown without saved dates.",
      },
    };
  }
}
