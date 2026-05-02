/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { Timestamp } from "firebase/firestore";

import { SPORTS_HACK_2026_EVENT_ID, SPORTS_HACK_2026_LUMA_URL } from "./sports-hack-2026";

export const SUMMER_COHORT_SITE_ID = "cursor-boston";
export const SUMMER_COHORT_COLLECTION = "summerCohortApplications";
export const SUMMER_COHORT_VOTES_COLLECTION = "summerCohortVotes";
export const SUMMER_COHORT_NOTIFY_EMAIL = "roger@cursorboston.com";
export const SUMMER_COHORT_LOCALSTORAGE_KEY =
  "cursor-boston-summer-cohort-modal-shown-date";
export const SUMMER_COHORT_RETURN_TO = "/summer-cohort";
export const SUMMER_COHORT_OPEN_EVENT = "open-summer-cohort-modal";

export type SummerCohortId = "cohort-1" | "cohort-2";

export interface SummerCohort {
  id: SummerCohortId;
  label: string;
  start: string;
  end: string;
  startLabel: string;
  endLabel: string;
  graduationLabel: string;
}

export const SUMMER_COHORTS: readonly SummerCohort[] = [
  {
    id: "cohort-1",
    label: "Cohort 1",
    start: "2026-05-11",
    end: "2026-06-19",
    startLabel: "Mon, May 11",
    endLabel: "Fri, Jun 19",
    graduationLabel: "Graduation: Fri, Jun 19",
  },
  {
    id: "cohort-2",
    label: "Cohort 2",
    start: "2026-06-29",
    end: "2026-08-07",
    startLabel: "Mon, Jun 29",
    endLabel: "Fri, Aug 7",
    graduationLabel: "Graduation: Fri, Aug 7",
  },
] as const;

export type SummerCohortStatus =
  | "pending"
  | "admitted"
  | "rejected"
  | "waitlist";

