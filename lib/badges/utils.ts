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
