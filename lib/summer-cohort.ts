/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { Timestamp } from "firebase/firestore";

export const SUMMER_COHORT_SITE_ID = "cursor-boston";
export const SUMMER_COHORT_COLLECTION = "summerCohortApplications";
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
}

export const SUMMER_COHORTS: readonly SummerCohort[] = [
  {
    id: "cohort-1",
    label: "Cohort 1",
    start: "2026-05-11",
    end: "2026-06-19",
    startLabel: "Mon, May 11",
    endLabel: "Fri, Jun 19",
  },
  {
    id: "cohort-2",
    label: "Cohort 2",
    start: "2026-06-29",
    end: "2026-08-07",
    startLabel: "Mon, Jun 29",
    endLabel: "Fri, Aug 7",
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
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export function isValidCohortId(value: unknown): value is SummerCohortId {
  return value === "cohort-1" || value === "cohort-2";
}
