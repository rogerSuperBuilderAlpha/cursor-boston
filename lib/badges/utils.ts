/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { BadgeDefinition, BadgeEligibilityMap, BadgeId } from "./types";

export function getEarnedBadgeIds(
  definitions: BadgeDefinition[],
  eligibilityMap?: BadgeEligibilityMap,
  userBadgeMap: Partial<Record<BadgeId, unknown>> = {}
): BadgeId[] {
  return definitions
    .filter(
      (definition) =>
        Boolean(eligibilityMap?.[definition.id]?.isEligible) ||
        Boolean(userBadgeMap[definition.id])
    )
    .map((definition) => definition.id);
}
