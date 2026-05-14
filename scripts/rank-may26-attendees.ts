#!/usr/bin/env node
/**
 * One-list ranking for the May 26 (sports-hack-2026) event.
 *
 * Sort key, in order:
 *   1. Cohort-1 applicant (status in {pending, admitted}) — yes before no
 *   2. Merged-PR count, descending
 *   3. Website signup before Luma-only (rewards people who took the extra step)
 *   4. Earliest signup wins
 *
 * Sources:
 *   - hackathonLumaRegistrants — Luma RSVPs (post sync-may26 seed)
 *   - hackathonEventSignups    — website signups for the event
 *   - users                    — display name + GitHub login for website signups
 *   - summerCohortApplications — cohort-1 lookup (by email, lowercased)
 *   - GitHub merged PRs        — pulled via fetchMergedPrCountsForLogins
 *
 * Usage:
 *   npx tsx scripts/rank-may26-attendees.ts
 *   npx tsx scripts/rank-may26-attendees.ts --top 80
 *   npx tsx scripts/rank-may26-attendees.ts --csv out.csv
 */
import { writeFileSync } from "fs";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { getAdminDb } from "../lib/firebase-admin";
import { fetchMergedPrCountsForLogins } from "../lib/github-merged-pr-count";
import { getGithubRepoPair } from "../lib/github-recent-merged-prs";
import {
  getDeclinedEmailsForEvent,
  getJudgeEmailsForEvent,
} from "../lib/hackathon-event-signup";
import {
  SUMMER_COHORT_COLLECTION,
  SUMMER_COHORT_IMMERSION,
} from "../lib/summer-cohort";
import { SPORTS_HACK_2026_CAPACITY } from "../lib/sports-hack-2026";

const EVENT_ID = SUMMER_COHORT_IMMERSION.eventId;

/** Inlined version of the bulk merged-PR search — the lib version sits behind
 *  next/cache `unstable_cache`, which throws when called outside a request.
 *  Same query and pagination as `fetchMergedPrCountByAuthorForRepoUncached`
 *  in `lib/github-merged-pr-count.ts`. */
async function fetchBulkMergedPrCounts(): Promise<Map<string, number> | null> {
  const { owner, repo } = getGithubRepoPair();
  const q = `repo:${owner}/${repo} type:pr is:merged`;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;

  const counts = new Map<string, number>();
  const PER_PAGE = 100;
  const MAX_PAGES = 10;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = new URL("https://api.github.com/search/issues");
    url.searchParams.set("q", q);
    url.searchParams.set("per_page", String(PER_PAGE));
    url.searchParams.set("page", String(page));
    const res = await fetch(url.toString(), { headers });
    if (!res.ok) {
      console.warn(
        `GitHub search failed at page ${page}: ${res.status} ${res.statusText}`
      );
      return page === 1 ? null : counts;
    }
    const data = (await res.json()) as {
      items?: Array<{ user?: { login?: string } }>;
    };
    const items = data.items ?? [];
    if (items.length === 0) break;
    for (const item of items) {
      const login = item.user?.login;
      if (!login) continue;
      counts.set(
        login.toLowerCase(),
        (counts.get(login.toLowerCase()) ?? 0) + 1
      );
    }
    if (items.length < PER_PAGE) break;
  }
  return counts;
}

interface RankedRow {
  source: "website" | "luma";
  email: string | null;
  displayName: string | null;
  githubLogin: string | null;
  isCohort1: boolean;
  cohort1Status: string | null;
  mergedPrCount: number;
  signedUpAtMs: number;
  signedUpAtIso: string;
}

function parseArgs(argv: string[]) {
  const topIdx = argv.indexOf("--top");
  const top = topIdx >= 0 ? Number(argv[topIdx + 1]) : null;
  const csvIdx = argv.indexOf("--csv");
  const csvPath = csvIdx >= 0 ? argv[csvIdx + 1] : null;
  return { top: top && top > 0 ? top : null, csvPath };
}

