/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { BadgeDefinition, BadgeId } from "./types";

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: "first-steps",
    name: "First Steps",
    category: "onboarding",
    description: "Completed your basic profile setup.",
    howToEarn: "Add a bio and profile photo.",
    sortOrder: 1,
    iconKey: "sparkles",
  },
  {
    id: "connected",
    name: "Connected",
    category: "onboarding",
    description: "Connected your community accounts.",
    howToEarn: "Connect both Discord and GitHub.",
    sortOrder: 2,
    iconKey: "link",
  },
  {
    id: "speaker",
    name: "Speaker",
    category: "events",
    description: "Delivered a talk to the community.",
    howToEarn: "Deliver at least 1 talk.",
    sortOrder: 3,
    iconKey: "mic",
  },
  {
    id: "hacker",
    name: "Hacker",
    category: "events",
    description: "Joined a hackathon or build event.",
    howToEarn: "Participate in at least 1 hackathon.",
    sortOrder: 4,
    iconKey: "code",
  },
  {
    id: "showcase-star",
    name: "Showcase Star",
    category: "community",
    description: "Shared a project or community showcase.",
    howToEarn: "Submit at least 1 showcase project.",
    sortOrder: 5,
    iconKey: "star",
  },
  {
    id: "conversation-starter",
    name: "Conversation Starter",
    category: "community",
    description: "Kept conversations going in the community feed.",
    howToEarn: "Post at least 5 community messages.",
    sortOrder: 6,
    iconKey: "message-square",
  },
  {
    id: "regular",
    name: "Regular",
    category: "community",
    description: "Showed up consistently at community events.",
    howToEarn: "Attend at least 3 events.",
    sortOrder: 7,
    iconKey: "calendar-check",
  },
  {
    id: "mentor",
    name: "Mentor",
    category: "mentorship",
    description: "Supported another member through mentorship.",
    howToEarn: "Complete at least 1 mentor match.",
    sortOrder: 8,
    iconKey: "graduation-cap",
  },
  {
    id: "contributor",
    name: "Contributor",
    category: "contributions",
    description: "Contributed code to the community project.",
    howToEarn: "Get at least 1 pull request merged to this repo.",
    sortOrder: 9,
    iconKey: "git-pull-request",
  },
];

export const BADGE_IDS: BadgeId[] = BADGE_DEFINITIONS.map(
  (badge) => badge.id
);

export const BADGE_DEFINITIONS_BY_ID: Record<BadgeId, BadgeDefinition> =
  BADGE_DEFINITIONS.reduce((acc, badge) => {
    acc[badge.id] = badge;
    return acc;
  }, {} as Record<BadgeId, BadgeDefinition>);
