/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type {
  BadgeDefinition,
  BadgeEligibilityMap,
  BadgeId,
  UserBadge,
} from "@/lib/badges/types";
import { getEarnedBadgeIds } from "@/lib/badges/utils";

/** @internal */
export interface SkillTrackDefinition {
  id: string;
  name: string;
  description: string;
  badgeIds: BadgeId[];
}

/** @internal */
export interface SkillTrackProgress extends SkillTrackDefinition {
  earnedCount: number;
  totalCount: number;
  percent: number;
  badges: BadgeDefinition[];
}

/** @internal */
export interface NextSkillMilestone {
  badge: BadgeDefinition;
  current: number;
  target: number;
  unit: string;
  reason: string;
  percent: number;
}

/** @internal */
export interface SkillsPassportSummary {
  earnedBadgeIds: BadgeId[];
  earnedCount: number;
  totalCount: number;
  percent: number;
  tracks: SkillTrackProgress[];
  nextMilestones: NextSkillMilestone[];
}

/** @internal */
export const SKILL_TRACKS: SkillTrackDefinition[] = [
  {
    id: "foundation",
    name: "AI Project Foundations",
    description: "Profile readiness and connected accounts for community work.",
    badgeIds: ["first-steps", "connected"],
  },
  {
    id: "community",
    name: "Community Practice",
    description: "Participation signals from conversations and recurring events.",
    badgeIds: ["conversation-starter", "regular"],
  },
  {
    id: "building",
    name: "Build and Ship",
    description: "Evidence from hackathons, showcases, and merged code.",
    badgeIds: ["hacker", "showcase-star", "contributor"],
  },
  {
    id: "leadership",
    name: "Mentorship and Leadership",
    description: "Teaching, mentoring, and presenting to other members.",
    badgeIds: ["mentor", "speaker"],
  },
];

function percent(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.round((Math.min(current, target) / target) * 100);
}

function progressPercent(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.round((Math.min(current, target) / target) * 100);
}

export function buildSkillsPassportSummary(
  definitions: BadgeDefinition[],
  eligibilityMap?: BadgeEligibilityMap,
  userBadgeMap: Partial<Record<BadgeId, UserBadge>> = {}
): SkillsPassportSummary {
  const definitionsById = new Map(definitions.map((definition) => [
    definition.id,
    definition,
  ]));
  const earnedBadgeIds = getEarnedBadgeIds(
    definitions,
    eligibilityMap,
    userBadgeMap
  );
  const earnedBadgeSet = new Set(earnedBadgeIds);

  const tracks = SKILL_TRACKS.map((track) => {
    const badges = track.badgeIds
      .map((badgeId) => definitionsById.get(badgeId))
      .filter((definition): definition is BadgeDefinition =>
        Boolean(definition)
      );
    const earnedCount = badges.filter((badge) =>
      earnedBadgeSet.has(badge.id)
    ).length;

    return {
      ...track,
      badges,
      earnedCount,
      totalCount: badges.length,
      percent: percent(earnedCount, badges.length),
    };
  });

  const nextMilestones = definitions
    .filter((definition) => !earnedBadgeSet.has(definition.id))
    .map((badge): NextSkillMilestone => {
      const eligibility = eligibilityMap?.[badge.id];
      const current = eligibility?.progress?.current ?? 0;
      const target = eligibility?.progress?.target ?? 1;

      return {
        badge,
        current,
        target,
        unit: eligibility?.progress?.unit ?? "steps",
        reason: eligibility?.reason ?? badge.howToEarn,
        percent: progressPercent(current, target),
      };
    })
    .sort((a, b) => b.percent - a.percent || a.badge.sortOrder - b.badge.sortOrder)
    .slice(0, 3);

  return {
    earnedBadgeIds,
    earnedCount: earnedBadgeIds.length,
    totalCount: definitions.length,
    percent: percent(earnedBadgeIds.length, definitions.length),
    tracks,
    nextMilestones,
  };
}