async function main() {
  const { top, csvPath } = parseArgs(process.argv.slice(2));
  const db = getAdminDb();
  if (!db) {
    console.error("Firebase Admin not configured.");
    process.exit(1);
  }

  // 1. Cohort-1 applicant emails (pending + admitted only).
  const appsSnap = await db.collection(SUMMER_COHORT_COLLECTION).get();
  const cohort1ByEmail = new Map<string, string>();
  for (const doc of appsSnap.docs) {
    const d = doc.data();
    const cohorts = Array.isArray(d.cohorts) ? d.cohorts : [];
    if (!cohorts.includes("cohort-1")) continue;
    const status = typeof d.status === "string" ? d.status : "pending";
    if (status !== "pending" && status !== "admitted") continue;
    const email = (d.email || "").toString().trim().toLowerCase();
    if (email) cohort1ByEmail.set(email, status);
  }
  console.log(
    `Cohort-1 applicants (pending+admitted): ${cohort1ByEmail.size}`
  );

  // 2. Website signups (hackathonEventSignups → users).
  const websiteSnap = await db
    .collection("hackathonEventSignups")
    .where("eventId", "==", EVENT_ID)
    .get();
  const websiteUserIds = websiteSnap.docs
    .map((d) => d.data().userId as string | undefined)
    .filter((u): u is string => Boolean(u));

  const userMap = new Map<string, FirebaseFirestore.DocumentData>();
  for (let i = 0; i < websiteUserIds.length; i += 10) {
    const chunk = websiteUserIds.slice(i, i + 10);
    const refs = chunk.map((id) => db.collection("users").doc(id));
    const snaps = await db.getAll(...refs);
    for (const s of snaps) {
      if (s.exists) userMap.set(s.id, s.data() ?? {});
    }
  }

  // 3. Luma registrants (post sync-may26 seed).
  const lumaSnap = await db
    .collection("hackathonLumaRegistrants")
    .where("eventId", "==", EVENT_ID)
    .get();

  const judgeEmails = getJudgeEmailsForEvent(EVENT_ID);
  const declinedEmails = getDeclinedEmailsForEvent(EVENT_ID);

  // Build website rows (deduped by user id; track their email + github so we
  // can deduplicate against luma rows).
  const rows: RankedRow[] = [];
  const websiteEmails = new Set<string>();
  const websiteGithubLogins = new Set<string>();

  for (const doc of websiteSnap.docs) {
    const data = doc.data();
    const userId = data.userId as string | undefined;
    if (!userId) continue;
    const profile = userMap.get(userId) ?? {};
    const email =
      typeof profile.email === "string"
        ? profile.email.trim().toLowerCase()
        : null;
    if (email && (judgeEmails.has(email) || declinedEmails.has(email))) {
      continue;
    }
    const ghLogin =
      profile.github && typeof profile.github === "object"
        ? (profile.github as { login?: string }).login ?? null
        : null;
    if (email) websiteEmails.add(email);
    if (ghLogin) websiteGithubLogins.add(ghLogin.toLowerCase());

    const signedUpAt = data.signedUpAt;
    let signedUpMs = 0;
    if (
      signedUpAt &&
      typeof signedUpAt === "object" &&
      "toMillis" in signedUpAt &&
      typeof (signedUpAt as { toMillis: () => number }).toMillis === "function"
    ) {
      signedUpMs = (signedUpAt as { toMillis: () => number }).toMillis();
    }

    rows.push({
      source: "website",
      email,
      displayName:
        typeof profile.displayName === "string" ? profile.displayName : null,
      githubLogin: ghLogin,
      isCohort1: email ? cohort1ByEmail.has(email) : false,
      cohort1Status: email ? cohort1ByEmail.get(email) ?? null : null,
      mergedPrCount: 0, // filled in below
      signedUpAtMs: signedUpMs,
      signedUpAtIso: new Date(signedUpMs).toISOString(),
    });
  }

  // Build luma-only rows (skip ones already covered by a website row).
  for (const doc of lumaSnap.docs) {
    const d = doc.data();
    const email = (d.email as string | undefined)?.trim().toLowerCase() ?? null;
    if (email && (judgeEmails.has(email) || declinedEmails.has(email))) {
      continue;
    }
    const ghLogin =
      typeof d.githubLogin === "string" ? d.githubLogin : null;
    if (email && websiteEmails.has(email)) continue;
    if (ghLogin && websiteGithubLogins.has(ghLogin.toLowerCase())) continue;

    const lumaCreatedAt =
      typeof d.lumaCreatedAt === "string" ? d.lumaCreatedAt : "";
    const signedUpMs = lumaCreatedAt ? new Date(lumaCreatedAt).getTime() : 0;

    rows.push({
      source: "luma",
      email,
      displayName: typeof d.name === "string" ? d.name : null,
      githubLogin: ghLogin,
      isCohort1: email ? cohort1ByEmail.has(email) : false,
      cohort1Status: email ? cohort1ByEmail.get(email) ?? null : null,
      mergedPrCount: 0, // filled in below
      signedUpAtMs: signedUpMs,
      signedUpAtIso: lumaCreatedAt,
    });
  }

  // 4. Fetch merged-PR counts in one batch keyed by GitHub login.
  const allLogins = rows
    .map((r) => r.githubLogin)
    .filter((l): l is string => Boolean(l));
  const bulk = await fetchBulkMergedPrCounts();
  const prCounts = await fetchMergedPrCountsForLogins(allLogins, bulk);
  for (const r of rows) {
    if (r.githubLogin) {
      const c = prCounts.get(r.githubLogin.toLowerCase());
      if (typeof c === "number") r.mergedPrCount = c;
    }
  }

  // 5. Sort: cohort-1 first → merges desc → website-before-luma → earliest signup.
  rows.sort((a, b) => {
    if (a.isCohort1 !== b.isCohort1) return a.isCohort1 ? -1 : 1;
    if (b.mergedPrCount !== a.mergedPrCount) {
      return b.mergedPrCount - a.mergedPrCount;
    }
    const aWeb = a.source === "website" ? 1 : 0;
    const bWeb = b.source === "website" ? 1 : 0;
    if (bWeb !== aWeb) return bWeb - aWeb;
    return a.signedUpAtMs - b.signedUpAtMs;
  });

  const cap = SPORTS_HACK_2026_CAPACITY;
  const cohort1Total = rows.filter((r) => r.isCohort1).length;
  const websiteTotal = rows.filter((r) => r.source === "website").length;

  console.log(
    `\nTotal attendees: ${rows.length} (cohort-1: ${cohort1Total}, website: ${websiteTotal}, luma-only: ${rows.length - websiteTotal})`
  );
  console.log(`Confirmed cap: ${cap} → first ${cap} are confirmed seats.\n`);

  const limit = top ?? rows.length;
  const printable = rows.slice(0, limit);

  const padRank = String(limit).length;
  const padPr = Math.max(
    2,
    String(Math.max(0, ...printable.map((r) => r.mergedPrCount))).length
  );

  // Header
  console.log(
    "rank".padStart(padRank) +
      "  cohort  prs  src    name / github                       email"
  );
  console.log("-".repeat(120));
  for (let i = 0; i < printable.length; i++) {
    const r = printable[i]!;
    const rank = String(i + 1).padStart(padRank);
    const cohort = r.isCohort1 ? `c1` : `  `;
    const prs = String(r.mergedPrCount).padStart(padPr);
    const src = r.source === "website" ? "web " : "luma";
    const cap80Marker = i === cap - 1 ? "  ←— cap" : "";
    const name = (r.displayName || "(no name)").slice(0, 26).padEnd(26);
    const gh = r.githubLogin ? `@${r.githubLogin}`.slice(0, 22).padEnd(22) : " ".repeat(22);
    const email = r.email ?? "";
    console.log(
      `${rank}  ${cohort}      ${prs}  ${src}   ${name}  ${gh}  ${email}${cap80Marker}`
    );
    if (i === cap - 1 && i < printable.length - 1) {
      console.log("-".repeat(120) + " (waitlist below)");
    }
  }

  if (csvPath) {
    const header =
      "rank,confirmed,cohort1,cohort1_status,mergedPrCount,source,displayName,githubLogin,email,signedUpAt\n";
    const lines = rows.map((r, i) => {
      const rank = i + 1;
      const confirmed = rank <= cap ? "yes" : "waitlist";
      return [
        rank,
        confirmed,
        r.isCohort1 ? "yes" : "no",
        r.cohort1Status ?? "",
        r.mergedPrCount,
        r.source,
        (r.displayName ?? "").replace(/[\n,"]/g, " "),
        r.githubLogin ?? "",
        r.email ?? "",
        r.signedUpAtIso,
      ].join(",");
    });
    writeFileSync(csvPath, header + lines.join("\n") + "\n", "utf8");
    console.log(`\nCSV written: ${csvPath}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
