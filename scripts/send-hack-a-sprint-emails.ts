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
 *   npx tsx scripts/send-hack-a-sprint-emails.ts --send --announce-list [--csv path/to/export.csv]
 *   npx tsx scripts/send-hack-a-sprint-emails.ts --dry-run --reminder [--csv path/to/export.csv]
 *   npx tsx scripts/send-hack-a-sprint-emails.ts --dry-run --correction [--csv path/to/export.csv]
 *   npx tsx scripts/send-hack-a-sprint-emails.ts --dry-run --dayof [--csv path/to/export.csv]
 *   npx tsx scripts/send-hack-a-sprint-emails.ts --dry-run --waitlist-pr-deadline [--csv path/to/export.csv]
 *   npx tsx scripts/send-hack-a-sprint-emails.ts --dry-run --confirmed-arrival-reminder [--csv path/to/export.csv]
 *   npx tsx scripts/send-hack-a-sprint-emails.ts --dry-run --list-is-set [--csv path/to/export.csv]
 *
 * --announce-list: sends a simpler email linking to the participant list page
 *   (accepted & waitlisted) instead of the full tier-specific emails.
 *
 * --reminder: day-before blast — confirmed vs waitlisted vs incomplete signup copy
 *   (website registration, Luma “not going”, 4:00 PM arrival, late RSVP on site).
 *
 * --dayof: event-day blast — 4 PM / late message for confirmed; 10 AM PR merge cutoff
 *   and open-PR queue guidance for waitlisted; shared community / governance copy for all.
 *
 * --waitlist-pr-deadline: **waitlisted recipients only** — short merge window, 4 PM arrival,
 *   Discord for rank questions, and per-recipient open-PR + review status from GitHub (needs token).
 *   Optional env: HACK_A_SPRINT_WAITLIST_PR_CUTOFF_LABEL, HACK_A_SPRINT_WAITLIST_PR_WINDOW_MINUTES.
 *
 * --confirmed-arrival-reminder: **confirmed recipients only** — be there by 4:00 PM ET (or say you’re late),
 *   spot released if not checked in / no word by 4:30 PM ET; update Luma if not attending.
 *
 * --list-is-set: **all non-declined CSV registrants** — same copy for everyone; only the greeting name varies.
 *   Final list + Luma + website registration + before 4 PM + community / maintainers “what’s next”.
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
  compareUnifiedHackathonRanking,
  CURSOR_CREDIT_TOP_N,
  DECLINED_EMAILS,
  JUDGE_EMAILS,
  getHackathonEventSignupBlockReason,
} from "../lib/hackathon-event-signup";
import { HACK_A_SPRINT_2026_EVENT_ID } from "../lib/hackathon-showcase";
import {
  fetchMergedPrCountByAuthorForRepo,
  fetchMergedPrCountsForLogins,
} from "../lib/github-merged-pr-count";
import {
  fetchOpenPrsWithReviewStatusForAuthors,
  type OpenPrWithReviewSummary,
} from "../lib/github-open-pr-review-status";
import { getGithubRepoPair, getGithubRepoWebBaseUrl } from "../lib/github-recent-merged-prs";
import { getAdminAuth, getAdminDb } from "../lib/firebase-admin";
import { sendEmail } from "../lib/mailgun";

const SITE_ORIGIN = process.env.NEXT_PUBLIC_APP_URL || "https://cursorboston.com";
const SIGNUP_PATH = "/hackathons/hack-a-sprint-2026/signup";
const LUMA_URL = "https://luma.com/uixo8hl6";
const DISCORD_INVITE_URL = "https://discord.gg/Wsncg8YYqc";

/** Shown in --waitlist-pr-deadline copy (e.g. merge cutoff time). Override with env when sending. */
const WAITLIST_PR_CUTOFF_LABEL =
  process.env.HACK_A_SPRINT_WAITLIST_PR_CUTOFF_LABEL?.trim() || "3:20 PM ET";

const WAITLIST_PR_WINDOW_MINUTES = (() => {
  const n = Number.parseInt(
    process.env.HACK_A_SPRINT_WAITLIST_PR_WINDOW_MINUTES ?? "40",
    10
  );
  return Number.isFinite(n) && n > 0 ? n : 40;
})();

const GITHUB_COL_KEY = "What is your GitHub username?";
const PR_COL_KEY =
  "Have you contributed to the repo?  If yes, last PR to https://github.com/rogerSuperBuilderAlpha/cursor-boston";

const USER_ID_IN_CHUNK = 10;

/** Update before send if the open PR queue size changed (see GitHub pulls tab). */
const DAYOF_OPEN_PR_QUEUE_COUNT = 16;

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

/** Same unified ordering as GET signup API (confirmed first, then PRs, …). */
async function buildUnifiedDisplayRankMaps(
  db: Firestore
): Promise<{
  rankByUserId: Map<string, number>;
  rankByEmail: Map<string, number>;
  /** Matches signup page `totalCount` (website + Luma-only, deduped). */
  totalEntries: number;
}> {
  const eventId = HACK_A_SPRINT_2026_EVENT_ID;
  const signupSnap = await db
    .collection("hackathonEventSignups")
    .where("eventId", "==", eventId)
    .get();

  const rows: {
    userId: string;
    email: string | null;
    signedUpAtMs: number;
    mergedPrCount: number;
    confirmedAt: number | null;
  }[] = [];

  const userIds = signupSnap.docs.map((d) => d.data().userId as string).filter(Boolean);
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
  const githubMergedByLogin = await fetchMergedPrCountsForLogins(githubLogins);

  for (const doc of signupSnap.docs) {
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
    const emailRaw =
      profile && typeof profile.email === "string" ? profile.email.toLowerCase() : null;
    if (emailRaw && DECLINED_EMAILS.has(emailRaw)) continue;
    rows.push({
      userId,
      email: emailRaw,
      signedUpAtMs: signedUpAtToMs(data.signedUpAt),
      mergedPrCount: pr,
      confirmedAt: data.confirmedAt ? signedUpAtToMs(data.confirmedAt) : null,
    });
  }

  const websiteEmails = new Set<string>();
  const websiteGithubLogins = new Set<string>();
  for (const uid of userIds) {
    const profile = userMap.get(uid);
    if (typeof profile?.email === "string") websiteEmails.add(profile.email.toLowerCase());
    const g =
      profile?.github && typeof profile.github === "object"
        ? (profile.github as { login?: string }).login
        : undefined;
    if (typeof g === "string" && g.trim()) websiteGithubLogins.add(g.trim().toLowerCase());
  }

  const lumaSnap = await db
    .collection("hackathonLumaRegistrants")
    .where("eventId", "==", eventId)
    .get();

  const lumaGithubLogins: string[] = [];
  type LumaRow = {
    email: string;
    name: string;
    githubLogin: string | null;
    lumaCreatedAt: string;
    mergedPrCount: number;
    confirmedAt: number | null;
  };
  const lumaRows: LumaRow[] = [];

  for (const doc of lumaSnap.docs) {
    const d = doc.data();
    const email = (d.email as string || "").toLowerCase();
    const ghLogin = typeof d.githubLogin === "string" ? d.githubLogin : null;
    if (JUDGE_EMAILS.has(email) || DECLINED_EMAILS.has(email)) continue;
    if (websiteEmails.has(email)) continue;
    if (ghLogin && websiteGithubLogins.has(ghLogin.toLowerCase())) continue;
    if (ghLogin) lumaGithubLogins.push(ghLogin);
    lumaRows.push({
      email,
      name: typeof d.name === "string" ? d.name : "",
      githubLogin: ghLogin,
      lumaCreatedAt: typeof d.lumaCreatedAt === "string" ? d.lumaCreatedAt : "",
      mergedPrCount: 0,
      confirmedAt: d.confirmedAt ? signedUpAtToMs(d.confirmedAt) : null,
    });
  }

  if (lumaGithubLogins.length > 0) {
    const lumaPrCounts = await fetchMergedPrCountsForLogins(lumaGithubLogins);
    for (const lr of lumaRows) {
      if (lr.githubLogin) {
        const count = lumaPrCounts.get(lr.githubLogin.toLowerCase());
        if (count !== undefined) lr.mergedPrCount = count;
      }
    }
  }

  type EntrySource = "website" | "luma_only";
  type UnifiedRow = {
    userId: string | null;
    email: string | null;
    mergedPrCount: number;
    signedUpAtMs: number;
    source: EntrySource;
    confirmedAt: number | null;
  };

  const unified: UnifiedRow[] = [];
  for (const r of rows) {
    unified.push({
      userId: r.userId,
      email: r.email,
      mergedPrCount: r.mergedPrCount,
      signedUpAtMs: r.signedUpAtMs,
      source: "website",
      confirmedAt: r.confirmedAt,
    });
  }
  for (const lr of lumaRows) {
    unified.push({
      userId: null,
      email: lr.email || null,
      mergedPrCount: lr.mergedPrCount,
      signedUpAtMs: lr.lumaCreatedAt ? new Date(lr.lumaCreatedAt).getTime() : 0,
      source: "luma_only",
      confirmedAt: lr.confirmedAt,
    });
  }

  unified.sort(compareUnifiedHackathonRanking);

  const rankByUserId = new Map<string, number>();
  const rankByEmail = new Map<string, number>();
  for (let i = 0; i < unified.length; i++) {
    const u = unified[i]!;
    const rank = i + 1;
    if (u.userId) rankByUserId.set(u.userId, rank);
    if (u.email) rankByEmail.set(u.email, rank);
  }

  return { rankByUserId, rankByEmail, totalEntries: unified.length };
}

