#!/usr/bin/env node
/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Post-deadline broadcast (Fri May 15, 2026) to every admitted Cohort 1
 * applicant: Week 1 submissions are scored, here is the 6pm Zoom for the
 * voting / show-and-tell call. Tone is kind + excited — the call is about
 * the cohort exploring each other's builds together.
 *
 * Idempotent via `cohort1Week1VotingCallEmailedAt`. `--force` re-sends.
 * `--only-email=foo@bar` restricts to a single recipient.
 *
 * Usage:
 *   npx tsx scripts/send-cohort1-week1-voting-call.ts --dry-run
 *   npx tsx scripts/send-cohort1-week1-voting-call.ts --send --only-email=roger@cursorboston.com
 *   npx tsx scripts/send-cohort1-week1-voting-call.ts --send
 *   npx tsx scripts/send-cohort1-week1-voting-call.ts --send --force
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "../lib/firebase-admin";
import { sendEmail } from "../lib/mailgun";
import { buildUnsubscribeUrl, buildWithdrawUrl } from "../lib/unsubscribe-token";
import { SUMMER_COHORT_COLLECTION } from "../lib/summer-cohort";

const COHORT_URL = "https://cursorboston.com/summer-cohort";
const STAMP_FIELD = "cohort1Week1VotingCallEmailedAt";

const ZOOM_URL = "https://bentley.zoom.us/j/97389332225";
const ZOOM_CHAT_URL = "https://bentley.zoom.us/launch/jc/97389332225";
const ZOOM_MEETING_ID = "973 8933 2225";
const ZOOM_ONE_TAP_1 = "+13052241968,,97389332225# US";
const ZOOM_ONE_TAP_2 = "+13092053325,,97389332225# US";

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

  const subject = "Week 1 submissions are scored — see you at 6pm EST tonight 🎉";

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:640px;">
<p>Hi ${first},</p>

<p><strong>Week 1 is in the books — and what a week.</strong> Every submission has been merged, scored by the AI judge, and is now live on the cohort page. Go take a look — there is genuinely cool stuff in there:</p>

<p>
  <a href="${COHORT_URL}" style="display:inline-block;background:#10b981;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
    See the Week 1 builds →
  </a>
</p>

<p><strong>Tonight at 6pm EST</strong> we get together on Zoom to walk through each other's work, hear the pitches live, and vote on Week 1. Whether you submitted or not, please come — this is the part of the cohort that makes the whole thing worth it. You'll meet the people behind the cards on the page, see what shipped this week, and trade notes on what you're each building. Bring questions, bring curiosity.</p>

<div style="border:1px solid #d1d5db;border-radius:8px;padding:16px;margin:20px 0;background:#f9fafb;font-size:14px;color:#111;">
  <p style="margin:0 0 10px 0;"><strong>Zoom — tonight, 6:00 pm EST</strong></p>
  <p style="margin:0 0 6px 0;">
    Join: <a href="${escapeHtml(ZOOM_URL)}">${escapeHtml(ZOOM_URL)}</a>
  </p>
  <p style="margin:0 0 6px 0;">
    Meeting chat: <a href="${escapeHtml(ZOOM_CHAT_URL)}">${escapeHtml(ZOOM_CHAT_URL)}</a>
  </p>
  <p style="margin:0 0 6px 0;">
    Meeting ID: <strong>${ZOOM_MEETING_ID}</strong>
  </p>
  <p style="margin:0;color:#555;font-size:13px;">
    One-tap mobile: ${escapeHtml(ZOOM_ONE_TAP_1)} · ${escapeHtml(ZOOM_ONE_TAP_2)}
  </p>
</div>

<p>Seriously — come hang out, even just to listen. Half the value of a cohort is meeting the other people in it. Bring whatever you shipped this week, or just bring yourself.</p>

<p>Excited to see everyone tonight.</p>

<p>— Roger<br/>
<a href="mailto:roger@cursorboston.com">roger@cursorboston.com</a></p>

<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#888;">
You're receiving this because you're admitted to Cohort 1 of the Cursor Boston summer cohort.<br/>
<a href="${escapeHtml(unsubUrl)}" style="color:#888;">Unsubscribe from emails</a> · <a href="${escapeHtml(withdrawUrl)}" style="color:#888;">Withdraw from Cohort 1</a>
</p>
</body></html>`;

  const text = `Hi ${firstText},

Week 1 is in the books — and what a week. Every submission has been merged, scored by the AI judge, and is now live on the cohort page. Go take a look — there is genuinely cool stuff in there:

${COHORT_URL}

Tonight at 6pm EST we get together on Zoom to walk through each other's work, hear the pitches live, and vote on Week 1. Whether you submitted or not, please come — this is the part of the cohort that makes the whole thing worth it. You'll meet the people behind the cards on the page, see what shipped this week, and trade notes on what you're each building. Bring questions, bring curiosity.

ZOOM — TONIGHT, 6:00 PM EST
  Join: ${ZOOM_URL}
  Meeting chat: ${ZOOM_CHAT_URL}
  Meeting ID: ${ZOOM_MEETING_ID}
  One-tap mobile: ${ZOOM_ONE_TAP_1} · ${ZOOM_ONE_TAP_2}

Seriously — come hang out, even just to listen. Half the value of a cohort is meeting the other people in it. Bring whatever you shipped this week, or just bring yourself.

Excited to see everyone tonight.

— Roger
roger@cursorboston.com

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
