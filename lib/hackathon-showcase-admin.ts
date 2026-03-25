import { FieldValue } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";
import { getAdminDb } from "./firebase-admin";
import { findUserByGitHubLogin } from "./github";
import { logger } from "./logger";
import { getJudgeEmailSet, getJudgeUidSet } from "./hackathon-showcase";

/**
 * Server-only: set when a merged PR touches Hack-a-Sprint 2026 submission JSON paths.
 * Clients cannot set this field (see firestore.rules).
 */
export async function awardHackASprint2026ShowcaseBadge(
  githubLogin: string
): Promise<void> {
  const db = getAdminDb();
  if (!db) {
    logger.warn("awardHackASprint2026ShowcaseBadge: no admin db", {
      githubLogin,
    });
    return;
  }
  const userId = await findUserByGitHubLogin(githubLogin);
  if (!userId) {
    logger.warn("awardHackASprint2026ShowcaseBadge: no linked user", {
      githubLogin,
    });
    return;
  }
  await db
    .collection("users")
    .doc(userId)
    .set(
      {
        hackASprint2026ShowcaseBadge: true,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  logger.info("Awarded Hack-a-Sprint 2026 showcase badge", {
    githubLogin,
    userId,
  });
}

export async function userIsHackASprint2026Judge(
  db: Firestore,
  uid: string,
  tokenEmail?: string | null
): Promise<boolean> {
  if (getJudgeUidSet().has(uid)) return true;
  const allowed = getJudgeEmailSet();
  if (allowed.size === 0) return false;

  const candidates = new Set<string>();
  if (tokenEmail) {
    candidates.add(tokenEmail.trim().toLowerCase());
  }
  const snap = await db.collection("users").doc(uid).get();
  const d = snap.data();
  if (typeof d?.email === "string") {
    candidates.add(d.email.trim().toLowerCase());
  }
  for (const entry of d?.additionalEmails ?? []) {
    if (
      entry?.verified &&
      typeof entry?.email === "string"
    ) {
      candidates.add(entry.email.trim().toLowerCase());
    }
  }
  for (const c of candidates) {
    if (allowed.has(c)) return true;
  }
  return false;
}
