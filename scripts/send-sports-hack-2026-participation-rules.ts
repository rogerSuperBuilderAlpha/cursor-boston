#!/usr/bin/env node
/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Closing-comms blast to everyone on the May 26 list (Sports Hack 2026):
 *
 *   1. "See you Tuesday" — event reminder.
 *   2. How to claim a Cursor credit — claim spot on signup page, climb into
 *      top 119 via merged PRs to the community repo.
 *   3. How to win the hackathon — PR a meta.json into
 *      `sports-hack-2026-submissions` with video + repo + deployed URL +
 *      description. Hard deadline 4 PM ET. Late = judges-only.
 *   4. Link to the public submissions board.
 *
 * Recipient set mirrors `scripts/send-may26-attendee-action-prompts.ts`:
 * union of website signups + Luma-only minus judges/declined/unsubscribed,
 * deduped by email + matching GitHub login.
 *
 * Idempotent via `sportsHack2026ParticipationRulesEmailedAt` stamped on:
 *   - `hackathonEventSignups/{id}` for website signups
 *   - `hackathonLumaRegistrants/{id}` for Luma-only attendees
 * Pass `--force` to re-send; `--only-email=foo@bar` to restrict to one.
 *
 * Usage:
 *   npx tsx scripts/send-sports-hack-2026-participation-rules.ts --dry-run
 *   npx tsx scripts/send-sports-hack-2026-participation-rules.ts --send --only-email=rhunt@bentley.edu
 *   npx tsx scripts/send-sports-hack-2026-participation-rules.ts --send
 *   npx tsx scripts/send-sports-hack-2026-participation-rules.ts --send --force
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "../lib/firebase-admin";
import { sendEmail } from "../lib/mailgun";
import { syncMailgunSuppressions } from "../lib/mailgun-suppressions";
import { buildUnsubscribeUrl } from "../lib/unsubscribe-token";
import {
  getDeclinedEmailsForEvent,
  getJudgeEmailsForEvent,
} from "../lib/hackathon-event-signup";
import {
  SPORTS_HACK_2026_CAPACITY,
  SPORTS_HACK_2026_EVENT_ID,
  SPORTS_HACK_2026_NAME,
} from "../lib/sports-hack-2026";

const EVENT_ID = SPORTS_HACK_2026_EVENT_ID;
const STAMP_FIELD = "sportsHack2026ParticipationRulesEmailedAt";

const SIGNUP_URL = `https://cursorboston.com/hackathons/${EVENT_ID}/signup`;
const LANDING_URL = `https://cursorboston.com/hackathons/${EVENT_ID}`;
const SUBMISSIONS_PAGE_URL =
  "https://cursorboston.com/events/cursor-boston-sports-hack-2026";
const REPO_URL = "https://github.com/rogerSuperBuilderAlpha/cursor-boston";
const SUBMISSIONS_BRANCH = "sports-hack-2026-submissions";
const README_URL = `${REPO_URL}/blob/main/${SUBMISSIONS_BRANCH}/README.md`;

const DEADLINE_HUMAN = "4:00 PM ET on Tuesday, May 26";
const EVENT_TIME_HUMAN = "Tuesday, May 26 · 10 AM – 4 PM ET · Hult International, Cambridge";

