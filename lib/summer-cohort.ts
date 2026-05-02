/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { Timestamp } from "firebase/firestore";

import { SPORTS_HACK_2026_EVENT_ID, SPORTS_HACK_2026_LUMA_URL } from "./sports-hack-2026";

export const SUMMER_COHORT_SITE_ID = "cursor-boston";
export const SUMMER_COHORT_COLLECTION = "summerCohortApplications";
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

export const SUMMER_COHORT_PHILOSOPHY =
  "The cohort succeeds or fails as a cohort. Goal: every participant lands a job offer. The tools each cohort builds are how they market themselves to hiring partners and the world.";

/** Stretch target for applicants per cohort — drives the counter UI. */
export const SUMMER_COHORT_GOAL_PER_COHORT = 100;
