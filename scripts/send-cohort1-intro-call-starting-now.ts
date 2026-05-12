#!/usr/bin/env node
/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * "Starting now" blast to every admitted Cohort 1 applicant — fired
 * at 6:00 pm EST on kickoff Monday (May 11, 2026). Short, urgent,
 * Zoom block front-and-center, no extra CTAs.
 *
 * Idempotent via `cohort1IntroCallStartingNowEmailedAt`.
 *
 * Usage:
 *   npx tsx scripts/send-cohort1-intro-call-starting-now.ts --dry-run
 *   npx tsx scripts/send-cohort1-intro-call-starting-now.ts --send
 *   npx tsx scripts/send-cohort1-intro-call-starting-now.ts --send --force
 *
 * Requires: FIREBASE_SERVICE_ACCOUNT_JSON
 * For --send: MAILGUN_API_KEY, MAILGUN_DOMAIN
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "../lib/firebase-admin";
import { sendEmail } from "../lib/mailgun";
import { buildUnsubscribeUrl } from "../lib/unsubscribe-token";
import { SUMMER_COHORT_COLLECTION } from "../lib/summer-cohort";

const STAMP_FIELD = "cohort1IntroCallStartingNowEmailedAt";

const ZOOM_URL =
  "https://bentley.zoom.us/j/94435931870?pwd=0rLlEfYcJRMsAvpB1q34KOZU740Sgb.1";
const ZOOM_MEETING_ID = "944 3593 1870";
const ZOOM_PASSCODE = "Uv8s&m";
const ZOOM_DIAL_NY = "+1 646 876 9923,,94435931870#,,,,*813695#";

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

  const subject = "STARTING NOW: Cohort 1 intro call — Zoom link inside";

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:640px;">
<p>Hi ${first},</p>

<p style="font-size:18px;"><strong>The Cohort 1 intro call is starting <span style="color:#b91c1c;">RIGHT NOW</span> — 6:00 pm EST.</strong></p>

<div style="border:2px solid #b91c1c;border-radius:8px;padding:16px;margin:16px 0;background:#fff7f7;">
  <h3 style="margin:0 0 12px 0;font-size:16px;color:#111;">Join Zoom — now</h3>
  <p style="margin:0 0 10px 0;">
    <a href="${escapeHtml(ZOOM_URL)}" style="display:inline-block;background:#b91c1c;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:700;font-size:16px;">
      Join Zoom Meeting →
    </a>
  </p>
  <p style="margin:0;font-size:13px;color:#374151;">
    Meeting ID: <strong>${ZOOM_MEETING_ID}</strong><br/>
    Passcode: <strong>${escapeHtml(ZOOM_PASSCODE)}</strong>
  </p>
  <p style="margin:8px 0 0 0;font-size:12px;color:#6b7280;">
    Tap-to-dial (US): ${ZOOM_DIAL_NY}
  </p>
</div>

<p>Hop on whenever you can — late is fine, missed is not.</p>

<p>— Roger<br/>
<a href="mailto:roger@cursorboston.com">roger@cursorboston.com</a></p>

<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#888;">
You're receiving this because you're admitted to Cohort 1 of the Cursor Boston summer cohort.<br/>
<a href="${escapeHtml(unsubUrl)}" style="color:#888;">Unsubscribe</a>
</p>
</body></html>`;

  const text = `Hi ${r.firstName?.trim() || "there"},

The Cohort 1 intro call is starting RIGHT NOW — 6:00 pm EST.

==========================
JOIN ZOOM — NOW
==========================
Join: ${ZOOM_URL}
Meeting ID: ${ZOOM_MEETING_ID}
Passcode: ${ZOOM_PASSCODE}
Tap-to-dial (US): ${ZOOM_DIAL_NY}

Hop on whenever you can — late is fine, missed is not.

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
