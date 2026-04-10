/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { getGithubRepoPair } from "@/lib/github-recent-merged-prs";
import { logger } from "@/lib/logger";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

type SearchIssueItem = {
  user?: { login?: string } | null;
};

const SEARCH_PER_PAGE = 100;
/** GitHub search only returns the first 1000 matches. */
const SEARCH_MAX_PAGES = 10;

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
 * One paginated Search over all merged PRs in the community repo, aggregated by
 * author login. Replaces N per-author searches (which quickly hits Search API limits).
 *
 * @returns map (lowercase login → count), or `null` if the search failed entirely.
 * @see https://docs.github.com/en/rest/search/search#search-issues-and-pull-requests
 */
export async function fetchMergedPrCountByAuthorForRepo(): Promise<
  Map<string, number> | null
> {
  const { owner, repo } = getGithubRepoPair();
  const q = `repo:${owner}/${repo} type:pr is:merged`;
  const headers = searchHeaders();
  const counts = new Map<string, number>();

  try {
    for (let page = 1; page <= SEARCH_MAX_PAGES; page++) {
      const url = new URL("https://api.github.com/search/issues");
      url.searchParams.set("q", q);
      url.searchParams.set("per_page", String(SEARCH_PER_PAGE));
      url.searchParams.set("page", String(page));

      let res = await fetch(url.toString(), { headers, cache: "no-store" });
      if ((res.status === 403 || res.status === 429) && page === 1) {
        const retryAfter = res.headers.get("retry-after");
        const waitSec = retryAfter ? Number.parseInt(retryAfter, 10) : Number.NaN;
        const waitMs = Number.isFinite(waitSec) && waitSec > 0 ?
            Math.min(waitSec * 1000, 30_000)
          : 2_000;
        logger.warn("GitHub bulk merged-PR search rate-limited; retrying", {
          status: res.status,
          waitMs,
        });
        await sleep(waitMs);
        res = await fetch(url.toString(), { headers, cache: "no-store" });
      }

      if (!res.ok) {
        logger.warn("GitHub bulk merged-PR search failed", {
          status: res.status,
          page,
        });
        return page === 1 ? null : counts;
      }

      const data = (await res.json()) as { items?: SearchIssueItem[] };
      const items = data.items ?? [];
      if (items.length === 0) break;

      for (const item of items) {
        const login = item.user?.login;
        if (!login) continue;
        const k = login.toLowerCase();
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }

      if (items.length < SEARCH_PER_PAGE) break;
    }

    return counts;
  } catch (error) {
    logger.warn("GitHub bulk merged-PR search error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Merged PR counts for specific logins, using one bulk repo search when
 * `preloadedBulk` is omitted, or slicing from `preloadedBulk` when provided
 * (avoids duplicate API work in long-running scripts).
 *
 * For keys in `githubLogins`, the returned map always has an entry when the bulk
 * fetch succeeded; values may be `0`. On bulk failure, returns an empty map so
 * callers keep their fallback (e.g. Firestore).
 */
export async function fetchMergedPrCountsForLogins(
  githubLogins: string[],
  preloadedBulk?: Map<string, number> | null
): Promise<Map<string, number>> {
  const unique = [...new Set(githubLogins.map((l) => l.trim()).filter(Boolean))];
  const out = new Map<string, number>();
  if (unique.length === 0) return out;

  const bulk =
    preloadedBulk !== undefined ?
      preloadedBulk
    : await fetchMergedPrCountByAuthorForRepo();

  if (!bulk) return out;

  for (const login of unique) {
    out.set(login.toLowerCase(), bulk.get(login.toLowerCase()) ?? 0);
  }
  return out;
}
