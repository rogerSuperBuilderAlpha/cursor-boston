/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { logger } from "@/lib/logger";

const DEFAULT_OWNER = "rogerSuperBuilderAlpha";
const DEFAULT_REPO = "cursor-boston";

export type MergedPullRequestSummary = {
  number: number;
  title: string;
  htmlUrl: string;
  mergedAt: string;
  authorLogin: string;
};

type GitHubPullApiItem = {
  number?: unknown;
  title?: unknown;
  html_url?: unknown;
  merged_at?: unknown;
  user?: { login?: unknown } | null;
};

/**
 * Resolved community repository owner/name from env (`GITHUB_REPO_OWNER`, `GITHUB_REPO_NAME`) with defaults.
 *
 * @returns `{ owner, repo }` for API calls and links.
 */
export function getGithubRepoPair(): { owner: string; repo: string } {
  const owner = process.env.GITHUB_REPO_OWNER || DEFAULT_OWNER;
  const repo = process.env.GITHUB_REPO_NAME || DEFAULT_REPO;
  return { owner, repo };
}

/**
 * Public https URL for the configured repo (for links in the UI).
 *
 * @returns HTTPS base URL for UI links.
 */
export function getGithubRepoWebBaseUrl(): string {
  const { owner, repo } = getGithubRepoPair();
  return `https://github.com/${owner}/${repo}`;
}

function normalizeItem(raw: GitHubPullApiItem): MergedPullRequestSummary | null {
  const mergedAt =
    typeof raw.merged_at === "string" && raw.merged_at.length > 0
      ? raw.merged_at
      : null;
  if (!mergedAt) return null;

  const number = typeof raw.number === "number" ? raw.number : null;
  const title = typeof raw.title === "string" ? raw.title : null;
  const htmlUrl = typeof raw.html_url === "string" ? raw.html_url : null;
  const authorLogin =
    raw.user && typeof raw.user.login === "string" ? raw.user.login : "unknown";

  if (number === null || !title || !htmlUrl) return null;

  return {
    number,
    title,
    htmlUrl,
    mergedAt,
    authorLogin,
  };
}

/**
 * Fetches recently merged PRs for the configured community repo (public API).
 * Uses GITHUB_TOKEN when set (same as other server routes) for a higher rate limit.
 *
 * @param limit - Max merged rows to return (default 8).
 * @returns Merged PR summaries, repo URL, and `error: true` when the GitHub request fails.
 */
export async function fetchRecentMergedPullRequests(
  limit = 8
): Promise<{ prs: MergedPullRequestSummary[]; repoUrl: string; error?: boolean }> {
  const { owner, repo } = getGithubRepoPair();
  const repoUrl = `https://github.com/${owner}/${repo}`;
  const token = process.env.GITHUB_TOKEN;
  const url = new URL(
    `https://api.github.com/repos/${owner}/${repo}/pulls`
  );
  url.searchParams.set("state", "closed");
  url.searchParams.set("sort", "updated");
  url.searchParams.set("direction", "desc");
  url.searchParams.set("per_page", "40");

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      logger.warn("GitHub pulls fetch failed", {
        status: res.status,
        owner,
        repo,
      });
      return { prs: [], repoUrl, error: true };
    }

    const data: unknown = await res.json();
    if (!Array.isArray(data)) {
      return { prs: [], repoUrl, error: true };
    }

    const prs: MergedPullRequestSummary[] = [];
    for (const item of data) {
      const row = normalizeItem(item as GitHubPullApiItem);
      if (row) prs.push(row);
      if (prs.length >= limit) break;
    }

    return { prs, repoUrl };
  } catch (error) {
    logger.warn("GitHub pulls fetch error", { error, owner, repo });
    return { prs: [], repoUrl, error: true };
  }
}
