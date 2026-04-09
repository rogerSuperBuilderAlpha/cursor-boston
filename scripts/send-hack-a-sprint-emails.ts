#!/usr/bin/env node
/**
 * Hack-a-Sprint 2026 — personalized emails for Luma CSV registrants.
 *
 * Cross-references Firestore (users, hackathonEventSignups, pullRequests) + GitHub
 * and sends tiered Mailgun messages.
 *
 * Usage:
 *   npx tsx scripts/send-hack-a-sprint-emails.ts --dry-run [--csv path/to/export.csv]
 *   npx tsx scripts/send-hack-a-sprint-emails.ts --send [--csv path/to/export.csv]
 *
 * Requires: FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS;
 * Use the same **GITHUB_TOKEN** as production (e.g. from `.env.local`). PR counts use
 * one paginated GitHub Search over all merged PRs in the repo, then per-person lookups.
 *
 * For --send: MAILGUN_API_KEY, MAILGUN_DOMAIN, optional MAILGUN_FROM, MAILGUN_EU=true
 */
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import type { DocumentData, Firestore } from "firebase-admin/firestore";
import {
  CURSOR_CREDIT_TOP_N,
  getHackathonEventSignupBlockReason,
} from "../lib/hackathon-event-signup";
import { HACK_A_SPRINT_2026_EVENT_ID } from "../lib/hackathon-showcase";
import {
  fetchMergedPrCountByAuthorForRepo,
  fetchMergedPrCountsForLogins,
} from "../lib/github-merged-pr-count";
import { getGithubRepoPair, getGithubRepoWebBaseUrl } from "../lib/github-recent-merged-prs";
import { getAdminAuth, getAdminDb } from "../lib/firebase-admin";
import { sendEmail } from "../lib/mailgun";

const SITE_ORIGIN = process.env.NEXT_PUBLIC_APP_URL || "https://cursorboston.com";
const SIGNUP_PATH = "/hackathons/hack-a-sprint-2026/signup";
const INSTRUCTIONS_PATH = "/hackathons/hack-a-sprint-2026/instructions";
const LUMA_URL = "https://luma.com/uixo8hl6";

const GITHUB_COL_KEY = "What is your GitHub username?";
const PR_COL_KEY =
  "Have you contributed to the repo?  If yes, last PR to https://github.com/rogerSuperBuilderAlpha/cursor-boston";

const USER_ID_IN_CHUNK = 10;

const INVALID_LOGIN_TOKENS = new Set([
  "",
  "n",
  "no",
  "none",
  "na",
  "n/a",
  "-",
  ".",
  "unknown",
]);

type RegistrantTier =
  | "DECLINED"
  | "CONFIRMED"
  | "WAITLISTED"
  | "SIGNED_UP_NO_SPOT"
  | "NO_SITE_ACCOUNT";

type CsvRow = Record<string, string>;

function parseCsv(content: string): CsvRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const c = content[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\r") {
      /* ignore */
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  row.push(field);
  if (row.some((cell) => cell.length > 0)) {
    rows.push(row);
  }

  if (rows.length < 2) return [];

  const header = rows[0]!.map((h) => h.trim());
  const out: CsvRow[] = [];
  for (let r = 1; r < rows.length; r++) {
    const line = rows[r]!;
    const obj: CsvRow = {};
    for (let j = 0; j < header.length; j++) {
      obj[header[j]!] = (line[j] ?? "").trim();
    }
    out.push(obj);
  }
  return out;
}

