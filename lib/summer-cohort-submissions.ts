/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { getAdminDb } from "./firebase-admin";
import { getGithubRepoPair } from "./github-recent-merged-prs";
import { logger } from "./logger";
import {
  SUMMER_COHORT_C1_VOTE_WEEKS,
  type SummerCohortVoteWeek,
} from "./summer-cohort";

export interface SummerCohortSubmissionFile {
  githubHandle: string;
  repoUrl?: string;
  loomUrl?: string;
  liveUrl?: string;
  pitch?: string;
  competeForWin?: boolean;
}

export interface SummerCohortSubmissionsSummary {
  weekId: string;
  branch: string;
  path: string;
  merged: number;
  tryingToWin: number;
  /** Sorted by githubHandle for stable ordering. */
  submissions: ReadonlyArray<{
    githubHandle: string;
    repoUrl: string | null;
    loomUrl: string | null;
    liveUrl: string | null;
    pitch: string | null;
    competeForWin: boolean;
    allFieldsPresent: boolean;
    /** Looked up from the `users` collection by `github.login` (lowercased). */
    displayName: string | null;
    photoUrl: string | null;
  }>;
}

/** Strip leading slashes / `<github-handle>.json` placeholder so we can use the
 *  path as a directory listing target on the GitHub Contents API. */
function getDirectoryPath(submissionPath: string): string {
  // submissionPath looks like:
  //   "content/summer-cohort/c1/w1-pm/submissions/<github-handle>.json"
  const idx = submissionPath.lastIndexOf("/");
  return idx >= 0 ? submissionPath.slice(0, idx) : submissionPath;
}

const VOTE_WEEK_BY_ID: Record<string, SummerCohortVoteWeek> = {
  "week-1": SUMMER_COHORT_C1_VOTE_WEEKS[0],
  "week-2": SUMMER_COHORT_C1_VOTE_WEEKS[1],
  "week-3": SUMMER_COHORT_C1_VOTE_WEEKS[2],
};

export function getVoteWeekById(weekId: string): SummerCohortVoteWeek | null {
  return VOTE_WEEK_BY_ID[weekId] ?? null;
}

interface ContentsApiItem {
  name?: unknown;
  path?: unknown;
  type?: unknown;
  download_url?: unknown;
}

function isJsonFileItem(item: ContentsApiItem): boolean {
  return (
    item.type === "file" &&
    typeof item.name === "string" &&
    item.name.endsWith(".json")
  );
}

interface RawSubmission {
  githubHandle: string;
  repoUrl: string | null;
  loomUrl: string | null;
  liveUrl: string | null;
  pitch: string | null;
  competeForWin: boolean;
  allFieldsPresent: boolean;
  /** Fallback identity if no Firebase user matches by github.login. */
  jsonName: string | null;
  jsonPhotoUrl: string | null;
}

function normalizeSubmission(
  raw: unknown,
  fallbackHandle: string
): RawSubmission | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const githubHandle =
    typeof obj.githubHandle === "string" && obj.githubHandle.trim().length > 0
      ? obj.githubHandle.trim()
      : fallbackHandle;
  const repoUrl =
    typeof obj.repoUrl === "string" && obj.repoUrl.trim().length > 0
      ? obj.repoUrl.trim()
      : null;
  const loomUrl =
    typeof obj.loomUrl === "string" && obj.loomUrl.trim().length > 0
      ? obj.loomUrl.trim()
      : null;
  const liveUrl =
    typeof obj.liveUrl === "string" && obj.liveUrl.trim().length > 0
      ? obj.liveUrl.trim()
      : null;
  const pitch =
    typeof obj.pitch === "string" && obj.pitch.trim().length > 0
      ? obj.pitch.trim()
      : null;
  const competeForWin = obj.competeForWin === true;
  const jsonName =
    typeof obj.name === "string" && obj.name.trim().length > 0
      ? obj.name.trim()
      : null;
  const jsonPhotoUrl =
    typeof obj.photoUrl === "string" && obj.photoUrl.trim().length > 0
      ? obj.photoUrl.trim()
      : null;
  // Baseline = the always-required fields. Caller layers in the
  // liveUrlRequired check from the week config.
  const allFieldsBaseline = Boolean(repoUrl && loomUrl && pitch && githubHandle);

  return {
    githubHandle,
    repoUrl,
    loomUrl,
    liveUrl,
    pitch,
    competeForWin,
    allFieldsPresent: allFieldsBaseline,
    jsonName,
    jsonPhotoUrl,
  };
}

/**
 * Fetch the merged-submissions list for a vote-format week from GitHub.
 *
 * Source of truth: JSON files on the week's submission branch under the week's
 * submissions directory. "Merged" = file exists on the branch. "Trying to win"
 * = all required fields are present AND `competeForWin: true`.
 */
