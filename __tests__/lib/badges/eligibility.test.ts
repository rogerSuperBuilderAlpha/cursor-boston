import {
  normalizeBadgeEligibilityInput,
  evaluateBadgeEligibility,
} from "@/lib/badges/eligibility";

describe("badge eligibility", () => {
  describe("normalizeBadgeEligibilityInput", () => {
    it("normalizes missing fields to false/0", () => {
      expect(normalizeBadgeEligibilityInput({})).toEqual({
        hasDisplayName: false,
        isPublicProfile: false,
        hasDiscordConnected: false,
        hasGithubConnected: false,
        eventsAttendedCount: 0,
        talksGivenCount: 0,
        pullRequestsCount: 0,
        communityPostsCount: 0,
        hackathonParticipationCount: 0,
        showcaseSubmissionsCount: 0,
        mentorMatchesCount: 0,
      });
    });
  });

  describe("first-steps", () => {
    it("is eligible when display name and public profile are both true", () => {
      const result = evaluateBadgeEligibility({
        hasDisplayName: true,
        isPublicProfile: true,
      });

      expect(result["first-steps"].isEligible).toBe(true);
    });

    it("is ineligible with partial completion and reports 1/2 progress + reason", () => {
      const result = evaluateBadgeEligibility({
        hasDisplayName: true,
        isPublicProfile: false,
      });

      expect(result["first-steps"].isEligible).toBe(false);
      expect(result["first-steps"].progress).toEqual({
        current: 1,
        target: 2,
        unit: "steps",
      });
      expect(result["first-steps"].reason).toBe(
        "Add a display name and make your profile public."
      );
    });
  });

  describe("connected", () => {
    it("is eligible only when both Discord and GitHub are connected", () => {
      expect(
        evaluateBadgeEligibility({
          hasDiscordConnected: true,
          hasGithubConnected: true,
        }).connected.isEligible
      ).toBe(true);

      expect(
        evaluateBadgeEligibility({
          hasDiscordConnected: true,
          hasGithubConnected: false,
        }).connected.isEligible
      ).toBe(false);
    });

    it("reports 1/2 progress for partial connection", () => {
      const result = evaluateBadgeEligibility({
        hasDiscordConnected: true,
        hasGithubConnected: false,
      });

      expect(result.connected.progress).toEqual({
        current: 1,
        target: 2,
        unit: "connections",
      });
    });
  });

  describe("speaker", () => {
    it("is eligible at 1 talk and caps progress at 1", () => {
      const eligible = evaluateBadgeEligibility({ talksGivenCount: 1 });
      const capped = evaluateBadgeEligibility({ talksGivenCount: 5 });

      expect(eligible.speaker.isEligible).toBe(true);
      expect(capped.speaker.progress).toEqual({
        current: 1,
        target: 1,
        unit: "talks",
      });
    });
  });

  describe("regular", () => {
    it("is ineligible at 2 events and eligible at 3 with target 3", () => {
      const atTwo = evaluateBadgeEligibility({ eventsAttendedCount: 2 });
      const atThree = evaluateBadgeEligibility({ eventsAttendedCount: 3 });

      expect(atTwo.regular.isEligible).toBe(false);
      expect(atThree.regular.isEligible).toBe(true);
      expect(atTwo.regular.progress?.target).toBe(3);
    });
  });

  describe("contributor", () => {
    it("is eligible at 1 pull request and has no reason when eligible", () => {
      const result = evaluateBadgeEligibility({ pullRequestsCount: 1 });

      expect(result.contributor.isEligible).toBe(true);
      expect(result.contributor.reason).toBeUndefined();
    });
  });

  describe("default input safety", () => {
    it("does not accidentally award badges for missing values", () => {
      const result = evaluateBadgeEligibility({});

      expect(Object.values(result).every((badge) => badge.isEligible === false)).toBe(
        true
      );
    });
  });
});
