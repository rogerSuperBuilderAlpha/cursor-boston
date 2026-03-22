import {
  BadgeDefinition,
  BadgeId,
  BadgeCategory,
  BadgeAwardSource,
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
 */
export function getBadgeDocumentId(badgeId: BadgeId): string {
  return badgeId;
}

export function getUserBadgeDocumentId(
  userId: string,
  badgeId: BadgeId
): string {
  return `${userId}_${badgeId}`;
}

/**
 * Mapping helpers (domain -> storage)
 * Pure functions, no Firebase usage
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