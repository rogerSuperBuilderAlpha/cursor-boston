/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { getGithubRepoPair } from "@/lib/github-recent-merged-prs";
import { logger } from "@/lib/logger";

export type OpenPrWithReviewSummary = {
  number: number;
  title: string;
  htmlUrl: string;
  isDraft: boolean;
  /** Short line for email body (escape before HTML if needed). */
  reviewSummary: string;
};

type PullListItem = {
  number?: unknown;
  title?: unknown;
  html_url?: unknown;
  draft?: unknown;
  user?: { login?: unknown } | null;
};

type ReviewItem = {
  state?: unknown;
  submitted_at?: unknown | null;
};

function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function summarizeReviews(
  reviews: ReviewItem[],
  isDraft: boolean
): string {
  if (isDraft) {
    return "Draft — mark Ready for review when you want maintainers to look.";
  }

  const dated = reviews.filter(
    (r): r is ReviewItem & { submitted_at: string } =>
      typeof r.submitted_at === "string" && r.submitted_at.length > 0
  );
  dated.sort(
    (a, b) => Date.parse(b.submitted_at) - Date.parse(a.submitted_at)
  );

  for (const r of dated) {
    const state = typeof r.state === "string" ? r.state : "";
    if (state === "DISMISSED") continue;
    if (state === "CHANGES_REQUESTED") {
      return "Changes requested — address comments and push updates so it can merge.";
    }
    if (state === "APPROVED") {
      return "Approved — if checks pass, it should merge soon; refresh the PR and watch for conflicts.";
    }
    if (state === "COMMENTED") {
      return "Review comment(s) — read the Conversation tab and reply or fix as needed.";
    }
  }

  if (reviews.length === 0) {
    return "Open — no reviews yet; check back for maintainer feedback before the cutoff.";
  }

  return "Open — check the PR conversation for the latest status.";
}

async function fetchOpenPullsAllPages(
  owner: string,
  repo: string
): Promise<PullListItem[]> {
  const headers = githubHeaders();
  const out: PullListItem[] = [];
  for (let page = 1; page <= 20; page++) {
    const url = new URL(
      `https://api.github.com/repos/${owner}/${repo}/pulls`
    );
    url.searchParams.set("state", "open");
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));

    const res = await fetch(url.toString(), { headers, cache: "no-store" });
    if (!res.ok) {
      logger.warn("GitHub list open PRs failed", { status: res.status, page });
      return page === 1 ? [] : out;
    }
    const batch = (await res.json()) as PullListItem[];
    if (!Array.isArray(batch) || batch.length === 0) break;
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out;
}

async function fetchReviewsForPull(
  owner: string,
  repo: string,
  pullNumber: number
): Promise<ReviewItem[]> {
  const headers = githubHeaders();
  const url = new URL(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}/reviews`
  );
  url.searchParams.set("per_page", "100");

  const res = await fetch(url.toString(), { headers, cache: "no-store" });
  if (!res.ok) {
    logger.warn("GitHub list PR reviews failed", {
      status: res.status,
      pullNumber,
    });
    return [];
  }
  const data = (await res.json()) as ReviewItem[];
  return Array.isArray(data) ? data : [];
}

/**
 * For each GitHub login (lowercase), lists that author's **open** PRs in the
 * configured repo with a short review-status line (from REST review history).
 */
export async function fetchOpenPrsWithReviewStatusForAuthors(
  authorLoginsLower: Set<string>
): Promise<Map<string, OpenPrWithReviewSummary[]>> {
  const result = new Map<string, OpenPrWithReviewSummary[]>();
  if (authorLoginsLower.size === 0) return result;

  const { owner, repo } = getGithubRepoPair();
  const pulls = await fetchOpenPullsAllPages(owner, repo);

  type Brief = {
    number: number;
    title: string;
    htmlUrl: string;
    isDraft: boolean;
    authorLower: string;
  };

  const byAuthor = new Map<string, Brief[]>();
  for (const raw of pulls) {
    const num = typeof raw.number === "number" ? raw.number : null;
    const title = typeof raw.title === "string" ? raw.title : null;
    const htmlUrl = typeof raw.html_url === "string" ? raw.html_url : null;
    const login =
      raw.user && typeof raw.user.login === "string" ? raw.user.login : null;
    if (num === null || !title || !htmlUrl || !login) continue;
    const authorLower = login.toLowerCase();
    if (!authorLoginsLower.has(authorLower)) continue;
    const isDraft = raw.draft === true;
    const brief: Brief = { number: num, title, htmlUrl, isDraft, authorLower };
    const list = byAuthor.get(authorLower) ?? [];
    list.push(brief);
    byAuthor.set(authorLower, list);
  }

  const reviewCache = new Map<number, ReviewItem[]>();
  const uniqueNumbers = new Set<number>();
  for (const list of byAuthor.values()) {
    for (const b of list) uniqueNumbers.add(b.number);
  }

  // Parallel in batches of 10 to stay well under GitHub Search API quotas.
  const BATCH = 10;
  const nums = [...uniqueNumbers];
  for (let start = 0; start < nums.length; start += BATCH) {
    const chunk = nums.slice(start, start + BATCH);
    const results = await Promise.all(
      chunk.map((n) => fetchReviewsForPull(owner, repo, n))
    );
    chunk.forEach((n, idx) => reviewCache.set(n, results[idx]!));
  }

  for (const [authorLower, briefs] of byAuthor) {
    const enriched: OpenPrWithReviewSummary[] = [];
    for (const b of briefs) {
      const reviews = reviewCache.get(b.number) ?? [];
      enriched.push({
        number: b.number,
        title: b.title,
        htmlUrl: b.htmlUrl,
        isDraft: b.isDraft,
        reviewSummary: summarizeReviews(reviews, b.isDraft),
      });
    }
    enriched.sort((a, b) => b.number - a.number);
    result.set(authorLower, enriched);
  }

  return result;
}
