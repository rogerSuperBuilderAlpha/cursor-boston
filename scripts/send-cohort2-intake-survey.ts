#!/usr/bin/env node
/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Email Cohort 2 admits asking them to fill out the intake survey, with a
 * full reiteration of the kickoff date (Mon, Jun 29) and explicit, one-click
 * withdraw instructions for anyone who no longer wants to participate.
 *
 * Filters:
 *   - cohort-2 only (must include "cohort-2" in `cohorts`)
 *   - status === "admitted" (skips pending/withdrawn/rejected/waitlist)
 *   - skips anyone whose email already has a doc in summerCohortIntakeSurveys
 *
 * Idempotency:
 *   - on successful send, stamps `cohort2IntakeSurveyEmailedAt` on the
 *     application doc; re-runs skip anyone already stamped (override with --force).
 *
 * Usage:
 *   npx tsx scripts/send-cohort2-intake-survey.ts --dry-run
 *   npx tsx scripts/send-cohort2-intake-survey.ts --send
 *   npx tsx scripts/send-cohort2-intake-survey.ts --send --force
 *
 * Requires: FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS
 * For --send: MAILGUN_API_KEY, MAILGUN_DOMAIN
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "../lib/firebase-admin";
import { sendEmail } from "../lib/mailgun";
import {
  buildUnsubscribeUrl,
  buildWithdrawUrl,
} from "../lib/unsubscribe-token";
import { SUMMER_COHORT_COLLECTION, isValidCohortId } from "../lib/summer-cohort";
import { SUMMER_COHORT_INTAKE_COLLECTION } from "../lib/summer-cohort-intake";

const COHORT_URL = "https://cursorboston.com/summer-cohort";
const KICKOFF = "Monday, June 29 at 6pm EST";

