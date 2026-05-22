#!/usr/bin/env node
/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Fri May 22 send to every admitted Cohort 1 applicant — three things:
 *   1. May 26 immersion at Hult is Tuesday — looking forward to seeing
 *      everyone there.
 *   2. TODAY (Fri May 22) at 5pm EST is the Week 2 comms-platform submission
 *      deadline. Voting call right after at 6pm.
 *   3. Jackie — Ying's Week 1 PM tool, the Cohort 1 winner — is live at
 *      jackie.cursorboston.com. Everyone should log in with their GitHub
 *      handle and use it as the cohort's project-management surface.
 *
 * Idempotent via `cohort1May26JackieEmailedAt`. `--force` re-sends.
 * `--only-email=foo@bar` restricts to a single recipient.
 *
 * Usage:
 *   npx tsx scripts/send-cohort1-may26-jackie-deadline.ts --dry-run
 *   npx tsx scripts/send-cohort1-may26-jackie-deadline.ts --send --only-email=roger@cursorboston.com
 *   npx tsx scripts/send-cohort1-may26-jackie-deadline.ts --send
 *   npx tsx scripts/send-cohort1-may26-jackie-deadline.ts --send --force
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "../lib/firebase-admin";
import { sendEmail } from "../lib/mailgun";
import { buildUnsubscribeUrl, buildWithdrawUrl } from "../lib/unsubscribe-token";
import { SUMMER_COHORT_COLLECTION } from "../lib/summer-cohort";

const COHORT_URL = "https://cursorboston.com/summer-cohort";
const STAMP_FIELD = "cohort1May26JackieEmailedAt";

const JACKIE_URL = "https://jackie.cursorboston.com";
const JACKIE_LOOM_URL =
  "https://www.loom.com/share/7424fcbc4e294a0fa39e38d1242736d4";
const SUBMISSION_BRANCH_URL =
  "https://github.com/rogerSuperBuilderAlpha/cursor-boston/tree/c1w2comms-submission";
const SUBMISSION_PATH =
  "content/summer-cohort/c1/w2-comms/submissions/<github-handle>.json";
const MAY26_DETAIL_URL =
  "https://www.cursorboston.com/events/cursor-boston-sports-hack-2026";

const MAY26_LABEL = "Tue, May 26 · Hult International (Cambridge)";
const DEADLINE_LABEL = "TODAY · Fri, May 22 · 5pm EST";
const VOTING_CALL_LABEL = "Fri, May 22 · 6pm EST";

interface Recipient {
  applicationId: string;
  email: string;
  firstName: string;
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
  const withdrawUrl = buildWithdrawUrl(r.email, "cohort-1");

