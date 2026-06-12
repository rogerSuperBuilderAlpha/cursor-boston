#!/usr/bin/env node
/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Cohort 1 — "reach out if you have questions" check-in email.
 *
 * Roger is traveling over the next few weeks (DC this week, SF the week of
 * Jun 15, NY the week of Jun 22) but stays fully available — this email
 * encourages anyone who's stuck or has questions to just message him.
 *
 * Idempotent via `cohort1ReachOutEmailedAt` on the application doc.
 *
 * Usage:
 *   npx tsx scripts/send-cohort1-reach-out.ts --dry-run
 *   npx tsx scripts/send-cohort1-reach-out.ts --send
 *   npx tsx scripts/send-cohort1-reach-out.ts --send --force
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

const COHORT_URL = "https://cursorboston.com/summer-cohort";
const CONTACT_EMAIL = "roger@cursorboston.com";
const STAMP_FIELD = "cohort1ReachOutEmailedAt";

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

  const subject = "Stuck on anything? Just reach out — I'm around";

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:640px;">
<p>Hi ${first},</p>

<p>Quick check-in: if you're stuck on anything or have a question — about the build, the tooling, your track, anything — <strong>please just reach out</strong>. Don't sit on it. The fastest way to get unblocked is to message me.</p>

<p>I'm doing a fair bit of travel over the next few weeks — <strong>DC this week, San Francisco the week of June 15, and New York the week of June 22</strong> — but that doesn't change anything: I'm fully available and happy to help. A different time zone is not a barrier; ping me and I'll get back to you.</p>

<p>The easiest way to reach me:</p>
<p>
  <a href="mailto:${CONTACT_EMAIL}" style="display:inline-block;background:#10b981;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
    Email me → ${CONTACT_EMAIL}
  </a>
</p>
<p style="font-size:14px;color:#6b7280;">Or drop a note in the cohort Discord channel — whatever's quickest for you.</p>

<p style="margin-top:24px;">Everything you need (Discord, GitHub, intake survey) is on the cohort page:</p>
<p>
  <a href="${COHORT_URL}" style="display:inline-block;background:#7c3aed;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;">
    Open the cohort page →
  </a>
</p>

<p style="margin-top:32px;">Seriously — don't be a stranger. I'd rather hear from you early than have you stuck.</p>

<p>— Roger<br/>
<a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>

<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#888;">
You're receiving this because you're in Cohort 1 of the Cursor Boston summer cohort.<br/>
Don't want any emails from us? <a href="${escapeHtml(unsubUrl)}" style="color:#888;">Unsubscribe</a>.
</p>
</body></html>`;

  const text = `Hi ${r.firstName?.trim() || "there"},

Quick check-in: if you're stuck on anything or have a question — about the build, the tooling, your track, anything — please just reach out. Don't sit on it. The fastest way to get unblocked is to message me.

I'm doing a fair bit of travel over the next few weeks — DC this week, San Francisco the week of June 15, and New York the week of June 22 — but that doesn't change anything: I'm fully available and happy to help. A different time zone is not a barrier; ping me and I'll get back to you.

The easiest way to reach me: ${CONTACT_EMAIL}
Or drop a note in the cohort Discord channel — whatever's quickest for you.

Everything you need (Discord, GitHub, intake survey) is on the cohort page: ${COHORT_URL}

Seriously — don't be a stranger. I'd rather hear from you early than have you stuck.

— Roger
${CONTACT_EMAIL}

---
You're receiving this because you're in Cohort 1 of the Cursor Boston summer cohort.
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

  console.log("Loading cohort-1 admits...");
  const appsSnap = await db.collection(SUMMER_COHORT_COLLECTION).get();

  const recipients: Recipient[] = [];
  let skippedNotCohort1 = 0;
  let skippedNotAdmitted = 0;
  let skippedNoEmail = 0;
  let skippedAlreadyEmailed = 0;

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

  console.log(`Eligible recipients: ${recipients.length}`);
  console.log(`Skipped — not cohort-1: ${skippedNotCohort1}`);
  console.log(`Skipped — not admitted: ${skippedNotAdmitted}`);
  console.log(`Skipped — no email: ${skippedNoEmail}`);
  console.log(`Skipped — already emailed: ${skippedAlreadyEmailed}`);

  if (dryRun) {
    console.log("\n--dry-run: no emails sent.\n");
    const sample = recipients[0];
    if (sample) {
      const { subject, html, text } = buildEmail(sample);
      console.log(`Sample to: ${sample.email}`);
      console.log(`Subject: ${subject}`);
      console.log("\n--- HTML preview ---");
      console.log(html);
      console.log("\n--- Text preview ---");
      console.log(text);
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