interface Recipient {
  applicationId: string;
  email: string;
  name: string;
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
  const first = escapeHtml(r.name?.split(" ")[0]?.trim() || "there");
  const unsubUrl = buildUnsubscribeUrl(r.email);
  const withdrawUrl = buildWithdrawUrl(r.email, "cohort-2");
  const subject = "Cohort 2 starts Jun 29 — quick 5-min intake survey";

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:640px;">
<p>Hi ${first},</p>

<p>You&rsquo;re admitted to <strong>Cohort 2</strong> of the Cursor Boston Summer Cohort. Kickoff is <strong>${KICKOFF}</strong> on the kickoff Zoom (link sent separately closer to the date). Mark your calendar now.</p>

<p>One quick ask before we get going:</p>

<p style="margin:16px 0;padding:14px 16px;background:#ecfdf5;border-left:4px solid #10b981;border-radius:6px;">
  <strong>Take the intake survey on your cohort page (~5 min).</strong><br/>
  <a href="${COHORT_URL}" style="color:#065f46;font-weight:600;">${COHORT_URL}</a>
</p>

<p>It&rsquo;s simple — programming background, what you&rsquo;ve been using AI for, what you want out of the cohort. We&rsquo;re using it to <strong>build tools that help you ship faster, smoother, and have more fun</strong>: track progress, surface where people are getting stuck, route help to the right person, and tailor the program to who&rsquo;s actually in the room.</p>

<p style="margin:16px 0;padding:12px 16px;background:#fffbeb;border-left:4px solid #f59e0b;border-radius:6px;">
  <strong>Heads up: this is NOT a research study.</strong><br/>
  Cursor Boston&rsquo;s research IRB is still pending. This intake is for operational use only — it&rsquo;s not part of any experimental or research project. Once IRB is approved we&rsquo;ll send a separate, fully-optional research survey; you can decide then whether you want to participate.
</p>

<p style="margin-top:20px;">
  <a href="${COHORT_URL}" style="display:inline-block;background:#10b981;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Take the intake survey →</a>
</p>

<h3 style="margin-top:32px;margin-bottom:8px;color:#b91c1c;">Not joining anymore?</h3>
<p>No problem — life happens. If you can no longer commit to Cohort 2, please <strong>withdraw now</strong> so we can free your spot for someone on the waitlist:</p>
<p>
  <a href="${escapeHtml(withdrawUrl)}" style="display:inline-block;background:#fff;color:#b91c1c;border:1px solid #b91c1c;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;">
    Withdraw from Cohort 2
  </a>
</p>
<p style="font-size:14px;color:#6b7280;">One click — no confirmation page. You&rsquo;ll land on a &ldquo;you&rsquo;ve been withdrawn&rdquo; page. This removes you from the cohort entirely (different from the unsubscribe link below, which only stops emails). You can re-apply later if your situation changes.</p>

<p style="margin-top:24px;color:#555;font-size:14px;">Reply to this email if you hit any snags. Excited to build with you.</p>

<p>— Roger &amp; Cursor Boston<br/>
<a href="mailto:roger@cursorboston.com">roger@cursorboston.com</a><br/>
<a href="https://cursorboston.com">https://cursorboston.com</a></p>

<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#888;">
You&rsquo;re receiving this because you&rsquo;re an admitted Cohort 2 participant.<br/>
Don&rsquo;t want any emails from us? <a href="${escapeHtml(unsubUrl)}" style="color:#888;">Unsubscribe</a> (different from withdrawing — this just stops emails, doesn&rsquo;t remove you from the cohort).
</p>
</body></html>`;

  const text = `Hi ${r.name?.split(" ")[0]?.trim() || "there"},

You're admitted to COHORT 2 of the Cursor Boston Summer Cohort. Kickoff is ${KICKOFF} on the kickoff Zoom (link sent separately closer to the date). Mark your calendar now.

One quick ask before we get going:

TAKE THE INTAKE SURVEY ON YOUR COHORT PAGE (~5 MIN):
${COHORT_URL}

It's simple — programming background, what you've been using AI for, what you want out of the cohort. We're using it to build tools that help you ship faster, smoother, and have more fun: track progress, surface where people are getting stuck, route help to the right person, and tailor the program to who's actually in the room.

HEADS UP: THIS IS NOT A RESEARCH STUDY.
Cursor Boston's research IRB is still pending. This intake is for operational use only — it's not part of any experimental or research project. Once IRB is approved we'll send a separate, fully-optional research survey; you can decide then whether you want to participate.

Take the intake survey: ${COHORT_URL}

NOT JOINING ANYMORE?
No problem — life happens. If you can no longer commit to Cohort 2, please withdraw now so we can free your spot for someone on the waitlist:
${withdrawUrl}

One click — no confirmation page. This removes you from the cohort entirely (different from unsubscribing, which only stops emails). You can re-apply later if your situation changes.

Reply to this email if you hit any snags. Excited to build with you.

— Roger & Cursor Boston
roger@cursorboston.com
https://cursorboston.com

You're receiving this because you're an admitted Cohort 2 participant.
Unsubscribe from emails (different from withdrawing): ${unsubUrl}`;

  return { subject, html, text };
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const send = args.includes("--send");
  const force = args.includes("--force"); // re-send even if previously emailed

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
    console.error(
      "Firebase Admin not configured (FIREBASE_SERVICE_ACCOUNT_JSON / GOOGLE_APPLICATION_CREDENTIALS)."
    );
    process.exit(1);
  }

  console.log(`Loading existing intake submissions from ${SUMMER_COHORT_INTAKE_COLLECTION}…`);
  const intakeSnap = await db.collection(SUMMER_COHORT_INTAKE_COLLECTION).get();
  const intakeEmails = new Set<string>();
  for (const doc of intakeSnap.docs) {
    const email = (doc.data().email || "").toString().trim().toLowerCase();
    if (email) intakeEmails.add(email);
  }
  console.log(`Existing intake submissions: ${intakeEmails.size}`);

  console.log(`Loading applications from ${SUMMER_COHORT_COLLECTION}…`);
  const snap = await db
    .collection(SUMMER_COHORT_COLLECTION)
    .orderBy("createdAt", "asc")
    .get();

  const recipients: Recipient[] = [];
  let skippedNotAdmitted = 0;
  let skippedNotCohort2 = 0;
  let skippedAlreadyDone = 0;
  let skippedAlreadyEmailed = 0;
  let skippedNoEmail = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const email = (data.email || "").toString().trim();
    if (!email || !email.includes("@")) {
      skippedNoEmail++;
      continue;
    }
    const cohorts = Array.isArray(data.cohorts)
      ? data.cohorts.filter(isValidCohortId)
      : [];
    if (!cohorts.includes("cohort-2")) {
      skippedNotCohort2++;
      continue;
    }
    if (data.status !== "admitted") {
      skippedNotAdmitted++;
      continue;
    }
    if (intakeEmails.has(email.toLowerCase())) {
      skippedAlreadyDone++;
      continue;
    }
    if (!force && data.cohort2IntakeSurveyEmailedAt) {
      skippedAlreadyEmailed++;
      continue;
    }

    recipients.push({
      applicationId: doc.id,
      email,
      name: typeof data.name === "string" ? data.name : "",
    });
  }

  console.log(
    `Eligible to email: ${recipients.length} | already submitted: ${skippedAlreadyDone} | already emailed: ${skippedAlreadyEmailed} | not admitted: ${skippedNotAdmitted} | not cohort-2: ${skippedNotCohort2} | no email: ${skippedNoEmail}`
  );

  if (recipients.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  if (dryRun) {
    console.log("\n--dry-run: no emails sent.\n");
    const sample = recipients[0];
    if (sample) {
      const { subject, html, text } = buildEmail(sample);
      console.log("============================================================");
      console.log("SAMPLE");
      console.log("============================================================");
      console.log(`To:      ${sample.email} (${sample.name || "(no name)"})`);
      console.log(`Subject: ${subject}`);
      console.log(`\n---- TEXT BODY ----\n${text}\n`);
      console.log(`---- HTML PREVIEW (first 2200 chars) ----\n${html.slice(0, 2200)}\n…`);
    }
    console.log(`\nWould send to ${recipients.length} cohort-2 admits.`);
    return;
  }

  let sent = 0;
  let failed = 0;
  for (const recipient of recipients) {
    const { subject, html, text } = buildEmail(recipient);
    try {
      await sendEmail({ to: recipient.email, subject, html, text });
      sent++;
      await db.collection(SUMMER_COHORT_COLLECTION).doc(recipient.applicationId).set(
        { cohort2IntakeSurveyEmailedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
      if (sent % 10 === 0) {
        console.log(`  Progress: ${sent}/${recipients.length}`);
      }
    } catch (e) {
      failed++;
      console.error(`Failed: ${recipient.email}`, e);
    }
    await sleep(450);
  }

  console.log(`\nDone. Sent ${sent}, failed ${failed}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
