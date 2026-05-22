/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

export const RESEARCH_ENTRIES_DIR = "content/research/entries";
export const RESEARCH_README_PATH = "content/research/README.md";
export const RESEARCH_REPO_FILE_BASE =
  "https://github.com/rogerSuperBuilderAlpha/cursor-boston/blob/develop/content/research/entries";
export const RESEARCH_REPO_NEW_FILE_URL =
  "https://github.com/rogerSuperBuilderAlpha/cursor-boston/new/develop/content/research/entries";
export const RESEARCH_REPO_README_URL =
  "https://github.com/rogerSuperBuilderAlpha/cursor-boston/blob/develop/content/research/README.md";

const AuthorSchema = z.object({
  name: z.string().min(1).max(120),
  affiliation: z.string().max(160).optional(),
  url: z.string().url().optional(),
});

const BaseSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
      message: "slug must be kebab-case (lowercase, digits, hyphens)",
    }),
  title: z.string().min(3).max(200),
  authors: z.array(AuthorSchema).min(1).max(20),
  postedAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }).optional(),
  disciplines: z.array(z.string().min(1).max(40)).min(1).max(8),
  summary: z.string().min(20).max(500),
  /** External GitHub repo that hosts the actual content / files / data. */
  sourceRepoUrl: z.string().url(),
  contactEmail: z.string().email().optional(),
  contactUrl: z.string().url().optional(),
  /**
   * Placeholder / demo entry. Sample entries are hidden from the main feed
   * and from type-specific filters; they only appear under the dedicated
   * "Samples" filter. Cards visibly mark them and disable external CTAs so
   * users don't click through to fake URLs. Real entries omit this field.
   */
  isSample: z.boolean().optional(),
});

/**
 * Active Research — calls for study participants. Renamed from "recruiting"
 * to communicate the surface plainly to non-academic readers: this is the
 * research that's actively running and looking for participants.
 */
const ActiveResearchSchema = BaseSchema.extend({
  type: z.literal("active-research"),
  deadline: z.string().datetime({ offset: true }),
  compensation: z.string().min(1).max(200),
  timeCommitment: z.string().min(1).max(120),
  location: z.enum(["remote", "in-person", "hybrid"]),
  eligibility: z.string().min(1).max(400),
  slotsRemaining: z.number().int().nonnegative().optional(),
  irb: z
    .object({
      institution: z.string().min(1).max(160),
      protocolNumber: z.string().min(1).max(60),
    })
    .optional(),
  studyUrl: z.string().url().optional(),
  status: z.enum(["open", "paused", "closed"]).default("open"),
});

/**
 * Working Paper — formerly "preprint." Same schema; renamed to a term that
 * carries less institutional baggage and reads cleanly to practitioners.
 */
const WorkingPaperSchema = BaseSchema.extend({
  type: z.literal("working-paper"),
  version: z.string().min(1).max(20),
  license: z.string().min(1).max(60),
  pdfUrl: z.string().url(),
  doi: z.string().max(100).optional(),
  peerReviewStatus: z
    .enum(["awaiting", "approved", "approved-with-reservations", "rejected"])
    .optional(),
});

const DatasetSchema = BaseSchema.extend({
  type: z.literal("dataset"),
  license: z.string().min(1).max(60),
  size: z.string().max(60).optional(),
  format: z.array(z.string().min(1).max(20)).max(8).optional(),
  doi: z.string().max(100).optional(),
  citation: z.string().max(800).optional(),
});

/**
 * Collaboration — request for co-authors, co-investigators, replication
 * partners, or other co-research arrangements. Different from active
 * research (which seeks subjects) in that it seeks peer collaborators.
 */
const CollaborationSchema = BaseSchema.extend({
  type: z.literal("collaboration"),
  collaborationType: z.enum([
    "co-author",
    "co-investigator",
    "replication-partner",
    "data-sharing",
    "code-collaboration",
    "grant-partner",
    "other",
  ]),
  projectStage: z.enum([
    "idea",
    "proposal",
    "data-collection",
    "analysis",
    "writing",
    "revising",
  ]),
  seeking: z.string().min(1).max(400),
  timeCommitment: z.string().min(1).max(120),
  /** Optional deadline (grant deadline, conference target, etc.). */
  deadline: z.string().datetime({ offset: true }).optional(),
  status: z.enum(["open", "paused", "closed"]).default("open"),
});

