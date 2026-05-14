#!/usr/bin/env node
/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Same-day reminder to admitted Cohort 1 applicants who haven't yet
 * confirmed their dev environment is set up (Node + Git + Cursor or
 * Claude Code). Sent the morning of kickoff so they have time to install
 * before the 6pm EST Zoom.
 *
 * Recipients = admitted cohort-1 AND cohort1DevEnvConfirmedAt is unset.
 * The cohort page's SetupReadinessModal will pop on next visit and let
 * them flip the confirmation with one click.
 *
 * Idempotent via `cohort1DevEnvCheckEmailedAt` on the application doc.
 *
 * Usage:
 *   npx tsx scripts/send-cohort1-dev-env-check.ts --dry-run
 *   npx tsx scripts/send-cohort1-dev-env-check.ts --send
 *   npx tsx scripts/send-cohort1-dev-env-check.ts --send --force
 *
 * Requires: FIREBASE_SERVICE_ACCOUNT_JSON
 * For --send: MAILGUN_API_KEY, MAILGUN_DOMAIN
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "../lib/firebase-admin";
import { sendEmail } from "../lib/mailgun";
import { buildUnsubscribeUrl, buildWithdrawUrl } from "../lib/unsubscribe-token";
import { SUMMER_COHORT_COLLECTION } from "../lib/summer-cohort";

const COHORT_URL = "https://cursorboston.com/summer-cohort";
const ALC_URL = "https://ludwitt.com/alc";
const STAMP_FIELD = "cohort1DevEnvCheckEmailedAt";

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

