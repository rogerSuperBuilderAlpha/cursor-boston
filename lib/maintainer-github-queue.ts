/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { MAINTAINER_APPLICATION_BRANCH } from "@/lib/maintainer-application";
import { getGithubRepoPair } from "@/lib/github-recent-merged-prs";
import { logger } from "@/lib/logger";

const GITHUB_ACCEPT = "application/vnd.github+json";
const GITHUB_API_VERSION = "2022-11-28";

export type MaintainerPrBrief = {
  number: number;
  title: string;
  htmlUrl: string;
  authorLogin: string;
};

function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: GITHUB_ACCEPT,
    "X-GitHub-Api-Version": GITHUB_API_VERSION,
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url, { headers: githubHeaders(), cache: "no-store" });
  if (!res.ok) {
    logger.warn("Maintainer GitHub request failed", { status: res.status, url: url.split("?")[0] });
    return null;
  }
  return (await res.json()) as T;
}

/**
 * True if this GitHub user has opened at least one PR (any state) into maintainer-application.
 */
export async function hasMaintainerApplicationPullRequest(
  githubLogin: string
): Promise<boolean> {
  const login = githubLogin.trim().toLowerCase();
  if (!login) return false;

  const { owner, repo } = getGithubRepoPair();
  for (let page = 1; page <= 10; page++) {
    const url = new URL(`https://api.github.com/repos/${owner}/${repo}/pulls`);
    url.searchParams.set("state", "all");
    url.searchParams.set("base", MAINTAINER_APPLICATION_BRANCH);
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));

    const batch = await fetchJson<unknown[]>(url.toString());
    if (!batch || !Array.isArray(batch) || batch.length === 0) break;

    for (const raw of batch) {
      const row = raw as { user?: { login?: string } | null };
      const author =
        row.user && typeof row.user.login === "string" ? row.user.login.toLowerCase() : "";
      if (author === login) return true;
    }

    if (batch.length < 100) break;
    await sleep(60);
  }

  return false;
}

type PullItem = {
  number?: unknown;
  title?: unknown;
  html_url?: unknown;
  draft?: unknown;
  user?: { login?: unknown } | null;
};

type IssueComment = { user?: { login?: unknown } | null };
type PullReviewComment = { user?: { login?: unknown } | null };
type ReviewItem = {
  user?: { login?: unknown } | null;
  state?: unknown;
  body?: unknown;
  submitted_at?: unknown;
};

async function fetchOpenPullsToDevelop(
  owner: string,
  repo: string
): Promise<MaintainerPrBrief[]> {
  const out: MaintainerPrBrief[] = [];
  for (let page = 1; page <= 10; page++) {
    const url = new URL(`https://api.github.com/repos/${owner}/${repo}/pulls`);
    url.searchParams.set("state", "open");
    url.searchParams.set("base", "develop");
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));

    const batch = await fetchJson<PullItem[]>(url.toString());
    if (!batch || !Array.isArray(batch) || batch.length === 0) break;

    for (const raw of batch) {
      if (raw.draft === true) continue;
      const num = typeof raw.number === "number" ? raw.number : null;
      const title = typeof raw.title === "string" ? raw.title : null;
      const htmlUrl = typeof raw.html_url === "string" ? raw.html_url : null;
      const authorLogin =
        raw.user && typeof raw.user.login === "string" ? raw.user.login : null;
      if (num === null || !title || !htmlUrl || !authorLogin) continue;
      out.push({ number: num, title, htmlUrl, authorLogin });
    }

    if (batch.length < 100) break;
    await sleep(60);
  }
  return out;
}

