#!/usr/bin/env node
/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Send the Hult / Cohort 2 announcement to Cohort 1 participants who are NOT
 * registered for Cohort 2, with a call-to-action to sign up for Cohort 2 on
 * cursorboston.com so they keep getting updates. Same core news as
 * send-cohort2-hult-announcement.ts, but the "your spot carries over"
 * logistics are replaced with a sign-up CTA (these people are not enrolled).
 *
 * Filters:
 *   - cohorts includes "cohort-1" AND does NOT include "cohort-2"
 *   - status === "admitted" (skips withdrawn/etc — i.e. actual participants)
 *
 * Idempotency:
 *   - on successful send, stamps `cohort1HultC2InviteEmailedAt` on the
 *     application doc; re-runs skip anyone already stamped (override with --force).
 *
 * Usage:
 *   npx tsx scripts/send-cohort1-hult-c2-invite.ts --dry-run
 *   npx tsx scripts/send-cohort1-hult-c2-invite.ts --send
 *   npx tsx scripts/send-cohort1-hult-c2-invite.ts --send --force
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

const SUBJECT =
  "Big news for Cohort 2 — we've teamed up with Hult International Business School";
const SIGNUP_URL = "https://cursorboston.com/summer-cohort";

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

function buildEmail(r: Recipient): { subject: string; html: string; text: string } {
  const first = escapeHtml(r.name?.split(" ")[0]?.trim() || "there");
  const unsubUrl = buildUnsubscribeUrl(r.email);

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:640px;">
<p>Hi ${first},</p>

<p>Some big news from Cursor Boston — and a chance for you to be part of what&rsquo;s next.</p>

<p style="margin:16px 0;padding:14px 16px;background:#ecfdf5;border-left:4px solid #10b981;border-radius:6px;">
  <strong>Cursor Boston is teaming up with Hult International Business School — and Cohort 2 will run as the inaugural pilot of the new Hult Cohort Developer Program.</strong>
</p>

<p>You were part of <strong>Cohort 1</strong> — thank you. Cohort 2 is shaping up to be bigger and more ambitious, and we&rsquo;d love to have you in it.</p>

<p><strong>What&rsquo;s in it:</strong></p>

<ul>
  <li><strong>A bigger, more ambitious program.</strong> The pilot brings together 300+ students and professionals in a learning environment built for the agentic economy — building real software with AI, collaborating in public through GitHub, reviewing peers&rsquo; work, and making real product decisions.</li>
  <li><strong>Led by Professor Anusha Vissapragada</strong>, academic director for Computer Science for Business at Hult Boston — recently named by <em>Poets&amp;Quants</em> as one of the 50 Best Undergraduate Business Professors of 2025.</li>
  <li><strong>A certificate of completion from both Hult and Cursor Boston</strong> when you finish.</li>
  <li><strong>A pathway to college credit.</strong> This summer pilot lays the groundwork for the fall semester, where students will be able to take a cohort for actual college credit.</li>
  <li><strong>Job placement support.</strong> We&rsquo;re building a team of placement specialists to help participants find roles during and after the program. More on this soon.</li>
</ul>

<p style="margin:18px 0;padding:14px 16px;background:#eff6ff;border-left:4px solid #3b82f6;border-radius:6px;">
  <strong>You&rsquo;re not registered for Cohort 2 yet.</strong> Sign up on Cursor Boston to join Cohort 2 and keep getting updates — we&rsquo;re now planning to kick off <strong>Thursday, July 9</strong>, with lots of detail coming over the next two weeks.
</p>

<p style="margin-top:20px;">
  <a href="${SIGNUP_URL}" style="display:inline-block;background:#10b981;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Sign up for Cohort 2 →</a>
</p>
<p style="font-size:14px;color:#6b7280;"><a href="${SIGNUP_URL}" style="color:#065f46;">${SIGNUP_URL}</a></p>

<p>Thank you for being part of Cursor Boston — we&rsquo;d love to build with you again.</p>

<p>— Roger &amp; Cursor Boston<br/>
<a href="mailto:roger@cursorboston.com">roger@cursorboston.com</a><br/>
<a href="https://cursorboston.com">https://cursorboston.com</a></p>

<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#888;">
You&rsquo;re receiving this because you were a Cohort 1 participant.<br/>
Don&rsquo;t want any emails from us? <a href="${escapeHtml(unsubUrl)}" style="color:#888;">Unsubscribe</a>.
</p>
</body></html>`;

  const text = `Hi ${r.name?.split(" ")[0]?.trim() || "there"},

Some big news from Cursor Boston — and a chance for you to be part of what's next.

CURSOR BOSTON IS TEAMING UP WITH HULT INTERNATIONAL BUSINESS SCHOOL — and Cohort 2 will run as the inaugural pilot of the new Hult Cohort Developer Program.

You were part of Cohort 1 — thank you. Cohort 2 is shaping up to be bigger and more ambitious, and we'd love to have you in it.

WHAT'S IN IT:

- A bigger, more ambitious program. The pilot brings together 300+ students and professionals in a learning environment built for the agentic economy — building real software with AI, collaborating in public through GitHub, reviewing peers' work, and making real product decisions.
- Led by Professor Anusha Vissapragada, academic director for Computer Science for Business at Hult Boston — recently named by Poets&Quants as one of the 50 Best Undergraduate Business Professors of 2025.
- A certificate of completion from both Hult and Cursor Boston when you finish.
- A pathway to college credit. This summer pilot lays the groundwork for the fall semester, where students will be able to take a cohort for actual college credit.
- Job placement support. We're building a team of placement specialists to help participants find roles during and after the program. More on this soon.

YOU'RE NOT REGISTERED FOR COHORT 2 YET. Sign up on Cursor Boston to join Cohort 2 and keep getting updates — we're now planning to kick off THURSDAY, JULY 9, with lots of detail coming over the next two weeks.

Sign up for Cohort 2: ${SIGNUP_URL}

Thank you for being part of Cursor Boston — we'd love to build with you again.

— Roger & Cursor Boston
roger@cursorboston.com
https://cursorboston.com

You're receiving this because you were a Cohort 1 participant.
Unsubscribe from emails: ${unsubUrl}`;

  return { subject: SUBJECT, html, text };
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const send = args.includes("--send");
  const force = args.includes("--force");

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

  console.log(`Loading applications from ${SUMMER_COHORT_COLLECTION}…`);
  const snap = await db
    .collection(SUMMER_COHORT_COLLECTION)
    .orderBy("createdAt", "asc")
    .get();

  const recipients: Recipient[] = [];
  let skippedNotAdmitted = 0;
  let skippedNotC1 = 0;
  let skippedInC2 = 0;
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
      skippedNotC1++;
      continue;
    }
    if (cohorts.includes("cohort-2")) {
      skippedInC2++;
      continue;
    }
    if (data.status !== "admitted") {
      skippedNotAdmitted++;
      continue;
    }
    if (!force && data.cohort1HultC2InviteEmailedAt) {
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
    `Eligible to email: ${recipients.length} | already emailed: ${skippedAlreadyEmailed} | not admitted: ${skippedNotAdmitted} | already in cohort-2: ${skippedInC2} | not cohort-1: ${skippedNotC1} | no email: ${skippedNoEmail}`
  );

  if (recipients.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  if (dryRun) {
    console.log("\n--dry-run: no emails sent.\n");
    const sample = recipients[0];
    if (sample) {
      const { subject, text } = buildEmail(sample);
      console.log("============================================================");
      console.log("SAMPLE");
      console.log("============================================================");
      console.log(`To:      ${sample.email} (${sample.name || "(no name)"})`);
      console.log(`Subject: ${subject}`);
      console.log(`\n---- TEXT BODY ----\n${text}\n`);
    }
    console.log("All recipients:");
    for (const r of recipients) console.log(`  ${r.email.padEnd(40)} ${r.name}`);
    console.log(`\nWould send to ${recipients.length} cohort-1 (not cohort-2) admits.`);
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
        { cohort1HultC2InviteEmailedAt: FieldValue.serverTimestamp() },
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
