#!/usr/bin/env node
/**
 * Backfill Firestore `pullRequests` for contributors whose work landed without
 * merging their original GitHub PR (see docs/CONTRIBUTOR_MERGE_CREDIT_BACKFILL.md).
 *
 * Requires: FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS,
 * and GITHUB_TOKEN for --audit / GitHub API calls.
 *
 * Usage:
 *   npx tsx scripts/backfill-merge-credit.ts --audit
 *   npx tsx scripts/backfill-merge-credit.ts --dry-run
 *   npx tsx scripts/backfill-merge-credit.ts --apply
 *   npx tsx scripts/backfill-merge-credit.ts --apply --sync-badges
 *   npx tsx scripts/backfill-merge-credit.ts --apply --cases path/to/custom.cases.json
 */

import { readFileSync } from "fs";
import { join } from "path";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { FieldValue } from "firebase-admin/firestore";
import { syncUserBadgesForUser } from "../lib/badges/admin-badge-awards";
import { getAdminDb } from "../lib/firebase-admin";
import { getGithubRepoPair } from "../lib/github-recent-merged-prs";

const DEFAULT_CASES_PATH = join(process.cwd(), "scripts", "backfill-merge-credit.cases.json");

type Classification = "landedDirectly" | "landedViaIntegrationPr";

type BackfillCase = {
  classification: Classification;
  prNumber: number;
  authorLogin: string;
  integrationMergedPrNumber?: number;
  notes?: string;
};

type CasesFile = {
  cases: BackfillCase[];
};

type GitHubPull = {
  number: number;
  title: string;
  html_url: string;
  created_at: string;
  updated_at: string;
  merged_at: string | null;
  closed_at: string | null;
  state: string;
  user: { login: string } | null;
};

const BOT_LOGINS = new Set(["app/dependabot", "dependabot", "renovate", "github-actions"]);

function isLikelyBot(login: string | undefined): boolean {
  if (!login) return true;
  if (BOT_LOGINS.has(login)) return true;
  return login.endsWith("[bot]") || login.includes("dependabot");
}

