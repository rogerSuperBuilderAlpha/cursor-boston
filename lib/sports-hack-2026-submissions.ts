/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import fs from "node:fs";
import path from "node:path";

/**
 * Build-time loader for the Sports Hack 2026 submissions directory.
 *
 * Layout (see `sports-hack-2026-submissions/README.md`):
 *
 *   sports-hack-2026-submissions/
 *     README.md
 *     <gh-handle>/
 *       meta.json       — title, description, videoUrl, repoUrl, deployedUrl
 *       score.json      — maintainer-authored: { ai: {...}, judges?: {...} }
 *
 * The event page reads this list at build time. New submissions appear
 * after `main` deploys:
 *   attendee PR → `sports-hack-2026-submissions` branch → develop → main → deploy.
 *
 * Scoring is post-deadline. AI scores come from
 * `scripts/score-sports-hack-2026-submission.ts`. Judge scores come from a
 * follow-up admin path (TBD until a judge list is locked).
 */

export const SPORTS_HACK_2026_SUBMISSIONS_BRANCH = "sports-hack-2026-submissions";
export const SPORTS_HACK_2026_SUBMISSIONS_DIR = "sports-hack-2026-submissions";
export const SPORTS_HACK_2026_SUBMISSIONS_REPO_URL =
  "https://github.com/rogerSuperBuilderAlpha/cursor-boston";

const META_FILENAME = "meta.json";
const SCORE_FILENAME = "score.json";
const MAX_TITLE = 120;
const MAX_DESCRIPTION = 500;
const MAX_TAGS = 6;
const MAX_COLLABORATORS = 10;
const MAX_RATIONALE = 1000;
const MAX_URL = 500;

/**
 * Hard deadline: 4:00 PM ET on Tuesday, May 26, 2026 (event end).
 * Submissions whose PR was opened at or after this instant are still
 * eligible for the judges track but locked out of AI scoring.
 */
export const SPORTS_HACK_2026_WINNER_ELIGIBLE_CUTOFF_ISO =
  "2026-05-26T20:00:00.000Z";

/**
 * Maintainer-filled map of PR creation timestamps, keyed by the submission
 * folder name (lowercased GitHub handle). Fill this in as PRs land — the
 * page uses it to render the AI-eligible vs after-deadline split. Same
 * pattern as `lib/pydata-submissions.ts`.
 */
const SUBMISSION_PR_CREATED_AT: Record<string, string> = {};

export interface SportsHack2026SubmissionCollaborator {
  displayName: string;
  githubHandle: string | null;
}

export interface SportsHack2026AiScore {
  /** Numeric 1-10 score from the LLM judge; decimals are used for tie-breaks. */
  score: number;
  /** Short justification from the judge. */
  rationale: string;
  /** Model name that produced the score (e.g. `claude-opus-4-7`). */
  model: string;
  /** ISO timestamp of when the score was written. */
  scoredAt: string;
}

export interface SportsHack2026JudgeScore {
  /** Average human-judge score 1-10. */
  average: number;
  /** Number of judges who scored. */
  count: number;
  /** Optional consolidated rationale from the judge panel. */
  rationale?: string;
  /** ISO timestamp of when the score was finalized. */
  scoredAt?: string;
}

export interface SportsHack2026Submission {
  githubHandle: string;
  displayName: string;
  title: string;
  description: string;
  /** URL to a Loom/YouTube/Vimeo/etc. explainer video. */
  videoUrl: string | null;
  /** GitHub URL for the project repo. */
  repoUrl: string | null;
  /** Live URL for the deployed project. Empty string for not-deployed. */
  deployedUrl: string | null;
  tags: string[];
  collaborators: SportsHack2026SubmissionCollaborator[];
  /** GitHub URL pointing at the submission folder on `main`. */
  folderUrl: string;
  /** AI judge score. Absent if not yet scored or PR was after the deadline. */
  aiScore: SportsHack2026AiScore | null;
  /** Human judge score. Absent if not yet finalized. */
  judgeScore: SportsHack2026JudgeScore | null;
  /** PR creation time used for AI-eligibility cutoff decisions. */
  submittedAt: string | null;
  /** True when the original PR was opened before 4 PM ET on May 26. */
  aiEligible: boolean;
}

function clampString(s: unknown, max: number): string {
  if (typeof s !== "string") return "";
  return s.trim().slice(0, max);
}

function parseTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const tags: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== "string") continue;
    const cleaned = entry.trim().toLowerCase().slice(0, 32);
    if (!cleaned) continue;
    if (tags.includes(cleaned)) continue;
    tags.push(cleaned);
    if (tags.length >= MAX_TAGS) break;
  }
  return tags;
}

function parseCollaborators(raw: unknown): SportsHack2026SubmissionCollaborator[] {
  if (!Array.isArray(raw)) return [];
  const out: SportsHack2026SubmissionCollaborator[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const obj = entry as Record<string, unknown>;
    const displayName = clampString(obj.displayName, 80);
    if (!displayName) continue;
    const handleRaw = clampString(obj.githubHandle, 64);
    out.push({
      displayName,
      githubHandle: handleRaw ? handleRaw.replace(/^@/, "") : null,
    });
    if (out.length >= MAX_COLLABORATORS) break;
  }
  return out;
}

function isValidHandleDirname(name: string): boolean {
  if (name.startsWith(".") || name.startsWith("_")) return false;
  return /^[a-z0-9][a-z0-9-_]{0,38}$/i.test(name);
}