async function buildSignupConfirmedByUserId(db: Firestore): Promise<Map<string, boolean>> {
  const m = new Map<string, boolean>();
  const snap = await db
    .collection("hackathonEventSignups")
    .where("eventId", "==", HACK_A_SPRINT_2026_EVENT_ID)
    .get();
  for (const doc of snap.docs) {
    const d = doc.data();
    const uid = d.userId as string;
    if (!uid) continue;
    m.set(uid, !!d.confirmedAt);
  }
  return m;
}

async function buildLumaConfirmedByEmail(db: Firestore): Promise<Map<string, boolean>> {
  const m = new Map<string, boolean>();
  const snap = await db
    .collection("hackathonLumaRegistrants")
    .where("eventId", "==", HACK_A_SPRINT_2026_EVENT_ID)
    .get();
  for (const doc of snap.docs) {
    const d = doc.data();
    const email = String(d.email ?? "").toLowerCase();
    if (!email) continue;
    m.set(email, !!d.confirmedAt);
  }
  return m;
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

function openIssuesHtml(): string {
  const repoIssuesUrl = `${getGithubRepoWebBaseUrl()}/issues`;
  return `<p><strong>Looking for something to work on?</strong> These open issues are great candidates for a quick PR:</p>
<ul style="margin:8px 0;">
<li><strong><a href="${escapeHtml(repoIssuesUrl)}/232">#232</a></strong> — Increase test coverage from 13.9% to 50%+ <em>(good first issue, testing)</em></li>
<li><strong><a href="${escapeHtml(repoIssuesUrl)}/235">#235</a></strong> — Add JSDoc documentation to exported utility functions <em>(good first issue, docs)</em></li>
<li><strong><a href="${escapeHtml(repoIssuesUrl)}/243">#243</a></strong> — Add bounds checking for Firestore query .docs[0] access <em>(bug fix)</em></li>
<li><strong><a href="${escapeHtml(repoIssuesUrl)}/257">#257</a></strong> — Career Board for Cursor-Native Developers <em>(good first issue, feature)</em></li>
<li><strong><a href="${escapeHtml(repoIssuesUrl)}/260">#260</a></strong> — AI Dev Terminology Glossary <em>(good first issue, feature)</em></li>
</ul>
<p style="font-size:13px;">See all open issues: <a href="${escapeHtml(repoIssuesUrl)}">${escapeHtml(repoIssuesUrl)}</a></p>`;
}

function openIssuesText(): string {
  const repoIssuesUrl = `${getGithubRepoWebBaseUrl()}/issues`;
  return `Looking for something to work on? Try these open issues:
- #232 Increase test coverage (good first issue, testing)
- #235 Add JSDoc documentation (good first issue, docs)
- #243 Add bounds checking for Firestore .docs[0] (bug fix)
- #257 Career Board for Cursor-Native Developers (good first issue)
- #260 AI Dev Terminology Glossary (good first issue)
All issues: ${repoIssuesUrl}`;
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
  const repoUrl = getGithubRepoWebBaseUrl();

  let subject: string;
  let lead: string;

  if (tier === "CONFIRMED") {
    subject = `Hack-a-Sprint: You’re #${rank} — confirm your spot for April 13`;
    lead = `<p>Hi ${first},</p>
<p>The participant list is finalized. You’re <strong>#${rank}</strong> out of <strong>${totalOnLeaderboard}</strong> on the leaderboard with <strong>${mergedPrCount}</strong> merged PR${mergedPrCount === 1 ? "" : "s"}. You’re in the top ${CURSOR_CREDIT_TOP_N} — <strong>your spot is reserved</strong>.</p>
<p><strong>To confirm you’re coming, do one of the following before April 13:</strong></p>
<ol>
<li><strong>Submit a PR</strong> to <a href="${escapeHtml(repoUrl)}">${escapeHtml(repoUrl)}</a> — any contribution counts (docs, fixes, features). This confirms your attendance and boosts your rank.</li>
<li>Or <strong>reply to this email</strong> to let us know you’re coming.</li>
</ol>
<p>If you can no longer attend, <strong>please remove yourself from <a href="${escapeHtml(LUMA_URL)}">Luma</a></strong> so we can give your spot to someone on the waitlist.</p>
<p><strong>Arrive by 4:00 PM ET on April 13.</strong> If you’ll be late, contact roger@cursorboston.com before the event. Unclaimed spots at 4:00 PM go to the waitlist.</p>
<p>Bring your laptop, charger, and something you want to build. Sprint starts at 4:30 PM.</p>
<p>Final leaderboard: <a href="${escapeHtml(signupUrl)}">${escapeHtml(signupUrl)}</a></p>`;
  } else if (tier === "WAITLISTED") {
    subject = `Hack-a-Sprint: You’re #${rank} — waitlist for April 13`;
    lead = `<p>Hi ${first},</p>
<p>The participant list is finalized. You’re <strong>#${rank}</strong> out of <strong>${totalOnLeaderboard}</strong> on the leaderboard with <strong>${mergedPrCount}</strong> merged PR${mergedPrCount === 1 ? "" : "s"}. We have <strong>${CURSOR_CREDIT_TOP_N}</strong> confirmed spots, so you’re currently on the <strong>waitlist</strong>.</p>
<p><strong>You can still move up.</strong> Merged PRs are the #1 way to climb the leaderboard. Open a PR to <a href="${escapeHtml(repoUrl)}">${escapeHtml(repoUrl)}</a> — documentation, bug fixes, and small features all count. As confirmed participants drop out or don’t show up, waitlisted builders move in <strong>by rank order</strong>.</p>
${openIssuesHtml()}
<p><strong>How day-of works:</strong> at 4:00 PM ET on April 13, unclaimed spots go to the waitlist in rank order. If you’d like a chance at a spot, be nearby and watch your email or Discord around 4:00 PM.</p>
<p>If you know you won’t be coming, please remove yourself from <a href="${escapeHtml(LUMA_URL)}">Luma</a> so others can move up.</p>
<p>Final leaderboard: <a href="${escapeHtml(signupUrl)}">${escapeHtml(signupUrl)}</a></p>`;
  } else if (tier === "SIGNED_UP_NO_SPOT") {
    subject = "Hack-a-Sprint: Final list posted — check your ranking";
    const block =
      profileBlockReason ?
        `<p><strong>Before you can claim your spot:</strong> ${escapeHtml(profileBlockReason)}</p>`
      : "";
    lead = `<p>Hi ${first},</p>
<p>The participant list for Hack-a-Sprint is finalized. We found your <strong>cursorboston.com</strong> account, but you haven’t joined the website signup list yet — so you’re not currently ranked.</p>
${block}
<p>If you still want to attend, go to <a href="${escapeHtml(signupUrl)}">${escapeHtml(signupUrl)}</a> and claim your spot. You’ll be ranked based on your merged PR count (<strong>${mergedPrCount}</strong>).</p>
<p>If you can no longer attend, please remove yourself from the <a href="${escapeHtml(LUMA_URL)}">Luma invite</a>.</p>`;
  } else {
    subject = "Hack-a-Sprint: Final list posted — complete your registration";
    lead = `<p>Hi ${first},</p>
<p>The participant list for Hack-a-Sprint is finalized. You registered on <strong>Luma</strong>, but we don’t see a matching <strong>cursorboston.com</strong> account — so you’re not currently ranked on the leaderboard.</p>
<p><strong>To get on the list:</strong></p>
<ol>
<li>Create an account at <a href="${escapeHtml(SITE_ORIGIN)}">cursorboston.com</a> (use this same email if possible).</li>
<li>Connect <strong>GitHub</strong> and <strong>Discord</strong> on your profile.</li>
<li>Set your profile to <strong>public</strong> with Discord visible.</li>
<li>Go to <a href="${escapeHtml(signupUrl)}">${escapeHtml(signupUrl)}</a> and <strong>claim your spot</strong>.</li>
</ol>
<p>If you can no longer attend, please remove yourself from the <a href="${escapeHtml(LUMA_URL)}">Luma invite</a>.</p>`;
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
      `You’re #${rank} — spot reserved for April 13. Confirm by submitting a PR to ${repoUrl} or replying to this email. Arrive by 4:00 PM ET. If you can’t come, remove yourself from Luma.`
    : tier === "WAITLISTED" ?
      `You’re #${rank} on the waitlist. Merge PRs to ${repoUrl} to move up. At 4:00 PM ET on April 13, unclaimed spots go to waitlist in rank order. If not coming, remove yourself from Luma.\n\n${openIssuesText()}`
    : tier === "SIGNED_UP_NO_SPOT" ?
      `Claim your leaderboard spot: ${signupUrl}` +
        (profileBlockReason ? ` First fix: ${profileBlockReason}` : "") +
        ` If not attending, remove from Luma.`
    : `Complete signup on cursorboston.com: ${signupUrl}. If not attending, remove from Luma.`,
    "",
    `Final leaderboard: ${signupUrl}`,
    `Event: April 13, 2026 4–8 PM ET, Back Bay Boston. Luma: ${LUMA_URL}`,
  ];

  return { subject, html, text: textParts.join("\n") };
}

function buildListAnnouncementEmail(args: {
  tier: Exclude<RegistrantTier, "DECLINED">;
  name: string;
  rank: number | null;
  totalOnLeaderboard: number;
  mergedPrCount: number;
}): { subject: string; html: string; text: string } {
  const { tier, name, rank, totalOnLeaderboard, mergedPrCount } = args;
  const first = escapeHtml(name);
  const signupUrl = `${SITE_ORIGIN.replace(/\/$/, "")}${SIGNUP_PATH}`;
  const repoUrl = getGithubRepoWebBaseUrl();

  const subject = "Hack-a-Sprint: Accepted & waitlisted participants list is live";

  let statusLine: string;
  if (tier === "CONFIRMED" && rank !== null) {
    statusLine = `You're <strong>#${rank}</strong> out of <strong>${totalOnLeaderboard}</strong> with <strong>${mergedPrCount}</strong> merged PR${mergedPrCount === 1 ? "" : "s"} — <strong style="color:#059669;">confirmed</strong>.`;
  } else if (tier === "WAITLISTED" && rank !== null) {
    statusLine = `You're <strong>#${rank}</strong> out of <strong>${totalOnLeaderboard}</strong> with <strong>${mergedPrCount}</strong> merged PR${mergedPrCount === 1 ? "" : "s"} — currently on the <strong style="color:#d97706;">waitlist</strong>. You can still move up by merging PRs to <a href="${escapeHtml(repoUrl)}">the community repo</a>.`;
  } else if (tier === "SIGNED_UP_NO_SPOT") {
    statusLine = `We found your cursorboston.com account but you haven't joined the signup list yet — go to the page below to claim your spot.`;
  } else {
    statusLine = `You registered on Luma but we don't see a matching cursorboston.com account yet — create one and claim your spot on the page below.`;
  }

  const html = emailShell(`<p>Hi ${first},</p>
<p>The accepted and waitlisted participant list for <strong>Hack-a-Sprint</strong> is now live. You can see the full list, your ranking, and your status here:</p>
<p style="margin:16px 0;"><a href="${escapeHtml(signupUrl)}" style="display:inline-block;background:#059669;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;">View participant list</a></p>
<p>${statusLine}</p>
${tier === "WAITLISTED" ? openIssuesHtml() : ""}
<p>The top <strong>${CURSOR_CREDIT_TOP_N}</strong> are confirmed. Everyone else is on the waitlist. Rankings are based on merged PRs to the community repo, then by signup time.</p>
${commonEventBlockHtml()}`);

  const textStatusLine =
    tier === "CONFIRMED" && rank !== null
      ? `You're #${rank} of ${totalOnLeaderboard} (${mergedPrCount} merged PRs) — confirmed.`
      : tier === "WAITLISTED" && rank !== null
        ? `You're #${rank} of ${totalOnLeaderboard} (${mergedPrCount} merged PRs) — waitlisted. Merge PRs to move up.`
        : tier === "SIGNED_UP_NO_SPOT"
          ? `You have an account but haven't joined the signup list yet — claim your spot at the link below.`
          : `Create a cursorboston.com account and claim your spot at the link below.`;

  const text = [
    `Hi ${name},`,
    "",
    "The accepted and waitlisted participant list for Hack-a-Sprint is now live.",
    "",
    `View the full list: ${signupUrl}`,
    "",
    textStatusLine,
    "",
    `Top ${CURSOR_CREDIT_TOP_N} are confirmed. Rankings = merged PRs to the community repo, then signup time.`,
    "",
    `Event: April 13, 2026 4–8 PM ET, Back Bay Boston. Luma: ${LUMA_URL}`,
  ].join("\n");

  return { subject, html, text };
}

function buildReminderEmail(args: {
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
  const repoUrl = getGithubRepoWebBaseUrl();
  const rankPhrase =
    rank !== null ? `#${rank} of ${totalOnLeaderboard}` : "the list";

  let subject: string;
  let lead: string;

  if (tier === "CONFIRMED") {
    subject = "Hack-a-Sprint is Monday — your spot is confirmed";
    lead = `<p>Hi ${first},</p>
<p><strong>Monday, April 13</strong> is almost here. You have a <strong>confirmed spot</strong> on the website leaderboard (${rank !== null ? `rank <strong>#${rank}</strong> of <strong>${totalOnLeaderboard}</strong>` : "see the list"} · <strong>${mergedPrCount}</strong> merged PR${mergedPrCount === 1 ? "" : "s"}).</p>
<p><strong>Can’t make it?</strong> Please mark yourself as <strong>not going</strong> on Luma so we can offer your spot to the waitlist: <a href="${escapeHtml(LUMA_URL)}">${escapeHtml(LUMA_URL)}</a></p>
<p><strong>Attending?</strong> You <strong>must register on the website</strong> to participate (leaderboard + day-of tools). Do it now — you can wait until you arrive, but it will be slow and annoying at the door: <a href="${escapeHtml(signupUrl)}">${escapeHtml(signupUrl)}</a></p>
<p><strong>Arrive by 4:00 PM ET.</strong> If you are not checked in by 4:00 PM, your spot may be given to someone on the waitlist.</p>
<p><strong>Running late but still coming?</strong> That’s OK — you <strong>must</strong> say so on the website (Day-of RSVP) or we may release your spot: <a href="${escapeHtml(signupUrl)}">${escapeHtml(signupUrl)}</a></p>`;
  } else if (tier === "WAITLISTED") {
    subject = "Hack-a-Sprint is Monday — waitlist update";
    lead = `<p>Hi ${first},</p>
<p>You are <strong>${rankPhrase}</strong> on the waitlist with <strong>${mergedPrCount}</strong> merged PR${mergedPrCount === 1 ? "" : "s"}. <strong>Admission is not guaranteed.</strong> There is <strong>no spectator room</strong> — only participants with a seat.</p>
<p><strong>Want to try for an open spot?</strong> At <strong>4:00 PM ET</strong>, unclaimed confirmed spots go to waitlisters <strong>in rank order</strong>. On the website, you can indicate that you’ll be there to queue: <a href="${escapeHtml(signupUrl)}">${escapeHtml(signupUrl)}</a></p>
<p><strong>Move up before Monday:</strong> Sign up on the website if you haven’t, and <strong>merge a PR</strong> to the community repo to climb the waitlist: <a href="${escapeHtml(repoUrl)}">${escapeHtml(repoUrl)}</a></p>
${openIssuesHtml()}
<p>If you’re not planning to queue, please remove yourself from <a href="${escapeHtml(LUMA_URL)}">Luma</a> so others can move up.</p>`;
  } else if (tier === "SIGNED_UP_NO_SPOT") {
    subject = "Hack-a-Sprint is Monday — finish website signup";
    const block =
      profileBlockReason ?
        `<p><strong>Before you can claim your spot on the site:</strong> ${escapeHtml(profileBlockReason)}</p>`
      : "";
    lead = `<p>Hi ${first},</p>
<p>We see your <strong>cursorboston.com</strong> account, but you’re <strong>not on the website signup list</strong> yet — so you’re not ranked for Monday.</p>
${block}
<p><strong>To get on the list:</strong> Complete your profile requirements and claim your spot: <a href="${escapeHtml(signupUrl)}">${escapeHtml(signupUrl)}</a></p>
<p><strong>Waitlist / no guaranteed seat:</strong> Spots are limited and there is <strong>no spectator room</strong>. Merge PRs to <a href="${escapeHtml(repoUrl)}">${escapeHtml(repoUrl)}</a> to improve your position.</p>
<p><strong>Can’t attend?</strong> Mark not going on Luma: <a href="${escapeHtml(LUMA_URL)}">${escapeHtml(LUMA_URL)}</a></p>`;
  } else {
    subject = "Hack-a-Sprint is Monday — create your site account";
    lead = `<p>Hi ${first},</p>
<p>You’re approved on <strong>Luma</strong>, but we don’t see a matching <strong>cursorboston.com</strong> account — you’re <strong>not on the website leaderboard</strong> yet.</p>
<p><strong>To compete or queue:</strong></p>
<ol>
<li>Create an account at <a href="${escapeHtml(SITE_ORIGIN)}">cursorboston.com</a> (this email if possible).</li>
<li>Connect <strong>GitHub</strong> and <strong>Discord</strong>; public profile with Discord visible.</li>
<li>Claim your spot: <a href="${escapeHtml(signupUrl)}">${escapeHtml(signupUrl)}</a></li>
<li>Merge a PR to <a href="${escapeHtml(repoUrl)}">${escapeHtml(repoUrl)}</a> to move up the waitlist.</li>
</ol>
<p><strong>Waitlist reality:</strong> Admission is <strong>not guaranteed</strong>. There is <strong>no spectator room</strong>. At 4:00 PM ET, open seats go to waitlisters in rank order — use the site to signal you’ll queue.</p>
<p><strong>Can’t come?</strong> Mark not going on Luma: <a href="${escapeHtml(LUMA_URL)}">${escapeHtml(LUMA_URL)}</a></p>`;
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
      `Confirmed spot (${rankPhrase}). Can't come? Mark not going on Luma: ${LUMA_URL}. Attending? Register on the site (required): ${signupUrl}. Arrive by 4:00 PM ET. Late? Indicate on site Day-of RSVP: ${signupUrl}`
    : tier === "WAITLISTED" ?
      `Waitlist ${rankPhrase}. Not guaranteed; no spectator room. Queue intent + signup: ${signupUrl}. Move up with PRs: ${repoUrl}\n\n${openIssuesText()}`
    : tier === "SIGNED_UP_NO_SPOT" ?
      `Finish website signup: ${signupUrl}` + (profileBlockReason ? ` (${profileBlockReason})` : "") + `. PRs: ${repoUrl}. Luma: ${LUMA_URL}`
    : `Create account and claim spot: ${signupUrl}. Repo: ${repoUrl}. Luma: ${LUMA_URL}`,
    "",
    `Event: April 13, 2026 4–8 PM ET, Back Bay Boston.`,
  ];

  return { subject, html, text: textParts.join("\n") };
}

function dayOfCommunityBlockHtml(): string {
  return `<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
<p><strong>Looking ahead: this is a community project.</strong></p>
<p>There will be plenty of other Cursor Boston events — and you can help organize them. If you have a venue (or know someone who does), reach out to <a href="mailto:roger@cursorboston.com">roger@cursorboston.com</a> and we can put something together.</p>
<p>I only have authority right now because I'm doing everything myself, but that's changing. I'll be sending out requests for repo maintainers soon, working with them to organize events, and doing my best to provide whatever support the community needs.</p>
<p>I'm also going to stop making personal updates to the site from here on out (unless I have a cool idea). It's community-managed now. And soon I hope to move to a more communal backend as well. Lots of exciting stuff coming.</p>
<p>Thank you sincerely for your contributions and participation. This community is already something special.</p>`;
}

function dayOfCommunityBlockText(): string {
  return [
    "",
    "Looking ahead: this is a community project.",
    "",
    "There will be plenty of other Cursor Boston events — and you can help organize them. If you have a venue (or know someone who does), reach out to roger@cursorboston.com and we can put something together.",
    "",
    "I only have authority right now because I'm doing everything myself, but that's changing. I'll be sending out requests for repo maintainers soon, working with them to organize events, and doing my best to provide whatever support the community needs.",
    "",
    "I'm also going to stop making personal updates to the site from here on out (unless I have a cool idea). It's community-managed now. And soon I hope to move to a more communal backend as well. Lots of exciting stuff coming.",
    "",
    "Thank you sincerely for your contributions and participation. This community is already something special.",
  ].join("\n");
}

function buildDayOfEmail(args: {
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
    mergedPrCount,
    profileBlockReason,
    csvSelfReportedPr,
  } = args;
  const first = escapeHtml(name);
  const signupUrl = `${SITE_ORIGIN.replace(/\/$/, "")}${SIGNUP_PATH}`;
  const repoUrl = getGithubRepoWebBaseUrl();
  const pullsUrl = `${repoUrl.replace(/\/$/, "")}/pulls`;

  const selfNote =
    csvSelfReportedPr ?
      `<p style="font-size:13px;color:#666;">(Your Luma free-text about contributions is not used for ranking; we use GitHub + our site.)</p>`
    : "";

  let subject: string;
  let lead: string;
  let textLead: string;

  if (tier === "CONFIRMED") {
    subject = "Hack-a-Sprint is TODAY — arrive by 4:00 PM or let us know";
    lead = `<p>Hi ${first},</p>
<p>You have a <strong>confirmed spot</strong>. <strong>Arrive by 4:00 PM ET</strong> or message <a href="mailto:roger@cursorboston.com">roger@cursorboston.com</a> that you will be late.</p>
<p><strong>After 4:00 PM, unclaimed spots will be forfeited</strong> to waitlisted participants in rank order. We cannot guarantee access after that.</p>
<p>We have a <strong>limited venue with fire code capacity</strong> — we must stay within the limit, no exceptions.</p>
<p>Bring your laptop, charger, and something to build. The sprint starts <strong>4:30 PM ET</strong>.</p>`;
    textLead = [
      `Hi ${name},`,
      "",
      "You have a confirmed spot. Arrive by 4:00 PM ET or email roger@cursorboston.com if you will be late.",
      "",
      "After 4:00 PM, unclaimed spots are forfeited to the waitlist in rank order. We cannot guarantee access after that.",
      "",
      "Limited venue / fire code capacity — we must stay within the limit, no exceptions.",
      "",
      "Bring laptop, charger, something to build. Sprint starts 4:30 PM ET.",
    ].join("\n");
  } else if (tier === "WAITLISTED") {
    subject = "Hack-a-Sprint is TODAY — PR deadline 10 AM, then waitlist at 4 PM";
    const waitRankLead =
      rank !== null ?
        `You are <strong>#${rank}</strong> on the waitlist`
      : `You are on the waitlist`;
    lead = `<p>Hi ${first},</p>
<p>${waitRankLead} with <strong>${mergedPrCount}</strong> merged PR${mergedPrCount === 1 ? "" : "s"}.</p>
<p><strong>Get your PRs merged by 10:00 AM ET today.</strong> Nothing will be merged after that — merged PRs are the metric for waitlist ranking.</p>
<p><strong>Before opening a new PR</strong>, check the <strong>${DAYOF_OPEN_PR_QUEUE_COUNT} open PRs</strong> already in queue so you don't duplicate work: <a href="${escapeHtml(pullsUrl)}">${escapeHtml(pullsUrl)}</a></p>
<p>At <strong>4:00 PM ET</strong>, unclaimed confirmed spots go to the waitlist in rank order. Be nearby if you want a chance.</p>
<p>We have a <strong>limited venue with fire code capacity</strong> — we sincerely apologize if we cannot accommodate everyone. There is <strong>no spectator room</strong>.</p>`;
    textLead = [
      `Hi ${name},`,
      "",
      `You are ${rank !== null ? `#${rank}` : "on"} the waitlist with ${mergedPrCount} merged PRs.`,
      "",
      "Get your PRs merged by 10:00 AM ET today. Nothing counts after that for waitlist ranking.",
      "",
      `Before opening a new PR, check the ${DAYOF_OPEN_PR_QUEUE_COUNT} open PRs in queue: ${pullsUrl}`,
      "",
      "At 4:00 PM ET, unclaimed confirmed spots go to the waitlist in rank order. Be nearby if you want a chance.",
      "",
      "Limited venue / fire code — we apologize if we cannot accommodate everyone. No spectator room.",
    ].join("\n");
  } else if (tier === "SIGNED_UP_NO_SPOT") {
    subject = "Hack-a-Sprint is TODAY — complete website signup to queue";
    const block =
      profileBlockReason ?
        `<p><strong>Before you can join the list:</strong> ${escapeHtml(profileBlockReason)}</p>`
      : "";
    lead = `<p>Hi ${first},</p>
<p><strong>Complete your website registration</strong> if you want to queue for a waitlist spot today: <a href="${escapeHtml(signupUrl)}">${escapeHtml(signupUrl)}</a></p>
${block}`;
    textLead = [
      `Hi ${name},`,
      "",
      `Complete your website registration if you want to queue for a waitlist spot today: ${signupUrl}`,
      ...(profileBlockReason ? [`(${profileBlockReason})`] : []),
    ].join("\n");
  } else {
    subject = "Hack-a-Sprint is TODAY — complete website signup to queue";
    lead = `<p>Hi ${first},</p>
<p><strong>Complete your website registration</strong> if you want to queue for a waitlist spot today: <a href="${escapeHtml(signupUrl)}">${escapeHtml(signupUrl)}</a></p>
<p>Create an account at <a href="${escapeHtml(SITE_ORIGIN)}">cursorboston.com</a> (this email if possible), connect GitHub + Discord with a public profile, then claim your spot at the link above.</p>`;
    textLead = [
      `Hi ${name},`,
      "",
      `Complete your website registration if you want to queue for a waitlist spot today: ${signupUrl}`,
      "",
      `Create an account at ${SITE_ORIGIN}, connect GitHub + Discord, then claim your spot.`,
    ].join("\n");
  }

  const html = emailShell(`${lead}${selfNote}${dayOfCommunityBlockHtml()}${commonEventBlockHtml()}`);
  const text = [textLead, dayOfCommunityBlockText(), "", `Event: April 13, 2026 4–8 PM ET, Back Bay Boston. Luma: ${LUMA_URL}`].join("\n");

  return { subject, html, text };
}

function buildConfirmedArrivalReminderEmail(args: {
  name: string;
  rank: number | null;
  totalOnLeaderboard: number;
  mergedPrCount: number;
}): { subject: string; html: string; text: string } {
  const { name, rank, totalOnLeaderboard, mergedPrCount } = args;
  const first = escapeHtml(name);
  const signupUrl = `${SITE_ORIGIN.replace(/\/$/, "")}${SIGNUP_PATH}`;
  const subject = "Hack-a-Sprint TODAY — be here by 4:00 PM ET (or tell us you’re running late)";

  const rankLine =
    rank !== null ?
      `You have a <strong>confirmed seat</strong> — you’re <strong>#${rank}</strong> on the public list (of <strong>${totalOnLeaderboard}</strong>) with <strong>${mergedPrCount}</strong> merged PR${mergedPrCount === 1 ? "" : "s"}.`
    : `You have a <strong>confirmed seat</strong> on the Hack-a-Sprint list.`;

  const lead = `<p>Hi ${first},</p>
<p>${rankLine}</p>
<p><strong>Please plan to arrive at or before 4:00 PM ET.</strong> If you’re running late but still coming, <strong>let us know before 4:00 PM ET</strong> so we can try to hold your spot — reply to this email, write <a href="mailto:roger@cursorboston.com">roger@cursorboston.com</a>, or use the day-of tools on the website: <a href="${escapeHtml(signupUrl)}">${escapeHtml(signupUrl)}</a></p>
<p><strong>If you are not checked in and we have not heard from you by 4:30 PM ET, we will release your seat</strong> to the waitlist. Please don’t assume we’ll wait indefinitely.</p>
<p><strong>Can’t attend?</strong> Update your status on <strong>Luma</strong> as soon as you know you’re not coming (<a href="${escapeHtml(LUMA_URL)}">${escapeHtml(LUMA_URL)}</a>) so people on the waitlist can plan. That helps everyone.</p>
<p>Sprint kicks off at <strong>4:30 PM ET</strong>. Bring your laptop and charger.</p>`;

  const text = [
    `Hi ${name},`,
    "",
    rank !== null ?
      `Confirmed seat — #${rank} of ${totalOnLeaderboard} on the list (${mergedPrCount} merged PRs).`
    : "Confirmed seat for Hack-a-Sprint.",
    "",
    "Arrive at or before 4:00 PM ET. Running late but coming? Tell us before 4:00 PM ET: reply, roger@cursorboston.com, or day-of on the site:",
    signupUrl,
    "",
    "If you're not checked in and we haven't heard from you by 4:30 PM ET, we release your seat to the waitlist.",
    "",
    "Can't make it? Update your status on Luma ASAP so waitlisted folks can plan:",
    LUMA_URL,
    "",
    "Sprint starts 4:30 PM ET. Bring laptop + charger.",
  ].join("\n");

  const html = emailShell(`${lead}${commonEventBlockHtml()}`);
  return { subject, html, text };
}

function listIsSetNextStepsHtml(): string {
  const repoUrl = getGithubRepoWebBaseUrl();
  return `<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
<p><strong>After tonight — what’s next?</strong></p>
<p>Cursor Boston is meant to grow beyond one-off events. If you want to <strong>help maintain</strong> the <a href="${escapeHtml(repoUrl)}">community repo</a>, <strong>co-organize a meetup or hack night</strong>, or bring <strong>a new idea</strong> for the site or the group, there will be room for you.</p>
<p>We’ll be reaching out about <strong>repo maintainers</strong> and clearer paths to co-organize. If you have a venue, a theme, or time to help run things, email <a href="mailto:roger@cursorboston.com">roger@cursorboston.com</a> and we’ll connect you.</p>
<p>The project is <strong>community-driven</strong> — the more people shaping it, the stronger it gets. Thank you for showing up and building with us.</p>`;
}

function listIsSetNextStepsText(): string {
  const repoUrl = getGithubRepoWebBaseUrl();
  return [
    "",
    "After tonight — what's next?",
    "",
    `Want to help maintain the community repo (${repoUrl}), co-organize events, or pitch ideas? We'll be inviting repo maintainers and making it easier to co-organize.`,
    "",
    "Venue, theme, or time to help? Email roger@cursorboston.com.",
    "",
    "Thank you for being part of Cursor Boston.",
  ].join("\n");
}

/** Same body for every recipient; only `name` in the greeting is personalized. */
function buildListIsSetEmail(name: string): { subject: string; html: string; text: string } {
  const first = escapeHtml(name);
  const signupUrl = `${SITE_ORIGIN.replace(/\/$/, "")}${SIGNUP_PATH}`;
  const subject = "Hack-a-Sprint: the participant list is set — check the website";

  const lead = `<p>Hi ${first},</p>
<p><strong>The participant list is set.</strong> Your status (confirmed or waitlisted) and position are on the website — that’s the source of truth:</p>
<p style="margin:16px 0;"><a href="${escapeHtml(signupUrl)}" style="display:inline-block;background:#059669;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;">View the Hack-a-Sprint list</a></p>
<p><strong>Plan to arrive before 4:00 PM ET</strong> if you want to hold your place in line for a seat. Late arrivals may miss out if we’ve already moved to the waitlist.</p>
<p><strong>Please register on the website before you arrive</strong> (same link above) if you haven’t already — it makes check-in much faster at the door.</p>
<p><strong>Can’t make it?</strong> Update your registration status on <strong>Luma</strong> as soon as you know, so waitlisted people can plan: <a href="${escapeHtml(LUMA_URL)}">${escapeHtml(LUMA_URL)}</a></p>
${listIsSetNextStepsHtml()}`;

  const text = [
    `Hi ${name},`,
    "",
    "The participant list is set. See your status (confirmed or waitlisted) on the website:",
    signupUrl,
    "",
    "Arrive before 4:00 PM ET to hold your spot in line for a seat.",
    "",
    "Register on the website before you arrive if you can — faster check-in:",
    signupUrl,
    "",
    "Can't make it? Update your status on Luma:",
    LUMA_URL,
    listIsSetNextStepsText(),
  ].join("\n");

  const html = emailShell(`${lead}${commonEventBlockHtml()}`);
  return { subject, html, text };
}

function buildWaitlistPrDeadlineEmail(args: {
  name: string;
  rank: number | null;
  totalOnLeaderboard: number;
  mergedPrCount: number;
  githubLogin: string | null;
  /** From GitHub API; empty array = no open PRs for this login in the repo. */
  openPrs: OpenPrWithReviewSummary[] | undefined;
  cutoffLabel: string;
}): { subject: string; html: string; text: string } {
  const {
    name,
    rank,
    totalOnLeaderboard,
    mergedPrCount,
    githubLogin,
    openPrs,
    cutoffLabel,
  } = args;
  const first = escapeHtml(name);
  const signupUrl = `${SITE_ORIGIN.replace(/\/$/, "")}${SIGNUP_PATH}`;
  const repoUrl = getGithubRepoWebBaseUrl();
  const pullsUrl = `${repoUrl.replace(/\/$/, "")}/pulls`;
  const subject = `Hack-a-Sprint waitlist — ~${WAITLIST_PR_WINDOW_MINUTES} min left for PRs to count (by ${cutoffLabel})`;

  const rankLine =
    rank !== null ?
      `You’re <strong>#${rank}</strong> on the waitlist (of <strong>${totalOnLeaderboard}</strong> on the public list) with <strong>${mergedPrCount}</strong> merged PR${mergedPrCount === 1 ? "" : "s"}.`
    : `You’re on the waitlist with <strong>${mergedPrCount}</strong> merged PR${mergedPrCount === 1 ? "" : "s"}.`;

  let prSectionHtml: string;
  let prSectionText: string;

  if (!githubLogin?.trim()) {
    prSectionHtml = `<p>We don’t have a GitHub username on file for you from this registration path — merged PRs in <a href="${escapeHtml(repoUrl)}">${escapeHtml(repoUrl)}</a> are what move you up. If you’ve been contributing under another handle, message me on <a href="${escapeHtml(DISCORD_INVITE_URL)}">Discord</a> with your GitHub login so we can sanity-check.</p>`;
    prSectionText = `We may not have your GitHub username on file — PRs in ${repoUrl} are what move you up. If you use another handle, message on Discord: ${DISCORD_INVITE_URL}`;
  } else if (!openPrs || openPrs.length === 0) {
    prSectionHtml = `<p>Right now we don’t see any <strong>open</strong> pull requests from <strong>${escapeHtml(githubLogin)}</strong> in the community repo. If you just opened one, refresh in a minute; if you use a different GitHub account, tell us on Discord. To get a merge in before the cutoff, pick something small from <a href="${escapeHtml(pullsUrl)}">open PRs</a> (avoid duplicating work already in flight) or an <a href="${escapeHtml(repoUrl)}/issues">open issue</a>.</p>`;
    prSectionText = `No open PRs from @${githubLogin} in the repo right now. If you use another account, say so on Discord. Open PR queue: ${pullsUrl}`;
  } else {
    const items = openPrs
      .map(
        (pr) =>
          `<li><strong><a href="${escapeHtml(pr.htmlUrl)}">#${pr.number}</a></strong> — ${escapeHtml(pr.title)}<br/><span style="color:#444;font-size:14px;">${escapeHtml(pr.reviewSummary)}</span></li>`
      )
      .join("");
    prSectionHtml = `<p><strong>Your open PRs</strong> (check comments / CI so they can merge before <strong>${escapeHtml(cutoffLabel)}</strong>):</p><ul style="margin:8px 0;padding-left:20px;">${items}</ul>`;
    prSectionText = [
      "Your open PRs:",
      ...openPrs.map(
        (pr) =>
          `- #${pr.number} ${pr.title} — ${pr.reviewSummary} (${pr.htmlUrl})`
      ),
    ].join("\n");
  }

  const lead = `<p>Hi ${first},</p>
<p>${rankLine}</p>
<p><strong>You have about ${WAITLIST_PR_WINDOW_MINUTES} minutes</strong> — anything merged by <strong>${escapeHtml(cutoffLabel)}</strong> can still improve your waitlist ranking. After that, we’re locking in order for day-of.</p>
<p><strong>Day-of logistics:</strong></p>
<ul>
<li><strong>Arrive before 4:00 PM ET.</strong> Check in on the website to see your spot and status: <a href="${escapeHtml(signupUrl)}">${escapeHtml(signupUrl)}</a></li>
<li><strong>Need your rank or a quick sanity-check?</strong> Message me on Discord: <a href="${escapeHtml(DISCORD_INVITE_URL)}">${escapeHtml(DISCORD_INVITE_URL)}</a> (include the email you used to register if it isn’t obvious).</li>
</ul>
${prSectionHtml}
<p style="font-size:14px;color:#333;"><strong>If you have a PR open:</strong> read maintainer comments, fix CI failures, and resolve conversations so it’s merge-ready — don’t assume silence means it will land in time.</p>
<p>At <strong>4:00 PM ET</strong>, empty confirmed seats go to the waitlist in rank order. Good luck — and thank you for building with us.</p>`;

  const textRank =
    rank !== null ?
      `#${rank} on the waitlist (of ${totalOnLeaderboard}) with ${mergedPrCount} merged PRs`
    : `on the waitlist with ${mergedPrCount} merged PRs`;

  const text = [
    `Hi ${name},`,
    "",
    textRank + ".",
    "",
    `About ${WAITLIST_PR_WINDOW_MINUTES} minutes left — merges by ${cutoffLabel} can still improve your ranking.`,
    "",
    `Arrive before 4:00 PM ET. Check in / your spot: ${signupUrl}`,
    "",
    `Questions about your spot or GitHub? Discord: ${DISCORD_INVITE_URL}`,
    "",
    prSectionText,
    "",
    "If you have a PR open: read comments, fix CI, resolve threads so it can merge.",
    "",
    "At 4:00 PM ET, open seats go to the waitlist in order.",
    "",
    `Repo: ${repoUrl}`,
  ].join("\n");

  const html = emailShell(`${lead}${commonEventBlockHtml()}`);
  return { subject, html, text };
}

const RANKING_JSON_PATH = join(__dirname, "data/hack-a-sprint-2026-ranking.json");

type CorrectionRow = {
  email: string;
  name: string;
  githubLogin: string | null;
  mergedPrCount: number;
  rank: number;
  tier: "CONFIRMED" | "WAITLISTED";
};

function loadCorrectionRanking(): CorrectionRow[] {
  const data = JSON.parse(readFileSync(RANKING_JSON_PATH, "utf8")) as {
    ranking: Array<{
      rank: number;
      status: "confirmed" | "waitlisted";
      email: string;
      name: string;
      githubLogin: string | null;
      prsThruApr9: number;
      prsAllTime: number;
    }>;
    totalParticipants: number;
  };

  return data.ranking.map((r) => ({
    email: r.email,
    name: r.name,
    githubLogin: r.githubLogin,
    mergedPrCount: r.status === "confirmed" ? r.prsThruApr9 : r.prsAllTime,
    rank: r.rank,
    tier: r.status === "confirmed" ? "CONFIRMED" as const : "WAITLISTED" as const,
  }));
}

function buildCorrectionEmail(args: {
  tier: Exclude<RegistrantTier, "DECLINED">;
  name: string;
  rank: number | null;
  totalOnLeaderboard: number;
  mergedPrCount: number;
}): { subject: string; html: string; text: string } {
  const { tier, name, rank, totalOnLeaderboard, mergedPrCount } = args;
  const first = escapeHtml(name);
  const signupUrl = `${SITE_ORIGIN.replace(/\/$/, "")}${SIGNUP_PATH}`;
  const repoUrl = getGithubRepoWebBaseUrl();

  let subject: string;
  let lead: string;

  if (tier === "CONFIRMED") {
    subject = "Hack-a-Sprint April 13 — your status is CONFIRMED (#" + rank + ")";
    lead = `<p>Hi ${first},</p>
<p>We apologize for the confusion caused by our previous emails — some contained incorrect status information. <strong>Please disregard those earlier messages.</strong> This email and the website are your source of truth going forward.</p>
<p style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:12px 16px;"><strong>Your status: CONFIRMED — #${rank} of ${totalOnLeaderboard}</strong><br/>${mergedPrCount} merged PR${mergedPrCount === 1 ? "" : "s"} · reserved seat · $50 Cursor credits at check-in</p>
<p><strong>Check your live ranking anytime:</strong> <a href="${escapeHtml(signupUrl)}">${escapeHtml(signupUrl)}</a> — this is the <strong>source of truth</strong> for your status and position.</p>
<p><strong>What you need to do:</strong></p>
<ul>
<li><strong>Arrive by 4:00 PM ET on April 13.</strong> Unclaimed spots at 4:00 PM go to the waitlist.</li>
<li>Running late? Use the <strong>Day-of RSVP</strong> on the website or email roger@cursorboston.com so we hold your spot.</li>
<li>Bring your laptop, charger, and something you want to build.</li>
</ul>
<p>Can't make it? You can <strong>give up your spot</strong> on the website so the next waitlisted person gets in. Or remove yourself from <a href="${escapeHtml(LUMA_URL)}">Luma</a>.</p>`;
  } else if (tier === "WAITLISTED") {
    subject = "Hack-a-Sprint April 13 — your status is WAITLISTED (#" + rank + ")";
    lead = `<p>Hi ${first},</p>
<p>We apologize for the confusion caused by our previous emails — some contained incorrect status information. <strong>Please disregard those earlier messages.</strong> This email and the website are your source of truth going forward.</p>
<p style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;"><strong>Your status: WAITLISTED — #${rank} of ${totalOnLeaderboard}</strong><br/>${mergedPrCount} merged PR${mergedPrCount === 1 ? "" : "s"} · top ${CURSOR_CREDIT_TOP_N} are confirmed</p>
<p><strong>Check your live ranking anytime:</strong> <a href="${escapeHtml(signupUrl)}">${escapeHtml(signupUrl)}</a> — this is the <strong>source of truth</strong> for your status and position. Rankings update in real time.</p>
<p><strong>How to move up:</strong> Merge PRs to <a href="${escapeHtml(repoUrl)}">${escapeHtml(repoUrl)}</a> — documentation, bug fixes, and features all count. As confirmed participants drop out or give up their spot, waitlisted builders move in by rank order.</p>
${openIssuesHtml()}
<p><strong>Day of (April 13):</strong> At 4:00 PM ET, unclaimed confirmed spots go to waitlisters in rank order. If you want a chance, be nearby and watch the website or your email around 4:00 PM.</p>
<p>Not coming? Please remove yourself from <a href="${escapeHtml(LUMA_URL)}">Luma</a> so others can move up.</p>`;
  } else {
    subject = "Hack-a-Sprint April 13 — complete your registration";
    lead = `<p>Hi ${first},</p>
<p>We apologize for the confusion caused by our previous emails. <strong>Please disregard those earlier messages.</strong></p>
<p>You're registered on Luma but not yet on the website leaderboard. To see your ranking and status, complete your registration:</p>
<ol>
<li>Create an account at <a href="${escapeHtml(SITE_ORIGIN)}">cursorboston.com</a> (use this same email if possible).</li>
<li>Connect <strong>GitHub</strong> and <strong>Discord</strong> on your profile.</li>
<li>Go to <a href="${escapeHtml(signupUrl)}">${escapeHtml(signupUrl)}</a> and <strong>claim your spot</strong>.</li>
</ol>
<p>The website is the <strong>source of truth</strong> for rankings. Top ${CURSOR_CREDIT_TOP_N} are confirmed; everyone else is waitlisted. Merge PRs to <a href="${escapeHtml(repoUrl)}">${escapeHtml(repoUrl)}</a> to move up.</p>`;
  }

  const html = emailShell(`${lead}${commonEventBlockHtml()}`);

  const textParts = [
    `Hi ${name},`,
    "",
    "We apologize for the confusion from our previous emails — some had incorrect status info. Please disregard those. This email and the website are your source of truth.",
    "",
    tier === "CONFIRMED" ?
      `YOUR STATUS: CONFIRMED — #${rank} of ${totalOnLeaderboard}. Reserved seat, $50 Cursor credits at check-in. Arrive by 4:00 PM ET April 13. Can't make it? Give up your spot on the website.`
    : tier === "WAITLISTED" ?
      `YOUR STATUS: WAITLISTED — #${rank} of ${totalOnLeaderboard}. Top ${CURSOR_CREDIT_TOP_N} are confirmed. Merge PRs to ${repoUrl} to move up. Day-of: unclaimed spots go to waitlist at 4:00 PM ET.\n\n${openIssuesText()}`
    : `Complete your registration at ${signupUrl} to see your ranking.`,
    "",
    `Live rankings (source of truth): ${signupUrl}`,
    `Event: April 13, 2026 4–8 PM ET, Back Bay Boston. Luma: ${LUMA_URL}`,
  ];

  return { subject, html, text: textParts.join("\n") };
}

function parseArgs(argv: string[]) {
  const dryRun = argv.includes("--dry-run");
  const send = argv.includes("--send");
  const announceList = argv.includes("--announce-list");
  const reminder = argv.includes("--reminder");
  const correction = argv.includes("--correction");
  const csvIdx = argv.indexOf("--csv");
  const csvPath =
    csvIdx >= 0 && argv[csvIdx + 1] ?
      argv[csvIdx + 1]!
    : join(
        homedir(),
        "Downloads",
        "Cursor Boston Hack-a-Sprint - Guests - 2026-04-13-14-12-00.csv"
      );

  if ((dryRun && send) || (!dryRun && !send)) {
    console.error("Specify exactly one of: --dry-run | --send");
    process.exit(1);
  }
  const dayof = argv.includes("--dayof");
  const waitlistPrDeadline = argv.includes("--waitlist-pr-deadline");
  const confirmedArrivalReminder = argv.includes("--confirmed-arrival-reminder");
  const listIsSet = argv.includes("--list-is-set");
  const modeCount =
    [
      announceList,
      reminder,
      correction,
      dayof,
      waitlistPrDeadline,
      confirmedArrivalReminder,
      listIsSet,
    ].filter(Boolean).length;
  if (modeCount > 1) {
    console.error(
      "Use only one of: --announce-list | --reminder | --correction | --dayof | --waitlist-pr-deadline | --confirmed-arrival-reminder | --list-is-set"
    );
    process.exit(1);
  }
  return {
    dryRun,
    send,
    announceList,
    reminder,
    correction,
    dayof,
    waitlistPrDeadline,
    confirmedArrivalReminder,
    listIsSet,
    csvPath,
  };
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const {
    dryRun,
    send,
    announceList,
    reminder,
    correction,
    dayof,
    waitlistPrDeadline,
    confirmedArrivalReminder,
    listIsSet,
    csvPath,
  } = parseArgs(process.argv.slice(2));

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

  const csvRows = parseCsv(raw);
  if (csvRows.length === 0) {
    console.error("No data rows in CSV.");
    process.exit(1);
  }

  console.log(`Loaded ${csvRows.length} rows from ${csvPath}`);

  if (correction) {
    console.log(`Loading ranking from ${RANKING_JSON_PATH}…`);
    const ranked = loadCorrectionRanking();
    const confirmedCount = ranked.filter((r) => r.tier === "CONFIRMED").length;
    const waitlistedCount = ranked.filter((r) => r.tier === "WAITLISTED").length;
    console.log(`\nCorrection ranking: ${ranked.length} participants (${confirmedCount} confirmed, ${waitlistedCount} waitlisted)`);

    const pad = (s: string, n: number) => s.slice(0, n).padEnd(n);
    for (const r of ranked) {
      console.log(
        [
          pad(`#${r.rank}`, 5),
          pad(r.tier, 12),
          pad(r.email, 42),
          `pr=${r.mergedPrCount}`,
          r.githubLogin ? `@${r.githubLogin}` : "—",
        ].join("  ")
      );
    }

    if (dryRun) {
      console.log("\n--dry-run --correction: no emails sent. Preview:");
      const sampleConfirmed = ranked.find((r) => r.tier === "CONFIRMED");
      const sampleWaitlisted = ranked.find((r) => r.tier === "WAITLISTED");
      for (const sample of [sampleConfirmed, sampleWaitlisted]) {
        if (!sample) continue;
        const { subject, html } = buildCorrectionEmail({
          tier: sample.tier,
          name: sample.name,
          rank: sample.rank,
          totalOnLeaderboard: ranked.length,
          mergedPrCount: sample.mergedPrCount,
        });
        console.log(`\n[${sample.tier}] Subject: ${subject}`);
        console.log("HTML preview:\n---\n" + html.slice(0, 700) + "…\n---");
      }
      return;
    }

    let sent = 0;
    let failed = 0;
    for (const r of ranked) {
      const { subject, html, text } = buildCorrectionEmail({
        tier: r.tier,
        name: r.name,
        rank: r.rank,
        totalOnLeaderboard: ranked.length,
        mergedPrCount: r.mergedPrCount,
      });
      try {
        await sendEmail({ to: r.email, subject, html, text });
        sent++;
        console.log(`Sent: ${r.email} (${r.tier} #${r.rank})`);
      } catch (e) {
        failed++;
        console.error(`Failed: ${r.email}`, e);
      }
      await sleep(450);
    }
    console.log(`\nDone. Sent ${sent}, failed ${failed}.`);
    return;
  }

  const db = getAdminDb();
  if (!db) {
    console.error("Firebase Admin not configured (FIREBASE_SERVICE_ACCOUNT_JSON / GOOGLE_APPLICATION_CREDENTIALS).");
    process.exit(1);
  }

  if (!process.env.GITHUB_TOKEN?.trim()) {
    console.warn(
      "[warn] GITHUB_TOKEN is not set — GitHub Search may return 403; merged PR counts use Firestore where possible."
    );
  }

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
  const { prByUserId, entries } = await buildLeaderboard(db, githubBulk);

  console.log("Building unified display ranks (matches signup page ordering)…");
  const {
    rankByUserId: displayRankByUserId,
    rankByEmail: displayRankByEmail,
    totalEntries: totalOnPublicList,
  } = await buildUnifiedDisplayRankMaps(db);
  const signupConfirmedByUserId = await buildSignupConfirmedByUserId(db);
  const lumaConfirmedByEmail = await buildLumaConfirmedByEmail(db);

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
    /** Resolved GitHub login (CSV or profile); null if unknown. */
    githubLogin: string | null;
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
        githubLogin: null,
      });
      continue;
    }

    const { uid, method } = await resolveUserIdForRow(db, normalizedEmail, csvGithub);

    let tier: RegistrantTier;
    let rank: number | null = null;
    let mergedPr = 0;
    let profileBlock: string | null = null;
    let githubLoginForRow: string | null = csvGithub;

    if (!uid) {
      const lumaRank = displayRankByEmail.get(normalizedEmail);
      mergedPr = mergedPrForLogin(csvGithub, githubBulk);
      if (lumaRank === undefined) {
        tier = "NO_SITE_ACCOUNT";
      } else {
        rank = lumaRank;
        tier = lumaConfirmedByEmail.get(normalizedEmail) ? "CONFIRMED" : "WAITLISTED";
      }
    } else {
      const userSnap = await db.collection("users").doc(uid).get();
      const p = userSnap.data();
      const profLogin =
        p?.github && typeof p.github === "object" ?
          (p.github as { login?: string }).login
        : undefined;
      const resolvedGithub =
        csvGithub ||
        (typeof profLogin === "string" ? profLogin.trim() : null);
      githubLoginForRow = resolvedGithub;

      mergedPr = prByUserId.get(uid) ?? 0;
      const dispRank =
        displayRankByUserId.get(uid) ?? displayRankByEmail.get(normalizedEmail);

      if (dispRank !== undefined) {
        rank = dispRank;
        const confirmed =
          !!signupConfirmedByUserId.get(uid) ||
          !!lumaConfirmedByEmail.get(normalizedEmail);
        tier = confirmed ? "CONFIRMED" : "WAITLISTED";
        if (!prByUserId.has(uid)) {
          mergedPr = mergedPrForLogin(resolvedGithub, githubBulk);
        }
      } else {
        tier = "SIGNED_UP_NO_SPOT";
        profileBlock = getHackathonEventSignupBlockReason(p);
        mergedPr = mergedPrForLogin(resolvedGithub, githubBulk);
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
      githubLogin: githubLoginForRow,
    });
  }

  const counts: Record<string, number> = {};
  for (const r of results) {
    counts[r.tier] = (counts[r.tier] ?? 0) + 1;
  }
  console.log("\nSummary by tier:", counts);
  console.log(
    `Public list size (website + Luma, deduped): ${totalOnPublicList}; website signups only: ${entries.length}\n`
  );

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

  let openPrByAuthor: Map<string, OpenPrWithReviewSummary[]> | null = null;
  if (waitlistPrDeadline) {
    if (!process.env.GITHUB_TOKEN?.trim()) {
      console.warn(
        "[warn] GITHUB_TOKEN is not set — open PR / review lookup may fail or rate-limit; set it for reliable per-recipient status."
      );
    }
    const loginSet = new Set<string>();
    for (const r of results) {
      if (r.tier !== "WAITLISTED") continue;
      const lg = r.githubLogin?.trim();
      if (lg) loginSet.add(lg.toLowerCase());
    }
    console.log(
      `\n--waitlist-pr-deadline: fetching open PRs + review state for ${loginSet.size} GitHub logins…`
    );
    openPrByAuthor = await fetchOpenPrsWithReviewStatusForAuthors(loginSet);
    const withOpen = [...openPrByAuthor.values()].filter((a) => a.length > 0).length;
    console.log(
      `Open PR lookup: ${withOpen} waitlist author(s) with at least one open PR in ${getGithubRepoWebBaseUrl()}.`
    );
    for (const r of results) {
      if (r.tier !== "WAITLISTED") continue;
      const lg = r.githubLogin?.trim().toLowerCase() ?? "";
      const prs = lg ? (openPrByAuthor.get(lg) ?? []) : [];
      console.log(
        `  ${pad(r.email, 38)} @${pad(r.githubLogin ?? "—", 22)} openPRs=${prs.length}${prs.length ? ` (${prs.map((p) => "#" + p.number).join(", ")})` : ""}`
      );
    }
  }

  if (dryRun) {
    console.log("\n--dry-run: no emails sent. Review the table above.");
    if (announceList) console.log("(--announce-list mode: simplified participant-list email)");
    if (reminder) console.log("(--reminder mode: day-before blast)");
    if (correction) console.log("(--correction mode: status correction email)");
    if (dayof) console.log("(--dayof mode: event-day blast)");
    if (waitlistPrDeadline) console.log("(--waitlist-pr-deadline: waitlisted only)");
    if (confirmedArrivalReminder) console.log("(--confirmed-arrival-reminder: confirmed only)");
    if (listIsSet) console.log("(--list-is-set: all non-declined; body identical except name)");
    const pickSample = (t: RegistrantTier) => results.find((x) => x.tier === t && x.tier !== "DECLINED");

    if (listIsSet) {
      const sample = results.find((r) => r.tier !== "DECLINED");
      if (sample) {
        const { subject, html } = buildListIsSetEmail(sample.name);
        console.log(`\n[list-is-set sample: ${sample.email}] Subject: ${subject}`);
        console.log("Sample HTML preview:\n---\n" + html.slice(0, 1100) + "…\n---");
      } else {
        console.log("\nNo non-declined rows to preview.");
      }
      return;
    }

    if (confirmedArrivalReminder) {
      const sample = results.find((r) => r.tier === "CONFIRMED");
      if (sample) {
        const { subject, html } = buildConfirmedArrivalReminderEmail({
          name: sample.name,
          rank: sample.rank,
          totalOnLeaderboard: totalOnPublicList,
          mergedPrCount: sample.mergedPrCount,
        });
        console.log(`\n[CONFIRMED sample: ${sample.email}] Subject: ${subject}`);
        console.log("Sample HTML preview:\n---\n" + html.slice(0, 900) + "…\n---");
      } else {
        console.log("\nNo CONFIRMED rows to preview.");
      }
      return;
    }

    if (waitlistPrDeadline) {
      const waiters = results.filter((r) => r.tier === "WAITLISTED");
      const withPrs = waiters.filter(
        (r) => (openPrByAuthor?.get(r.githubLogin?.trim().toLowerCase() ?? "") ?? []).length > 0
      );
      const withoutPrs = waiters.filter(
        (r) => (openPrByAuthor?.get(r.githubLogin?.trim().toLowerCase() ?? "") ?? []).length === 0
      );
      const samples = [
        withPrs[0],
        withoutPrs.find((r) => r.githubLogin?.trim()),
        withoutPrs.find((r) => !r.githubLogin?.trim()),
      ].filter(Boolean) as RowResult[];
      for (const sample of samples) {
        if (!sample) continue;
        const lg = sample.githubLogin?.trim().toLowerCase() ?? "";
        const openPrs =
          sample.githubLogin?.trim() ? (openPrByAuthor?.get(lg) ?? []) : undefined;
        const { subject, html } = buildWaitlistPrDeadlineEmail({
          name: sample.name,
          rank: sample.rank,
          totalOnLeaderboard: totalOnPublicList,
          mergedPrCount: sample.mergedPrCount,
          githubLogin: sample.githubLogin,
          openPrs,
          cutoffLabel: WAITLIST_PR_CUTOFF_LABEL,
        });
        console.log(`\n[WAITLISTED sample: ${sample.email}] Subject: ${subject}`);
        console.log("Sample HTML preview:\n---\n" + html.slice(0, 900) + "…\n---");
      }
      return;
    }

    if (reminder || correction || dayof) {
      const previewTiers: RegistrantTier[] = [
        "CONFIRMED",
        "WAITLISTED",
        "SIGNED_UP_NO_SPOT",
        "NO_SITE_ACCOUNT",
      ];
      for (const tier of previewTiers) {
        const sample = pickSample(tier);
        if (!sample) continue;
        const t = sample.tier as Exclude<RegistrantTier, "DECLINED">;
        const emailArgs = {
          tier: t,
          name: sample.name,
          rank: sample.rank,
          totalOnLeaderboard: totalOnPublicList,
          mergedPrCount: sample.mergedPrCount,
          profileBlockReason: sample.profileBlock,
          csvSelfReportedPr: sample.csvSelfReportedPr,
        };
        const { subject, html } =
          correction ? buildCorrectionEmail(emailArgs)
          : dayof ? buildDayOfEmail(emailArgs)
          : buildReminderEmail(emailArgs);
        console.log(`\n[${tier}] Sample subject: ${subject}`);
        console.log("Sample HTML preview:\n---\n" + html.slice(0, 700) + "…\n---");
      }
      return;
    }

    const sample = results.find((x) => x.tier === "CONFIRMED") || results.find((x) => x.tier !== "DECLINED");
    if (sample && sample.tier !== "DECLINED") {
      const tier = sample.tier as Exclude<RegistrantTier, "DECLINED">;
      const { subject, html } = announceList
        ? buildListAnnouncementEmail({
            tier,
            name: sample.name,
            rank: sample.rank,
            totalOnLeaderboard: totalOnPublicList,
            mergedPrCount: sample.mergedPrCount,
          })
        : buildEmails({
            tier,
            name: sample.name,
            rank: sample.rank,
            totalOnLeaderboard: totalOnPublicList,
            mergedPrCount: sample.mergedPrCount,
            profileBlockReason: sample.profileBlock,
            csvSelfReportedPr: sample.csvSelfReportedPr,
          });
      console.log(`\nSample subject: ${subject}`);
      console.log("\nSample HTML preview (first non-declined row):\n---\n" + html.slice(0, 800) + "…\n---");
    }
    return;
  }

  let sent = 0;
  let failed = 0;
  let skippedNonWaitlist = 0;
  let skippedNonConfirmed = 0;
  for (const r of results) {
    if (listIsSet) {
      if (r.tier === "DECLINED") continue;
      const { subject, html, text } = buildListIsSetEmail(r.name);
      try {
        await sendEmail({ to: r.email, subject, html, text });
        sent++;
        console.log(`Sent: ${r.email} (list-is-set)`);
      } catch (e) {
        failed++;
        console.error(`Failed: ${r.email}`, e);
      }
      await sleep(450);
      continue;
    }

    if (confirmedArrivalReminder) {
      if (r.tier !== "CONFIRMED") {
        skippedNonConfirmed++;
        continue;
      }
      const { subject, html, text } = buildConfirmedArrivalReminderEmail({
        name: r.name,
        rank: r.rank,
        totalOnLeaderboard: totalOnPublicList,
        mergedPrCount: r.mergedPrCount,
      });
      try {
        await sendEmail({ to: r.email, subject, html, text });
        sent++;
        console.log(`Sent: ${r.email} (CONFIRMED)`);
      } catch (e) {
        failed++;
        console.error(`Failed: ${r.email}`, e);
      }
      await sleep(450);
      continue;
    }

    if (waitlistPrDeadline) {
      if (r.tier !== "WAITLISTED") {
        skippedNonWaitlist++;
        continue;
      }
      const lg = r.githubLogin?.trim().toLowerCase() ?? "";
      const openPrs =
        r.githubLogin?.trim() ? (openPrByAuthor?.get(lg) ?? []) : undefined;
      const { subject, html, text } = buildWaitlistPrDeadlineEmail({
        name: r.name,
        rank: r.rank,
        totalOnLeaderboard: totalOnPublicList,
        mergedPrCount: r.mergedPrCount,
        githubLogin: r.githubLogin,
        openPrs,
        cutoffLabel: WAITLIST_PR_CUTOFF_LABEL,
      });
      try {
        await sendEmail({ to: r.email, subject, html, text });
        sent++;
        console.log(`Sent: ${r.email} (WAITLISTED)`);
      } catch (e) {
        failed++;
        console.error(`Failed: ${r.email}`, e);
      }
      await sleep(450);
      continue;
    }

    if (r.tier === "DECLINED") continue;
    const tier = r.tier as Exclude<RegistrantTier, "DECLINED">;
    const emailArgs = {
      tier,
      name: r.name,
      rank: r.rank,
      totalOnLeaderboard: totalOnPublicList,
      mergedPrCount: r.mergedPrCount,
      profileBlockReason: r.profileBlock,
      csvSelfReportedPr: r.csvSelfReportedPr ?? "",
    };
    const { subject, html, text } = correction
      ? buildCorrectionEmail(emailArgs)
      : reminder
        ? buildReminderEmail(emailArgs)
        : dayof
          ? buildDayOfEmail(emailArgs)
          : announceList
            ? buildListAnnouncementEmail({
                tier,
                name: r.name,
                rank: r.rank,
                totalOnLeaderboard: totalOnPublicList,
                mergedPrCount: r.mergedPrCount,
              })
            : buildEmails(emailArgs);
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
  if (listIsSet) {
    console.log(
      `\nDone. Sent ${sent}, failed ${failed}, skipped declined ${counts["DECLINED"] ?? 0}.`
    );
  } else if (confirmedArrivalReminder) {
    console.log(
      `\nDone. Sent ${sent}, failed ${failed}, skipped non-confirmed ${skippedNonConfirmed} (waitlist / incomplete / no-account / declined).`
    );
  } else if (waitlistPrDeadline) {
    console.log(
      `\nDone. Sent ${sent}, failed ${failed}, skipped non-waitlist ${skippedNonWaitlist} (confirmed / incomplete / no-account / declined).`
    );
  } else {
    console.log(`\nDone. Sent ${sent}, failed ${failed}, skipped declined ${counts["DECLINED"] ?? 0}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
