/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Live GitHub query for submission PRs into the sports-hack-2026 submissions
 * branch. Modeled on `lib/github-merged-pr-count.ts`: one bulk Search call,
 * cached via `unstable_cache` so the leaderboard snapshot doesn't pay a
 * GitHub round-trip on every refresh.
 *
 * Cache TTL is short (60s) so newly-opened submission PRs propagate to the
 * snapshot's `hasSubmission` flag — and to the credit-eligibility gate —
 * within a minute. Maintainers can force-refresh via
 * `POST /api/hackathons/events/sports-hack-2026/refresh-submissions` which
 * revalidates the tag and rebuilds the snapshot.
 *
 * Returns lowercased author logins so callers can do a single
 * `set.has(login.toLowerCase())` check per attendee.
 */
import { unstable_cache } from "next/cache";
import { getGithubRepoPair } from "@/lib/github-recent-merged-prs";
import { fetchWithTimeout } from "@/lib/http-fetch";
import { logger } from "@/lib/logger";
import { SPORTS_HACK_2026_SUBMISSIONS_BRANCH } from "@/lib/sports-hack-2026-submissions";

export const SPORTS_HACK_2026_SUBMISSION_AUTHORS_CACHE_TAG =
  "sports-hack-2026-submission-authors";

const SEARCH_PER_PAGE = 100;
/** GitHub search caps at 1000 results; 10 pages × 100. */
const SEARCH_MAX_PAGES = 10;

type SearchIssueItem = {
  user?: { login?: string } | null;
};

function searchHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/**
 * Uncached search for PRs (open + merged + closed) targeting the sports-hack
 * submissions branch. Returns lowercased author logins as an array of strings
 * so the result is JSON-serialisable for the next/cache layer.
 *
 * Returns `null` on hard failure so callers can leave `hasSubmission` false
 * without crashing the snapshot build.
 */
export async function fetchSportsHack2026SubmissionAuthorsUncached(): Promise<
  string[] | null
> {
  const { owner, repo } = getGithubRepoPair();
  const q = `repo:${owner}/${repo} is:pr base:${SPORTS_HACK_2026_SUBMISSIONS_BRANCH}`;
  const headers = searchHeaders();
  const logins = new Set<string>();

  try {
    for (let page = 1; page <= SEARCH_MAX_PAGES; page++) {
      const url = new URL("https://api.github.com/search/issues");
      url.searchParams.set("q", q);
      url.searchParams.set("per_page", String(SEARCH_PER_PAGE));
      url.searchParams.set("page", String(page));

      const res = await fetchWithTimeout(url.toString(), {
        headers,
        cache: "no-store",
      });
      if (!res.ok) {
        logger.warn("GitHub sports-hack submission PR search failed", {
          status: res.status,
          page,
        });
        return page === 1 ? null : Array.from(logins);
      }

      const data = (await res.json()) as { items?: SearchIssueItem[] };
      const items = data.items ?? [];
      if (items.length === 0) break;

      for (const item of items) {
        const login = item.user?.login;
        if (typeof login === "string" && login.trim()) {
          logins.add(login.trim().toLowerCase());
        }
      }

      if (items.length < SEARCH_PER_PAGE) break;
    }

    return Array.from(logins);
  } catch (error) {
    logger.warn("GitHub sports-hack submission PR search error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

const cachedSubmissionAuthors = unstable_cache(
  fetchSportsHack2026SubmissionAuthorsUncached,
  ["fetchSportsHack2026SubmissionAuthors"],
  { revalidate: 60, tags: [SPORTS_HACK_2026_SUBMISSION_AUTHORS_CACHE_TAG] },
);

/**
 * Cached set of lowercased GitHub logins that have at least one PR (open,
 * merged, or closed) targeting the submissions branch.
 *
 * Returns an empty Set on hard fetch failure so the snapshot still renders —
 * downstream consumers treat "not in set" as "no submission yet."
 */
export async function fetchSportsHack2026SubmissionAuthors(): Promise<
  Set<string>
> {
  const arr = await cachedSubmissionAuthors();
  return new Set(arr ?? []);
}
