#!/usr/bin/env node
/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Sports Hack 2026 — distribute Cursor credit links to credit-eligible
 * attendees.
 *
 * Eligibility is computed by the three-tier ranking model
 * (lib/hackathon-leaderboard-snapshot.ts): top SPORTS_HACK_2026_CAPACITY
 * (119) by rank, gated on `hasSubmission` (a PR was opened against the
 * sports-hack-2026-submissions branch). The snapshot is already in tier
 * order (Tier A > B > C, PR count desc within each), so this script just
 * filters by the precomputed flags — no re-sort, no second source of truth.
 *
 * Usage:
 *   # Print ranked credit-eligible list (no emails, no credit assignment)
 *   npx tsx scripts/distribute-sports-hack-2026-credits.ts --dry-run
 *
 *   # Preview emails with credit links (no send)
 *   npx tsx scripts/distribute-sports-hack-2026-credits.ts --dry-run --credits credits.json
 *
 *   # Send credit emails
 *   npx tsx scripts/distribute-sports-hack-2026-credits.ts --send --credits credits.json
 *
 * `credits.json` format: flat array of redemption URL strings, assigned by
 * rank order to credit-eligible entries:
 *   ["https://cursor.com/redeem/abc", "https://cursor.com/redeem/def", ...]
 *
 * Requires: FIREBASE_SERVICE_ACCOUNT_JSON; for --send: MAILGUN_API_KEY,
 * MAILGUN_DOMAIN. UNSUBSCRIBE_SECRET required since 2026-05-22 to mint
 * unsubscribe tokens.
 */
import { readFileSync } from "fs";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { getAdminDb } from "../lib/firebase-admin";
import {
  SPORTS_HACK_2026_CAPACITY,
  SPORTS_HACK_2026_EVENT_ID,
  SPORTS_HACK_2026_NAME,
} from "../lib/sports-hack-2026";
import {
  getSnapshotOrRefresh,
  type LeaderboardEntry,
} from "../lib/hackathon-leaderboard-snapshot";
import { sendEmail } from "../lib/mailgun";
import { buildUnsubscribeUrl } from "../lib/unsubscribe-token";

const SITE_ORIGIN = process.env.NEXT_PUBLIC_APP_URL || "https://cursorboston.com";
const CREDIT_AMOUNT = "$50";
const FROM_ADDRESS = "Roger <roger@cursorboston.com>";
const SUBMISSIONS_PAGE_URL = `${SITE_ORIGIN.replace(/\/$/, "")}/events/cursor-boston-sports-hack-2026`;

interface RankedEntry {
  rank: number;
  userId: string | null;
  githubLogin: string | null;
  displayName: string | null;
  email: string | null;
  mergedPrCount: number;
  tier: "A" | "B" | "C" | null;
  hasSubmission: boolean;
  inCreditBand: boolean;
  creditUrl: string | null;
}