function loginEq(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function userHasApprovedFromReviews(
  reviews: ReviewItem[] | null,
  maintainerLogin: string
): boolean {
  if (!reviews || !Array.isArray(reviews)) return false;
  const mine = reviews.filter(
    (r) =>
      r.user &&
      typeof r.user.login === "string" &&
      loginEq(r.user.login, maintainerLogin) &&
      typeof r.state === "string" &&
      r.state !== "PENDING"
  );
  if (mine.length === 0) return false;
  mine.sort((a, b) => {
    const ta =
      typeof a.submitted_at === "string" ? Date.parse(a.submitted_at) : 0;
    const tb =
      typeof b.submitted_at === "string" ? Date.parse(b.submitted_at) : 0;
    return tb - ta;
  });
  return mine[0]?.state === "APPROVED";
}

function userHasReviewCommentSignalFromReviews(
  reviews: ReviewItem[] | null,
  maintainerLogin: string
): boolean {
  if (!reviews || !Array.isArray(reviews)) return false;
  return reviews.some((r) => {
    if (
      !r.user ||
      typeof r.user.login !== "string" ||
      !loginEq(r.user.login, maintainerLogin)
    ) {
      return false;
    }
    const state = typeof r.state === "string" ? r.state : "";
    if (state === "COMMENTED") return true;
    const body = typeof r.body === "string" ? r.body.trim() : "";
    return body.length > 0;
  });
}

async function fetchParticipationForPull(
  owner: string,
  repo: string,
  pullNumber: number,
  maintainerLogin: string
): Promise<{ approved: boolean; commented: boolean }> {
  const reviewsUrl = new URL(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}/reviews`
  );
  reviewsUrl.searchParams.set("per_page", "100");
  const reviews = await fetchJson<ReviewItem[]>(reviewsUrl.toString());

  const approved = userHasApprovedFromReviews(reviews, maintainerLogin);
  const fromReviews = userHasReviewCommentSignalFromReviews(reviews, maintainerLogin);
  if (fromReviews) {
    return { approved, commented: true };
  }

  const issueCommentsUrl = new URL(
    `https://api.github.com/repos/${owner}/${repo}/issues/${pullNumber}/comments`
  );
  issueCommentsUrl.searchParams.set("per_page", "100");
  const issueComments = await fetchJson<IssueComment[]>(issueCommentsUrl.toString());
  if (
    Array.isArray(issueComments) &&
    issueComments.some(
      (c) =>
        c.user &&
        typeof c.user.login === "string" &&
        loginEq(c.user.login, maintainerLogin)
    )
  ) {
    return { approved, commented: true };
  }

  const reviewCommentsUrl = new URL(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}/comments`
  );
  reviewCommentsUrl.searchParams.set("per_page", "100");
  const reviewComments = await fetchJson<PullReviewComment[]>(
    reviewCommentsUrl.toString()
  );
  const commented =
    Array.isArray(reviewComments) &&
    reviewComments.some(
      (c) =>
        c.user &&
        typeof c.user.login === "string" &&
        loginEq(c.user.login, maintainerLogin)
    );

  return { approved, commented: Boolean(commented) };
}

export type MaintainerReviewQueueResult = {
  /** Open PRs to develop (non-draft) where you are not the author and you have not approved. */
  notApproved: MaintainerPrBrief[];
  /** Same set, but you have not left a comment/review comment/review body (approve-only does not count). */
  notCommented: MaintainerPrBrief[];
  /** You approved but the PR is still open. */
  approvedNotMerged: MaintainerPrBrief[];
  /** True when list calls succeeded (token may be missing — then lists may be empty). */
  githubConfigured: boolean;
};

export async function fetchMaintainerReviewQueue(
  maintainerGithubLogin: string
): Promise<MaintainerReviewQueueResult> {
  const empty: MaintainerReviewQueueResult = {
    notApproved: [],
    notCommented: [],
    approvedNotMerged: [],
    githubConfigured: Boolean(process.env.GITHUB_TOKEN?.trim()),
  };

  const login = maintainerGithubLogin.trim();
  if (!login) return empty;

  const { owner, repo } = getGithubRepoPair();
  const pulls = await fetchOpenPullsToDevelop(owner, repo);
  const relevant = pulls.filter((p) => !loginEq(p.authorLogin, login));

  const notApproved: MaintainerPrBrief[] = [];
  const notCommented: MaintainerPrBrief[] = [];
  const approvedNotMerged: MaintainerPrBrief[] = [];

  let i = 0;
  for (const pr of relevant) {
    if (i++ > 0) await sleep(80);

    const { approved, commented } = await fetchParticipationForPull(
      owner,
      repo,
      pr.number,
      login
    );

    if (!approved) {
      notApproved.push(pr);
    }
    if (!commented) {
      notCommented.push(pr);
    }
    if (approved) {
      approvedNotMerged.push(pr);
    }
  }

  return {
    notApproved,
    notCommented,
    approvedNotMerged,
    githubConfigured: Boolean(process.env.GITHUB_TOKEN?.trim()),
  };
}