/**
 * Call for Papers — community-posted upcoming conference, journal special
 * issue, or workshop. For Cursor Boston's own flagship CFP, see the
 * dedicated banner on the page; this type is for peer/external CFPs.
 */
const CfpSchema = BaseSchema.extend({
  type: z.literal("cfp"),
  conferenceDates: z.string().min(1).max(120),
  /** "City, Country" or "Virtual" or "Hybrid — City, Country". */
  location: z.string().min(1).max(120),
  /** Hard deadline for paper / abstract submission. */
  submissionDeadline: z.string().datetime({ offset: true }),
  conferenceUrl: z.string().url(),
  organizingBody: z.string().min(1).max(200),
  submissionTypes: z.array(z.string().min(1).max(60)).min(1).max(8),
  status: z.enum(["open", "paused", "closed"]).default("open"),
});

export const ResearchEntrySchema = z.discriminatedUnion("type", [
  ActiveResearchSchema,
  WorkingPaperSchema,
  DatasetSchema,
  CollaborationSchema,
  CfpSchema,
]);

export type ResearchType =
  | "active-research"
  | "working-paper"
  | "dataset"
  | "collaboration"
  | "cfp";
export type ResearchEntry = z.infer<typeof ResearchEntrySchema>;
export type ActiveResearchEntry = z.infer<typeof ActiveResearchSchema>;
export type WorkingPaperEntry = z.infer<typeof WorkingPaperSchema>;
export type DatasetEntry = z.infer<typeof DatasetSchema>;
export type CollaborationEntry = z.infer<typeof CollaborationSchema>;
export type CfpEntry = z.infer<typeof CfpSchema>;

export interface LoadedResearchEntry {
  entry: ResearchEntry;
  /** Relative path from repo root (e.g. content/research/entries/<slug>.json). */
  sourcePath: string;
}

/**
 * Past-deadline active-research entries are visually struck-through and
 * auto-hidden after this many days unless explicitly paused. Keeps the
 * feed alive — every recruitment platform that didn't enforce this ends
 * up with a graveyard of dead listings.
 */
export const RECRUITING_AUTO_HIDE_DAYS_PAST_DEADLINE = 14;
/** CFP past-deadline auto-hide window — slightly longer than studies. */
export const CFP_AUTO_HIDE_DAYS_PAST_DEADLINE = 21;

export function isActiveResearch(e: ResearchEntry): e is ActiveResearchEntry {
  return e.type === "active-research";
}
export function isWorkingPaper(e: ResearchEntry): e is WorkingPaperEntry {
  return e.type === "working-paper";
}
export function isDataset(e: ResearchEntry): e is DatasetEntry {
  return e.type === "dataset";
}
export function isCollaboration(e: ResearchEntry): e is CollaborationEntry {
  return e.type === "collaboration";
}
export function isCfp(e: ResearchEntry): e is CfpEntry {
  return e.type === "cfp";
}

export function isActiveResearchPastDeadline(
  e: ActiveResearchEntry,
  now: Date = new Date()
): boolean {
  return new Date(e.deadline).getTime() < now.getTime();
}

export function shouldAutoHideActiveResearch(
  e: ActiveResearchEntry,
  now: Date = new Date()
): boolean {
  if (!isActiveResearchPastDeadline(e, now)) return false;
  const deadlineMs = new Date(e.deadline).getTime();
  const cutoffMs =
    deadlineMs +
    RECRUITING_AUTO_HIDE_DAYS_PAST_DEADLINE * 24 * 60 * 60 * 1000;
  return now.getTime() > cutoffMs;
}

