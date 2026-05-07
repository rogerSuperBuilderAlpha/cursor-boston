#!/usr/bin/env node
/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * General broadcast to all eventContacts (2026-05-07).
 *
 * Four sections:
 *   1. Generals game — play + contribute PRs
 *   2. PyData (Wed May 13) — MUST register on cursorboston.com with the
 *      exact name on your driver's license (Moderna admit list)
 *   3. Cohort 1 (starts Mon May 11) — apply at /summer-cohort
 *   4. May 26 Boston Tech Week hack at Hult — register if you haven't
 *
 * Mirrors send-contact-list-email.ts mechanics: pulls from eventContacts,
 * skips unsubscribed, syncs Mailgun suppressions first, HMAC unsubscribe link.
 *
 * Usage:
 *   npx tsx scripts/send-broadcast-2026-05-07.ts --dry-run
 *   npx tsx scripts/send-broadcast-2026-05-07.ts --send
 *
 * Requires: FIREBASE_SERVICE_ACCOUNT_JSON
 * For --send: MAILGUN_API_KEY, MAILGUN_DOMAIN
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { getAdminDb } from "../lib/firebase-admin";
import { sendEmail } from "../lib/mailgun";
import { syncMailgunSuppressions } from "../lib/mailgun-suppressions";
import { buildUnsubscribeUrl } from "../lib/unsubscribe-token";

const PYDATA_REGISTER_URL =
  "https://www.cursorboston.com/events/cursor-boston-pydata-2026/register";
const PYDATA_DETAIL_URL =
  "https://www.cursorboston.com/events/cursor-boston-pydata-2026";
const COHORT_URL = "https://www.cursorboston.com/summer-cohort";
const MAY26_LUMA_URL = "https://luma.com/t5vseeed";
const MAY26_SIGNUP_URL =
  "https://www.cursorboston.com/hackathons/sports-hack-2026/signup";
const MAY26_DETAIL_URL =
  "https://www.cursorboston.com/events/cursor-boston-sports-hack-2026";
const GENERALS_URL = "https://www.cursorboston.com/game";
const GENERALS_DOCS_URL =
  "https://github.com/rogerSuperBuilderAlpha/cursor-boston/blob/develop/docs/generals/README.md";
const REPO_URL = "https://github.com/rogerSuperBuilderAlpha/cursor-boston";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface ContactData {
  email: string;
  name: string;
  firstName: string;
}