/** Extract GitHub login from URL or bare login; returns null if unusable. */
function parseGithubLogin(raw: string | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  let s = raw.trim();
  if (!s) return null;
  const lower = s.toLowerCase();
  if (lower.startsWith("http://") || lower.startsWith("https://")) {
    try {
      const u = new URL(s.startsWith("http") ? s : `https://${s}`);
      if (!u.hostname.includes("github.com")) return null;
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts.length === 0) return null;
      s = parts[0]!;
    } catch {
      return null;
    }
  } else if (lower.includes("github.com")) {
    const idx = lower.indexOf("github.com");
    const rest = s.slice(idx + "github.com".length).replace(/^[/:]+/, "");
    const parts = rest.split("/").filter(Boolean);
    if (parts.length === 0) return null;
    s = parts[0]!;
  }
  s = s.replace(/^@+/, "");
  if (INVALID_LOGIN_TOKENS.has(s.toLowerCase()) || s.length < 2) return null;
  return s;
}

function signedUpAtToMs(value: unknown): number {
  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof (value as { toMillis: () => number }).toMillis === "function"
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (value instanceof Date) return value.getTime();
  return 0;
}

async function fetchUserDataMap(
  db: Firestore,
  userIds: string[]
): Promise<Map<string, DocumentData>> {
  const map = new Map<string, DocumentData>();
  const unique = [...new Set(userIds)];
  for (let i = 0; i < unique.length; i += 10) {
    const chunk = unique.slice(i, i + 10);
    const refs = chunk.map((id) => db.collection("users").doc(id));
    const snaps = await db.getAll(...refs);
    snaps.forEach((s) => {
      if (s.exists) {
        map.set(s.id, s.data() ?? {});
      }
    });
  }
  return map;
}

async function countMergedCommunityPrsByUserIds(
  db: Firestore,
  userIds: string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const unique = [...new Set(userIds.filter(Boolean))];
  for (const id of unique) counts.set(id, 0);
  if (unique.length === 0) return counts;

  const { owner, repo } = getGithubRepoPair();
  const expectedRepo = `${owner}/${repo}`;

  for (let i = 0; i < unique.length; i += USER_ID_IN_CHUNK) {
    const chunk = unique.slice(i, i + USER_ID_IN_CHUNK);
    const snap = await db
      .collection("pullRequests")
      .where("userId", "in", chunk)
      .where("state", "==", "merged")
      .get();

    for (const doc of snap.docs) {
      const data = doc.data();
      const uid = data.userId as string | undefined;
      if (!uid) continue;
      const repoField = data.repository;
      if (
        typeof repoField === "string" &&
        repoField.length > 0 &&
        repoField !== expectedRepo
      ) {
        continue;
      }
      counts.set(uid, (counts.get(uid) ?? 0) + 1);
    }
  }

  return counts;
}

type LeaderboardEntry = {
  rank: number;
  userId: string;
  displayName: string | null;
  githubLogin: string | null;
  mergedPrCount: number;
  signedUpAtMs: number;
};

function mergedPrForLogin(
  login: string | null | undefined,
  bulk: Map<string, number> | null
): number {
  if (!login?.trim() || !bulk) return 0;
  return bulk.get(login.trim().toLowerCase()) ?? 0;
}

