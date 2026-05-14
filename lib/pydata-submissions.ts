/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import fs from "node:fs";
import path from "node:path";

/**
 * Build-time loader for the PyData hackathon submissions directory.
 *
 * Layout (see `pydata-2026-submissions/README.md`):
 *
 *   pydata-2026-submissions/
 *     README.md
 *     <gh-handle>/
 *       submission.py
 *       meta.json
 *
 * The event page reads this list at build time. New submissions appear
 * after `main` deploys, which matches the user's workflow:
 *   attendee PR → `pydata-2026-submissions` branch → develop → main → deploy.
 */

export const PYDATA_SUBMISSIONS_BRANCH = "pydata-2026-submissions";
export const PYDATA_SUBMISSIONS_DIR = "pydata-2026-submissions";
export const PYDATA_SUBMISSIONS_REPO_URL =
  "https://github.com/rogerSuperBuilderAlpha/cursor-boston";

const NOTEBOOK_FILENAME = "submission.py";
const META_FILENAME = "meta.json";
const SCORE_FILENAME = "score.json";
const MAX_TITLE = 120;
const MAX_DESCRIPTION = 500;
const MAX_TAGS = 6;
const MAX_COLLABORATORS = 10;
const MAX_RATIONALE = 1000;
const WINNER_ELIGIBLE_CUTOFF_ISO = "2026-05-14T01:00:00.000Z";

const SUBMISSION_PR_CREATED_AT: Record<string, string> = {
  aaravraina3: "2026-05-14T00:40:39Z",
  aarongrace978: "2026-05-14T01:09:53Z",
  amirmolavi: "2026-05-14T00:48:53Z",
  ankittejyadav: "2026-05-14T01:18:21Z",
  bradagi: "2026-05-14T00:01:10Z",
  buenogrande: "2026-05-14T00:56:23Z",
  danysigha: "2026-05-14T00:54:50Z",
  dengziwu123: "2026-05-14T00:49:54Z",
  dimavrem22: "2026-05-14T00:56:07Z",
  ed2uiz: "2026-05-13T23:28:49Z",
  gavinsadler: "2026-05-13T23:05:38Z",
  harryj12: "2026-05-14T00:58:38Z",
  johnnywang1998: "2026-05-14T00:17:31Z",
  jonathanlittel: "2026-05-14T00:58:40Z",
  mahtaraatwit: "2026-05-14T01:10:41Z",
  mallikagaikwad: "2026-05-14T01:24:26Z",
  manisha002307735: "2026-05-14T01:11:27Z",
  ori98: "2026-05-14T00:44:57Z",
  "paramjeet-singh-neu": "2026-05-14T00:58:49Z",
  pjsk02: "2026-05-14T01:05:56Z",
  pocketp1ck: "2026-05-14T01:01:37Z",
  rdspangler: "2026-05-14T00:46:39Z",
  saadai113: "2026-05-14T01:49:05Z",
  saiff7: "2026-05-14T01:37:07Z",
  sanaz01: "2026-05-14T01:10:42Z",
  shuaeb6: "2026-05-14T01:05:51Z",
  simrankumari30: "2026-05-14T01:31:56Z",
  squamis: "2026-05-14T00:56:20Z",
  "t-siddharth": "2026-05-14T00:28:58Z",
  trevordcampbell: "2026-05-14T01:04:01Z",
  varun7778: "2026-05-14T01:08:07Z",
  vimaleshraja: "2026-05-14T01:01:31Z",
  vishalprasanna11: "2026-05-14T00:56:43Z",
  "xiaolong-y": "2026-05-13T23:06:48Z",
};

export interface PyDataSubmissionCollaborator {
  displayName: string;
  githubHandle: string | null;
}

export interface PyDataSubmissionScore {
  /** Integer 1-10 from the LLM judge. */
  score: number;
  /** Short justification from the judge. */
  rationale: string;
  /** Model name that produced the score (e.g. `claude-opus-4-7`). */
  model: string;
  /** ISO timestamp of when the score was written. */
  scoredAt: string;
}