function buildEmail(contact: ContactData): { subject: string; html: string; text: string } {
  const first = escapeHtml(
    contact.firstName?.trim() || contact.name?.split(" ")[0]?.trim() || "there"
  );
  const unsubUrl = buildUnsubscribeUrl(contact.email);

  const subject =
    "Cursor Boston — PyData (Wed), Cohort 1 (Mon), May 26 hack, and a game to play";

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:640px;">
<p>Hi ${first},</p>

<p>A lot happening over the next three weeks. Four quick things — please act on the ones that apply to you.</p>

<h3 style="margin-top:24px;margin-bottom:8px;">1. Generals — come play, and help us build it</h3>

<p><strong>Generals</strong> is the turn-based strategy game we&apos;ve been growing inside the Cursor Boston site. Come <a href="${GENERALS_URL}">play a turn</a> — recruit units, claim tiles, raid for artifacts. It&apos;s designed to be picked up in 2 minutes a day.</p>

<p>If you&apos;re into <strong>game design or game development</strong>, this is a real open contribution surface. Lore, units, spells, artifacts, castes, buildings, balance, UI — every piece is documented with exact file paths to edit and what testing we expect. Start at the <a href="${GENERALS_DOCS_URL}">contribution guide</a> and open a PR. Improvements ship fast.</p>

<h3 style="margin-top:24px;margin-bottom:8px;">2. PyData × Moderna — Wednesday, May 13 — please re-register on the website</h3>

<p>The Cursor Boston × PyData Data Science Hack at Moderna HQ is <strong>this Wednesday, May 13</strong>. Read more on the <a href="${PYDATA_DETAIL_URL}">event page</a>.</p>

<p style="background:#fff8e1;border-left:4px solid #f59e0b;padding:12px 16px;margin:12px 0;"><strong>Critical:</strong> Even if you RSVP&apos;d on Luma, you <strong>must register on the website</strong> at <a href="${PYDATA_REGISTER_URL}">${PYDATA_REGISTER_URL}</a>. Moderna requires us to send them a final guest list ahead of time. <strong>If your name isn&apos;t on the list we send Moderna, you will not be admitted to the building.</strong></p>

<p style="background:#fff8e1;border-left:4px solid #f59e0b;padding:12px 16px;margin:12px 0;"><strong>And the name you give us must match the name on your driver&apos;s license / government ID exactly.</strong> Moderna security checks IDs at the door. "Mike" on the list and "Michael" on your ID is a problem. Use your full legal first and last name.</p>

<h3 style="margin-top:24px;margin-bottom:8px;">3. Summer Cohort 1 starts Monday — apply now</h3>

<p>Our first cohort kicks off <strong>Monday, May 11</strong>. Six weeks of structured shipping, weekly check-ins, mentor pairing, and an immersion day at Hult on May 26. If you&apos;re looking for a reason to commit time to leveling up your AI-tooling skills with a group of people doing the same thing, this is it.</p>

<p>Apply now at <a href="${COHORT_URL}">${COHORT_URL}</a>. Spots are capped — earlier applications get reviewed first.</p>

<h3 style="margin-top:24px;margin-bottom:8px;">4. May 26 — Boston Tech Week hack at Hult — register if you haven&apos;t</h3>

<p>Tuesday, May 26 we&apos;re running an in-person hack at Hult International (Cambridge) as part of <strong>Boston Tech Week</strong>. Open to anyone — cohort or not — but space is limited (80 seats).</p>

<p>If you haven&apos;t already, RSVP via <a href="${MAY26_LUMA_URL}">Luma</a> and then complete the website signup at <a href="${MAY26_SIGNUP_URL}">${MAY26_SIGNUP_URL}</a>. Details on the <a href="${MAY26_DETAIL_URL}">event page</a>.</p>

<hr style="margin:32px 0;border:none;border-top:1px solid #e5e5e5;"/>

<p>Reply to this email if anything is unclear, you want to host or sponsor, or you&apos;re looking for a way to get more involved with the community than attending. We&apos;re actively recruiting people who want to <strong>maintain</strong>, <strong>organize</strong>, or <strong>contribute</strong>, not only attend.</p>

<p>— Roger &amp; Cursor Boston<br/><small style="color:#666;">Repo: <a href="${REPO_URL}">${REPO_URL}</a></small></p>

<p style="font-size:12px;color:#888;margin-top:24px;">You&apos;re receiving this because you registered for a Cursor Boston event. <a href="${unsubUrl}">Unsubscribe</a> at any time.</p>
</body></html>`;

  const text = `Hi ${first},

A lot happening over the next three weeks. Four quick things — please act on the ones that apply to you.

1. GENERALS — COME PLAY, AND HELP US BUILD IT

Generals is the turn-based strategy game we've been growing inside the Cursor Boston site. Come play a turn — recruit units, claim tiles, raid for artifacts: ${GENERALS_URL}

If you're into game design or game development, this is a real open contribution surface. Start at the contribution guide and open a PR: ${GENERALS_DOCS_URL}

2. PYDATA × MODERNA — WEDNESDAY, MAY 13 — PLEASE RE-REGISTER ON THE WEBSITE

The Cursor Boston × PyData Data Science Hack at Moderna HQ is Wednesday, May 13. Details: ${PYDATA_DETAIL_URL}

CRITICAL: Even if you RSVP'd on Luma, you MUST register on the website: ${PYDATA_REGISTER_URL}
If your name isn't on the list we send Moderna, you will NOT be admitted to the building.

The name you give us must match the name on your driver's license / government ID EXACTLY. Moderna security checks IDs at the door. Use your full legal first and last name.

3. SUMMER COHORT 1 STARTS MONDAY — APPLY NOW

Our first cohort kicks off Monday, May 11. Six weeks of structured shipping, weekly check-ins, mentor pairing, and an immersion day at Hult on May 26. Apply now: ${COHORT_URL}
Spots are capped — earlier applications get reviewed first.

4. MAY 26 — BOSTON TECH WEEK HACK AT HULT — REGISTER IF YOU HAVEN'T

Tuesday, May 26 we're running an in-person hack at Hult International (Cambridge) as part of Boston Tech Week. Open to anyone — cohort or not — but space is limited (80 seats).

If you haven't already, RSVP via Luma: ${MAY26_LUMA_URL}
Then complete the website signup: ${MAY26_SIGNUP_URL}
Details: ${MAY26_DETAIL_URL}

---

Reply to this email if anything is unclear, you want to host or sponsor, or you're looking for a way to get more involved with the community than attending. We're actively recruiting people who want to maintain, organize, or contribute, not only attend.

— Roger & Cursor Boston
Repo: ${REPO_URL}

You're receiving this because you registered for a Cursor Boston event.
Unsubscribe: ${unsubUrl}
`;

  return { subject, html, text };
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const send = args.includes("--send");

  if ((dryRun && send) || (!dryRun && !send)) {
    console.error("Specify exactly one of: --dry-run | --send");
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
    console.error(
      "Firebase Admin not configured (FIREBASE_SERVICE_ACCOUNT_JSON / GOOGLE_APPLICATION_CREDENTIALS)."
    );
    process.exit(1);
  }

  await syncMailgunSuppressions(db);

  console.log("Loading contacts from eventContacts…");
  const snap = await db.collection("eventContacts").get();
  console.log(`Total contacts: ${snap.size}`);

  const contacts: ContactData[] = [];
  let skippedUnsubscribed = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.unsubscribed === true) {
      skippedUnsubscribed++;
      continue;
    }
    contacts.push({
      email: data.email || doc.id,
      name: data.name || "",
      firstName: data.firstName || "",
    });
  }

  console.log(`Eligible: ${contacts.length} | Skipped unsubscribed: ${skippedUnsubscribed}`);

  if (dryRun) {
    console.log("\n--dry-run: no emails sent.\n");
    const sample = contacts[0];
    if (sample) {
      const { subject, html, text } = buildEmail(sample);
      console.log(`Sample to: ${sample.email}`);
      console.log(`Subject: ${subject}`);
      console.log("\n--- HTML preview (first 1500 chars) ---");
      console.log(html.slice(0, 1500));
      console.log("\n--- Text preview (first 800 chars) ---");
      console.log(text.slice(0, 800));
    }
    console.log(`\nWould send to ${contacts.length} contacts.`);
    return;
  }

  let sent = 0;
  let failed = 0;
  for (const contact of contacts) {
    const { subject, html, text } = buildEmail(contact);
    try {
      await sendEmail({ to: contact.email, subject, html, text });
      sent++;
      if (sent % 50 === 0) {
        console.log(`  Progress: ${sent}/${contacts.length}`);
      }
    } catch (e) {
      failed++;
      console.error(`Failed: ${contact.email}`, e);
    }
    await sleep(450);
  }

  console.log(`\nDone. Sent ${sent}, failed ${failed}, skipped ${skippedUnsubscribed}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