export function isCfpPastDeadline(
  e: CfpEntry,
  now: Date = new Date()
): boolean {
  return new Date(e.submissionDeadline).getTime() < now.getTime();
}

export function shouldAutoHideCfp(
  e: CfpEntry,
  now: Date = new Date()
): boolean {
  if (!isCfpPastDeadline(e, now)) return false;
  const deadlineMs = new Date(e.submissionDeadline).getTime();
  const cutoffMs =
    deadlineMs + CFP_AUTO_HIDE_DAYS_PAST_DEADLINE * 24 * 60 * 60 * 1000;
  return now.getTime() > cutoffMs;
}

/**
 * Build-time loader. Reads every JSON file under content/research/entries/,
 * validates against ResearchEntrySchema, and returns the typed entries.
 *
 * Throws on validation errors so a malformed PR breaks the build rather than
 * silently dropping the entry.
 */
export function loadAllResearchEntries(): LoadedResearchEntry[] {
  const dir = path.join(process.cwd(), RESEARCH_ENTRIES_DIR);
  if (!fs.existsSync(dir)) return [];

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json") && !f.startsWith("."));

  const loaded: LoadedResearchEntry[] = [];
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const text = fs.readFileSync(fullPath, "utf8");
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      throw new Error(
        `Invalid JSON in ${RESEARCH_ENTRIES_DIR}/${file}: ${(err as Error).message}`
      );
    }
    const result = ResearchEntrySchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(
        `Schema validation failed for ${RESEARCH_ENTRIES_DIR}/${file}:\n${result.error.message}`
      );
    }
    const expectedSlug = file.replace(/\.json$/, "");
    if (result.data.slug !== expectedSlug) {
      throw new Error(
        `Slug mismatch in ${RESEARCH_ENTRIES_DIR}/${file}: file slug "${expectedSlug}" does not match entry slug "${result.data.slug}"`
      );
    }
    loaded.push({
      entry: result.data,
      sourcePath: `${RESEARCH_ENTRIES_DIR}/${file}`,
    });
  }
  return loaded;
}

/**
 * Sort entries by "recently active" — preferring updatedAt when present,
 * falling back to postedAt. Newer first.
 */
export function sortByRecentlyActive(
  entries: LoadedResearchEntry[]
): LoadedResearchEntry[] {
  return [...entries].sort((a, b) => {
    const aTs = new Date(a.entry.updatedAt ?? a.entry.postedAt).getTime();
    const bTs = new Date(b.entry.updatedAt ?? b.entry.postedAt).getTime();
    return bTs - aTs;
  });
}

/** Visible feed: drops auto-hidden expired entries and explicit closures. */
export function filterVisible(
  entries: LoadedResearchEntry[],
  now: Date = new Date()
): LoadedResearchEntry[] {
  return entries.filter(({ entry }) => {
    if (isActiveResearch(entry)) {
      if (entry.status === "closed") return false;
      return !shouldAutoHideActiveResearch(entry, now);
    }
    if (isCfp(entry)) {
      if (entry.status === "closed") return false;
      return !shouldAutoHideCfp(entry, now);
    }
    if (isCollaboration(entry)) {
      return entry.status !== "closed";
    }
    return true;
  });
}

export function isSample(entry: ResearchEntry): boolean {
  return entry.isSample === true;
}

export const RESEARCH_TYPE_LABEL: Record<ResearchType, string> = {
  "active-research": "Active Research",
  "working-paper": "Working Paper",
  dataset: "Dataset",
  collaboration: "Collaboration",
  cfp: "Call for Papers",
};

export const RESEARCH_TYPE_PLURAL: Record<ResearchType, string> = {
  "active-research": "Active Research",
  "working-paper": "Working Papers",
  dataset: "Datasets",
  collaboration: "Collaboration",
  cfp: "Calls for Papers",
};

/**
 * Path inside the cursor-boston repo for the entry's JSON. PR-based comments
 * happen against this path — the detail page deep-links here.
 */
export function repoFileUrlForSlug(slug: string): string {
  return `${RESEARCH_REPO_FILE_BASE}/${slug}.json`;
}