interface Recipient {
  /** Lowercased email, for both addressing and the stamp lookup. */
  email: string;
  firstName: string;
  /** Source channel — determines which Firestore doc carries the stamp. */
  source: "website" | "luma";
  /** Firestore doc id for the stamp write. */
  sourceDocId: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getOnlyEmailFlag(): string | null {
  const arg = process.argv.find((a) => a.startsWith("--only-email="));
  if (!arg) return null;
  return arg.slice("--only-email=".length).trim().toLowerCase();
}

function buildEmail(r: Recipient): { subject: string; html: string; text: string } {
  const first = escapeHtml(r.firstName?.trim() || "there");
  const firstText = r.firstName?.trim() || "there";
  const unsubUrl = buildUnsubscribeUrl(r.email);

  const subject =
    "Sports Hack on Tuesday — 119 Cursor credits up for grabs + how to win";

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:640px;">
<p>Hi ${first},</p>

<p>Quick rundown for Tuesday's <strong>${escapeHtml(SPORTS_HACK_2026_NAME)}</strong> — looking forward to seeing you there.</p>

<p><strong>${escapeHtml(EVENT_TIME_HUMAN)}.</strong></p>

<h3 style="margin-top:24px;margin-bottom:8px;">1. Want a Cursor credit?</h3>
<p>We have <strong>${SPORTS_HACK_2026_CAPACITY} Cursor credit codes</strong> for participants. They go to the top ${SPORTS_HACK_2026_CAPACITY} ranked attendees on the website signup list — ranked by <strong>merged PRs to the community repo</strong>, with signup time as the tiebreaker.</p>
<p>Two things to do:</p>
<ol>
  <li><a href="${SIGNUP_URL}">Claim your spot on the site</a> if you haven&apos;t. Required even if you&apos;re already on Luma — this is the list we rank from.</li>
  <li>Merge PRs to <a href="${REPO_URL}">cursor-boston</a>. Every merged PR moves you up. Look for <code>good first issue</code> if it&apos;s your first one.</li>
</ol>

<h3 style="margin-top:24px;margin-bottom:8px;">2. How to win the hackathon</h3>
<p>On event day, submit your project by opening a PR into the <a href="${REPO_URL}/tree/${SUBMISSIONS_BRANCH}"><code>${SUBMISSIONS_BRANCH}</code></a> branch with a folder named after your GitHub handle. Inside the folder: one <code>meta.json</code> with:</p>
<ul>
  <li><strong>title</strong> + <strong>description</strong> — what you built, in 1–3 sentences</li>
  <li><strong>videoUrl</strong> — Loom, YouTube, or any link we can watch your explainer from</li>
  <li><strong>repoUrl</strong> — your project&apos;s GitHub repo</li>
  <li><strong>deployedUrl</strong> — a live URL we can open in a browser</li>
</ul>
<p style="font-size:14px;color:#555;"><a href="${README_URL}">Full template + field reference →</a></p>

<div style="border:1px solid #fca5a5;border-radius:8px;padding:16px;margin:20px 0;background:#fef2f2;font-size:14px;color:#7f1d1d;">
  <p style="margin:0 0 6px 0;"><strong>⏱ Hard deadline: ${escapeHtml(DEADLINE_HUMAN)}.</strong></p>
  <p style="margin:0;">Your PR must be <strong>opened before</strong> 4 PM ET to be eligible for AI scoring. One second late and your AI eval is gone — but human judges still review every merged submission, so you can still win on the judges track.</p>
</div>

<h3 style="margin-top:24px;margin-bottom:8px;">3. How winners are picked</h3>
<p>Two independent tracks, both running off the same submissions:</p>
<ul>
  <li><strong>AI track</strong> — after the 4 PM deadline, an AI agent reads every eligible <code>meta.json</code> + your video/repo/deployed links and scores 1–10 with a written rationale. <strong>Top 3 win.</strong></li>
  <li><strong>Judges track</strong> — a panel of human judges reviews every merged submission (AI-eligible or not) and picks their top 3 based on the live presentations and the repo + deployed project. <strong>Top 3 win.</strong></li>
</ul>
<p>That&apos;s 6 winners total. AI-eligible submissions can win on either track; late submissions are judges-only.</p>

<p style="margin-top:24px;">Public submissions board: <a href="${SUBMISSIONS_PAGE_URL}">${SUBMISSIONS_PAGE_URL}</a> — empty right now, fills up as PRs land Tuesday.</p>

<p>Reply if anything is unclear, you want to host or sponsor on the 26th, or you&apos;re looking for a way to get more involved with the community beyond the event itself.</p>

<p>See you Tuesday —</p>

<p>— Roger<br/>
<a href="mailto:roger@cursorboston.com">roger@cursorboston.com</a></p>

<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#888;">
You&apos;re receiving this because you registered for the Cursor Boston May 26 immersion event.<br/>
<a href="${escapeHtml(unsubUrl)}" style="color:#888;">Unsubscribe from emails</a>
</p>
</body></html>`;

  const text = `Hi ${firstText},

Quick rundown for Tuesday's ${SPORTS_HACK_2026_NAME} — looking forward to seeing you there.

${EVENT_TIME_HUMAN}.

1) WANT A CURSOR CREDIT?
We have ${SPORTS_HACK_2026_CAPACITY} Cursor credit codes for participants. They go to the top ${SPORTS_HACK_2026_CAPACITY} ranked attendees on the website signup list — ranked by merged PRs to the community repo, with signup time as the tiebreaker.

Two things to do:
  - Claim your spot on the site: ${SIGNUP_URL}
    Required even if you're already on Luma — this is the list we rank from.
  - Merge PRs to cursor-boston: ${REPO_URL}
    Every merged PR moves you up. Look for "good first issue" if it's your first one.

2) HOW TO WIN THE HACKATHON
On event day, submit your project by opening a PR into the "${SUBMISSIONS_BRANCH}" branch with a folder named after your GitHub handle. Inside the folder: one meta.json with:
  - title + description (1–3 sentences)
  - videoUrl  — Loom, YouTube, or any link we can watch from
  - repoUrl   — your project's GitHub repo
  - deployedUrl — a live URL we can open in a browser