async function buildLeaderboard(
  db: Firestore,
  githubBulk: Map<string, number> | null
): Promise<{
  entries: LeaderboardEntry[];
  rankByUserId: Map<string, number>;
  prByUserId: Map<string, number>;
  totalOnLeaderboard: number;
}> {
  const snap = await db
    .collection("hackathonEventSignups")
    .where("eventId", "==", HACK_A_SPRINT_2026_EVENT_ID)
    .get();

  const rows: Omit<LeaderboardEntry, "rank">[] = [];

  const userIds = snap.docs.map((d) => d.data().userId as string).filter(Boolean);
  const userMap = await fetchUserDataMap(db, userIds);
  const firestoreMergedCounts = await countMergedCommunityPrsByUserIds(db, userIds);

  const githubLogins: string[] = [];
  for (const uid of userIds) {
    const profile = userMap.get(uid);
    const login =
      profile?.github && typeof profile.github === "object"
        ? (profile.github as { login?: string }).login
        : undefined;
    if (typeof login === "string" && login.trim()) githubLogins.push(login.trim());
  }
  const githubMergedByLogin = await fetchMergedPrCountsForLogins(
    githubLogins,
    githubBulk
  );

  for (const doc of snap.docs) {
    const data = doc.data();
    const userId = data.userId as string;
    if (!userId) continue;
    const profile = userMap.get(userId);
    const gh =
      profile?.github && typeof profile.github === "object"
        ? (profile.github as { login?: string }).login
        : undefined;
    const githubLogin = typeof gh === "string" ? gh : null;
    let pr = firestoreMergedCounts.get(userId) ?? 0;
    if (githubLogin) {
      const fromApi = githubMergedByLogin.get(githubLogin.toLowerCase());
      if (fromApi !== undefined) pr = fromApi;
    }
    rows.push({
      userId,
      displayName:
        typeof profile?.displayName === "string" ? profile.displayName : null,
      githubLogin,
      mergedPrCount: pr,
      signedUpAtMs: signedUpAtToMs(data.signedUpAt),
    });
  }

  rows.sort((a, b) => {
    if (b.mergedPrCount !== a.mergedPrCount) {
      return b.mergedPrCount - a.mergedPrCount;
    }
    return a.signedUpAtMs - b.signedUpAtMs;
  });

  const rankByUserId = new Map<string, number>();
  const prByUserId = new Map<string, number>();
  const entries: LeaderboardEntry[] = rows.map((r, i) => {
    const rank = i + 1;
    rankByUserId.set(r.userId, rank);
    prByUserId.set(r.userId, r.mergedPrCount);
    return { ...r, rank };
  });

  return {
    entries,
    rankByUserId,
    prByUserId,
    totalOnLeaderboard: entries.length,
  };
}

type MatchMethod = "auth" | "emailLookup" | "firestoreEmail" | "githubLogin" | null;

async function resolveUserIdForEmail(
  db: Firestore,
  normalizedEmail: string
): Promise<{ uid: string | null; method: MatchMethod }> {
  const auth = getAdminAuth();
  if (auth) {
    try {
      const u = await auth.getUserByEmail(normalizedEmail);
      return { uid: u.uid, method: "auth" };
    } catch {
      /* continue */
    }
  }

  const lookup = await db.collection("emailLookup").doc(normalizedEmail).get();
  if (lookup.exists) {
    const uid = lookup.data()?.uid as string | undefined;
    if (uid) return { uid, method: "emailLookup" };
  }

  const byEmail = await db.collection("users").where("email", "==", normalizedEmail).limit(3).get();
  if (!byEmail.empty) {
    if (byEmail.docs.length > 1) {
      console.warn(
        `[warn] Multiple Firestore users for email ${normalizedEmail}; using first doc ${byEmail.docs[0]!.id}`
      );
    }
    return { uid: byEmail.docs[0]!.id, method: "firestoreEmail" };
  }

  return { uid: null, method: null };
}

async function resolveUserIdByGithubLogin(
  db: Firestore,
  login: string
): Promise<string | null> {
  const snap = await db
    .collection("users")
    .where("github.login", "==", login)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return snap.docs[0]!.id;
}

async function resolveUserIdForRow(
  db: Firestore,
  normalizedEmail: string,
  csvGithubLogin: string | null
): Promise<{ uid: string | null; method: MatchMethod }> {
  const primary = await resolveUserIdForEmail(db, normalizedEmail);
  if (primary.uid) return primary;

  if (csvGithubLogin) {
    const uid = await resolveUserIdByGithubLogin(db, csvGithubLogin);
    if (uid) return { uid, method: "githubLogin" };
    const uidLower = await resolveUserIdByGithubLogin(
      db,
      csvGithubLogin.toLowerCase()
    );
    if (uidLower) return { uid: uidLower, method: "githubLogin" };
  }

  return { uid: null, method: null };
}

