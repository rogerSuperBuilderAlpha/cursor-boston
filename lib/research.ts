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
});

const RecruitingSchema = BaseSchema.extend({
  type: z.literal("recruiting"),
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

const PreprintSchema = BaseSchema.extend({
  type: z.literal("preprint"),
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

export const ResearchEntrySchema = z.discriminatedUnion("type", [
  RecruitingSchema,
  PreprintSchema,
  DatasetSchema,
]);

export type ResearchType = "recruiting" | "preprint" | "dataset";
export type ResearchEntry = z.infer<typeof ResearchEntrySchema>;
export type RecruitingEntry = z.infer<typeof RecruitingSchema>;
export type PreprintEntry = z.infer<typeof PreprintSchema>;
export type DatasetEntry = z.infer<typeof DatasetSchema>;

export interface LoadedResearchEntry {
  entry: ResearchEntry;
  /** Relative path from repo root (e.g. content/research/entries/<slug>.json). */
  sourcePath: string;
}

/**
 * Past-deadline recruiting entries are visually struck-through and auto-hidden
 * after this many days unless the entry's status is explicitly "paused".
 * Keeps the feed alive — every recruitment platform that didn't enforce this
 * ends up with a graveyard of dead listings.
 */
export const RECRUITING_AUTO_HIDE_DAYS_PAST_DEADLINE = 14;

export function isRecruiting(e: ResearchEntry): e is RecruitingEntry {
  return e.type === "recruiting";
}
export function isPreprint(e: ResearchEntry): e is PreprintEntry {
  return e.type === "preprint";
}
export function isDataset(e: ResearchEntry): e is DatasetEntry {
  return e.type === "dataset";
}

export function isRecruitingPastDeadline(
  e: RecruitingEntry,
  now: Date = new Date()
): boolean {
  return new Date(e.deadline).getTime() < now.getTime();
}

export function shouldAutoHideRecruiting(
  e: RecruitingEntry,
  now: Date = new Date()
): boolean {
  if (!isRecruitingPastDeadline(e, now)) return false;
  const deadlineMs = new Date(e.deadline).getTime();
  const cutoffMs =
    deadlineMs +
    RECRUITING_AUTO_HIDE_DAYS_PAST_DEADLINE * 24 * 60 * 60 * 1000;
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

/** Visible feed: drops auto-hidden expired recruiting entries. */
export function filterVisible(
  entries: LoadedResearchEntry[],
  now: Date = new Date()
): LoadedResearchEntry[] {
  return entries.filter(({ entry }) => {
    if (entry.type !== "recruiting") return true;
    if (entry.status === "closed") return false;
    return !shouldAutoHideRecruiting(entry, now);
  });
}

export const RESEARCH_TYPE_LABEL: Record<ResearchType, string> = {
  recruiting: "Recruiting",
  preprint: "Preprint",
  dataset: "Dataset",
};

export const RESEARCH_TYPE_PLURAL: Record<ResearchType, string> = {
  recruiting: "Recruiting calls",
  preprint: "Preprints",
  dataset: "Datasets",
};

/**
 * Path inside the cursor-boston repo for the entry's JSON. PR-based comments
 * happen against this path — the detail page deep-links here.
 */
export function repoFileUrlForSlug(slug: string): string {
  return `${RESEARCH_REPO_FILE_BASE}/${slug}.json`;
}