  const subject =
    "May 26 immersion · Week 2 deadline TODAY 5pm · Jackie is live";

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:640px;">
<p>Hi ${first},</p>

<p>Three things heading into the weekend.</p>

<h3 style="margin-top:24px;margin-bottom:8px;">1. May 26 immersion — see you Tuesday</h3>
<p>Our <strong>${escapeHtml(MAY26_LABEL)}</strong> immersion day is right around the corner. Cohort 1 has priority on the 80-person cap, and it&apos;s a chance to put faces to handles, demo what you&apos;re building, and spend a real day in the room with the rest of the cohort. Genuinely excited to see everyone there. <a href="${escapeHtml(MAY26_DETAIL_URL)}">Event details</a>.</p>

<h3 style="margin-top:24px;margin-bottom:8px;">2. Week 2 comms-platform deadline — TODAY at 5pm EST</h3>
<p>The Week 2 comms-platform submission PR is due <strong>${escapeHtml(DEADLINE_LABEL)}</strong>. Voting call is right after at <strong>${escapeHtml(VOTING_CALL_LABEL)}</strong>. If you&apos;ve got something close, open the PR now — even a draft locks in your slot on the branch and you can push polish up to 5.</p>

<div style="border:1px solid #d1d5db;border-radius:8px;padding:16px;margin:16px 0;background:#f9fafb;font-size:14px;color:#111;">
  <p style="margin:0 0 10px 0;"><strong>How to submit</strong></p>
  <p style="margin:0 0 6px 0;">
    Open a PR into <a href="${escapeHtml(SUBMISSION_BRANCH_URL)}"><code>c1w2comms-submission</code></a> with your submission JSON at:
  </p>
  <p style="margin:0 0 10px 0;">
    <code>${escapeHtml(SUBMISSION_PATH)}</code>
  </p>
  <p style="margin:0 0 6px 0;">
    Deadline: <strong>${escapeHtml(DEADLINE_LABEL)}</strong>
  </p>
  <p style="margin:0;">
    Voting call: <strong>${escapeHtml(VOTING_CALL_LABEL)}</strong>
  </p>
</div>

<h3 style="margin-top:24px;margin-bottom:8px;">3. Jackie is live — the Cohort 1 tracker, built by Ying (Week 1 winner)</h3>
<p>Big one. <strong>Jackie</strong>, the Cohort 1 tracker Ying built as our Week 1 PM-tool winner, is shipped and ready to help you manage your work. It&apos;s officially the cohort&apos;s lightweight project-management surface — please register and start using it through the rest of the cohort.</p>

<p style="margin:8px 0 12px 0;">
  <a href="${escapeHtml(JACKIE_URL)}" style="display:inline-block;background:#0284c7;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
    Open Jackie →
  </a>
  &nbsp;·&nbsp;
  <a href="${escapeHtml(JACKIE_LOOM_URL)}">Watch Ying&apos;s walkthrough (Loom)</a>
</p>

<p><strong>Quick start (from Ying):</strong> Jackie isn&apos;t a PM tool that makes you do work — it&apos;s a lightweight assistant that keeps track of what&apos;s due, where you are, and what the cohort is building, without asking you to do anything. GitHub is the source of truth for submissions, so Jackie reads directly from there. Submit your work once, Jackie picks it up automatically.</p>

<p><strong>Login.</strong> Go to <a href="${escapeHtml(JACKIE_URL)}">${escapeHtml(JACKIE_URL)}</a>, enter your GitHub handle, and Jackie checks you&apos;re in the cohort and lets you in. You need at least one PR submitted to the Cursor Boston repo to get access. Jackie uses your GitHub handle to personalize your view — it&apos;s not authenticated, so whatever you add in Jackie stays in your browser and is only visible to you.</p>

<p><strong>Progress Tracker (My Stuff).</strong> Your weekly dashboard. Each week shows what you&apos;re building, your submission status pulled live from GitHub, and any tasks you&apos;ve added. Click &quot;Add task&quot;, type what it is, set a due date, save. Trash icon to delete.</p>

<p><strong>Cohort.</strong> See what everyone is building. Browse by week, search by GitHub handle, sort by newest or oldest. Each card shows the builder&apos;s repo, live link, Loom, and pitch. Week 5 cards show a green demo icon for anyone demoing on Friday.</p>

<p>If something feels off, ping Ying in Discord or open an issue on the Jackie repo. The cohort gets stronger when folks pitch in on each other&apos;s work.</p>

<p>See you Tuesday on the 26th —</p>

<p>— Roger<br/>
<a href="mailto:roger@cursorboston.com">roger@cursorboston.com</a></p>

<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#888;">
You&apos;re receiving this because you&apos;re admitted to Cohort 1 of the Cursor Boston summer cohort.<br/>
<a href="${escapeHtml(unsubUrl)}" style="color:#888;">Unsubscribe from emails</a> · <a href="${escapeHtml(withdrawUrl)}" style="color:#888;">Withdraw from Cohort 1</a>
</p>
</body></html>`;

  const text = `Hi ${firstText},

Three things heading into the weekend.

1) MAY 26 IMMERSION — SEE YOU TUESDAY
Our ${MAY26_LABEL} immersion day is right around the corner. Cohort 1 has priority on the 80-person cap, and it's a chance to put faces to handles, demo what you're building, and spend a real day in the room with the rest of the cohort. Genuinely excited to see everyone there.
Event details: ${MAY26_DETAIL_URL}

2) WEEK 2 COMMS-PLATFORM DEADLINE — TODAY AT 5PM EST
The Week 2 comms-platform submission PR is due ${DEADLINE_LABEL}. Voting call is right after at ${VOTING_CALL_LABEL}. If you've got something close, open the PR now — even a draft locks in your slot on the branch and you can push polish up to 5.

HOW TO SUBMIT
  Open a PR into the c1w2comms-submission branch
  (${SUBMISSION_BRANCH_URL})
  with your submission JSON at:
    ${SUBMISSION_PATH}
  Deadline:     ${DEADLINE_LABEL}
  Voting call:  ${VOTING_CALL_LABEL}

3) JACKIE IS LIVE — THE COHORT 1 TRACKER, BUILT BY YING (WEEK 1 WINNER)
Jackie, the Cohort 1 tracker Ying built as our Week 1 PM-tool winner, is shipped and ready to help you manage your work. It's officially the cohort's lightweight project-management surface — please register and start using it through the rest of the cohort.

  Open Jackie:       ${JACKIE_URL}
  Ying's walkthrough: ${JACKIE_LOOM_URL}

