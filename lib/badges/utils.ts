/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { BadgeDefinition, BadgeEligibilityMap, BadgeId } from "./types";

/**
 * Lists badge ids the user should show as earned: either eligible in `eligibilityMap` or already present in `userBadgeMap`.
 *
 * @param definitions - Ordered badge catalog (typically `BADGE_DEFINITIONS`).
 * @param eligibilityMap - Optional live eligibility from {@link evaluateBadgeEligibility}.
 * @param userBadgeMap - Persisted awards keyed by badge id.
 * @returns Badge ids to display as earned, in catalog order.
 */
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