function parseUrl(raw: unknown): string | null {
  const s = clampString(raw, MAX_URL);
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) return null;
  return s;
}

function readMeta(folderPath: string): unknown {
  const metaPath = path.join(folderPath, META_FILENAME);
  if (!fs.existsSync(metaPath)) return null;
  try {
    const text = fs.readFileSync(metaPath, "utf8");
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function readScores(folderPath: string): {
  aiScore: SportsHack2026AiScore | null;
  judgeScore: SportsHack2026JudgeScore | null;
} {
  const scorePath = path.join(folderPath, SCORE_FILENAME);
  if (!fs.existsSync(scorePath)) return { aiScore: null, judgeScore: null };
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(fs.readFileSync(scorePath, "utf8")) as Record<
      string,
      unknown
    >;
  } catch {
    return { aiScore: null, judgeScore: null };
  }
  return {
    aiScore: parseAiScoreBlock(parsed.ai),
    judgeScore: parseJudgeScoreBlock(parsed.judges),
  };
}

function parseAiScoreBlock(raw: unknown): SportsHack2026AiScore | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const score = Number(obj.score);
  if (!Number.isFinite(score) || score < 1 || score > 10) return null;
  const rationale = clampString(obj.rationale, MAX_RATIONALE);
  if (!rationale) return null;
  const model = clampString(obj.model, 80) || "unknown";
  const scoredAt = clampString(obj.scoredAt, 40) || "";
  return { score, rationale, model, scoredAt };
}

function parseJudgeScoreBlock(raw: unknown): SportsHack2026JudgeScore | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const average = Number(obj.average);
  if (!Number.isFinite(average) || average < 1 || average > 10) return null;
  const count = Number(obj.count);
  if (!Number.isFinite(count) || count < 1) return null;
  const rationale = clampString(obj.rationale, MAX_RATIONALE) || undefined;
  const scoredAt = clampString(obj.scoredAt, 40) || undefined;
  return { average, count, rationale, scoredAt };
}

function buildSubmission(
  handleDir: string,
  meta: Record<string, unknown>,
  aiScore: SportsHack2026AiScore | null,
  judgeScore: SportsHack2026JudgeScore | null
): SportsHack2026Submission | null {
  const title = clampString(meta.title, MAX_TITLE);
  const description = clampString(meta.description, MAX_DESCRIPTION);
  if (!title || !description) return null;
  const displayName = clampString(meta.displayName, 80) || handleDir;
  const submittedAt = SUBMISSION_PR_CREATED_AT[handleDir] ?? null;
  const aiEligible = submittedAt
    ? Date.parse(submittedAt) < Date.parse(SPORTS_HACK_2026_WINNER_ELIGIBLE_CUTOFF_ISO)
    : false;

  return {
    githubHandle: handleDir,
    displayName,
    title,
    description,
    videoUrl: parseUrl(meta.videoUrl),
    repoUrl: parseUrl(meta.repoUrl),
    deployedUrl: parseUrl(meta.deployedUrl),
    tags: parseTags(meta.tags),
    collaborators: parseCollaborators(meta.collaborators),
    folderUrl: `${SPORTS_HACK_2026_SUBMISSIONS_REPO_URL}/tree/main/${SPORTS_HACK_2026_SUBMISSIONS_DIR}/${handleDir}`,
    aiScore,
    judgeScore,
    submittedAt,
    aiEligible,
  };
}

/**
 * Read every valid submission from the directory on disk.
 *
 * Invalid entries (malformed meta.json, bad folder name) are silently skipped
 * so a single broken submission can't take down the whole page. Build logs
 * surface the skip via console.warn — visible in Vercel deploy output.
 */
export function getSportsHack2026Submissions(): SportsHack2026Submission[] {
  const dir = path.join(process.cwd(), SPORTS_HACK_2026_SUBMISSIONS_DIR);
  if (!fs.existsSync(dir)) return [];

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const submissions: SportsHack2026Submission[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const handleDir = entry.name;
    if (!isValidHandleDirname(handleDir)) continue;

    const folderPath = path.join(dir, handleDir);
    const meta = readMeta(folderPath);
    if (!meta || typeof meta !== "object") {
      console.warn(
        `[sports-hack-2026-submissions] ${handleDir}: missing or invalid ${META_FILENAME}, skipping`
      );
      continue;
    }

    const { aiScore, judgeScore } = readScores(folderPath);
    const submission = buildSubmission(
      handleDir,
      meta as Record<string, unknown>,
      aiScore,
      judgeScore
    );
    if (!submission) {
      console.warn(
        `[sports-hack-2026-submissions] ${handleDir}: ${META_FILENAME} missing required fields, skipping`
      );
      continue;
    }
    submissions.push(submission);
  }

  // Sort: strongest combined score first (AI + judges if both present;
  // otherwise whichever is set; unscored last). Stable tie-break on name.
  submissions.sort((a, b) => {
    const aRank = combinedRankScore(a);
    const bRank = combinedRankScore(b);
    if (bRank !== aRank) return bRank - aRank;
    return a.displayName.localeCompare(b.displayName, undefined, {
      sensitivity: "base",
    });
  });
  return submissions;
}

function combinedRankScore(s: SportsHack2026Submission): number {
  const ai = s.aiScore?.score ?? null;
  const judge = s.judgeScore?.average ?? null;
  if (ai != null && judge != null) return (ai + judge) / 2;
  if (ai != null) return ai;
  if (judge != null) return judge;
  return -Infinity;
}
