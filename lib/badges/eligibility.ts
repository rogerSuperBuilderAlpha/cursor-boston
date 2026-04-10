/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { BadgeEligibilityInput, BadgeEligibilityMap } from "./types";

type NormalizedBadgeEligibilityInput = Required<BadgeEligibilityInput>;

export function normalizeBadgeEligibilityInput(
  input: BadgeEligibilityInput
): NormalizedBadgeEligibilityInput {
  return {
    hasDisplayName: input.hasDisplayName ?? false,
    isPublicProfile: input.isPublicProfile ?? false,
    hasBio: input.hasBio ?? false,
    hasAvatar: input.hasAvatar ?? false,
    hasDiscordConnected: input.hasDiscordConnected ?? false,
    hasGithubConnected: input.hasGithubConnected ?? false,
    eventsAttendedCount: input.eventsAttendedCount ?? 0,
    talksSubmittedCount: input.talksSubmittedCount ?? 0,
    talksGivenCount: input.talksGivenCount ?? 0,
    pullRequestsCount: input.pullRequestsCount ?? 0,
    communityPostsCount: input.communityPostsCount ?? 0,
    communityMessagesCount: input.communityMessagesCount ?? 0,
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

  const firstStepsCurrent = Number(n.hasBio) + Number(n.hasAvatar);
  const firstStepsEligible = firstStepsCurrent >= 2;

  const connectedCurrent = Number(n.hasDiscordConnected) + Number(n.hasGithubConnected);
  const connectedEligible = connectedCurrent >= 2;

  const speakerEligible = n.talksGivenCount >= 1;
  const hackerEligible = n.hackathonParticipationCount >= 1;
  const showcaseStarEligible = n.showcaseSubmissionsCount >= 1;
  const conversationStarterEligible = n.communityMessagesCount >= 5;
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
        : "Add a bio and profile photo.",
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
      reason: speakerEligible ? undefined : "Deliver at least 1 talk.",
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
        current: cap(n.communityMessagesCount, 5),
        target: 5,
        unit: "messages",
      },
      reason: conversationStarterEligible
        ? undefined
        : "Post at least 5 community messages.",
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
        : "Get at least 1 pull request merged to this repo.",
    },
  };
}