function parseArgs(argv: string[]) {
  const dryRun = argv.includes("--dry-run");
  const send = argv.includes("--send");
  const creditsIdx = argv.indexOf("--credits");
  const creditsPath = creditsIdx >= 0 ? argv[creditsIdx + 1] ?? null : null;

  if ((dryRun && send) || (!dryRun && !send)) {
    console.error("Specify exactly one of: --dry-run | --send");
    process.exit(1);
  }
  return { dryRun, send, creditsPath };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function resolveEmailsForEntries(
  db: FirebaseFirestore.Firestore,
  entries: LeaderboardEntry[],
): Promise<Map<string, { email: string | null; displayName: string | null }>> {
  // Two lookup paths:
  //   1. userId !== null → users/{userId}.email (Tier A and Tier B)
  //   2. userId === null + githubLogin → reverse-lookup users by github.login
  //      (covers Tier C registrants who have a Cursor Boston account but
  //      never claimed a website spot — rare but possible)
  // The returned map is keyed by a row identifier so we can attach the
  // result to the right RankedEntry without re-doing the lookup.
  const out = new Map<string, { email: string | null; displayName: string | null }>();

  const userIds = entries.map((e) => e.userId).filter((u): u is string => Boolean(u));
  if (userIds.length > 0) {
    // getAll batches in groups of 500; userIds < 119 always so one call.
    const refs = userIds.map((id) => db.collection("users").doc(id));
    const snaps = await db.getAll(...refs);
    for (const snap of snaps) {
      if (!snap.exists) continue;
      const d = snap.data() ?? {};
      out.set(`uid:${snap.id}`, {
        email: typeof d.email === "string" ? d.email : null,
        displayName: typeof d.displayName === "string" ? d.displayName : null,
      });
    }
  }

  const orphanLogins = entries
    .filter((e) => !e.userId && e.githubLogin)
    .map((e) => e.githubLogin!.toLowerCase());
  if (orphanLogins.length > 0) {
    // One full pass over users to build a login → uid map. This is the only
    // path that scans the whole collection — kept off the hot path above.
    const userSnap = await db.collection("users").get();
    for (const doc of userSnap.docs) {
      const d = doc.data();
      const gh =
        d.github && typeof d.github === "object"
          ? (d.github as { login?: string }).login
          : undefined;
      if (typeof gh === "string" && orphanLogins.includes(gh.toLowerCase())) {
        out.set(`login:${gh.toLowerCase()}`, {
          email: typeof d.email === "string" ? d.email : null,
          displayName: typeof d.displayName === "string" ? d.displayName : null,
        });
      }
    }
  }

  return out;
}

function buildCreditEmail(entry: RankedEntry): {
  subject: string;
  html: string;
  text: string;
} {
  const name = escapeHtml(entry.displayName || entry.githubLogin || "there");
  const firstNameText =
    (entry.displayName || entry.githubLogin || "there").split(/\s+/)[0] ?? "there";
  const creditLink = escapeHtml(entry.creditUrl!);
  const unsubUrl = entry.email ? buildUnsubscribeUrl(entry.email) : "";

  const subject = `Your Cursor credit — ${SPORTS_HACK_2026_NAME} (rank #${entry.rank})`;

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:640px;">
<p>Hi ${name},</p>

<p>Thanks for building with us at the <strong>${escapeHtml(SPORTS_HACK_2026_NAME)}</strong>! You landed at <strong>rank #${entry.rank}</strong> in the credit band${entry.mergedPrCount > 0 ? ` (${entry.mergedPrCount} merged PR${entry.mergedPrCount !== 1 ? "s" : ""} to cursor-boston)` : ""}, and your submission PR was open at the deadline, so you've earned a <strong>${CREDIT_AMOUNT} Cursor credit</strong>.</p>

<p><strong>Redeem your credit here:</strong></p>
<p><a href="${creditLink}" style="display:inline-block;margin:8px 0;padding:12px 22px;background:#10b981;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">${creditLink}</a></p>

<p>Public submission board: <a href="${escapeHtml(SUBMISSIONS_PAGE_URL)}">${escapeHtml(SUBMISSIONS_PAGE_URL)}</a></p>

<p>Reply if anything's off, or to share what you built.</p>

<p>— Roger<br/>
<a href="mailto:roger@cursorboston.com">roger@cursorboston.com</a></p>

${
  unsubUrl
    ? `<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#888;">
You&apos;re receiving this because you participated in the Cursor Boston Sports Hack on May 26.<br/>
<a href="${escapeHtml(unsubUrl)}" style="color:#888;">Unsubscribe from emails</a>
</p>`
    : ""
}
</body></html>`;

  const text = `Hi ${firstNameText},

Thanks for building with us at the ${SPORTS_HACK_2026_NAME}! You landed at rank #${entry.rank} in the credit band${entry.mergedPrCount > 0 ? ` (${entry.mergedPrCount} merged PR${entry.mergedPrCount !== 1 ? "s" : ""} to cursor-boston)` : ""}, and your submission PR was open at the deadline, so you've earned a ${CREDIT_AMOUNT} Cursor credit.

Redeem your credit here:
${entry.creditUrl}

Public submission board: ${SUBMISSIONS_PAGE_URL}

Reply if anything's off, or to share what you built.

— Roger
roger@cursorboston.com
${unsubUrl ? `\n---\nYou're receiving this because you participated in the Cursor Boston Sports Hack on May 26.\nUnsubscribe: ${unsubUrl}\n` : ""}`;

  return { subject, html, text };
}

async function main(): Promise<void> {
  const { dryRun, send, creditsPath } = parseArgs(process.argv.slice(2));

  if (send) {
    if (!process.env.MAILGUN_API_KEY || !process.env.MAILGUN_DOMAIN) {
      console.error("For --send, set MAILGUN_API_KEY and MAILGUN_DOMAIN.");
      process.exit(1);
    }
  }

  const db = getAdminDb();
  if (!db) {
    console.error(
      "Firebase Admin not configured (FIREBASE_SERVICE_ACCOUNT_JSON / GOOGLE_APPLICATION_CREDENTIALS).",
    );
    process.exit(1);
  }

  let creditUrls: string[] = [];
  if (creditsPath) {
    try {
      const raw = readFileSync(creditsPath, "utf8");
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.some((x) => typeof x !== "string")) {
        console.error("Credits file must be a JSON array of URL strings.");
        process.exit(1);
      }
      creditUrls = parsed as string[];
      console.log(`Loaded ${creditUrls.length} credit link(s) from ${creditsPath}`);
    } catch (e) {
      console.error(`Cannot read credits file: ${creditsPath}`, e);
      process.exit(1);
    }
  }

  console.log(`Refreshing ${SPORTS_HACK_2026_EVENT_ID} snapshot…`);
  const snapshot = await getSnapshotOrRefresh(SPORTS_HACK_2026_EVENT_ID);
  console.log(`Snapshot has ${snapshot.entries.length} entries (generated ${snapshot.generatedAt}).`);

  // Take the credit band (top SPORTS_HACK_2026_CAPACITY by rank), then filter
  // to entries that have an open submission PR. This is the same filter the
  // public page renders for "Credit seats locked X/119".
  const creditBand = snapshot.entries
    .filter((e) => e.inCreditBand)
    .slice(0, SPORTS_HACK_2026_CAPACITY);
  const eligible = creditBand.filter((e) => e.hasSubmission);
  const missingSubmission = creditBand.filter((e) => !e.hasSubmission);

  console.log(`In credit band (top ${SPORTS_HACK_2026_CAPACITY}): ${creditBand.length}`);
  console.log(`  Credit-eligible (in band + submission opened): ${eligible.length}`);
  console.log(`  In band, no submission opened:                ${missingSubmission.length}`);

  // Resolve emails for the eligible set. Two paths (uid lookup primary,
  // login lookup fallback for Tier C orphans).
  const emailMap = await resolveEmailsForEntries(db, eligible);

  let creditIdx = 0;
  const ranked: RankedEntry[] = eligible.map((e) => {
    const profile =
      e.userId != null
        ? emailMap.get(`uid:${e.userId}`)
        : e.githubLogin
          ? emailMap.get(`login:${e.githubLogin.toLowerCase()}`)
          : undefined;
    const creditUrl = creditIdx < creditUrls.length ? creditUrls[creditIdx]! : null;
    if (creditUrl) creditIdx++;
    return {
      rank: e.rank,
      userId: e.userId,
      githubLogin: e.githubLogin,
      displayName: profile?.displayName ?? e.displayName,
      email: profile?.email ?? null,
      mergedPrCount: e.mergedPrCount,
      tier: e.tier ?? null,
      hasSubmission: e.hasSubmission,
      inCreditBand: e.inCreditBand,
      creditUrl,
    };
  });

  // Print the assignment table.
  const pad = (s: string, n: number) => s.slice(0, n).padEnd(n);
  console.log(
    `\n${pad("Rank", 6)} ${pad("Tier", 5)} ${pad("Login", 22)} ${pad("PRs", 4)} ${pad("Email", 32)} ${pad("Credit", 12)}`,
  );
  console.log("-".repeat(90));
  for (const r of ranked) {
    console.log(
      `${pad(`#${r.rank}`, 6)} ${pad(r.tier ?? "—", 5)} ${pad(r.githubLogin ?? "—", 22)} ${pad(String(r.mergedPrCount), 4)} ${pad(r.email ?? "—", 32)} ${pad(r.creditUrl ? "ASSIGNED" : "—", 12)}`,
    );
  }

  if (missingSubmission.length > 0) {
    console.log(
      `\n[info] ${missingSubmission.length} attendee(s) in the credit band did NOT open a submission PR — they forfeit the credit slot:`,
    );
    for (const e of missingSubmission) {
      console.log(`  #${e.rank} ${e.tier ?? "—"} @${e.githubLogin ?? "(no github)"} — ${e.displayName ?? "(no display name)"}`);
    }
  }

  if (!creditsPath) {
    console.log(
      `\nRanked credit-eligible list exported. Run with --credits <file.json> to pair with redemption URLs.`,
    );
    return;
  }

  if (creditUrls.length < ranked.length) {
    console.warn(
      `\n[warn] Only ${creditUrls.length} credit link(s) for ${ranked.length} credit-eligible attendee(s). The last ${ranked.length - creditUrls.length} won't get one.`,
    );
  }

  const toSend = ranked.filter((r) => r.email && r.creditUrl);
  const noEmail = ranked.filter((r) => !r.email && r.creditUrl);

  if (noEmail.length > 0) {
    console.warn(`\n[warn] ${noEmail.length} ranked credit-eligible attendee(s) have no resolvable email:`);
    for (const r of noEmail) {
      console.warn(`  #${r.rank} @${r.githubLogin ?? "(no github)"} — no matching users/{uid}.email or github-login match`);
    }
  }

  console.log(`\nWill send ${toSend.length} email(s).`);

  if (dryRun) {
    const sample = toSend[0];
    if (sample) {
      const { subject, html, text } = buildCreditEmail(sample);
      console.log(`\nSample email to: ${sample.email}`);
      console.log(`Subject: ${subject}`);
      console.log("\n--- HTML (first 800 chars) ---");
      console.log(html.slice(0, 800));
      console.log("\n--- Text ---");
      console.log(text);
    }
    console.log("\n--dry-run: no emails sent.");
    return;
  }

  let sent = 0;
  let failed = 0;
  for (const r of toSend) {
    const { subject, html, text } = buildCreditEmail(r);
    try {
      await sendEmail({
        from: FROM_ADDRESS,
        to: r.email!,
        subject,
        html,
        text,
      });
      sent++;
      console.log(`  [ok] #${r.rank} @${r.githubLogin ?? "—"} → ${r.email}`);
    } catch (e) {
      failed++;
      console.error(`  [fail] #${r.rank} ${r.email}`, e);
    }
    await sleep(450);
  }

  console.log(`\nDone. Sent ${sent}, failed ${failed}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
