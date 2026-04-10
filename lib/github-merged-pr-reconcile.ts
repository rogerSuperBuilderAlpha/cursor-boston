/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { getGithubRepoPair } from "@/lib/github-recent-merged-prs";
import { logger } from "@/lib/logger";

type SearchMergedPrItem = {
  number: number;
  title: string;
  html_url: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  user?: { login?: string } | null;
};

const SEARCH_PER_PAGE = 100;
const SEARCH_MAX_PAGES = 10;
const BATCH_WRITE_LIMIT = 400;

function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export async function fetchMergedPullRequestsForAuthor(
  githubLogin: string
): Promise<SearchMergedPrItem[]> {
  const login = githubLogin.trim();
  if (!login) return [];

  const { owner, repo } = getGithubRepoPair();
  const query = `repo:${owner}/${repo} type:pr is:merged author:${login}`;
  const headers = githubHeaders();
  const items: SearchMergedPrItem[] = [];

  for (let page = 1; page <= SEARCH_MAX_PAGES; page += 1) {
    const url = new URL("https://api.github.com/search/issues");
    url.searchParams.set("q", query);
    url.searchParams.set("per_page", String(SEARCH_PER_PAGE));
    url.searchParams.set("page", String(page));

    const response = await fetch(url.toString(), {
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `GitHub merged PR search failed for ${login}: ${response.status} ${body}`
      );
    }

    const data = (await response.json()) as { items?: SearchMergedPrItem[] };
    const pageItems = Array.isArray(data.items) ? data.items : [];
    if (pageItems.length === 0) break;

    items.push(...pageItems);

    if (pageItems.length < SEARCH_PER_PAGE) break;
  }

  return items;
}

async function countMergedRepoPullRequestsForUser(userId: string): Promise<number> {
  const db = getAdminDb();
  if (!db) {
    throw new Error("Firebase Admin is not configured");
  }

  const { owner, repo } = getGithubRepoPair();
  const expectedRepo = `${owner}/${repo}`;
  const snapshot = await db
    .collection("pullRequests")
    .where("userId", "==", userId)
    .where("state", "==", "merged")
    .get();

  let count = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const repository = data.repository;
    if (
      typeof repository === "string" &&
      repository.length > 0 &&
      repository !== expectedRepo
    ) {
      continue;
    }
    count += 1;
  }

  return count;
}

export async function reconcileMergedPrCreditForUser(
  userId: string,
  githubLogin: string
): Promise<{ mergedPrCount: number; syncedPrCount: number }> {
  const db = getAdminDb();
  if (!db) {
    throw new Error("Firebase Admin is not configured");
  }

  const login = githubLogin.trim();
  if (!login) {
    throw new Error("GitHub login is required");
  }

  const { owner, repo } = getGithubRepoPair();
  const repository = `${owner}/${repo}`;
  const mergedPrs = await fetchMergedPullRequestsForAuthor(login);

  let batch = db.batch();
  let writes = 0;

  const flush = async () => {
    if (writes === 0) return;
    await batch.commit();
    batch = db.batch();
    writes = 0;
  };

  for (const pr of mergedPrs) {
    batch.set(
      db.collection("pullRequests").doc(`pr-${pr.number}`),
      {
        prNumber: pr.number,
        title: pr.title,
        state: "merged",
        authorLogin: pr.user?.login ?? login,
        userId,
        url: pr.html_url,
        repository,
        createdAt: new Date(pr.created_at),
        updatedAt: new Date(pr.updated_at),
        mergedAt: pr.closed_at ? new Date(pr.closed_at) : null,
        isConnected: true,
        lastProcessedAt: FieldValue.serverTimestamp(),
        backfillSource: "github-connect-reconcile",
      },
      { merge: true }
    );
    writes += 1;

    if (writes >= BATCH_WRITE_LIMIT) {
      await flush();
    }
  }

  await flush();

  const mergedPrCount = await countMergedRepoPullRequestsForUser(userId);
  await db.collection("users").doc(userId).set(
    {
      pullRequestsCount: mergedPrCount,
      github: {
        login,
      },
    },
    { merge: true }
  );

  logger.info("Reconciled merged PR credit for user", {
    userId,
    githubLogin: login,
    syncedPrCount: mergedPrs.length,
    mergedPrCount,
  });

  return {
    mergedPrCount,
    syncedPrCount: mergedPrs.length,
  };
}
