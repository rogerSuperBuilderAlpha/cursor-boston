#!/usr/bin/env node
/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Announce to Cohort 2 admits that Cursor Boston has teamed up with Hult
 * International Business School and Cohort 2 will run as the inaugural pilot of
 * the Hult Cohort Developer Program. Communicates: new tentative start date
 * (Thu, Jul 9, moved from Jun 29), dual Hult + Cursor Boston certificate, fall
 * college-credit pathway, forthcoming job-placement support, and that lots more
 * detail is coming over the next two weeks. Deliberately does NOT include the
 * pilot website URL (not public yet).
 *
 * Filters:
 *   - cohort-2 only (must include "cohort-2" in `cohorts`)
 *   - status === "admitted" (skips pending/withdrawn/rejected/waitlist)
 *
 * Idempotency:
 *   - on successful send, stamps `cohort2HultAnnouncementEmailedAt` on the
 *     application doc; re-runs skip anyone already stamped (override with --force).
 *
 * Usage:
 *   npx tsx scripts/send-cohort2-hult-announcement.ts --dry-run
 *   npx tsx scripts/send-cohort2-hult-announcement.ts --send
 *   npx tsx scripts/send-cohort2-hult-announcement.ts --send --force
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

<p>Some big news, and we&rsquo;re genuinely excited to share it.</p>

<p style="margin:16px 0;padding:14px 16px;background:#ecfdf5;border-left:4px solid #10b981;border-radius:6px;">
  <strong>Cursor Boston is teaming up with Hult International Business School — and Cohort 2 will run as the inaugural pilot of the new Hult Cohort Developer Program.</strong> You&rsquo;re part of the very first group to go through it.
</p>

<p><strong>What this means for you:</strong></p>

<ul>
  <li><strong>A bigger, more ambitious program.</strong> The pilot brings together 300+ students and professionals in a learning environment built for the agentic economy — building real software with AI, collaborating in public through GitHub, reviewing peers&rsquo; work, and making real product decisions. The core of what you signed up for stays exactly the same; it&rsquo;s just getting a lot more behind it.</li>
  <li><strong>Led by Professor Anusha Vissapragada</strong>, academic director for Computer Science for Business at Hult Boston — recently named by <em>Poets&amp;Quants</em> as one of the 50 Best Undergraduate Business Professors of 2025.</li>
  <li><strong>A certificate of completion from both Hult and Cursor Boston</strong> when you finish.</li>
  <li><strong>A pathway to college credit.</strong> This summer pilot lays the groundwork for the fall semester, where students will be able to take a cohort for actual college credit.</li>
  <li><strong>Job placement support.</strong> We&rsquo;re building a team of placement specialists to help participants find roles during and after the program. More on this soon.</li>
</ul>

<p><strong>A couple of logistics:</strong></p>

<ul>
  <li><strong>New start date:</strong> we&rsquo;re now planning to kick off <strong>Thursday, July 9</strong> (moved from the original June 29). We&rsquo;ll confirm the final schedule shortly.</li>
  <li><strong>Nothing you need to do right now.</strong> Your spot carries over automatically.</li>
  <li><strong>Lots of information is on the way.</strong> Over the <strong>next two weeks</strong> we&rsquo;ll be sending details on the schedule, the platform, onboarding, the certificate, and everything else you&rsquo;ll need to hit the ground running.</li>
</ul>

<p>Thank you for being part of this — you&rsquo;re joining at the start of something that&rsquo;s about to get a lot bigger.</p>

<p>— Roger &amp; Cursor Boston<br/>
<a href="mailto:roger@cursorboston.com">roger@cursorboston.com</a><br/>
<a href="https://cursorboston.com">https://cursorboston.com</a></p>

<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#888;">
You&rsquo;re receiving this because you&rsquo;re an admitted Cohort 2 participant.<br/>
Don&rsquo;t want any emails from us? <a href="${escapeHtml(unsubUrl)}" style="color:#888;">Unsubscribe</a> (this just stops emails; it doesn&rsquo;t remove you from the cohort).
</p>
</body></html>`;

  const text = `Hi ${r.name?.split(" ")[0]?.trim() || "there"},

Some big news, and we're genuinely excited to share it.

CURSOR BOSTON IS TEAMING UP WITH HULT INTERNATIONAL BUSINESS SCHOOL — and Cohort 2 will run as the inaugural pilot of the new Hult Cohort Developer Program. You're part of the very first group to go through it.

WHAT THIS MEANS FOR YOU:

- A bigger, more ambitious program. The pilot brings together 300+ students and professionals in a learning environment built for the agentic economy — building real software with AI, collaborating in public through GitHub, reviewing peers' work, and making real product decisions. The core of what you signed up for stays exactly the same; it's just getting a lot more behind it.
- Led by Professor Anusha Vissapragada, academic director for Computer Science for Business at Hult Boston — recently named by Poets&Quants as one of the 50 Best Undergraduate Business Professors of 2025.
- A certificate of completion from both Hult and Cursor Boston when you finish.
- A pathway to college credit. This summer pilot lays the groundwork for the fall semester, where students will be able to take a cohort for actual college credit.
- Job placement support. We're building a team of placement specialists to help participants find roles during and after the program. More on this soon.

A COUPLE OF LOGISTICS:

- New start date: we're now planning to kick off THURSDAY, JULY 9 (moved from the original June 29). We'll confirm the final schedule shortly.
- Nothing you need to do right now. Your spot carries over automatically.
- Lots of information is on the way. Over the next two weeks we'll be sending details on the schedule, the platform, onboarding, the certificate, and everything else you'll need to hit the ground running.

Thank you for being part of this — you're joining at the start of something that's about to get a lot bigger.

— Roger & Cursor Boston
roger@cursorboston.com
https://cursorboston.com

You're receiving this because you're an admitted Cohort 2 participant.
Unsubscribe from emails (doesn't remove you from the cohort): ${unsubUrl}`;

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
  let skippedNotCohort2 = 0;
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
    if (!force && data.cohort2HultAnnouncementEmailedAt) {
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
    `Eligible to email: ${recipients.length} | already emailed: ${skippedAlreadyEmailed} | not admitted: ${skippedNotAdmitted} | not cohort-2: ${skippedNotCohort2} | no email: ${skippedNoEmail}`
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
      console.log(`---- HTML PREVIEW (first 1800 chars) ----\n${html.slice(0, 1800)}\n…`);
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
        { cohort2HultAnnouncementEmailedAt: FieldValue.serverTimestamp() },
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
