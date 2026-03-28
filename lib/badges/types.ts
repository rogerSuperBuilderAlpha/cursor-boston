export type BadgeId =
  | "first-steps"
  | "connected"
  | "speaker"
  | "hacker"
  | "showcase-star"
  | "conversation-starter"
  | "regular"
  | "mentor"
  | "contributor";

export type BadgeCategory =
  | "onboarding"
  | "community"
  | "events"
  | "contributions"
  | "mentorship";

export interface BadgeDefinition {
  id: BadgeId;
  name: string;
  description: string;
  category: BadgeCategory;
  howToEarn: string;
  sortOrder: number;
  iconKey?: string;
}

export type BadgeAwardSource = "manual" | "on-demand" | "migration" | "system";

export interface UserBadge {
  id: string;
  userId: string;
  badgeId: BadgeId;
  awardedAt: string;
  awardSource: BadgeAwardSource;
  awardedBy?: string;
}

export interface BadgeEligibilityInput {
  hasDisplayName?: boolean;
  isPublicProfile?: boolean;
  hasBio?: boolean;
  hasAvatar?: boolean;
  hasDiscordConnected?: boolean;
  hasGithubConnected?: boolean;
  eventsAttendedCount?: number;
  talksSubmittedCount?: number;
  talksGivenCount?: number;
  pullRequestsCount?: number;
  communityPostsCount?: number;
  communityMessagesCount?: number;
  hackathonParticipationCount?: number;
  showcaseSubmissionsCount?: number;
  mentorMatchesCount?: number;
}

export interface BadgeProgress {
  current: number;
  target: number;
  unit?: string;
}

export interface BadgeEligibilityResult {
  badgeId: BadgeId;
  isEligible: boolean;
  progress?: BadgeProgress;
  reason?: string;
}

export type BadgeEligibilityMap = Record<BadgeId, BadgeEligibilityResult>;
