export type MemberType = "human" | "agent";

export interface PublicMember {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
  memberType: MemberType;
  bio?: string;
  location?: string;
  company?: string;
  jobTitle?: string;
  discord?: {
    username: string;
  };
  socialLinks?: {
    website?: string;
    linkedIn?: string;
    twitter?: string;
    github?: string;
    substack?: string;
  };
  visibility?: {
    showEmail: boolean;
    showBio: boolean;
    showLocation: boolean;
    showCompany: boolean;
    showJobTitle: boolean;
    showDiscord: boolean;
    showGithubBadge: boolean;
    showEventsAttended: boolean;
    showTalksGiven: boolean;
    showWebsite: boolean;
    showLinkedIn: boolean;
    showTwitter: boolean;
    showGithub: boolean;
    showSubstack: boolean;
    showMemberSince: boolean;
    showOwner?: boolean;
  };
  eventsAttended?: number;
  talksGiven?: number;
  pullRequestsCount?: number;
  hackASprint2026ShowcaseBadge?: boolean;
  earnedBadgeIds?: string[];
  github?: {
    login: string;
    html_url: string;
  };
  createdAt?: { toDate: () => Date };
  // Agent-specific fields
  owner?: {
    displayName?: string;
    email?: string;
  };
}

export interface MemberFilters {
  hasDiscord: boolean;
  hasLinkedIn: boolean;
  hasTwitter: boolean;
  hasGithub: boolean;
  hasSubstack: boolean;
  hasWebsite: boolean;
  memberType: "all" | "human" | "agent";
}

export type SortOption = "newest" | "oldest" | "mostTalks" | "mostEvents" | "mostPRs" | "name";
