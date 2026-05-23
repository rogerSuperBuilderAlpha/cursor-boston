import { BADGE_DEFINITIONS } from "@/lib/badges/definitions";
import { evaluateBadgeEligibility } from "@/lib/badges/eligibility";
import { buildSkillsPassportSummary } from "@/lib/skills-passport";
import type { UserBadge } from "@/lib/badges/types";

describe("skills passport summary", () => {
  it("groups earned badges into skill tracks", () => {
    const eligibility = evaluateBadgeEligibility({
      hasAvatar: true,
      hasBio: true,
      hasDiscordConnected: true,
      pullRequestsCount: 1,
    });

    const summary = buildSkillsPassportSummary(
      BADGE_DEFINITIONS,
      eligibility,
      {}
    );

    expect(summary.earnedBadgeIds).toEqual(["first-steps", "contributor"]);
    expect(summary.earnedCount).toBe(2);
    expect(summary.totalCount).toBe(BADGE_DEFINITIONS.length);

    expect(summary.tracks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "foundation",
          earnedCount: 1,
          totalCount: 2,
          percent: 50,
        }),
        expect.objectContaining({
          id: "building",
          earnedCount: 1,
          totalCount: 3,
          percent: 33,
        }),
      ])
    );
  });

  it("counts persisted badges even when live eligibility is unavailable", () => {
    const userBadgeMap = {
      mentor: {
        awardSource: "manual",
        awardedAt: "2026-05-01T00:00:00.000Z",
        badgeId: "mentor",
        id: "user-1_mentor",
        userId: "user-1",
      } satisfies UserBadge,
    };

    const summary = buildSkillsPassportSummary(
      BADGE_DEFINITIONS,
      evaluateBadgeEligibility({}),
      userBadgeMap
    );

    expect(summary.earnedBadgeIds).toContain("mentor");
    expect(
      summary.tracks.find((track) => track.id === "leadership")
    ).toEqual(
      expect.objectContaining({
        earnedCount: 1,
        totalCount: 2,
        percent: 50,
      })
    );
  });

  it("prioritizes the closest next milestones", () => {
    const eligibility = evaluateBadgeEligibility({
      hasDiscordConnected: true,
      communityMessagesCount: 4,
      eventsAttendedCount: 1,
    });

    const summary = buildSkillsPassportSummary(
      BADGE_DEFINITIONS,
      eligibility,
      {}
    );

    expect(summary.nextMilestones.map((milestone) => milestone.badge.id)).toEqual([
      "conversation-starter",
      "connected",
      "regular",
    ]);
    expect(summary.nextMilestones[0]).toEqual(
      expect.objectContaining({
        current: 4,
        percent: 80,
        target: 5,
        unit: "messages",
      })
    );
  });
});
