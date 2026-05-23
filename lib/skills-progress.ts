/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { BADGE_DEFINITIONS } from "@/lib/badges/definitions";
import type { BadgeEligibilityDataStatus } from "@/lib/badges/getBadgeEligibilityInput";
import type {
  BadgeDefinition,
  BadgeEligibilityMap,
  BadgeId,
} from "@/lib/badges/types";

export const SKILL_LEVELS = ["started", "practiced", "verified", "mentor"] as const;

export type SkillLevel = (typeof SKILL_LEVELS)[number];

export interface SkillCatalogItem {
  id: string;
  trackId: string;
  title: string;
  description: string;
  levels: SkillLevel[];
  evidenceRequirements: string[];
  relatedBadgeIds: BadgeId[];
}

export interface SkillProgressItem {
  skillId: string;
  trackId: string;
  title: string;
  description: string;
  level: SkillLevel;
  progressPercent: number;
  relatedBadgeIds: BadgeId[];
  earnedBadgeIds: BadgeId[];
  evidenceRequirements: string[];
}

export interface SkillsProgressSummary {
  totalSkills: number;
  practicedSkills: number;
  verifiedSkills: number;
  mentorSkills: number;
  averageProgressPercent: number;
}

export interface SkillsProgressPayload {
  catalog: SkillCatalogItem[];
  progress: SkillProgressItem[];
  summary: SkillsProgressSummary;
  badgeDataStatus: BadgeEligibilityDataStatus;
}

const BADGE_DERIVED_MAX_PROGRESS = 70;

export function buildSkillsProgress(input: {
  eligibilityMap: BadgeEligibilityMap;
  earnedBadgeIds: BadgeId[];
  badgeDataStatus: BadgeEligibilityDataStatus;
}): SkillsProgressPayload {
  const earnedBadgeSet = new Set(input.earnedBadgeIds);
  const catalog = BADGE_DEFINITIONS.map(skillCatalogItemFromBadge);
  const progress = BADGE_DEFINITIONS.map((badge) => {
    const earnedBadgeIds = earnedBadgeSet.has(badge.id) ? [badge.id] : [];
    const progressPercent = calculateBadgeDerivedProgress(
      badge.id,
      earnedBadgeSet,
      input.eligibilityMap
    );

    return {
      skillId: badge.id,
      trackId: badge.category,
      title: badge.name,
      description: badge.description,
      level: progressPercent > 0 ? "practiced" : "started",
      progressPercent,
      relatedBadgeIds: [badge.id],
      earnedBadgeIds,
      evidenceRequirements: [badge.howToEarn],
    } satisfies SkillProgressItem;
  });

  return {
    catalog,
    progress,
    summary: summarizeProgress(progress),
    badgeDataStatus: input.badgeDataStatus,
  };
}

function skillCatalogItemFromBadge(badge: BadgeDefinition): SkillCatalogItem {
  return {
    id: badge.id,
    trackId: badge.category,
    title: badge.name,
    description: badge.description,
    levels: [...SKILL_LEVELS],
    evidenceRequirements: [badge.howToEarn],
    relatedBadgeIds: [badge.id],
  };
}

function calculateBadgeDerivedProgress(
  badgeId: BadgeId,
  earnedBadgeSet: Set<BadgeId>,
  eligibilityMap: BadgeEligibilityMap
): number {
  if (earnedBadgeSet.has(badgeId) || eligibilityMap[badgeId]?.isEligible) {
    return BADGE_DERIVED_MAX_PROGRESS;
  }

  const progress = eligibilityMap[badgeId]?.progress;
  if (!progress || progress.target <= 0) return 0;
  const ratio = Math.min(1, Math.max(0, progress.current / progress.target));
  return Math.round(ratio * BADGE_DERIVED_MAX_PROGRESS);
}

function summarizeProgress(progress: SkillProgressItem[]): SkillsProgressSummary {
  const totalProgress = progress.reduce(
    (sum, item) => sum + item.progressPercent,
    0
  );

  return {
    totalSkills: progress.length,
    practicedSkills: progress.filter((item) => item.progressPercent > 0).length,
    verifiedSkills: progress.filter((item) =>
      ["verified", "mentor"].includes(item.level)
    ).length,
    mentorSkills: progress.filter((item) => item.level === "mentor").length,
    averageProgressPercent:
      progress.length === 0 ? 0 : Math.round(totalProgress / progress.length),
  };
}
