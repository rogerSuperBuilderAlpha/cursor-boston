/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { BadgeEligibilityInput, BadgeEligibilityMap } from "./types";
import {
  checkCountThreshold,
  checkPullRequestThreshold,
  type ThresholdEligibilityResult,
} from "@/lib/eligibility-base";

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

function countBadge<Reason extends string>(
  check: ThresholdEligibilityResult<Reason>,
  unit: string
) {
  return {
    isEligible: check.isEligible,
    progress: {
      current: check.current,
      target: check.target,
      unit,
    },
    reason: check.reason,
  };
}

export function evaluateBadgeEligibility(
  input: BadgeEligibilityInput
): BadgeEligibilityMap {
  const n = normalizeBadgeEligibilityInput(input);

  const firstStepsCurrent = Number(n.hasBio) + Number(n.hasAvatar);
  const firstStepsEligible = firstStepsCurrent >= 2;

  const connectedCurrent = Number(n.hasDiscordConnected) + Number(n.hasGithubConnected);
  const connectedEligible = connectedCurrent >= 2;

  const speaker = countBadge(
    checkCountThreshold({
      current: n.talksGivenCount,
      target: 1,
      reason: "Deliver at least 1 talk.",
    }),
    "talks"
  );
  const hacker = countBadge(
    checkCountThreshold({
      current: n.hackathonParticipationCount,
      target: 1,
      reason: "Participate in at least 1 hackathon.",
    }),
    "hackathons"
  );
  const showcaseStar = countBadge(
    checkCountThreshold({
      current: n.showcaseSubmissionsCount,
      target: 1,
      reason: "Submit at least 1 showcase project.",
    }),
    "showcases"
  );
  const conversationStarter = countBadge(
    checkCountThreshold({
      current: n.communityMessagesCount,
      target: 5,
      reason: "Post at least 5 community messages.",
    }),
    "messages"
  );
  const regular = countBadge(
    checkCountThreshold({
      current: n.eventsAttendedCount,
      target: 3,
      reason: "Attend at least 3 events.",
    }),
    "events"
  );
  const mentor = countBadge(
    checkCountThreshold({
      current: n.mentorMatchesCount,
      target: 1,
      reason: "Complete at least 1 mentor match.",
    }),
    "matches"
  );
  const contributor = countBadge(
    checkPullRequestThreshold({
      pullRequestsCount: n.pullRequestsCount,
      target: 1,
      reason: "Get at least 1 pull request merged to this repo.",
    }),
    "pull requests"
  );

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
      ...speaker,
    },
    hacker: {
      badgeId: "hacker",
      ...hacker,
    },
    "showcase-star": {
      badgeId: "showcase-star",
      ...showcaseStar,
    },
    "conversation-starter": {
      badgeId: "conversation-starter",
      ...conversationStarter,
    },
    regular: {
      badgeId: "regular",
      ...regular,
    },
    mentor: {
      badgeId: "mentor",
      ...mentor,
    },
    contributor: {
      badgeId: "contributor",
      ...contributor,
    },
  };
}
