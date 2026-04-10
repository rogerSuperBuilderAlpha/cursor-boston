/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { createHmac, timingSafeEqual } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getGithubRepoPair } from "./github-recent-merged-prs";
import { getAdminDb } from "./firebase-admin";
import { logger } from "./logger";

const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;

/**
 * Verify GitHub webhook signature
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string | null
): boolean {
  if (!GITHUB_WEBHOOK_SECRET || !signature) {
    return false;
  }

  const hmac = createHmac("sha256", GITHUB_WEBHOOK_SECRET);
  const digest = "sha256=" + hmac.update(payload).digest("hex");

  return timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(digest)
  );
}

/**
 * Find Firebase user by GitHub login
 */
export async function findUserByGitHubLogin(
  githubLogin: string
): Promise<string | null> {
  const db = getAdminDb();
  if (!db) {
    logger.error("Firebase Admin is not configured for GitHub webhook processing");
    return null;
  }

  logger.info("Looking up user by GitHub login", { githubLogin });

  try {
    const snapshot = await db
      .collection("users")
      .where("github.login", "==", githubLogin)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      const userId = snapshot.docs[0].id;
      logger.info("Found user by GitHub login", { githubLogin, userId });
      return userId;
    }
    
    logger.warn("No user found with GitHub login", { githubLogin });
    return null;
  } catch (error) {
    logger.error("Error finding user by GitHub login", { error, githubLogin });
    return null;
  }
}

/**
 * Check if repository matches our target repository.
 * Uses the same owner/repo resolution as the rest of the app (env with defaults).
 */
export function isTargetRepository(owner: string, repo: string): boolean {
  const expected = getGithubRepoPair();
  return owner === expected.owner && repo === expected.repo;
}

/**
 * List changed file paths for a PR (GitHub REST). Returns [] on failure.
 */
export async function fetchPullRequestChangedFilenames(
  owner: string,
  repo: string,
  prNumber: number
): Promise<string[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files`;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return [];
    const files = (await res.json()) as { filename?: string }[];
    if (!Array.isArray(files)) return [];
    return files
      .map((f) => f.filename)
      .filter((f): f is string => typeof f === "string");
  } catch {
    return [];
  }
}

/**
 * Process and store pull request
 */
export async function processPullRequest(
  prData: {
    number: number;
    title: string;
    state: string;
    merged: boolean; // Boolean from GitHub payload indicating if PR was merged
    user: { login: string };
    html_url: string;
    created_at: string;
    updated_at: string;
    merged_at: string | null;
    repository: { owner: { login: string }; name: string };
  }
): Promise<void> {
  const db = getAdminDb();
  if (!db) {
    throw new Error("Firebase Admin is not configured");
  }

  // Check if repository matches
  if (
    !isTargetRepository(
      prData.repository.owner.login,
      prData.repository.name
    )
  ) {
    const expected = getGithubRepoPair();
    logger.warn("Skipping PR from different repository", {
      owner: prData.repository.owner.login,
      repo: prData.repository.name,
      expectedOwner: expected.owner,
      expectedRepo: expected.repo,
    });
    return;
  }

  const authorLogin = prData.user.login;
  const userId = await findUserByGitHubLogin(authorLogin);

  // Only process PRs from users with connected GitHub accounts
  if (!userId) {
    logger.warn("Skipping PR from user without connected GitHub account", {
      prNumber: prData.number,
      authorLogin,
      hint: "User needs to connect GitHub on their profile",
    });
    return;
  }

  logger.info("Processing PR for user", {
    prNumber: prData.number,
    authorLogin,
    userId,
    state: prData.state,
    merged: prData.merged,
  });

  const prId = `pr-${prData.number}`;
  const prRef = db.collection("pullRequests").doc(prId);

  // Determine PR state - use merged boolean from GitHub payload
  let prState: "open" | "closed" | "merged" = "open";
  if (prData.merged || prData.merged_at) {
    // PR is merged if merged boolean is true OR merged_at is set
    prState = "merged";
  } else if (prData.state === "closed") {
    prState = "closed";
  } else {
    prState = "open";
  }

  // Check if PR already exists
  const existingPr = await prRef.get();
  const wasMerged = existingPr.exists && existingPr.data()?.state === "merged";
  const isNowMerged = prState === "merged";

  // Update or create PR document
  await prRef.set(
    {
      prNumber: prData.number,
      title: prData.title,
      state: prState,
      authorLogin,
      userId,
      url: prData.html_url,
      repository: `${prData.repository.owner.login}/${prData.repository.name}`,
      createdAt: new Date(prData.created_at),
      updatedAt: new Date(prData.updated_at),
      mergedAt: prData.merged_at ? new Date(prData.merged_at) : null,
      isConnected: true,
      lastProcessedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  // Update user's PR count
  if (isNowMerged && !wasMerged) {
    // PR was just merged - increment count
    const userRef = db.collection("users").doc(userId);
    await userRef.update({
      pullRequestsCount: FieldValue.increment(1),
    });
  } else if (wasMerged && prState !== "merged") {
    // PR was merged but is no longer merged (shouldn't happen, but handle it)
    const userRef = db.collection("users").doc(userId);
    const userSnap = await userRef.get();
    const currentCount = userSnap.data()?.pullRequestsCount || 0;
    if (currentCount > 0) {
      await userRef.update({
        pullRequestsCount: FieldValue.increment(-1),
      });
    }
  }

  logger.info("Processed pull request", {
    prNumber: prData.number,
    authorLogin,
    userId,
    state: prState,
  });
}
