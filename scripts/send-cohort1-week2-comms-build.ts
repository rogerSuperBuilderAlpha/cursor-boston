#!/usr/bin/env node
/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Midweek nudge to every admitted Cohort 1 applicant about the Week 2 build:
 * everyone is invited to ship a cohort comms platform; Jackie (Ying's Week 1
 * PM tool) is being polished and will be ready end-of-week; nothing is required
 * unless you want to win Week 2 — in which case submit to the
 * `c1w2comms-submission` branch by Fri May 22 5pm EST.
 *
 * Idempotent via `cohort1Week2CommsBuildEmailedAt`. `--force` re-sends.
 * `--only-email=foo@bar` restricts to a single recipient.
 *
 * Usage:
 *   npx tsx scripts/send-cohort1-week2-comms-build.ts --dry-run
 *   npx tsx scripts/send-cohort1-week2-comms-build.ts --send --only-email=roger@cursorboston.com
 *   npx tsx scripts/send-cohort1-week2-comms-build.ts --send
 *   npx tsx scripts/send-cohort1-week2-comms-build.ts --send --force
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "../lib/firebase-admin";
import { sendEmail } from "../lib/mailgun";
import { buildUnsubscribeUrl, buildWithdrawUrl } from "../lib/unsubscribe-token";
import { SUMMER_COHORT_COLLECTION } from "../lib/summer-cohort";

const COHORT_URL = "https://cursorboston.com/summer-cohort";
const STAMP_FIELD = "cohort1Week2CommsBuildEmailedAt";

const JACKIE_URL = "https://jackie-app-one.vercel.app";
const JACKIE_REPO_URL = "https://github.com/ProductChameleon/jackie";
const SUBMISSION_BRANCH_URL =
  "https://github.com/rogerSuperBuilderAlpha/cursor-boston/tree/c1w2comms-submission";
const SUBMISSION_PATH =
  "content/summer-cohort/c1/w2-comms/submissions/<github-handle>.json";
const DEADLINE_LABEL = "Fri, May 22 · 5pm EST";
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

  const subject = "Week 2 build — comms platform · Jackie lands end of week";

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:640px;">
<p>Hi ${first},</p>

<p>Last night&apos;s call was a good one — thanks to everyone who showed up. Quick update on where Week 2 stands.</p>

<p><strong>The build: a cohort comms platform.</strong> Same vote-and-pick-a-winner format as Week 1. The wedge to chase: <em>what does a 100-person cohort need that Discord doesn&apos;t already deliver?</em> Persistent project threads, peer-review queues, kudos, weekly digest — pick one angle and ship it.</p>

<p><strong>Jackie update.</strong> Ying is polishing <a href="${escapeHtml(JACKIE_URL)}">Jackie</a> — the PM tool from Week 1 — and it&apos;ll be ready as the cohort&apos;s PM surface by end of the week. You can poke at it right now at <a href="${escapeHtml(JACKIE_URL)}">${escapeHtml(JACKIE_URL)}</a>. If something feels off, open an issue on <a href="${escapeHtml(JACKIE_REPO_URL)}">${escapeHtml(JACKIE_REPO_URL)}</a>, ping Ying, or jump in and help. The cohort gets stronger when folks pitch in on each other&apos;s work.</p>

<p><strong>To be clear: nothing here is required.</strong> Engage, support, help if you want to — that&apos;s the spirit of the cohort. The <em>only</em> ask, and only if you want to win Week 2:</p>

<div style="border:1px solid #d1d5db;border-radius:8px;padding:16px;margin:20px 0;background:#f9fafb;font-size:14px;color:#111;">
  <p style="margin:0 0 10px 0;"><strong>How to win Week 2</strong></p>
  <p style="margin:0 0 6px 0;">
    Open a PR into the <a href="${escapeHtml(SUBMISSION_BRANCH_URL)}"><code>c1w2comms-submission</code></a> branch with your submission JSON at:
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

<p>
  <a href="${COHORT_URL}" style="display:inline-block;background:#0284c7;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
    Open the cohort page →
  </a>
</p>

<p style="margin-top:8px;font-size:13px;color:#555;">
  Week 2 prompt, inspiration list, and submission form all live on the <strong>&quot;Week 2: Comms&quot;</strong> tab.
</p>

<p>Reach out anytime if you&apos;re stuck or want a second pair of eyes — that&apos;s what we&apos;re here for.</p>

<p>— Roger<br/>
<a href="mailto:roger@cursorboston.com">roger@cursorboston.com</a></p>

<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#888;">
You&apos;re receiving this because you&apos;re admitted to Cohort 1 of the Cursor Boston summer cohort.<br/>
<a href="${escapeHtml(unsubUrl)}" style="color:#888;">Unsubscribe from emails</a> · <a href="${escapeHtml(withdrawUrl)}" style="color:#888;">Withdraw from Cohort 1</a>
</p>
</body></html>`;

  const text = `Hi ${firstText},

Last night's call was a good one — thanks to everyone who showed up. Quick update on where Week 2 stands.

THE BUILD: A COHORT COMMS PLATFORM.
Same vote-and-pick-a-winner format as Week 1. The wedge to chase: what does a 100-person cohort need that Discord doesn't already deliver? Persistent project threads, peer-review queues, kudos, weekly digest — pick one angle and ship it.

JACKIE UPDATE.
Ying is polishing Jackie — the PM tool from Week 1 — and it'll be ready as the cohort's PM surface by end of the week. You can poke at it right now:
  ${JACKIE_URL}
If something feels off, open an issue on ${JACKIE_REPO_URL}, ping Ying, or jump in and help. The cohort gets stronger when folks pitch in on each other's work.

TO BE CLEAR: NOTHING HERE IS REQUIRED.
Engage, support, help if you want to — that's the spirit of the cohort. The only ask, and only if you want to win Week 2:

HOW TO WIN WEEK 2
  Open a PR into the c1w2comms-submission branch
  (${SUBMISSION_BRANCH_URL})
  with your submission JSON at:
    ${SUBMISSION_PATH}
  Deadline:     ${DEADLINE_LABEL}
  Voting call:  ${VOTING_CALL_LABEL}

Open the cohort page: ${COHORT_URL}
Week 2 prompt, inspiration list, and submission form all live on the "Week 2: Comms" tab.

Reach out anytime if you're stuck or want a second pair of eyes — that's what we're here for.

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