function buildEmail(r: Recipient): {
  subject: string;
  html: string;
  text: string;
} {
  const first = escapeHtml(r.firstName?.trim() || "there");
  const firstText = r.firstName?.trim() || "there";
  const unsubUrl = buildUnsubscribeUrl(r.email);
  const withdrawUrl = buildWithdrawUrl(r.email, "cohort-1");

  const subject =
    "Cohort 1 kicks off TONIGHT 6pm EST — confirm your dev setup on the cohort page";

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:640px;">
<p>Hi ${first},</p>

<p><strong>Tonight at 6pm EST is your Cohort 1 kickoff Zoom.</strong> One last thing to lock in before then.</p>

<p>Head to the cohort page and you&apos;ll see a quick readiness modal — confirm your dev environment is set up:</p>

<ul style="padding-left:20px;margin-top:8px;">
  <li style="margin-bottom:4px;"><strong>Node</strong> installed</li>
  <li style="margin-bottom:4px;"><strong>Git</strong> installed</li>
  <li style="margin-bottom:4px;"><strong>Cursor</strong> (or <strong>Claude Code</strong>) installed</li>
</ul>

<p style="margin-top:16px;">It&apos;s a single &quot;Yes, I&apos;m ready&quot; button — takes 5 seconds — and it helps us know who needs help before kickoff vs. who&apos;s ready to roll.</p>

<p>
  <a href="${COHORT_URL}" style="display:inline-block;background:#10b981;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
    Open the cohort page →
  </a>
</p>

<h3 style="margin-top:32px;margin-bottom:8px;color:#065f46;font-size:16px;">Haven&apos;t installed any of those yet?</h3>
<p style="margin-top:0;">Not required, but <strong>highly highly</strong> encouraged to take care of this today if you haven&apos;t. There&apos;s a 20-minute walkthrough at <a href="${ALC_URL}"><strong>ludwitt.com/alc</strong></a> that covers Node, Git, and Cursor end-to-end. Run through it now and you&apos;ll show up to kickoff actually ready to build, instead of stuck on installs.</p>

<p>
  <a href="${ALC_URL}" style="display:inline-block;background:#fff;color:#065f46;border:1px solid #065f46;padding:8px 16px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
    Open the walkthrough at ludwitt.com/alc
  </a>
</p>

<p style="margin-top:24px;">See you tonight at 6.</p>

<p>— Roger<br/>
<a href="mailto:roger@cursorboston.com">roger@cursorboston.com</a></p>

<h3 style="margin-top:32px;margin-bottom:8px;color:#b91c1c;font-size:16px;">Can&apos;t make tonight?</h3>
<p style="margin:0 0 12px 0;">If your plans changed and you can&apos;t join, please withdraw so your spot goes to the waitlist:</p>
<p style="margin:0 0 24px 0;">
  <a href="${escapeHtml(withdrawUrl)}" style="display:inline-block;background:#fff;color:#b91c1c;border:1px solid #b91c1c;padding:8px 16px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
    Withdraw from Cohort 1
  </a>
</p>

<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#888;">
You&apos;re receiving this because you&apos;re admitted to Cohort 1 of the Cursor Boston summer cohort.<br/>
<a href="${escapeHtml(unsubUrl)}" style="color:#888;">Unsubscribe from emails</a> (different from withdrawing).
</p>
</body></html>`;

  const text = `Hi ${firstText},

Tonight at 6pm EST is your Cohort 1 kickoff Zoom. One last thing to lock in before then.

Head to the cohort page and you'll see a quick readiness modal — confirm your dev environment is set up:

  • Node installed
  • Git installed
  • Cursor (or Claude Code) installed

It's a single "Yes, I'm ready" button — takes 5 seconds — and it helps us know who needs help before kickoff vs. who's ready to roll.

  → ${COHORT_URL}


HAVEN'T INSTALLED ANY OF THOSE YET?

Not required, but HIGHLY HIGHLY encouraged to take care of this today if you haven't. There's a 20-minute walkthrough at ludwitt.com/alc that covers Node, Git, and Cursor end-to-end. Run through it now and you'll show up to kickoff actually ready to build, instead of stuck on installs.

  → ${ALC_URL}


See you tonight at 6.

— Roger
roger@cursorboston.com


CAN'T MAKE TONIGHT?

If your plans changed and you can't join, please withdraw so your spot goes to the waitlist:
${withdrawUrl}


---
You're receiving this because you're admitted to Cohort 1 of the Cursor Boston summer cohort.
Unsubscribe (different from withdrawing): ${unsubUrl}
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
  if (!dryRun) {
    if (!process.env.MAILGUN_API_KEY || !process.env.MAILGUN_DOMAIN) {
      console.error("For --send, set MAILGUN_API_KEY and MAILGUN_DOMAIN.");
      process.exit(1);
    }
  }

  const db = getAdminDb();
  if (!db) {
    console.error("Firebase Admin not configured.");
    process.exit(1);
  }

  console.log("Loading summerCohortApplications…");
  const appsSnap = await db.collection(SUMMER_COHORT_COLLECTION).get();

  const recipients: Recipient[] = [];
  let skippedNotCohort1 = 0;
  let skippedNotAdmitted = 0;
  let skippedAlreadyConfirmed = 0;
  let skippedAlreadyEmailed = 0;
  let skippedNoEmail = 0;

  for (const appDoc of appsSnap.docs) {
    const d = appDoc.data() as {
      cohorts?: string[];
      status?: string;
      email?: string;
      name?: string;
      cohort1DevEnvConfirmedAt?: unknown;
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
    if (d.cohort1DevEnvConfirmedAt) {
      skippedAlreadyConfirmed++;
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

  console.log(`\nEligible recipients (cohort-1 admit + dev env unconfirmed): ${recipients.length}`);
  console.log(`Skipped — not cohort-1: ${skippedNotCohort1}`);
  console.log(`Skipped — not admitted: ${skippedNotAdmitted}`);
  console.log(`Skipped — already confirmed dev env: ${skippedAlreadyConfirmed}`);
  console.log(`Skipped — already emailed (${STAMP_FIELD}): ${skippedAlreadyEmailed}`);
  console.log(`Skipped — no email: ${skippedNoEmail}`);

  if (dryRun) {
    console.log("\n--dry-run: no emails sent.\n");
    const sample = recipients[0];
    if (sample) {
      const { subject, text } = buildEmail(sample);
      console.log(`Sample to: ${sample.email}`);
      console.log(`Subject: ${subject}`);
      console.log(`\n--- TEXT preview ---\n${text}\n--- end ---`);
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
      if (sent % 25 === 0) {
        console.log(`  Progress: ${sent}/${recipients.length}`);
      }
    } catch (e) {
      failed++;
      console.error(`Failed: ${r.email}`, e);
    }
    await sleep(450);
  }

  console.log(`\nDone. Sent ${sent}, failed ${failed}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
