#!/usr/bin/env node
/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Cohort 1 — Sunday-evening status email sent the day before kickoff.
 * Personalized checklist (Discord, GitHub, intake survey), CTA to the
 * onboarding walkthrough at ludwitt.com/alc, heads-up that 3 emails are
 * coming Mon May 11 before the 6pm EST kickoff Zoom, and a one-click
 * "Withdraw from Cohort 1" link for anyone no longer participating.
 *
 * Idempotent via `cohort1StatusUpdateEmailedAt` on the application doc.
 *
 * Usage:
 *   npx tsx scripts/send-cohort1-status-update.ts --dry-run
 *   npx tsx scripts/send-cohort1-status-update.ts --send
 *   npx tsx scripts/send-cohort1-status-update.ts --send --force
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
import { SUMMER_COHORT_INTAKE_COLLECTION } from "../lib/summer-cohort-intake";

const COHORT_URL = "https://cursorboston.com/summer-cohort";
const ALC_URL = "https://ludwitt.com/alc";
const STAMP_FIELD = "cohort1StatusUpdateEmailedAt";

interface Recipient {
  applicationId: string;
  userId: string;
  email: string;
  name: string;
  firstName: string;
  hasDiscord: boolean;
  hasGithub: boolean;
  hasSurvey: boolean;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function row({
  done,
  label,
  todoCopy,
  doneCopy,
}: {
  done: boolean;
  label: string;
  todoCopy: string;
  doneCopy: string;
}): string {
  if (done) {
    return `<li style="margin-bottom:6px;"><strong>✅ ${escapeHtml(label)}</strong> — ${escapeHtml(doneCopy)}</li>`;
  }
  return `<li style="margin-bottom:6px;"><strong>⚠️ ${escapeHtml(label)}</strong> — ${escapeHtml(todoCopy)}</li>`;
}

function buildEmail(r: Recipient): { subject: string; html: string; text: string } {
  const first = escapeHtml(r.firstName?.trim() || "there");
  const unsubUrl = buildUnsubscribeUrl(r.email);
  const withdrawUrl = buildWithdrawUrl(r.email, "cohort-1");

  const subject = "Cohort 1 starts tomorrow at 6pm EST — your status + 3 emails coming";

  const items = [
    row({
      done: r.hasDiscord,
      label: "Connect Discord",
      todoCopy:
        "Without Discord you can't see the cohort channel. One click on the cohort page handles it.",
      doneCopy: "Connected — you've been added to the cohort-1 channel.",
    }),
    row({
      done: r.hasGithub,
      label: "Connect GitHub",
      todoCopy:
        "We use GitHub to count your weekly PRs against the cohort milestones.",
      doneCopy: "Connected — your PRs will count.",
    }),
    row({
      done: r.hasSurvey,
      label: "Intake survey (~5 min)",
      todoCopy:
        "Tells us what tracks fit you. If you haven't done it, knock it out tonight.",
      doneCopy: "Submitted. Thanks!",
    }),
  ].join("");

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:640px;">
<p>Hi ${first},</p>

<p>Cohort 1 kicks off <strong>tomorrow — Mon, May 11 at 6pm EST</strong> on the kickoff Zoom. The roster is now locked; you're in.</p>

<h3 style="margin-top:24px;margin-bottom:8px;">Your status</h3>
<ul style="padding-left:20px;">${items}</ul>

<h3 style="margin-top:24px;margin-bottom:8px;">If you haven't done the local-machine setup yet</h3>
<p>Walk through the 20-minute onboarding tonight so Monday isn't spent wrestling with Node / Git / Cursor:</p>
<p>
  <a href="${ALC_URL}" style="display:inline-block;background:#10b981;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
    Open ludwitt.com/alc →
  </a>
</p>

<h3 style="margin-top:24px;margin-bottom:8px;">What's coming tomorrow</h3>
<p>I'll send <strong>three emails before kickoff</strong> on Monday:</p>
<ol style="padding-left:20px;">
  <li>Final logistics + Zoom link</li>
  <li>Week-1 PM-tool brief (what you're building Mon–Fri)</li>
  <li>Discord channel layout + how we'll run the cohort comms</li>
</ol>
<p>Watch your inbox during the day so nothing surprises you at 6pm.</p>

<h3 style="margin-top:24px;margin-bottom:8px;">Cohort page</h3>
<p>One-click access to Discord, GitHub, and the intake survey:</p>
<p>
  <a href="${COHORT_URL}" style="display:inline-block;background:#7c3aed;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;">
    Open the cohort page →
  </a>
</p>

<h3 style="margin-top:32px;margin-bottom:8px;color:#b91c1c;">Not joining anymore?</h3>
<p>Life happens. If you're no longer participating, please <strong>withdraw now</strong> so I can free your spot for the waitlist:</p>
<p>
  <a href="${escapeHtml(withdrawUrl)}" style="display:inline-block;background:#fff;color:#b91c1c;border:1px solid #b91c1c;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;">
    Withdraw from Cohort 1
  </a>
</p>
<p style="font-size:14px;color:#6b7280;">One click; no confirmation page. You'll land on a "you've been withdrawn" page. This removes you from the cohort entirely — different from the unsubscribe link below, which only stops emails.</p>

<p style="margin-top:32px;">See you tomorrow.</p>

<p>— Roger<br/>
<a href="mailto:roger@cursorboston.com">roger@cursorboston.com</a></p>

<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#888;">
You're receiving this because you applied to Cohort 1 of the Cursor Boston summer cohort.<br/>
Don't want any emails from us? <a href="${escapeHtml(unsubUrl)}" style="color:#888;">Unsubscribe</a> (different from withdrawing — this just stops emails, doesn't remove you from the cohort).
</p>
</body></html>`;

  const text = `Hi ${r.firstName?.trim() || "there"},

Cohort 1 kicks off tomorrow — Mon, May 11 at 6pm EST — on the kickoff Zoom. The roster is now locked; you're in.

YOUR STATUS

  ${r.hasDiscord ? "[✓]" : "[ ]"} Connect Discord — ${r.hasDiscord ? "Connected; you've been added to the cohort-1 channel." : "Without Discord you can't see the cohort channel."}
  ${r.hasGithub ? "[✓]" : "[ ]"} Connect GitHub — ${r.hasGithub ? "Connected; your PRs will count." : "We use GitHub to count your weekly PRs."}
  ${r.hasSurvey ? "[✓]" : "[ ]"} Intake survey (~5 min) — ${r.hasSurvey ? "Submitted. Thanks!" : "Knock it out tonight."}

IF YOU HAVEN'T DONE THE LOCAL-MACHINE SETUP
Walk through the 20-minute onboarding tonight: ${ALC_URL}

WHAT'S COMING TOMORROW
Three emails before the 6pm kickoff:
  1. Final logistics + Zoom link
  2. Week-1 PM-tool brief
  3. Discord channel layout

COHORT PAGE
One-click access to Discord, GitHub, intake survey: ${COHORT_URL}

NOT JOINING ANYMORE?
If you're no longer participating, please withdraw so I can free your spot:
${withdrawUrl}

One click; no confirmation page. This removes you from the cohort entirely — different from unsubscribing, which only stops emails.

See you tomorrow.

— Roger
roger@cursorboston.com

---
You're receiving this because you applied to Cohort 1 of the Cursor Boston summer cohort.
Unsubscribe from emails (different from withdrawing): ${unsubUrl}
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

  console.log("Loading cohort-1 admits + intake survey responses + users...");
  const appsSnap = await db.collection(SUMMER_COHORT_COLLECTION).get();
  const intakeSnap = await db.collection(SUMMER_COHORT_INTAKE_COLLECTION).get();
  const intakeEmailSet = new Set<string>();
  for (const doc of intakeSnap.docs) {
    const d = doc.data() as { email?: string };
    if (d.email) intakeEmailSet.add(d.email.toLowerCase().trim());
  }

  const recipients: Recipient[] = [];
  let skippedNotAdmitted = 0;
  let skippedNotCohort1 = 0;
  let skippedAlreadyEmailed = 0;
  let skippedNoUserId = 0;
  let skippedNoEmail = 0;

  for (const appDoc of appsSnap.docs) {
    const d = appDoc.data() as {
      cohorts?: string[];
      status?: string;
      userId?: string;
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
    if (!d.userId) {
      skippedNoUserId++;
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
    const userSnap = await db.collection("users").doc(d.userId).get();
    const u = userSnap.exists
      ? (userSnap.data() as {
          discord?: { id?: string };
          github?: { login?: string };
        })
      : null;
    const hasDiscord = !!u?.discord?.id;
    const hasGithub = !!u?.github?.login;
    const hasSurvey = intakeEmailSet.has(d.email.toLowerCase().trim());
    const name = d.name?.trim() || "";
    const firstName = name.split(" ")[0] || "";
    recipients.push({
      applicationId: appDoc.id,
      userId: d.userId,
      email: d.email.trim(),
      name,
      firstName,
      hasDiscord,
      hasGithub,
      hasSurvey,
    });
  }

  console.log(`Eligible recipients: ${recipients.length}`);
  console.log(`Skipped — not cohort-1: ${skippedNotCohort1}`);
  console.log(`Skipped — not admitted: ${skippedNotAdmitted}`);
  console.log(`Skipped — no userId: ${skippedNoUserId}`);
  console.log(`Skipped — no email: ${skippedNoEmail}`);
  console.log(`Skipped — already emailed: ${skippedAlreadyEmailed}`);
  // Status histogram
  let allDone = 0;
  let missingDiscord = 0;
  let missingGithub = 0;
  let missingSurvey = 0;
  for (const r of recipients) {
    if (r.hasDiscord && r.hasGithub && r.hasSurvey) allDone++;
    if (!r.hasDiscord) missingDiscord++;
    if (!r.hasGithub) missingGithub++;
    if (!r.hasSurvey) missingSurvey++;
  }
  console.log(
    `Status: fully-set-up=${allDone}, missing-discord=${missingDiscord}, missing-github=${missingGithub}, missing-survey=${missingSurvey}`
  );

  if (dryRun) {
    console.log("\n--dry-run: no emails sent.\n");
    const sample = recipients[0];
    if (sample) {
      const { subject, html, text } = buildEmail(sample);
      console.log(`Sample to: ${sample.email}`);
      console.log(`Subject: ${subject}`);
      console.log(
        `Status: discord=${sample.hasDiscord}, github=${sample.hasGithub}, survey=${sample.hasSurvey}`
      );
      console.log("\n--- HTML preview (first 2500 chars) ---");
      console.log(html.slice(0, 2500));
      console.log("\n--- Text preview (first 2000 chars) ---");
      console.log(text.slice(0, 2000));
    }
    console.log(`\nWould send to ${recipients.length} contacts.`);
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
