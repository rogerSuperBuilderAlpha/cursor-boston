/**
 * @jest-environment node
 */

import { getEarnedBadgeIds } from "@/lib/badges/utils";
import { BADGE_DEFINITIONS } from "@/lib/badges/definitions";
import type { BadgeEligibilityMap } from "@/lib/badges/types";

describe("getEarnedBadgeIds", () => {
  it("keeps persisted badges earned even when eligibility data is degraded", () => {
    const partialEligibility = {
      "first-steps": {
        badgeId: "first-steps",
        isEligible: false,
      },
    } as BadgeEligibilityMap;

    const earnedBadgeIds = getEarnedBadgeIds(BADGE_DEFINITIONS, partialEligibility, {
      "first-steps": {
        id: "u1_first-steps",
        userId: "u1",
        badgeId: "first-steps",
        awardedAt: "2026-03-01T00:00:00.000Z",
        awardSource: "system",
      },
    });

    expect(earnedBadgeIds).toContain("first-steps");
  });
});