Full template + field reference: ${README_URL}

⏱ HARD DEADLINE: ${DEADLINE_HUMAN}.
Your PR must be opened before 4 PM ET to be eligible for AI scoring. One second late and your AI eval is gone — but human judges still review every merged submission, so you can still win on the judges track.

3) HOW WINNERS ARE PICKED
Two independent tracks, both running off the same submissions:
  - AI track     — after the deadline, an AI agent reads every eligible meta.json + your video/repo/deployed links and scores 1–10 with a written rationale. Top 3 win.
  - Judges track — a panel of human judges reviews every merged submission and picks their top 3 based on the live presentations and the repo + deployed project. Top 3 win.

That's 6 winners total. AI-eligible submissions can win on either track; late submissions are judges-only.

Public submissions board: ${SUBMISSIONS_PAGE_URL}
Empty right now, fills up as PRs land Tuesday.

Event landing page: ${LANDING_URL}

Reply if anything is unclear, you want to host or sponsor on the 26th, or you're looking for a way to get more involved with the community beyond the event itself.

See you Tuesday —

— Roger
roger@cursorboston.com

---
You're receiving this because you registered for the Cursor Boston May 26 immersion event.
Unsubscribe: ${unsubUrl}
`;

  return { subject, html, text };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function firstNameFrom(s: string | null | undefined): string {
  if (!s) return "";
  return s.trim().split(/\s+/)[0] ?? "";
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const send = process.argv.includes("--send");
  const force = process.argv.includes("--force");
  const onlyEmail = getOnlyEmailFlag();
  if ((dryRun && send) || (!dryRun && !send)) {
    console.error("Specify exactly one of: --dry-run | --send");
    process.exit(1);
  }

  if (send && (!process.env.MAILGUN_API_KEY || !process.env.MAILGUN_DOMAIN)) {
    console.error("For --send, set MAILGUN_API_KEY and MAILGUN_DOMAIN.");
    process.exit(1);
  }

  const db = getAdminDb();
  if (!db) {
    console.error("Firebase Admin not configured.");
    process.exit(1);
  }

  if (send) await syncMailgunSuppressions(db);

  // Website signups + their user docs.
  const signupSnap = await db
    .collection("hackathonEventSignups")
    .where("eventId", "==", EVENT_ID)
    .get();
  const websiteUserIds = signupSnap.docs
    .map((d) => d.data().userId as string | undefined)
    .filter((u): u is string => Boolean(u));
  const userMap = new Map<string, FirebaseFirestore.DocumentData>();
  for (let i = 0; i < websiteUserIds.length; i += 10) {
    const chunk = websiteUserIds.slice(i, i + 10);
    const refs = chunk.map((id) => db.collection("users").doc(id));
    const snaps = await db.getAll(...refs);
    for (const s of snaps) if (s.exists) userMap.set(s.id, s.data() ?? {});
  }
  console.log(`Website signups (${EVENT_ID}): ${signupSnap.size}`);

  // Luma registrants.
  const lumaSnap = await db
    .collection("hackathonLumaRegistrants")
    .where("eventId", "==", EVENT_ID)
    .get();
  console.log(`Luma registrants (${EVENT_ID}): ${lumaSnap.size}`);

  // Unsubscribed (global) — eventContacts.unsubscribed === true.
  const ecSnap = await db.collection("eventContacts").get();
  const unsubscribedEmails = new Set<string>();
  for (const doc of ecSnap.docs) {
    if (doc.data().unsubscribed === true) {
      const e = (doc.data().email || doc.id).toString().trim().toLowerCase();
      if (e) unsubscribedEmails.add(e);
    }
  }
  console.log(`Unsubscribed emails (global): ${unsubscribedEmails.size}`);

  const judgeEmails = getJudgeEmailsForEvent(EVENT_ID);
  const declinedEmails = getDeclinedEmailsForEvent(EVENT_ID);

  // Build recipients: website first, then Luma-only (skip dupes by email or
  // GitHub login). Same dedup as rank-may26-attendees + send-may26-action.
  const recipients: Recipient[] = [];
  const seenEmails = new Set<string>();
  const websiteGithubLogins = new Set<string>();

  let skippedAlreadyEmailed = 0;
  let skippedOnlyEmailFilter = 0;
  let skippedJudgeOrDeclined = 0;
  let skippedUnsubscribed = 0;
  let skippedNoEmail = 0;

  for (const doc of signupSnap.docs) {
    const data = doc.data();
    const userId = data.userId as string | undefined;
    if (!userId) {
      skippedNoEmail++;
      continue;
    }
    const profile = userMap.get(userId) ?? {};
    const email =
      typeof profile.email === "string"
        ? profile.email.trim().toLowerCase()
        : null;
    if (!email) {
      skippedNoEmail++;
      continue;
    }
    if (judgeEmails.has(email) || declinedEmails.has(email)) {
      skippedJudgeOrDeclined++;
      continue;
    }
    if (unsubscribedEmails.has(email)) {
      skippedUnsubscribed++;
      continue;
    }
    if (!force && data[STAMP_FIELD]) {
      skippedAlreadyEmailed++;
      continue;
    }
    if (onlyEmail && email !== onlyEmail) {
      skippedOnlyEmailFilter++;
      continue;
    }
    seenEmails.add(email);
    const ghLogin =
      profile.github && typeof profile.github === "object"
        ? (profile.github as { login?: string }).login ?? null
        : null;
    if (ghLogin) websiteGithubLogins.add(ghLogin.toLowerCase());
    recipients.push({
      email,
      firstName: firstNameFrom(
        typeof profile.displayName === "string" ? profile.displayName : ""
      ),
      source: "website",
      sourceDocId: doc.id,
    });
  }

  for (const doc of lumaSnap.docs) {
    const d = doc.data();
    const email = (d.email as string | undefined)?.trim().toLowerCase() ?? "";
    if (!email) {
      skippedNoEmail++;
      continue;
    }
    if (judgeEmails.has(email) || declinedEmails.has(email)) {
      skippedJudgeOrDeclined++;
      continue;
    }
    if (unsubscribedEmails.has(email)) {
      skippedUnsubscribed++;
      continue;
    }
    if (seenEmails.has(email)) continue; // dedup with website channel
    const ghLogin = typeof d.githubLogin === "string" ? d.githubLogin : null;
    if (ghLogin && websiteGithubLogins.has(ghLogin.toLowerCase())) continue;
    if (!force && d[STAMP_FIELD]) {
      skippedAlreadyEmailed++;
      continue;
    }
    if (onlyEmail && email !== onlyEmail) {
      skippedOnlyEmailFilter++;
      continue;
    }
    seenEmails.add(email);
    recipients.push({
      email,
      firstName: firstNameFrom(typeof d.name === "string" ? d.name : ""),
      source: "luma",
      sourceDocId: doc.id,
    });
  }

  console.log(
    `\nRecipients: ${recipients.length}${onlyEmail ? ` (--only-email=${onlyEmail})` : ""}`
  );
  console.log(`Skipped — judge/declined:           ${skippedJudgeOrDeclined}`);
  console.log(`Skipped — unsubscribed:             ${skippedUnsubscribed}`);
  console.log(`Skipped — no email:                 ${skippedNoEmail}`);
  console.log(`Skipped — already emailed (stamp):  ${skippedAlreadyEmailed}`);
  if (onlyEmail) {
    console.log(`Skipped — --only-email filter:      ${skippedOnlyEmailFilter}`);
  }

  if (dryRun) {
    console.log("\n--dry-run: no emails sent.\n");
    const sample = recipients[0];
    if (sample) {
      const { subject, html, text } = buildEmail(sample);
      console.log(`Sample to: ${sample.email} (${sample.source})`);
      console.log(`Subject: ${subject}`);
      console.log("\n--- HTML ---");
      console.log(html);
      console.log("\n--- Text ---");
      console.log(text);
    }
    console.log(`\nWould send to ${recipients.length} recipients.`);
    return;
  }

  let sent = 0;
  let failed = 0;
  for (const r of recipients) {
    const { subject, html, text } = buildEmail(r);
    try {
      await sendEmail({ to: r.email, subject, html, text });
      const collection =
        r.source === "website" ? "hackathonEventSignups" : "hackathonLumaRegistrants";
      await db
        .collection(collection)
        .doc(r.sourceDocId)
        .update({ [STAMP_FIELD]: FieldValue.serverTimestamp() })
        .catch((e) => {
          // Stamp write is best-effort — the email already went out. Log and continue.
          console.warn(`  [stamp-fail] ${r.email}`, e);
        });
      sent++;
      console.log(`  [ok] ${r.email}`);
      if (sent % 25 === 0) {
        console.log(`  Progress: ${sent}/${recipients.length}`);
      }
    } catch (e) {
      failed++;
      console.error(`  [fail] ${r.email}`, e);
    }
    await sleep(450);
  }

  console.log(`\nDone. Sent ${sent}, failed ${failed}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