export interface PyDataSubmission {
  githubHandle: string;
  displayName: string;
  title: string;
  description: string;
  tags: string[];
  collaborators: PyDataSubmissionCollaborator[];
  /** GitHub URL pointing at the Marimo notebook source on `main`. */
  notebookUrl: string;
  /** GitHub URL pointing at the submission folder. */
  folderUrl: string;
  /**
   * Hackathon judge score. Maintainer-authored via
   * `scripts/score-pydata-submission.ts` and committed as `score.json`
   * before the PR is merged. Absent if not yet scored.
   */
  score: PyDataSubmissionScore | null;
  /** PR creation time used for winner eligibility cutoff decisions. */
  submittedAt: string | null;
  /** True when the original PR was opened before 9 PM Eastern on May 13. */
  winnerEligible: boolean;
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

function parseCollaborators(raw: unknown): PyDataSubmissionCollaborator[] {
  if (!Array.isArray(raw)) return [];
  const out: PyDataSubmissionCollaborator[] = [];
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
  // Allow lowercase letters, digits, hyphens, underscores. Reject dotfiles
  // and our README/template scaffolding. GitHub handles are case-insensitive
  // but we want a canonical lowercase form for the URL.
  if (name.startsWith(".") || name.startsWith("_")) return false;
  return /^[a-z0-9][a-z0-9-_]{0,38}$/i.test(name);
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

function readScore(folderPath: string): PyDataSubmissionScore | null {
  const scorePath = path.join(folderPath, SCORE_FILENAME);
  if (!fs.existsSync(scorePath)) return null;
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(fs.readFileSync(scorePath, "utf8")) as Record<
      string,
      unknown
    >;
  } catch {
    return null;
  }
  const score = Number(parsed.score);
  if (!Number.isFinite(score) || score < 1 || score > 10) return null;
  const rationale = clampString(parsed.rationale, MAX_RATIONALE);
  if (!rationale) return null;
  const model = clampString(parsed.model, 80) || "unknown";
  const scoredAt = clampString(parsed.scoredAt, 40) || "";
  return { score, rationale, model, scoredAt };
}

function buildSubmission(
  handleDir: string,
  meta: Record<string, unknown>,
  score: PyDataSubmissionScore | null
): PyDataSubmission | null {
  const title = clampString(meta.title, MAX_TITLE);
  const description = clampString(meta.description, MAX_DESCRIPTION);
  if (!title || !description) return null;
  const displayName =
    clampString(meta.displayName, 80) || handleDir;
  const tags = parseTags(meta.tags);
  const collaborators = parseCollaborators(meta.collaborators);
  const submittedAt = SUBMISSION_PR_CREATED_AT[handleDir] ?? null;
  const winnerEligible = submittedAt
    ? Date.parse(submittedAt) < Date.parse(WINNER_ELIGIBLE_CUTOFF_ISO)
    : false;

  return {
    githubHandle: handleDir,
    displayName,
    title,
    description,
    tags,
    collaborators,
    notebookUrl: `${PYDATA_SUBMISSIONS_REPO_URL}/blob/main/${PYDATA_SUBMISSIONS_DIR}/${handleDir}/${NOTEBOOK_FILENAME}`,
    folderUrl: `${PYDATA_SUBMISSIONS_REPO_URL}/tree/main/${PYDATA_SUBMISSIONS_DIR}/${handleDir}`,
    score,
    submittedAt,
    winnerEligible,
  };
}

/**
 * Read every valid submission from the directory on disk.
 *
 * Invalid entries (missing notebook, malformed meta.json, bad folder name)
 * are silently skipped so a single broken submission can't take down the
 * whole page. Build logs surface the skip via console.warn — visible in
 * Vercel deploy output.
 */
export function getPyDataSubmissions(): PyDataSubmission[] {
  const dir = path.join(process.cwd(), PYDATA_SUBMISSIONS_DIR);
  if (!fs.existsSync(dir)) return [];

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const submissions: PyDataSubmission[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const handleDir = entry.name;
    if (!isValidHandleDirname(handleDir)) continue;

    const folderPath = path.join(dir, handleDir);
    const notebookPath = path.join(folderPath, NOTEBOOK_FILENAME);
    if (!fs.existsSync(notebookPath)) {
      console.warn(
        `[pydata-submissions] ${handleDir}: missing ${NOTEBOOK_FILENAME}, skipping`
      );
      continue;
    }

    const meta = readMeta(folderPath);
    if (!meta || typeof meta !== "object") {
      console.warn(
        `[pydata-submissions] ${handleDir}: missing or invalid ${META_FILENAME}, skipping`
      );
      continue;
    }

    const score = readScore(folderPath);
    const submission = buildSubmission(
      handleDir,
      meta as Record<string, unknown>,
      score
    );
    if (!submission) {
      console.warn(
        `[pydata-submissions] ${handleDir}: ${META_FILENAME} missing required fields, skipping`
      );
      continue;
    }
    submissions.push(submission);
  }

  // Show the strongest judged submissions first. Keep unscored entries last and
  // use display name as a stable tie-breaker so equal scores don't jump around.
  submissions.sort((a, b) => {
    const aScore = a.score?.score ?? -Infinity;
    const bScore = b.score?.score ?? -Infinity;
    if (bScore !== aScore) return bScore - aScore;
    return a.displayName.localeCompare(b.displayName, undefined, {
      sensitivity: "base",
    });
  });
  return submissions;
}
