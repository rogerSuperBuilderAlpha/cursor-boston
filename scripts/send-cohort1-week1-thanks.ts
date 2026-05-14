#!/usr/bin/env node
/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Post-intro-call thank-you to every admitted Cohort 1 applicant.
 * - Thanks them for joining the kickoff call.
 * - Points them to the Week 1: PM tab on cursorboston.com/summer-cohort.
 * - Submission deadline: Friday May 15, 2026 5:00 pm EST.
 * - Live presentations + winner pick: Friday May 15, 2026 6:00 pm EST.
 *
 * Idempotent via `cohort1Week1ThanksEmailedAt`.
 *
 * Usage:
 *   npx tsx scripts/send-cohort1-week1-thanks.ts --dry-run
 *   npx tsx scripts/send-cohort1-week1-thanks.ts --send
 *   npx tsx scripts/send-cohort1-week1-thanks.ts --send --force
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "../lib/firebase-admin";
import { sendEmail } from "../lib/mailgun";
import { buildUnsubscribeUrl } from "../lib/unsubscribe-token";
import { SUMMER_COHORT_COLLECTION } from "../lib/summer-cohort";

const COHORT_URL = "https://cursorboston.com/summer-cohort";
const STAMP_FIELD = "cohort1Week1ThanksEmailedAt";

const ZOOM_URL =
  "https://bentley.zoom.us/j/94435931870?pwd=0rLlEfYcJRMsAvpB1q34KOZU740Sgb.1";
const ZOOM_MEETING_ID = "944 3593 1870";
const ZOOM_PASSCODE = "Uv8s&m";

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

function buildEmail(r: Recipient): { subject: string; html: string; text: string } {
  const first = escapeHtml(r.firstName?.trim() || "there");
  const unsubUrl = buildUnsubscribeUrl(r.email);

  const subject = "Thanks for joining tonight — Week 1 is live (submit by Fri 5 pm)";

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:640px;">
<p>Hi ${first},</p>

<p><strong>Thanks for jumping on the kickoff tonight.</strong> Great to see who's in the room — let's go.</p>

<h3 style="margin-top:28px;margin-bottom:8px;font-size:16px;">Week 1: PM challenge</h3>
<p>Full prompt + submission form is live on the cohort page under the <strong>"Week 1: PM"</strong> tab:</p>
<p>
  <a href="${COHORT_URL}" style="display:inline-block;background:#10b981;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
    Open Week 1 →
  </a>
</p>

<h3 style="margin-top:28px;margin-bottom:8px;font-size:16px;">Two dates this week</h3>
<ul style="padding-left:20px;">
  <li style="margin-bottom:8px;"><strong>Friday May 15, 5:00 pm EST</strong> — submission deadline. Anything in by then is eligible to present.</li>
  <li style="margin-bottom:8px;"><strong>Friday May 15, 6:00 pm EST</strong> — same Zoom. Submitters present, the cohort votes, we pick a Week 1 winner.</li>
</ul>

<div style="border:1px solid #d1d5db;border-radius:8px;padding:14px;margin:16px 0;background:#f9fafb;font-size:13px;color:#374151;">
  <strong>Friday Zoom</strong> (same link as tonight)<br/>
  <a href="${escapeHtml(ZOOM_URL)}">${escapeHtml(ZOOM_URL)}</a><br/>
  Meeting ID: <strong>${ZOOM_MEETING_ID}</strong> · Passcode: <strong>${escapeHtml(ZOOM_PASSCODE)}</strong>
</div>

<p>Even a rough submission counts — ship something, then iterate Friday based on what the room says.</p>

<p>See you Friday at 6.</p>

<p>— Roger<br/>
<a href="mailto:roger@cursorboston.com">roger@cursorboston.com</a></p>

<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#888;">
You're receiving this because you're admitted to Cohort 1 of the Cursor Boston summer cohort.<br/>
<a href="${escapeHtml(unsubUrl)}" style="color:#888;">Unsubscribe</a>
</p>
</body></html>`;

  const text = `Hi ${r.firstName?.trim() || "there"},

Thanks for jumping on the kickoff tonight. Great to see who's in the room — let's go.

WEEK 1: PM CHALLENGE
Full prompt + submission form is live on the cohort page under the "Week 1: PM" tab:
${COHORT_URL}

TWO DATES THIS WEEK
  • Friday May 15, 5:00 pm EST — submission deadline. Anything in by then is eligible to present.
  • Friday May 15, 6:00 pm EST — same Zoom. Submitters present, the cohort votes, we pick a Week 1 winner.

FRIDAY ZOOM (same link as tonight)
${ZOOM_URL}
Meeting ID: ${ZOOM_MEETING_ID}  Passcode: ${ZOOM_PASSCODE}

Even a rough submission counts — ship something, then iterate Friday based on what the room says.

See you Friday at 6.

— Roger
roger@cursorboston.com

---
You're receiving this because you're admitted to Cohort 1 of the Cursor Boston summer cohort.
Unsubscribe: ${unsubUrl}
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
    const name = d.name?.trim() || "";
    const firstName = name.split(" ")[0] || "";
    recipients.push({
      applicationId: appDoc.id,
      email: d.email.trim(),
      firstName,
    });
  }

  console.log(`Eligible recipients (admitted cohort-1, not yet emailed): ${recipients.length}`);
  console.log(`Skipped — not cohort-1: ${skippedNotCohort1}`);
  console.log(`Skipped — not admitted: ${skippedNotAdmitted}`);
  console.log(`Skipped — no email: ${skippedNoEmail}`);
  console.log(`Skipped — already emailed (${STAMP_FIELD}): ${skippedAlreadyEmailed}`);

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
    console.log(`\nRecipient count: ${recipients.length}`);
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
      if (sent % 25 === 0) {
        console.log(`  Progress: ${sent}/${recipients.length}`);
      }
    } catch (e) {
      failed++;
      console.error(`Failed: ${r.email}`, e);
    }
    await sleep(250);
  }

  console.log(`\nDone. Sent ${sent}, failed ${failed}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