export interface SummerCohortApplication {
  userId: string;
  email: string;
  name: string;
  phone: string;
  cohorts: SummerCohortId[];
  siteId: string;
  status: SummerCohortStatus;
  /**
   * Lives in/near Boston and plans to attend in-person events. Required for
   * the first 3 weeks of in-person showcase events where in-person attendance
   * is mandatory for vote winners. Optional on legacy applications submitted
   * before this field was introduced.
   */
  isLocal?: boolean;
  /**
   * Comfortable presenting their work AND maintaining the platform for the
   * rest of the cohort if they win the week-1/2/3 vote. Not required of every
   * participant — the winner needs both.
   */
  wantsToPresent?: boolean;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export function isValidCohortId(value: unknown): value is SummerCohortId {
  return value === "cohort-1" || value === "cohort-2";
}

export interface SummerCohortWeek {
  week: number;
  title: string;
  description: string;
  winnerCert?: string;
}

export const SUMMER_COHORT_WEEKS: readonly SummerCohortWeek[] = [
  {
    week: 1,
    title: "Project management tool",
    description:
      "Everyone builds a PM tool. The cohort reviews each other's work and votes for a winner. The winner maintains the cohort PM platform through the rest of the program and uses it to keep engagement and support flowing.",
    winnerCert: "PM Winner",
  },
  {
    week: 2,
    title: "Communications platform",
    description:
      "Everyone builds a comms platform for the cohort. Same vote-and-pick-a-winner format. The winner maintains the platform through the rest of the cohort.",
    winnerCert: "Comms Winner",
  },
  {
    week: 3,
    title: "Marketing platform",
    description:
      "Everyone builds a marketing platform — for example a website to promote the cohort and everyone's work. Same voting format; winner maintains it.",
    winnerCert: "Marketing Winner",
  },
  {
    week: 4,
    title: "Education tool — merged to Ludwitt",
    description:
      "Everyone builds an education tool that gets merged into Ludwitt. As users consume credits via your tool, you earn a revenue share — every shipped tool earns its author fees.",
  },
  {
    week: 5,
    title: "Your own startup",
    description:
      "Build whatever you want — your own startup project for the week.",
  },
  {
    week: 6,
    title: "Open-source PR merge",
    description:
      "Pick a hugely popular open-source project of your choice and land a merged PR.",
  },
] as const;

export const SUMMER_COHORT_MEETING_CADENCE =
  "Twice-weekly Zoom for demos and Q&A.";

export const SUMMER_COHORT_IMMERSION = {
  date: "2026-05-26",
  label: "Mon, May 26",
  title: "Hult / Cursor Boston immersion event",
  description:
    "All cohort participants get a spot in the 80-person cap. Includes Cursor credits and the chance to win more at the hackathon.",
  /** Same event as Sports Hack 2026 — Luma RSVPs go through that signup. */
  eventId: SPORTS_HACK_2026_EVENT_ID,
  lumaUrl: SPORTS_HACK_2026_LUMA_URL,
} as const;

export const SUMMER_COHORT_DEMO_DAY = {
  title: "Final demo day with hiring partners",
  description:
    "Participants demo. Hiring partners share what their companies need and surface specific opportunities to apply to. No placement guarantees — placement depends on what the cohort builds and the partners' interest.",
} as const;

// TODO: swap in the real Zoom link before 2026-05-11.
export const SUMMER_COHORT_C1_ZOOM_URL_PLACEHOLDER =
  "https://zoom.us/j/PLACEHOLDER";

// TODO: swap in the real Discord invite link before kickoff.
export const SUMMER_COHORT_C1_DISCORD_INVITE_URL_PLACEHOLDER =
  "https://discord.gg/PLACEHOLDER";

/** Hard cap on Cohort 1 admits. Auto-admit-on-PR-merge respects this. */
export const SUMMER_COHORT_C1_CAP = 100;

/** PR-merge auto-admit deadline.
 *  Pending Cohort 1 applicants who get a PR merged into the community repo
 *  before this timestamp are automatically promoted to "admitted" — no need
 *  to wait for the May 10 manual admit round.
 *
 *  May 9, 2026 11:59:59 PM ET (EDT = UTC-4) → 03:59:59 UTC on May 10. */
export const SUMMER_COHORT_C1_AUTO_ADMIT_DEADLINE_MS = Date.UTC(
  2026,
  4, // May (0-indexed)
  10,
  3,
  59,
  59
);
export const SUMMER_COHORT_C1_AUTO_ADMIT_DEADLINE_LABEL =
  "Fri, May 9 · 11:59pm ET";

export function isWithinSummerCohortC1AutoAdmitWindow(
  now: number = Date.now()
): boolean {
  return now <= SUMMER_COHORT_C1_AUTO_ADMIT_DEADLINE_MS;
}

export const SUMMER_COHORT_C1_WEEK_1 = {
  title: "Project Management Build",
  kickoffLabel: "Mon, May 11 · 6–7pm EST",
  deadlineLabel: "Fri, May 15 · 5pm EST",
  votingCallLabel: "Fri, May 15 · 6pm EST",
  submissionBranch: "c1w1pm-submission",
  submissionPath:
    "content/summer-cohort/c1/w1-pm/submissions/<github-handle>.json",
  presentMinutes: 2.5,
  topNFromAi: 5,
  wildcardSlots: 3,
} as const;

// Vote-format week metadata (weeks 1, 2, 3). Each is the same submission
// shape: open a PR adding a JSON pointer file, get AI-scored, top 5 + 3
// wildcards present on Friday for the cohort vote. Dates and Zoom links are
// placeholders for weeks 2 and 3 — finalize closer to date.
export interface SummerCohortInspirationPlatform {
  name: string;
  url: string;
  takeaway: string;
}

export interface SummerCohortVoteWeek {
  week: number;
  title: string;
  oneLiner: string;
  kickoffLabel: string;
  deadlineLabel: string;
  votingCallLabel: string;
  submissionBranch: string;
  submissionPath: string;
  liveUrlRequired: boolean;
  winnerCommitment: string;
  /** Free-form note rendered above the kickoff block (e.g. holiday / immersion overlap). */
  weekNotes?: string;
  /** Reference platforms participants can study. Frame is "what's worth
   *  borrowing", not "rebuild this." */
  inspirationScopeNote: string;
  inspirationPlatforms: readonly SummerCohortInspirationPlatform[];
}

export const SUMMER_COHORT_C1_VOTE_WEEKS: readonly SummerCohortVoteWeek[] = [
  {
    week: 1,
    title: "Project Management Build",
    oneLiner:
      "Everyone builds a PM tool. The cohort picks a winner on Friday; the winner runs the cohort PM tool for the rest of the program.",
    kickoffLabel: SUMMER_COHORT_C1_WEEK_1.kickoffLabel,
    deadlineLabel: SUMMER_COHORT_C1_WEEK_1.deadlineLabel,
    votingCallLabel: SUMMER_COHORT_C1_WEEK_1.votingCallLabel,
    submissionBranch: SUMMER_COHORT_C1_WEEK_1.submissionBranch,
    submissionPath: SUMMER_COHORT_C1_WEEK_1.submissionPath,
    liveUrlRequired: true,
    winnerCommitment:
      "Winner maintains the cohort PM tool through the rest of the program — fixes bugs, ships changes the cohort asks for, keeps it running.",
    inspirationScopeNote:
      "Don't try to rebuild Linear or Asana. The cohort is ~100 people shipping for 6 weeks — think \"how do we track who's shipping what each week and prep for Friday voting calls?\" Skip Gantt charts, time tracking, sprint estimation, and billing.",
    inspirationPlatforms: [
      {
        name: "Linear",
        url: "https://linear.app",
        takeaway:
          "Keyboard-first UX, fast issue triage, opinionated state model. Borrow the speed and the clarity, not the feature surface.",
      },
      {
        name: "Trello",
        url: "https://trello.com",
        takeaway:
          "Kanban as the whole product. Lean on this if your wedge is \"see at a glance who's shipping where.\"",
      },
      {
        name: "Notion",
        url: "https://notion.so",
        takeaway:
          "Docs and databases in one. Useful if cohort updates and project tracking want to live next to each other.",
      },
      {
        name: "GitHub Projects",
        url: "https://github.com/features/issues",
        takeaway:
          "Already where the code lives. The bar to beat is \"why open another tab?\"",
      },
      {
        name: "Height",
        url: "https://height.app",
        takeaway:
          "AI-first PM tool — auto-triage, smart filters. Shows what an LLM-native PM tool looks like.",
      },
    ],
  },
  {
    week: 2,
    title: "Communications Build",
    oneLiner:
      "Everyone builds a comms platform for the cohort. Same vote-and-pick-a-winner format. Winner runs comms for the rest of the cohort.",
    kickoffLabel: "Mon, May 18 · 6–7pm EST",
    deadlineLabel: "Fri, May 22 · 5pm EST",
    votingCallLabel: "Fri, May 22 · 6pm EST",
    submissionBranch: "c1w2comms-submission",
    submissionPath:
      "content/summer-cohort/c1/w2-comms/submissions/<github-handle>.json",
    liveUrlRequired: true,
    winnerCommitment:
      "Winner maintains the cohort comms platform for the remaining weeks — onboarding new threads, fixing what breaks, keeping conversation flowing.",
    inspirationScopeNote:
      "Discord is already the cohort's chat backbone. Don't try to be Slack or Telegram from scratch. The bar to beat is \"what does a 100-person cohort need that Discord doesn't deliver?\" — maybe that's persistent project threads, peer-review queues, kudos, weekly digest. Pick a wedge.",
    inspirationPlatforms: [
      {
        name: "Slack",
        url: "https://slack.com",
        takeaway:
          "Channel + thread model, search, integrations. Borrow the clarity of channel taxonomy, not the enterprise feature pile.",
      },
      {
        name: "Discord",
        url: "https://discord.com",
        takeaway:
          "Already where the cohort hangs out. Study what's good — voice, presence, server identity — and what's bad — hard to thread, weak search.",
      },
      {
        name: "Telegram",
        url: "https://telegram.org",
        takeaway:
          "Mobile-first messaging at scale. Useful if your wedge is \"works great on a phone during commute.\"",
      },
      {
        name: "Mattermost",
        url: "https://mattermost.com",
        takeaway:
          "Open-source Slack analog. Worth a look if you want to study how a chat surface is structured under the hood.",
      },
      {
        name: "Circle",
        url: "https://circle.so",
        takeaway:
          "Community-platform feel — posts + threads + events, less \"chat,\" more \"forum.\" A different shape entirely.",
      },
    ],
  },
  {
    week: 3,
    title: "Marketing Build",
    oneLiner:
      "Everyone builds a marketing platform — typically a public site that promotes the cohort and the work. Same vote format; winner maintains it.",
    kickoffLabel: "Mon, May 25 · 6–7pm EST",
    deadlineLabel: "Fri, May 29 · 5pm EST",
    votingCallLabel: "Fri, May 29 · 6pm EST",
    submissionBranch: "c1w3mkt-submission",
    submissionPath:
      "content/summer-cohort/c1/w3-mkt/submissions/<github-handle>.json",
    liveUrlRequired: true,
    winnerCommitment:
      "Winner maintains the cohort marketing site through demo day — keeping it up to date with what the cohort is shipping.",
    weekNotes:
      "Heads up: Mon May 25 is Memorial Day (US holiday) and Tue May 26 is the in-person immersion event at Hult. Plan your build time around both.",
    inspirationScopeNote:
      "You're marketing 100 people and 6 weeks of builds — not running a media company. Skip A/B testing, lead-scoring, full CMS. The bar to beat is \"where does a hiring partner go on demo day to see what the cohort shipped?\"",
    inspirationPlatforms: [
      {
        name: "Vercel",
        url: "https://vercel.com",
        takeaway:
          "Easy deploys + MDX-friendly. The default if your wedge is \"a fast, content-rich public site I can keep editing.\"",
      },
      {
        name: "Framer",
        url: "https://framer.com",
        takeaway:
          "Design-led no-code. Lean on this if visual polish is your differentiator.",
      },
      {
        name: "Notion (public pages)",
        url: "https://notion.so",
        takeaway:
          "Quick wins for content-heavy cohort directories — every participant gets a page, no CMS needed.",
      },
      {
        name: "Read.cv",
        url: "https://read.cv",
        takeaway:
          "Profile-aggregator vibe — clean, opinionated. Useful if your wedge is \"the cohort's people page.\"",
      },
      {
        name: "Substack",
        url: "https://substack.com",
        takeaway:
          "Newsletter + article focus. Worth studying if you want \"weekly cohort digest\" to be your wedge.",
      },
    ],
  },
] as const;

export const SUMMER_COHORT_C1_WEEK_4 = {
  week: 4,
  title: "Ludwitt Education Tool",
  oneLiner:
    "Everyone ships an education tool that gets merged into Ludwitt. As users consume credits via your tool, you earn a revenue share — every shipped tool earns its author fees in perpetuity.",
  kickoffLabel: "Mon, Jun 1 · 6–7pm EST",
  deadlineLabel: "Fri, Jun 5 · 5pm EST",
  // No vote — every shipped + merged tool counts.
} as const;

export const SUMMER_COHORT_C1_WEEK_5 = {
  week: 5,
  title: "Your Own Startup",
  oneLiner:
    "Build whatever YOU want this week — your own startup project. No vote, no submission template; bring it to the Friday call for show-and-tell.",
  kickoffLabel: "Mon, Jun 8 · 6–7pm EST",
  showAndTellLabel: "Fri, Jun 12 · 6pm EST",
} as const;

export const SUMMER_COHORT_C1_WEEK_6 = {
  week: 6,
  title: "Open-Source PR",
  oneLiner:
    "Pick a major open-source project and land a merged PR upstream. Friday is also demo day with hiring partners — bring your merged PR URL.",
  kickoffLabel: "Mon, Jun 15 · 6–7pm EST",
  demoDayLabel: "Fri, Jun 19 · time TBD",
} as const;

/** Default tab when an admitted cohort-1 user lands on /summer-cohort. */
export const SUMMER_COHORT_C1_DEFAULT_TAB = "week-1" as const;

export const SUMMER_COHORT_PHILOSOPHY =
  "The cohort succeeds or fails as a cohort. Goal: every participant lands a job offer. The tools each cohort builds are how they market themselves to hiring partners and the world.";

/** Stretch target for applicants per cohort — drives the counter UI. */
export const SUMMER_COHORT_GOAL_PER_COHORT = 100;