async function githubFetchJson<T>(path: string): Promise<T> {
  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API ${path}: ${res.status} ${text}`);
  }
  return res.json() as Promise<T>;
}

async function fetchPull(
  owner: string,
  repo: string,
  prNumber: number
): Promise<GitHubPull> {
  return githubFetchJson<GitHubPull>(`/repos/${owner}/${repo}/pulls/${prNumber}`);
}

function parseArgs(argv: string[]) {
  const audit = argv.includes("--audit");
  const dryRun = argv.includes("--dry-run");
  const apply = argv.includes("--apply");
  const syncBadges = argv.includes("--sync-badges");
  const casesIdx = argv.indexOf("--cases");
  const casesPath =
    casesIdx >= 0 && argv[casesIdx + 1] ? argv[casesIdx + 1] : DEFAULT_CASES_PATH;
  if (!audit && !dryRun && !apply) {
    console.error(
      "Specify one of: --audit (list closed human PRs), --dry-run, or --apply"
    );
    process.exit(1);
  }
  if ((dryRun || apply) && audit) {
    console.error("Use --audit alone, or --dry-run/--apply without --audit");
    process.exit(1);
  }
  return { audit, dryRun, apply, syncBadges, casesPath };
}

function loadCases(path: string): BackfillCase[] {
  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw) as CasesFile;
  if (!Array.isArray(parsed.cases)) {
    throw new Error("cases file must have a 'cases' array");
  }
  return parsed.cases;
}

async function findUserIdByGithubLogin(githubLogin: string): Promise<string | null> {
  const db = getAdminDb();
  if (!db) return null;
  const snap = await db
    .collection("users")
    .where("github.login", "==", githubLogin)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return snap.docs[0]!.id;
}

async function reconcileMergedPrCountForUser(userId: string): Promise<number> {
  const db = getAdminDb();
  if (!db) throw new Error("No admin db");
  const { owner, repo } = getGithubRepoPair();
  const expectedRepo = `${owner}/${repo}`;
  const snap = await db
    .collection("pullRequests")
    .where("userId", "==", userId)
    .where("state", "==", "merged")
    .get();
  let n = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    const r = data.repository;
    if (typeof r === "string" && r.length > 0 && r !== expectedRepo) continue;
    n++;
  }
  await db.collection("users").doc(userId).set({ pullRequestsCount: n }, { merge: true });
  return n;
}

async function runAudit(owner: string, repo: string) {
  const closedHumanUnmerged: Array<{
    number: number;
    title: string;
    authorLogin: string;
    headRefName: string;
    closedAt: string | null;
  }> = [];

  for (let page = 1; page <= 20; page++) {
    const pulls = await githubFetchJson<
      Array<{
        number: number;
        title: string;
        user?: { login?: string } | null;
        merged_at: string | null;
        head: { ref: string };
        closed_at: string | null;
      }>
    >(`/repos/${owner}/${repo}/pulls?state=closed&per_page=100&page=${page}`);

    if (pulls.length === 0) break;

    for (const p of pulls) {
      const login = p.user?.login ?? "";
      if (p.merged_at) continue;
      if (isLikelyBot(login)) continue;
      closedHumanUnmerged.push({
        number: p.number,
        title: p.title,
        authorLogin: login,
        headRefName: p.head.ref,
        closedAt: p.closed_at,
      });
    }
  }

  closedHumanUnmerged.sort((a, b) => b.number - a.number);

  console.log(
    JSON.stringify(
      {
        repo: `${owner}/${repo}`,
        closedHumanUnmergedCount: closedHumanUnmerged.length,
        items: closedHumanUnmerged,
        hint: "Review each item; add real credit-loss cases to scripts/backfill-merge-credit.cases.json",
      },
      null,
      2
    )
  );
}

async function main() {
  const { audit, dryRun, apply, syncBadges, casesPath } = parseArgs(process.argv.slice(2));
  const { owner, repo } = getGithubRepoPair();

  if (audit) {
    await runAudit(owner, repo);
    return;
  }

  const cases = loadCases(casesPath);
  const db = getAdminDb();
  if (!db) {
    console.error("Firebase Admin not configured.");
    process.exit(1);
  }

  const affectedUserIds = new Set<string>();
  const ops: string[] = [];

  for (const c of cases) {
    const original = await fetchPull(owner, repo, c.prNumber);
    if (original.user?.login !== c.authorLogin) {
      console.warn(
        `Case pr #${c.prNumber}: authorLogin mismatch (expected ${c.authorLogin}, got ${original.user?.login}). Continuing with manifest author.`
      );
    }

    let mergedAtIso: string;
    if (c.classification === "landedViaIntegrationPr") {
      if (!c.integrationMergedPrNumber) {
        throw new Error(`Case pr #${c.prNumber}: integrationMergedPrNumber required`);
      }
      const integrated = await fetchPull(owner, repo, c.integrationMergedPrNumber);
      if (!integrated.merged_at) {
        throw new Error(
          `Integration PR #${c.integrationMergedPrNumber} is not merged on GitHub`
        );
      }
      mergedAtIso = integrated.merged_at;
    } else {
      const fallback = original.closed_at ?? original.updated_at;
      if (!fallback) {
        throw new Error(`PR #${c.prNumber}: no closed_at/updated_at for mergedAt fallback`);
      }
      mergedAtIso = fallback;
    }

    const userId = await findUserIdByGithubLogin(c.authorLogin);
    if (!userId) {
      ops.push(
        `SKIP pr-${c.prNumber}: no Firebase user with github.login=${c.authorLogin}`
      );
      continue;
    }

    affectedUserIds.add(userId);
    const prRef = db.collection("pullRequests").doc(`pr-${c.prNumber}`);
    const snapshot = await prRef.get();
    const prev = snapshot.data();
    const wasMerged = prev?.state === "merged";

    const payload = {
      prNumber: c.prNumber,
      title: original.title,
      state: "merged" as const,
      authorLogin: c.authorLogin,
      userId,
      url: original.html_url,
      repository: `${owner}/${repo}`,
      createdAt: new Date(original.created_at),
      updatedAt: new Date(original.updated_at),
      mergedAt: new Date(mergedAtIso),
      isConnected: true,
      lastProcessedAt: FieldValue.serverTimestamp(),
      backfillSource: "contributor-merge-credit-script",
      backfillClassification: c.classification,
      ...(c.integrationMergedPrNumber
        ? { backfillIntegrationPrNumber: c.integrationMergedPrNumber }
        : {}),
    };

    if (dryRun) {
      ops.push(
        `${wasMerged ? "UPDATE (already merged)" : "WRITE merged"} pullRequests/pr-${c.prNumber} userId=${userId} login=${c.authorLogin} mergedAt=${mergedAtIso}`
      );
      continue;
    }

    await prRef.set(payload, { merge: true });
    ops.push(
      `OK pullRequests/pr-${c.prNumber} -> merged for ${c.authorLogin} (${userId})`
    );
  }

  if (dryRun) {
    console.log("Dry run — no Firestore writes.\n");
    ops.forEach((l) => console.log(l));
    console.log("\nAffected userIds (for reconcile):", [...affectedUserIds]);
    return;
  }

  if (!apply) return;

  for (const line of ops) console.log(line);

  console.log("\nReconciling users.pullRequestsCount for affected users...");
  for (const uid of affectedUserIds) {
    const n = await reconcileMergedPrCountForUser(uid);
    console.log(`  ${uid}: pullRequestsCount = ${n}`);
  }

  if (syncBadges) {
    console.log("\nSyncing badges (migration source) for affected users...");
    for (const uid of affectedUserIds) {
      const r = await syncUserBadgesForUser(uid, {
        awardedBy: "scripts/backfill-merge-credit.ts",
      });
      console.log(
        `  ${uid}: eligible=${r.eligibleBadgeIds.join(",") || "none"} newlyAwarded=${r.newlyAwardedBadgeIds.join(",") || "none"}`
      );
    }
  } else {
    console.log(
      "\nTip: rerun with --sync-badges to award eligible badges, or users can POST /api/badges/awards."
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