function displayNameFromRow(row: CsvRow): string {
  const fn = row.first_name?.trim();
  const ln = row.last_name?.trim();
  if (fn || ln) return [fn, ln].filter(Boolean).join(" ").trim();
  const name = row.name?.trim();
  if (name) return name;
  return "there";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function emailShell(bodyHtml: string): string {
  return `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.5;color:#111;max-width:640px;">
${bodyHtml}
<p style="margin-top:24px;font-size:13px;color:#555;">Questions? Reply or write roger@cursorboston.com</p>
</body></html>`;
}

function commonEventBlockHtml(): string {
  const repoUrl = getGithubRepoWebBaseUrl();
  return `<p><strong>Cursor Boston Hack-a-Sprint</strong><br/>
Monday, April 13, 2026 · 4:00 PM – 8:00 PM ET<br/>
Back Bay, Boston, MA — exact address is on Luma after approval</p>
<ul>
<li>$50 Cursor credits for every selected participant</li>
<li>$1,200 prize pool (six $200 spots)</li>
<li>Food and drinks</li>
</ul>
<p>Links: <a href="${escapeHtml(LUMA_URL)}">Luma event</a> · <a href="${escapeHtml(SITE_ORIGIN)}">cursorboston.com</a> · <a href="${escapeHtml(repoUrl)}">Community repo</a></p>`;
}

function buildEmails(args: {
  tier: Exclude<RegistrantTier, "DECLINED">;
  name: string;
  rank: number | null;
  totalOnLeaderboard: number;
  mergedPrCount: number;
  profileBlockReason: string | null;
  csvSelfReportedPr: string;
}): { subject: string; html: string; text: string } {
  const {
    tier,
    name,
    rank,
    totalOnLeaderboard,
    mergedPrCount,
    profileBlockReason,
    csvSelfReportedPr,
  } = args;
  const first = escapeHtml(name);
  const signupUrl = `${SITE_ORIGIN.replace(/\/$/, "")}${SIGNUP_PATH}`;
  const instructionsUrl = `${SITE_ORIGIN.replace(/\/$/, "")}${INSTRUCTIONS_PATH}`;
  const repoUrl = getGithubRepoWebBaseUrl();

  let subject: string;
  let lead: string;

  if (tier === "CONFIRMED") {
    subject = "Hack-a-Sprint: You're on the leaderboard — details for April 13";
    lead = `<p>Hi ${first},</p>
<p>Great news: you’re <strong>#${rank}</strong> on the Hack-a-Sprint website leaderboard out of <strong>${totalOnLeaderboard}</strong> builders, with <strong>${mergedPrCount}</strong> merged PR${mergedPrCount === 1 ? "" : "s"} to our community repo. With only <strong>${CURSOR_CREDIT_TOP_N}</strong> in-person spots, you’re in strong shape — keep an eye on your email for any final selection notes from Luma.</p>
<p><strong>Please plan to arrive before 4:00 PM</strong> so you can check in and get set up before the sprint starts at 4:30 PM.</p>
<p>Bring your laptop, charger, and something you want to build.</p>`;
  } else if (tier === "WAITLISTED") {
    subject = "Hack-a-Sprint: Your leaderboard position & how to move up";
    lead = `<p>Hi ${first},</p>
<p>You’re on the website leaderboard at <strong>#${rank}</strong> of <strong>${totalOnLeaderboard}</strong>, with <strong>${mergedPrCount}</strong> merged PR${mergedPrCount === 1 ? "" : "s"}. We only have <strong>${CURSOR_CREDIT_TOP_N}</strong> spots for the in-person event, so you’re currently outside the top tier — but <strong>people drop out</strong>, and <strong>merged PRs are the fastest way to move up</strong>.</p>
<p>Open a PR to <a href="${escapeHtml(repoUrl)}">${escapeHtml(repoUrl)}</a> (documentation, fixes, small features all count). Priority on the site is: merged PRs → completed profile → Discord → signup order.</p>`;
  } else if (tier === "SIGNED_UP_NO_SPOT") {
    subject = "Hack-a-Sprint: Claim your spot on cursorboston.com";
    const block =
      profileBlockReason ?
        `<p><strong>Before you can claim your spot:</strong> ${escapeHtml(profileBlockReason)}</p>`
      : "";
    lead = `<p>Hi ${first},</p>
<p>We found your <strong>cursorboston.com</strong> account, but you haven’t joined the Hack-a-Sprint signup list yet. Luma registration is one step — the <strong>website leaderboard</strong> is what we use for ordering and credits.</p>
${block}
<p><strong>Next step:</strong> go to <a href="${escapeHtml(signupUrl)}">${escapeHtml(signupUrl)}</a> and click to join the list. Optional detail steps: <a href="${escapeHtml(instructionsUrl)}">${escapeHtml(instructionsUrl)}</a></p>
<p>Your merged PR count in our repo (verified): <strong>${mergedPrCount}</strong>. (We don’t rely on the free-text field from Luma for this.)</p>`;
  } else {
    subject = "Hack-a-Sprint: Finish your cursorboston.com registration";
    lead = `<p>Hi ${first},</p>
<p>You registered on <strong>Luma</strong>, but we don’t yet see a matching <strong>cursorboston.com</strong> account tied to this email. <strong>Luma approval alone doesn’t reserve a website leaderboard spot.</strong> We have <strong>50</strong> in-person spots; ordering favors merged PRs and a completed community profile.</p>
<p><strong>Please do this as soon as you can:</strong></p>
<ol>
<li>Create an account at <a href="${escapeHtml(SITE_ORIGIN)}">cursorboston.com</a> (use this same email if possible).</li>
<li>Connect <strong>GitHub</strong> on your profile.</li>
<li>Connect <strong>Discord</strong> and enable “Show Discord” on your public profile.</li>
<li>Set your profile to <strong>public</strong>.</li>
<li>Open <a href="${escapeHtml(signupUrl)}">${escapeHtml(signupUrl)}</a> and <strong>claim your spot</strong> on the leaderboard.</li>
<li>(Highly recommended) Submit a merged PR to <a href="${escapeHtml(repoUrl)}">${escapeHtml(repoUrl)}</a> to improve your priority.</li>
</ol>
<p>Full checklist: <a href="${escapeHtml(instructionsUrl)}">${escapeHtml(instructionsUrl)}</a></p>
<p>Verified merged PRs for the GitHub username we could infer from your Luma answers: <strong>${mergedPrCount}</strong>.</p>`;
  }

  const selfNote =
    csvSelfReportedPr ?
      `<p style="font-size:13px;color:#666;">(Your Luma free-text about contributions is not used for ranking; we use GitHub + our site.)</p>`
    : "";

  const html = emailShell(`${lead}${selfNote}${commonEventBlockHtml()}`);

  const textParts = [
    `Hi ${name},`,
    "",
    tier === "CONFIRMED" ?
      `You're #${rank} on the website leaderboard of ${totalOnLeaderboard} with ${mergedPrCount} merged PR(s). Arrive before 4:00 PM ET on April 13.`
    : tier === "WAITLISTED" ?
      `You're #${rank} of ${totalOnLeaderboard} on the leaderboard with ${mergedPrCount} merged PR(s). Only ${CURSOR_CREDIT_TOP_N} spots — merge PRs to ${repoUrl} to move up.`
    : tier === "SIGNED_UP_NO_SPOT" ?
      `Claim your spot: ${signupUrl}` +
        (profileBlockReason ? ` First fix: ${profileBlockReason}` : "")
    : `Complete signup on cursorboston.com and claim your spot: ${signupUrl}`,
    "",
    `Event: April 13, 2026 4–8 PM ET, Back Bay Boston. Luma: ${LUMA_URL}`,
  ];

  return { subject, html, text: textParts.join("\n") };
}

function parseArgs(argv: string[]) {
  const dryRun = argv.includes("--dry-run");
  const send = argv.includes("--send");
  const csvIdx = argv.indexOf("--csv");
  const csvPath =
    csvIdx >= 0 && argv[csvIdx + 1] ?
      argv[csvIdx + 1]!
    : join(
        homedir(),
        "Downloads",
        "Cursor Boston Hack-a-Sprint - Guests - 2026-04-09-12-23-27.csv"
      );

  if ((dryRun && send) || (!dryRun && !send)) {
    console.error("Specify exactly one of: --dry-run | --send");
    process.exit(1);
  }
  return { dryRun, send, csvPath };
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const { dryRun, send, csvPath } = parseArgs(process.argv.slice(2));

  let raw: string;
  try {
    raw = readFileSync(csvPath, "utf8");
  } catch (e) {
    console.error(`Cannot read CSV: ${csvPath}`, e);
    process.exit(1);
  }

  if (send) {
    if (!process.env.MAILGUN_API_KEY || !process.env.MAILGUN_DOMAIN) {
      console.error("For --send, set MAILGUN_API_KEY and MAILGUN_DOMAIN.");
      process.exit(1);
    }
  }

  const db = getAdminDb();
  if (!db) {
    console.error("Firebase Admin not configured (FIREBASE_SERVICE_ACCOUNT_JSON / GOOGLE_APPLICATION_CREDENTIALS).");
    process.exit(1);
  }

  if (!process.env.GITHUB_TOKEN?.trim()) {
    console.warn(
      "[warn] GITHUB_TOKEN is not set — GitHub Search may return 403; merged PR counts use Firestore where possible. Copy the token from your production/host env into .env.local for parity with the website."
    );
  }

  const csvRows = parseCsv(raw);
  if (csvRows.length === 0) {
    console.error("No data rows in CSV.");
    process.exit(1);
  }

  console.log(`Loaded ${csvRows.length} rows from ${csvPath}`);
  console.log("Fetching merged PR counts from GitHub (one bulk search)…");
  const githubBulk = await fetchMergedPrCountByAuthorForRepo();
  if (githubBulk) {
    const authors = githubBulk.size;
    const prs = [...githubBulk.values()].reduce((a, b) => a + b, 0);
    console.log(`GitHub: ${prs} merged PRs across ${authors} authors (paginated search).`);
  } else {
    console.warn(
      "[warn] GitHub bulk PR fetch failed — leaderboard uses Firestore + 0 for GitHub-only rows."
    );
  }

  console.log("Building leaderboard snapshot…");
  const { rankByUserId, prByUserId, totalOnLeaderboard, entries } =
    await buildLeaderboard(db, githubBulk);

  type RowResult = {
    email: string;
    tier: RegistrantTier;
    uid: string | null;
    matchMethod: MatchMethod;
    rank: number | null;
    mergedPrCount: number;
    profileBlock: string | null;
    name: string;
    csvSelfReportedPr: string;
  };

  const results: RowResult[] = [];

  for (const row of csvRows) {
    const emailRaw = row.email?.trim();
    if (!emailRaw) continue;

    const normalizedEmail = emailRaw.toLowerCase();
    const approval = (row.approval_status || "").toLowerCase();
    const ghCell = row[GITHUB_COL_KEY] ?? "";
    const csvGithub = parseGithubLogin(ghCell);
    const selfPrText = row[PR_COL_KEY] ?? "";

    if (approval === "declined") {
      results.push({
        email: normalizedEmail,
        tier: "DECLINED",
        uid: null,
        matchMethod: null,
        rank: null,
        mergedPrCount: 0,
        profileBlock: null,
        name: displayNameFromRow(row),
        csvSelfReportedPr: selfPrText,
      });
      continue;
    }

    const { uid, method } = await resolveUserIdForRow(db, normalizedEmail, csvGithub);

    let tier: RegistrantTier;
    let rank: number | null = null;
    let mergedPr = 0;
    let profileBlock: string | null = null;

    if (!uid) {
      tier = "NO_SITE_ACCOUNT";
      mergedPr = mergedPrForLogin(csvGithub, githubBulk);
    } else {
      const leaderboardRank = rankByUserId.get(uid);
      mergedPr = prByUserId.get(uid) ?? 0;

      if (leaderboardRank !== undefined) {
        rank = leaderboardRank;
        tier =
          leaderboardRank <= CURSOR_CREDIT_TOP_N ? "CONFIRMED" : "WAITLISTED";
      } else {
        tier = "SIGNED_UP_NO_SPOT";
        const userSnap = await db.collection("users").doc(uid).get();
        profileBlock = getHackathonEventSignupBlockReason(userSnap.data());
        const p = userSnap.data();
        const profLogin =
          p?.github && typeof p.github === "object" ?
            (p.github as { login?: string }).login
          : undefined;
        const gh =
          csvGithub ||
          (typeof profLogin === "string" ? profLogin.trim() : null);
        mergedPr = mergedPrForLogin(gh, githubBulk);
      }
    }

    results.push({
      email: normalizedEmail,
      tier,
      uid,
      matchMethod: method,
      rank,
      mergedPrCount: mergedPr,
      profileBlock,
      name: displayNameFromRow(row),
      csvSelfReportedPr: selfPrText,
    });
  }

  const counts: Record<string, number> = {};
  for (const r of results) {
    counts[r.tier] = (counts[r.tier] ?? 0) + 1;
  }
  console.log("\nSummary by tier:", counts);
  console.log(`Leaderboard size (website): ${entries.length}\n`);

  const pad = (s: string, n: number) => s.slice(0, n).padEnd(n);

  for (const r of results) {
    const line = [
      pad(r.email, 38),
      pad(r.tier, 18),
      r.rank !== null ? `#${r.rank}` : "—",
      `pr=${r.mergedPrCount}`,
      r.matchMethod ?? "—",
      r.uid ? r.uid.slice(0, 8) + "…" : "—",
    ].join("  ");
    console.log(line);
  }

  if (dryRun) {
    console.log("\n--dry-run: no emails sent. Review the table above.");
    const sample = results.find((x) => x.tier === "CONFIRMED") || results.find((x) => x.tier !== "DECLINED");
    if (sample && sample.tier !== "DECLINED") {
      const { html } = buildEmails({
        tier: sample.tier as Exclude<RegistrantTier, "DECLINED">,
        name: sample.name,
        rank: sample.rank,
        totalOnLeaderboard,
        mergedPrCount: sample.mergedPrCount,
        profileBlockReason: sample.profileBlock,
        csvSelfReportedPr: sample.csvSelfReportedPr,
      });
      console.log("\nSample HTML preview (first non-declined row):\n---\n" + html.slice(0, 500) + "…\n---");
    }
    return;
  }

  let sent = 0;
  let failed = 0;
  for (const r of results) {
    if (r.tier === "DECLINED") continue;
    const { subject, html, text } = buildEmails({
      tier: r.tier as Exclude<RegistrantTier, "DECLINED">,
      name: r.name,
      rank: r.rank,
      totalOnLeaderboard,
      mergedPrCount: r.mergedPrCount,
      profileBlockReason: r.profileBlock,
      csvSelfReportedPr: r.csvSelfReportedPr ?? "",
    });
    try {
      await sendEmail({ to: r.email, subject, html, text });
      sent++;
      console.log(`Sent: ${r.email} (${r.tier})`);
    } catch (e) {
      failed++;
      console.error(`Failed: ${r.email}`, e);
    }
    await sleep(450);
  }
  console.log(`\nDone. Sent ${sent}, failed ${failed}, skipped declined ${counts["DECLINED"] ?? 0}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
