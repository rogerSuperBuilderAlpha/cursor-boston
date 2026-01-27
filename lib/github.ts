import { createHmac, timingSafeEqual } from "crypto";
import { collection, query, where, getDocs, doc, setDoc, getDoc, updateDoc, serverTimestamp, increment } from "firebase/firestore";
import { db } from "./firebase";
import { logger } from "./logger";

const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;
// This is used to filter webhook events to only process PRs from this repository
const REPOSITORY_OWNER = process.env.GITHUB_REPO_OWNER || "rogerSuperBuilderAlpha";
const REPOSITORY_NAME = process.env.GITHUB_REPO_NAME || "cursor-boston";

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
  if (!db) return null;

  try {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("github.login", "==", githubLogin));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      return snapshot.docs[0].id; // Return the user's UID
    }
    return null;
  } catch (error) {
    logger.error("Error finding user by GitHub login", { error });
    return null;
  }
}

/**
 * Check if repository matches our target repository
 */
export function isTargetRepository(
  owner: string,
  repo: string
): boolean {
  return owner === REPOSITORY_OWNER && repo === REPOSITORY_NAME;
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
  if (!db) {
    throw new Error("Firebase is not configured");
  }

  // Check if repository matches
  if (
    !isTargetRepository(
      prData.repository.owner.login,
      prData.repository.name
    )
  ) {
    logger.debug("Skipping PR from different repository", {
      owner: prData.repository.owner.login,
      repo: prData.repository.name,
    });
    return;
  }

  const authorLogin = prData.user.login;
  const userId = await findUserByGitHubLogin(authorLogin);

  // Only process PRs from users with connected GitHub accounts
  if (!userId) {
    logger.debug("Skipping PR from user without connected GitHub account", {
      prNumber: prData.number,
      authorLogin,
    });
    return;
  }

  const prId = `pr-${prData.number}`;
  const prRef = doc(db, "pullRequests", prId);

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
  const existingPr = await getDoc(prRef);
  const wasMerged = existingPr.exists() && existingPr.data()?.state === "merged";
  const isNowMerged = prState === "merged";

  // Update or create PR document
  await setDoc(
    prRef,
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
      lastProcessedAt: serverTimestamp(),
    },
    { merge: true }
  );

  // Update user's PR count
  if (isNowMerged && !wasMerged) {
    // PR was just merged - increment count
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
      pullRequestsCount: increment(1),
    });
  } else if (wasMerged && prState !== "merged") {
    // PR was merged but is no longer merged (shouldn't happen, but handle it)
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    const currentCount = userSnap.data()?.pullRequestsCount || 0;
    if (currentCount > 0) {
      await updateDoc(userRef, {
        pullRequestsCount: increment(-1),
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
