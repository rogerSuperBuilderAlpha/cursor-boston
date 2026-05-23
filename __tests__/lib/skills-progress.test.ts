/**
 * @jest-environment node
 */

import { buildSkillsProgress } from "@/lib/skills-progress";
import type { BadgeEligibilityMap } from "@/lib/badges/types";

const completeStatus = {
  state: "complete" as const,
  isAuthoritative: true,
  failedSources: [],
};

describe("buildSkillsProgress", () => {
  it("derives practiced skill progress from earned and eligible badge signals", () => {
    const eligibilityMap = {
      contributor: {
        badgeId: "contributor",
        isEligible: true,
        progress: { current: 1, target: 1 },
      },
      "showcase-star": {
        badgeId: "showcase-star",
        isEligible: true,
        progress: { current: 1, target: 1 },
      },
      hacker: {
        badgeId: "hacker",
        isEligible: false,
        progress: { current: 0, target: 1 },
      },
    } as BadgeEligibilityMap;

    const payload = buildSkillsProgress({
      eligibilityMap,
      earnedBadgeIds: ["contributor", "showcase-star"],
      badgeDataStatus: completeStatus,
    });

    const contributor = payload.progress.find(
      (item) => item.skillId === "contributor"
    );
    expect(contributor).toEqual(
      expect.objectContaining({
        level: "practiced",
        progressPercent: 70,
        earnedBadgeIds: ["contributor"],
      })
    );
    expect(payload.summary.practicedSkills).toBeGreaterThan(0);
    expect(payload.summary.verifiedSkills).toBe(0);
  });

  it("uses partial badge progress without marking the skill verified", () => {
    const eligibilityMap = {
      "conversation-starter": {
        badgeId: "conversation-starter",
        isEligible: false,
        progress: { current: 2, target: 5 },
      },
      contributor: {
        badgeId: "contributor",
        isEligible: false,
        progress: { current: 0, target: 1 },
      },
    } as BadgeEligibilityMap;

    const payload = buildSkillsProgress({
      eligibilityMap,
      earnedBadgeIds: [],
      badgeDataStatus: completeStatus,
    });

    const conversation = payload.progress.find(
      (item) => item.skillId === "conversation-starter"
    );
    expect(conversation).toEqual(
      expect.objectContaining({
        level: "practiced",
        progressPercent: 28,
        earnedBadgeIds: [],
      })
    );
  });

  it("preserves badge data status for the route/UI warning surface", () => {
    const status = {
      state: "partial" as const,
      isAuthoritative: false,
      failedSources: ["pullRequests"],
      message: "Some badge data could not be loaded.",
    };

    const payload = buildSkillsProgress({
      eligibilityMap: {} as BadgeEligibilityMap,
      earnedBadgeIds: [],
      badgeDataStatus: status,
    });

    expect(payload.badgeDataStatus).toBe(status);
    expect(payload.summary.averageProgressPercent).toBe(0);
  });
});