export async function fetchSummerCohortSubmissions(
  week: SummerCohortVoteWeek,
  weekId: string
): Promise<SummerCohortSubmissionsSummary> {
  const { owner, repo } = getGithubRepoPair();
  const dirPath = getDirectoryPath(week.submissionPath);
  const token = process.env.GITHUB_TOKEN;

  const empty: SummerCohortSubmissionsSummary = {
    weekId,
    branch: week.submissionBranch,
    path: dirPath,
    merged: 0,
    tryingToWin: 0,
    submissions: [],
  };

  const listUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${dirPath}?ref=${encodeURIComponent(
    week.submissionBranch
  )}`;

  let listRes: Response;
  try {
    listRes = await fetch(listUrl, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      next: { revalidate: 60 },
    });
  } catch (error) {
    logger.warn("fetchSummerCohortSubmissions: contents-list fetch failed", {
      weekId,
      branch: week.submissionBranch,
      error: error instanceof Error ? error.message : String(error),
    });
    return empty;
  }

  // 404 = branch or directory doesn't exist yet (program hasn't started, or
  // no submissions merged). Return empty without erroring.
  if (listRes.status === 404) return empty;
  if (!listRes.ok) {
    logger.warn("fetchSummerCohortSubmissions: contents-list non-OK", {
      weekId,
      branch: week.submissionBranch,
      status: listRes.status,
    });
    return empty;
  }

  let listJson: unknown;
  try {
    listJson = await listRes.json();
  } catch {
    return empty;
  }
  if (!Array.isArray(listJson)) return empty;

  const fileItems = (listJson as ContentsApiItem[]).filter(isJsonFileItem);

  const submissions = await Promise.all(
    fileItems.map(async (item) => {
      const downloadUrl =
        typeof item.download_url === "string" ? item.download_url : null;
      const name = typeof item.name === "string" ? item.name : "";
      const fallbackHandle = name.replace(/\.json$/, "");
      if (!downloadUrl) return null;
      try {
        const fileRes = await fetch(downloadUrl, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          next: { revalidate: 60 },
        });
        if (!fileRes.ok) return null;
        const fileJson = await fileRes.json();
        return normalizeSubmission(fileJson, fallbackHandle);
      } catch {
        return null;
      }
    })
  );

  const cleaned = submissions
    .filter((s): s is RawSubmission => s !== null)
    .sort((a, b) => a.githubHandle.localeCompare(b.githubHandle));

  // Apply week-specific live-URL requirement to the all-fields baseline, and
  // enrich with Firebase user identity (displayName + photoURL) by looking up
  // the `users` collection by github.login.
  const handlesLower = cleaned.map((s) => s.githubHandle.toLowerCase());
  const userIdentities = await fetchUserIdentitiesByGithubLogin(handlesLower);

  const finalized = cleaned.map((s) => {
    const identity = userIdentities.get(s.githubHandle.toLowerCase());
    // Strip the JSON-fallback fields from the public payload — they exist
    // only to source a displayName/photoUrl when the submitter isn't a
    // Firebase user.
    const { jsonName, jsonPhotoUrl, ...rest } = s;
    return {
      ...rest,
      allFieldsPresent: week.liveUrlRequired
        ? s.allFieldsPresent && Boolean(s.liveUrl)
        : s.allFieldsPresent,
      displayName: identity?.displayName ?? jsonName ?? null,
      photoUrl: identity?.photoUrl ?? jsonPhotoUrl ?? null,
    };
  });

  const merged = finalized.length;
  const tryingToWin = finalized.filter(
    (s) => s.allFieldsPresent && s.competeForWin
  ).length;

  return {
    weekId,
    branch: week.submissionBranch,
    path: dirPath,
    merged,
    tryingToWin,
    submissions: finalized,
  };
}

interface UserIdentity {
  displayName: string | null;
  photoUrl: string | null;
}

/** Look up Firebase user records (displayName + photoURL) by github.login.
 *  Falls back to an empty map on any error — submissions still render, just
 *  without enrichment. */
async function fetchUserIdentitiesByGithubLogin(
  handlesLower: ReadonlyArray<string>
): Promise<Map<string, UserIdentity>> {
  const result = new Map<string, UserIdentity>();
  if (handlesLower.length === 0) return result;
  const db = getAdminDb();
  if (!db) return result;

  // Firestore "in" queries cap at 30 values; chunk to be safe.
  const chunkSize = 25;
  const unique = Array.from(new Set(handlesLower));
  try {
    for (let i = 0; i < unique.length; i += chunkSize) {
      const chunk = unique.slice(i, i + chunkSize);
      const snap = await db
        .collection("users")
        .where("github.login", "in", chunk)
        .get();
      for (const doc of snap.docs) {
        const data = doc.data() || {};
        const githubInfo =
          data.github && typeof data.github === "object"
            ? (data.github as Record<string, unknown>)
            : null;
        const handle =
          githubInfo && typeof githubInfo.login === "string"
            ? githubInfo.login.toLowerCase()
            : null;
        if (!handle) continue;
        const displayName =
          typeof data.displayName === "string" && data.displayName.trim().length > 0
            ? data.displayName.trim()
            : null;
        const photoUrl =
          typeof data.photoURL === "string" && data.photoURL.trim().length > 0
            ? data.photoURL.trim()
            : null;
        result.set(handle, { displayName, photoUrl });
      }
    }
  } catch (error) {
    logger.warn(
      "fetchUserIdentitiesByGithubLogin: lookup failed, returning partial map",
      { error: error instanceof Error ? error.message : String(error) }
    );
  }
  return result;
}
