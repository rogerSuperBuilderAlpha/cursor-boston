#!/usr/bin/env node
/**
 * Email Cohort 1 admits asking them to fill out the intake survey.
 *
 * Filters:
 *   - cohort-1 only (must include "cohort-1" in `cohorts`)
 *   - status === "admitted" (skips pending/withdrawn/rejected/waitlist)
 *   - skips anyone whose email already has a doc in summerCohortIntakeSurveys
 *
 * Idempotency:
 *   - on successful send, stamps `cohort1IntakeSurveyEmailedAt` on the
 *     application doc; re-runs skip anyone already stamped.
 *
 * Messaging:
 *   - simple, ~5 min framing
 *   - "we use this to build tools that help you ship faster, smoother, more fun"
 *   - explicit IRB disclaimer: NOT research, post-IRB optional research survey
 *
 * Usage:
 *   npx tsx scripts/send-cohort1-intake-survey.ts --dry-run
 *   npx tsx scripts/send-cohort1-intake-survey.ts --send
 *
 * Requires: FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS
 * For --send: MAILGUN_API_KEY, MAILGUN_DOMAIN
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "../lib/firebase-admin";
import { sendEmail } from "../lib/mailgun";
import { buildUnsubscribeUrl } from "../lib/unsubscribe-token";
import { SUMMER_COHORT_COLLECTION, isValidCohortId } from "../lib/summer-cohort";
import { SUMMER_COHORT_INTAKE_COLLECTION } from "../lib/summer-cohort-intake";

const COHORT_URL = "https://cursorboston.com/summer-cohort";

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
  const subject = "Cohort 1 — quick 5-min intake so we can help you ship";

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:640px;">
<p>Hi ${first},</p>

<p>You&rsquo;re in for <strong>Cohort 1</strong> — Mon, May 11 kickoff. One quick ask before we get going:</p>

<p style="margin:16px 0;padding:14px 16px;background:#ecfdf5;border-left:4px solid #10b981;border-radius:6px;">
  <strong>Take the intake survey on your cohort page (~5 min).</strong><br/>
  <a href="${COHORT_URL}" style="color:#065f46;font-weight:600;">${COHORT_URL}</a>
</p>

<p>It&rsquo;s simple — programming background, what you&rsquo;ve been using AI for, what you want out of the next six weeks. We&rsquo;re using it to <strong>build tools that help you ship faster, smoother, and have more fun</strong>: track progress, surface where people are getting stuck, route help to the right person, and tailor the program to who&rsquo;s actually in the room.</p>

<p style="margin:16px 0;padding:12px 16px;background:#fffbeb;border-left:4px solid #f59e0b;border-radius:6px;">
  <strong>Heads up: this is NOT a research study.</strong><br/>
  Cursor Boston&rsquo;s research IRB is still pending. This intake is for operational use only — it&rsquo;s not part of any experimental or research project. Once IRB is approved we&rsquo;ll send a separate, fully-optional research survey; you can decide then whether you want to participate.
</p>

<p style="margin-top:20px;">
  <a href="${COHORT_URL}" style="display:inline-block;background:#10b981;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Take the intake survey →</a>
</p>

<p style="margin-top:16px;color:#555;font-size:14px;">Reply to this email if you hit any snags. Excited to start building with you.</p>

<p>— Roger &amp; Cursor Boston<br/>
<a href="mailto:roger@cursorboston.com">roger@cursorboston.com</a><br/>
<a href="https://cursorboston.com">https://cursorboston.com</a></p>

<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#888;">
You&rsquo;re receiving this because you&rsquo;re an admitted Cohort 1 participant.<br/>
Don&rsquo;t want to hear from us? <a href="${escapeHtml(unsubUrl)}" style="color:#888;">Unsubscribe</a>
</p>
</body></html>`;

  const text = `Hi ${r.name?.split(" ")[0]?.trim() || "there"},

You're in for Cohort 1 — Mon, May 11 kickoff. One quick ask before we get going:

TAKE THE INTAKE SURVEY ON YOUR COHORT PAGE (~5 MIN):
${COHORT_URL}

It's simple — programming background, what you've been using AI for, what you want out of the next six weeks. We're using it to build tools that help you ship faster, smoother, and have more fun: track progress, surface where people are getting stuck, route help to the right person, and tailor the program to who's actually in the room.

HEADS UP: THIS IS NOT A RESEARCH STUDY.
Cursor Boston's research IRB is still pending. This intake is for operational use only — it's not part of any experimental or research project. Once IRB is approved we'll send a separate, fully-optional research survey; you can decide then whether you want to participate.

Take the intake survey: ${COHORT_URL}

Reply to this email if you hit any snags. Excited to start building with you.

— Roger & Cursor Boston
roger@cursorboston.com
https://cursorboston.com

You're receiving this because you're an admitted Cohort 1 participant.
Unsubscribe: ${unsubUrl}`;

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
  let skippedNotCohort1 = 0;
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
    if (!cohorts.includes("cohort-1")) {
      skippedNotCohort1++;
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
    if (!force && data.cohort1IntakeSurveyEmailedAt) {
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
    `Eligible to email: ${recipients.length} | already submitted: ${skippedAlreadyDone} | already emailed: ${skippedAlreadyEmailed} | not admitted: ${skippedNotAdmitted} | not cohort-1: ${skippedNotCohort1} | no email: ${skippedNoEmail}`
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
      console.log(`---- HTML PREVIEW (first 2000 chars) ----\n${html.slice(0, 2000)}\n…`);
    }
    console.log(`\nWould send to ${recipients.length} cohort-1 admits.`);
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
        { cohort1IntakeSurveyEmailedAt: FieldValue.serverTimestamp() },
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
