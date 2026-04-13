/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

export const JOB_TYPES = [
  "full-time",
  "part-time",
  "contract",
  "internship",
] as const;

export type JobType = (typeof JOB_TYPES)[number];

export const EXPERIENCE_LEVELS = [
  "junior",
  "mid",
  "senior",
  "any",
] as const;

export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

export const LOCATION_OPTIONS = [
  "Boston, MA",
  "Remote",
  "Hybrid – Boston, MA",
] as const;

export type LocationOption = (typeof LOCATION_OPTIONS)[number];

export interface JobListing {
  id: string;
  title: string;
  company: string;
  description: string;
  location: string;
  type: JobType;
  experienceLevel: ExperienceLevel;
  salaryMin?: number;
  salaryMax?: number;
  remote: boolean;
  tags: string[];
  applyUrl?: string;
  postedById: string;
  postedAt: string;
  featured: boolean;
  status: "active" | "closed";
}

export interface Application {
  id: string;
  jobId: string;
  userId: string;
  name: string;
  email: string;
  message: string;
  appliedAt: string;
}
