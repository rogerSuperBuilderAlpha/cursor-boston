import type { BadgeEligibilityInput, BadgeEligibilityMap } from "./types";

type NormalizedBadgeEligibilityInput = Required<BadgeEligibilityInput>;

export function normalizeBadgeEligibilityInput(
  input: BadgeEligibilityInput
): NormalizedBadgeEligibilityInput {
  return {
    hasDisplayName: input.hasDisplayName ?? false,
    isPublicProfile: input.isPublicProfile ?? false,
    hasDiscordConnected: input.hasDiscordConnected ?? false,
    hasGithubConnected: input.hasGithubConnected ?? false,
    eventsAttendedCount: input.eventsAttendedCount ?? 0,
    talksGivenCount: input.talksGivenCount ?? 0,
    pullRequestsCount: input.pullRequestsCount ?? 0,
    communityPostsCount: input.communityPostsCount ?? 0,
    hackathonParticipationCount: input.hackathonParticipationCount ?? 0,
    showcaseSubmissionsCount: input.showcaseSubmissionsCount ?? 0,
    mentorMatchesCount: input.mentorMatchesCount ?? 0,
  };
}

function cap(current: number, target: number): number {
  return Math.min(current, target);
}

export function evaluateBadgeEligibility(
  input: BadgeEligibilityInput
): BadgeEligibilityMap {
  const n = normalizeBadgeEligibilityInput(input);

  const firstStepsCurrent = Number(n.hasDisplayName) + Number(n.isPublicProfile);
  const firstStepsEligible = firstStepsCurrent >= 2;

  const connectedCurrent = Number(n.hasDiscordConnected) + Number(n.hasGithubConnected);
  const connectedEligible = connectedCurrent >= 2;

  const speakerEligible = n.talksGivenCount >= 1;
  const hackerEligible = n.hackathonParticipationCount >= 1;
  const showcaseStarEligible = n.showcaseSubmissionsCount >= 1;
  const conversationStarterEligible = n.communityPostsCount >= 1;
  const regularEligible = n.eventsAttendedCount >= 3;
  const mentorEligible = n.mentorMatchesCount >= 1;
  const contributorEligible = n.pullRequestsCount >= 1;

  return {
    "first-steps": {
      badgeId: "first-steps",
      isEligible: firstStepsEligible,
      progress: {
        current: firstStepsCurrent,
        target: 2,
        unit: "steps",
      },
      reason: firstStepsEligible
        ? undefined
        : "Add a display name and make your profile public.",
    },
    connected: {
      badgeId: "connected",
      isEligible: connectedEligible,
      progress: {
        current: connectedCurrent,
        target: 2,
        unit: "connections",
      },
      reason: connectedEligible ? undefined : "Connect both Discord and GitHub.",
    },
    speaker: {
      badgeId: "speaker",
      isEligible: speakerEligible,
      progress: {
        current: cap(n.talksGivenCount, 1),
        target: 1,
        unit: "talks",
      },
      reason: speakerEligible ? undefined : "Give at least 1 talk.",
    },
    hacker: {
      badgeId: "hacker",
      isEligible: hackerEligible,
      progress: {
        current: cap(n.hackathonParticipationCount, 1),
        target: 1,
        unit: "hackathons",
      },
      reason: hackerEligible ? undefined : "Participate in at least 1 hackathon.",
    },
    "showcase-star": {
      badgeId: "showcase-star",
      isEligible: showcaseStarEligible,
      progress: {
        current: cap(n.showcaseSubmissionsCount, 1),
        target: 1,
        unit: "showcases",
      },
      reason: showcaseStarEligible
        ? undefined
        : "Submit at least 1 showcase project.",
    },
    "conversation-starter": {
      badgeId: "conversation-starter",
      isEligible: conversationStarterEligible,
      progress: {
        current: cap(n.communityPostsCount, 1),
        target: 1,
        unit: "posts",
      },
      reason: conversationStarterEligible
        ? undefined
        : "Create at least 1 community post.",
    },
    regular: {
      badgeId: "regular",
      isEligible: regularEligible,
      progress: {
        current: cap(n.eventsAttendedCount, 3),
        target: 3,
        unit: "events",
      },
      reason: regularEligible ? undefined : "Attend at least 3 events.",
    },
    mentor: {
      badgeId: "mentor",
      isEligible: mentorEligible,
      progress: {
        current: cap(n.mentorMatchesCount, 1),
        target: 1,
        unit: "matches",
      },
      reason: mentorEligible ? undefined : "Complete at least 1 mentor match.",
    },
    contributor: {
      badgeId: "contributor",
      isEligible: contributorEligible,
      progress: {
        current: cap(n.pullRequestsCount, 1),
        target: 1,
        unit: "pull requests",
      },
      reason: contributorEligible
        ? undefined
        : "Have at least 1 counted pull request.",
    },
  };
}
