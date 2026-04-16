/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { unstable_cache } from "next/cache";
import { getGithubRepoPair } from "@/lib/github-recent-merged-prs";
import { fetchWithTimeout } from "@/lib/http-fetch";

export const HACK_A_SPRINT_2026_EVENT_ID = "hack-a-sprint-2026";
export const SHOWCASE_SUBMISSIONS_CACHE_TAG = "showcase-submissions";
export const HACK_A_SPRINT_2026_LABEL = "hack-a-sprint-2026";
export const HACK_A_SPRINT_2026_SUBMISSIONS_PATH =
  "content/hackathons/hack-a-sprint-2026/submissions";

export type ShowcaseSubmissionPayload = {
  /** May be empty if omitted in JSON; hide repo link in UI when missing. */
  projectRepoUrl: string;
  deployedUrl?: string;
  title: string;
  description: string;
  /** Walkthrough URL when present; gallery still lists submissions without it. */
  loomVideoUrl?: string;
  demoVideoUrl?: string;
};

export type ShowcaseSubmission = {
  submissionId: string;
  githubLogin: string;
  payload: ShowcaseSubmissionPayload;
};

type GitHubContentItem = {
  name: string;
  type: string;
  download_url: string | null;
};

const LOGIN_JSON = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9]))*\.json$/;
const SKIP_FILES = new Set(["readme.md", "example-login.json"]);

function trimStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function githubHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function fetchShowcaseSubmissionsFromGitHubUncached(): Promise<
  ShowcaseSubmission[]
> {
  const { owner, repo } = getGithubRepoPair();
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${HACK_A_SPRINT_2026_SUBMISSIONS_PATH}`;
  const res = await fetchWithTimeout(url, { headers: githubHeaders() });
  if (res.status === 404) {
    return [];
  }
  if (!res.ok) {
    throw new Error(`GitHub contents API failed: ${res.status}`);
  }
  const items = (await res.json()) as GitHubContentItem[];
  if (!Array.isArray(items)) {
    return [];
  }

  const jsonFiles = items.filter(
    (item) =>
      item.type === "file" &&
      item.name &&
      LOGIN_JSON.test(item.name) &&
      !SKIP_FILES.has(item.name.toLowerCase())
  );

  const fileResults = await Promise.all(
    jsonFiles.map(async (file) => {
      if (!file.download_url) return null;
      const githubLogin = file.name.replace(/\.json$/i, "");
      try {
        const raw = await fetchWithTimeout(file.download_url, {
          headers: githubHeaders(),
        });
        if (!raw.ok) return null;
        let parsed: unknown;
        try {
          parsed = await raw.json();
        } catch {
          return null;
        }
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          return null;
        }
        const pr = parsed as Record<string, unknown>;
        const projectRepoUrl = trimStr(pr.projectRepoUrl);
        const title = trimStr(pr.title) || githubLogin;
        const description = trimStr(pr.description);
        const loomVideoUrl = trimStr(pr.loomVideoUrl);
        const deployedRaw = trimStr(pr.deployedUrl);
        const demoRaw = trimStr(pr.demoVideoUrl);
        const payload: ShowcaseSubmissionPayload = {
          projectRepoUrl,
          title,
          description,
          ...(loomVideoUrl ? { loomVideoUrl } : {}),
          ...(deployedRaw ? { deployedUrl: deployedRaw } : {}),
          ...(demoRaw ? { demoVideoUrl: demoRaw } : {}),
        };
        return {
          submissionId: githubLogin.toLowerCase(),
          githubLogin,
          payload,
        } as ShowcaseSubmission;
      } catch {
        return null;
      }
    })
  );

  const results = fileResults.filter((r): r is ShowcaseSubmission => r !== null);
  results.sort((a, b) => a.githubLogin.localeCompare(b.githubLogin, "en"));
  return results;
}

/**
 * Cached listing of submission JSON files from GitHub. Shared across the
 * 6+ routes that need this data. Invalidated via revalidateTag in the
 * GitHub webhook when showcase submissions change.
 */
export const fetchShowcaseSubmissionsFromGitHub = unstable_cache(
  fetchShowcaseSubmissionsFromGitHubUncached,
  ["fetchShowcaseSubmissionsFromGitHub", HACK_A_SPRINT_2026_EVENT_ID],
  { revalidate: 60, tags: [SHOWCASE_SUBMISSIONS_CACHE_TAG] }
);

export function getJudgeUidSet(): Set<string> {
  const raw = process.env.HACK_A_SPRINT_2026_JUDGE_UIDS || "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

/** Comma-separated list, case-insensitive (e.g. judge@org.com,judge2@org.com). */
export function getJudgeEmailSet(): Set<string> {
  const raw = process.env.HACK_A_SPRINT_2026_JUDGE_EMAILS || "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

/**
 * Whether the GitHub user has a merged PR with the showcase label in the community repo.
 */
export async function githubUserHasMergedLabeledShowcasePr(
  githubLogin: string
): Promise<boolean> {
  if (!githubLogin) return false;
  const { owner, repo } = getGithubRepoPair();
  const q = encodeURIComponent(
    `repo:${owner}/${repo} is:pr is:merged label:${HACK_A_SPRINT_2026_LABEL} author:${githubLogin}`
  );
  const url = `https://api.github.com/search/issues?q=${q}&per_page=1`;
  const res = await fetchWithTimeout(url, { headers: githubHeaders() });
  if (!res.ok) {
    return false;
  }
  const data = (await res.json()) as { total_count?: number };
  return typeof data.total_count === "number" && data.total_count > 0;
}

/**
 * Whether the GitHub user has any merged PR in the community repo within the
 * last `windowHours` hours. Uses the GitHub Search API `merged:>ISO` filter.
 */
export async function githubUserHasRecentlyMergedPr(
  githubLogin: string,
  windowHours: number
): Promise<boolean> {
  if (!githubLogin || windowHours <= 0) return false;
  const { owner, repo } = getGithubRepoPair();
  const since = new Date(Date.now() - windowHours * 3600 * 1000).toISOString();
  const q = encodeURIComponent(
    `repo:${owner}/${repo} is:pr is:merged author:${githubLogin} merged:>${since}`
  );
  const url = `https://api.github.com/search/issues?q=${q}&per_page=1`;
  const res = await fetchWithTimeout(url, { headers: githubHeaders() });
  if (!res.ok) return false;
  const data = (await res.json()) as { total_count?: number };
  return typeof data.total_count === "number" && data.total_count > 0;
}