QUICK START (FROM YING)
Jackie isn't a PM tool that makes you do work — it's a lightweight assistant that keeps track of what's due, where you are, and what the cohort is building, without asking you to do anything. GitHub is the source of truth for submissions, so Jackie reads directly from there. Submit your work once, Jackie picks it up automatically.

LOGIN
Go to ${JACKIE_URL}, enter your GitHub handle, and Jackie checks you're in the cohort and lets you in. You need at least one PR submitted to the Cursor Boston repo to get access. Jackie uses your GitHub handle to personalize your view — it's not authenticated, so whatever you add in Jackie stays in your browser and is only visible to you.

PROGRESS TRACKER (MY STUFF)
Your weekly dashboard. Each week shows what you're building, your submission status pulled live from GitHub, and any tasks you've added. Click "Add task", type what it is, set a due date, save. Trash icon to delete.

COHORT
See what everyone is building. Browse by week, search by GitHub handle, sort by newest or oldest. Each card shows the builder's repo, live link, Loom, and pitch. Week 5 cards show a green demo icon for anyone demoing on Friday.

If something feels off, ping Ying in Discord or open an issue on the Jackie repo. The cohort gets stronger when folks pitch in on each other's work.

See you Tuesday on the 26th —

— Roger
roger@cursorboston.com

Open the cohort page: ${COHORT_URL}

---
You're receiving this because you're admitted to Cohort 1 of the Cursor Boston summer cohort.
Unsubscribe from emails: ${unsubUrl}
Withdraw from Cohort 1:  ${withdrawUrl}
`;

  return { subject, html, text };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const send = process.argv.includes("--send");
  const force = process.argv.includes("--force");
  const onlyEmail = getOnlyEmailFlag();
  if (!dryRun && !send) {
    console.error("Pass --dry-run or --send.");
    process.exit(1);
  }

  const db = getAdminDb();
  if (!db) {
    console.error("Firebase Admin not configured.");
    process.exit(1);
  }

  const appsSnap = await db.collection(SUMMER_COHORT_COLLECTION).get();

  const recipients: Recipient[] = [];
  let skippedNotCohort1 = 0;
  let skippedNotAdmitted = 0;
  let skippedAlreadyEmailed = 0;
  let skippedNoEmail = 0;
  let skippedOnlyEmailFilter = 0;

  for (const appDoc of appsSnap.docs) {
    const d = appDoc.data() as {
      cohorts?: string[];
      status?: string;
      email?: string;
      name?: string;
      [STAMP_FIELD]?: unknown;
    };
    const cohorts = Array.isArray(d.cohorts) ? d.cohorts : [];
    if (!cohorts.includes("cohort-1")) {
      skippedNotCohort1++;
      continue;
    }
    if (d.status !== "admitted") {
      skippedNotAdmitted++;
      continue;
    }
    if (!d.email) {
      skippedNoEmail++;
      continue;
    }
    if (!force && d[STAMP_FIELD]) {
      skippedAlreadyEmailed++;
      continue;
    }
    if (onlyEmail && d.email.trim().toLowerCase() !== onlyEmail) {
      skippedOnlyEmailFilter++;
      continue;
    }
    const name = d.name?.trim() || "";
    const firstName = name.split(" ")[0] || "";
    recipients.push({
      applicationId: appDoc.id,
      email: d.email.trim(),
      firstName,
    });
  }

  console.log(
    `Eligible recipients (admitted cohort-1${onlyEmail ? `, --only-email=${onlyEmail}` : ""}, not yet emailed): ${recipients.length}`
  );
  console.log(`Skipped — not cohort-1: ${skippedNotCohort1}`);
  console.log(`Skipped — not admitted: ${skippedNotAdmitted}`);
  console.log(`Skipped — no email: ${skippedNoEmail}`);
  console.log(`Skipped — already emailed (${STAMP_FIELD}): ${skippedAlreadyEmailed}`);
  if (onlyEmail) {
    console.log(`Skipped — --only-email filter: ${skippedOnlyEmailFilter}`);
  }

  if (dryRun) {
    console.log("\n--dry-run: no emails sent.\n");
    const sample = recipients[0];
    if (sample) {
      const { subject, html, text } = buildEmail(sample);
      console.log(`Sample to: ${sample.email}`);
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
      await db
        .collection(SUMMER_COHORT_COLLECTION)
        .doc(r.applicationId)
        .update({ [STAMP_FIELD]: FieldValue.serverTimestamp() });
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
