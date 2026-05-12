#!/usr/bin/env node
/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Sunday-night follow-up to cohort-1 admits who still have at least one of:
 *   - Discord not connected
 *   - GitHub not connected
 *   - Intake survey not submitted
 *
 * Tighter scope than send-cohort1-status-update.ts — only the people with
 * open items get pinged. Urgent subject + minimal body so it doesn't bury
 * the lede.
 *
 * Idempotent via `cohort1SetupFollowupEmailedAt` on the application doc
 * (distinct from the earlier status-update + finalize-reminder stamps).
 *
 * Usage:
 *   npx tsx scripts/send-cohort1-setup-followup.ts --dry-run
 *   npx tsx scripts/send-cohort1-setup-followup.ts --send
 *   npx tsx scripts/send-cohort1-setup-followup.ts --send --force
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
const STAMP_FIELD = "cohort1SetupFollowupEmailedAt";

interface Recipient {
  applicationId: string;
  email: string;
  firstName: string;
  needsDiscord: boolean;
  needsGithub: boolean;
  needsSurvey: boolean;
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
  const withdrawUrl = buildWithdrawUrl(r.email, "cohort-1");

  const openItems: string[] = [];
  const openItemsText: string[] = [];
  if (r.needsDiscord) {
    openItems.push(
      `<li style="margin-bottom:6px;"><strong>Connect Discord</strong> — without it you can't see the cohort channel.</li>`
    );
    openItemsText.push("• Connect Discord — without it you can't see the cohort channel.");
  }
  if (r.needsGithub) {
    openItems.push(
      `<li style="margin-bottom:6px;"><strong>Connect GitHub</strong> — your weekly PRs won't count without it.</li>`
    );
    openItemsText.push("• Connect GitHub — your weekly PRs won't count without it.");
  }
  if (r.needsSurvey) {
    openItems.push(
      `<li style="margin-bottom:6px;"><strong>Intake survey (~5 min)</strong> — tells us which tracks fit you.</li>`
    );
    openItemsText.push("• Intake survey (~5 min) — tells us which tracks fit you.");
  }

  const subject = "Cohort 1 kicks off TOMORROW 6pm EST — finish setup tonight";

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:640px;">
<p>Hi ${first},</p>

<p>Quick follow-up — <strong>kickoff is tomorrow, Mon May 11 at 6pm EST</strong>, and you still have an open setup item. Please knock these out tonight so tomorrow isn't spent on logistics:</p>

<ul style="padding-left:20px;">${openItems.join("")}</ul>

<p>All three live on the cohort page; one click per item.</p>

<p>
  <a href="${COHORT_URL}" style="display:inline-block;background:#10b981;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
    Open the cohort page →
  </a>
</p>

<p style="font-size:14px;color:#6b7280;">If you haven't done the local-machine setup (Node, Git, Cursor), there's also a 20-minute walkthrough at <a href="${ALC_URL}">ludwitt.com/alc</a> — worth running through before tomorrow.</p>

<h3 style="margin-top:32px;margin-bottom:8px;color:#b91c1c;font-size:16px;">Not joining anymore?</h3>
<p style="margin:0 0 12px 0;">Totally fine — one click to free your spot for the waitlist:</p>
<p style="margin:0 0 24px 0;">
  <a href="${escapeHtml(withdrawUrl)}" style="display:inline-block;background:#fff;color:#b91c1c;border:1px solid #b91c1c;padding:8px 16px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
    Withdraw from Cohort 1
  </a>
</p>

<p>See you tomorrow.</p>

<p>— Roger<br/>
<a href="mailto:roger@cursorboston.com">roger@cursorboston.com</a></p>

<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#888;">
You're receiving this because you're admitted to Cohort 1 of the Cursor Boston summer cohort.<br/>
<a href="${escapeHtml(unsubUrl)}" style="color:#888;">Unsubscribe from emails</a> (different from withdrawing).
</p>
</body></html>`;

  const text = `Hi ${r.firstName?.trim() || "there"},

Quick follow-up — kickoff is tomorrow, Mon May 11 at 6pm EST, and you still have an open setup item:

${openItemsText.join("\n")}

All three live on the cohort page; one click per item: ${COHORT_URL}

If you haven't done the local-machine setup (Node, Git, Cursor): ${ALC_URL} (20-min walkthrough).

NOT JOINING ANYMORE?
Totally fine — one click to free your spot for the waitlist:
${withdrawUrl}

See you tomorrow.

— Roger
roger@cursorboston.com

---
You're receiving this because you're admitted to Cohort 1 of the Cursor Boston summer cohort.
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

  const appsSnap = await db.collection(SUMMER_COHORT_COLLECTION).get();
  const intakeSnap = await db.collection(SUMMER_COHORT_INTAKE_COLLECTION).get();
  const intakeEmailSet = new Set<string>();
  for (const doc of intakeSnap.docs) {
    const d = doc.data() as { email?: string };
    if (d.email) intakeEmailSet.add(d.email.toLowerCase().trim());
  }

  const recipients: Recipient[] = [];
  let skippedNotCohort1 = 0;
  let skippedNotAdmitted = 0;
  let skippedAllSetUp = 0;
  let skippedAlreadyEmailed = 0;
  let skippedNoUserIdOrEmail = 0;

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
    if (!d.userId || !d.email) {
      skippedNoUserIdOrEmail++;
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
    const needsDiscord = !u?.discord?.id;
    const needsGithub = !u?.github?.login;
    const needsSurvey = !intakeEmailSet.has(d.email.toLowerCase().trim());
    if (!needsDiscord && !needsGithub && !needsSurvey) {
      skippedAllSetUp++;
      continue;
    }
    const name = d.name?.trim() || "";
    const firstName = name.split(" ")[0] || "";
    recipients.push({
      applicationId: appDoc.id,
      email: d.email.trim(),
      firstName,
      needsDiscord,
      needsGithub,
      needsSurvey,
    });
  }

  console.log(`Eligible recipients (missing >=1 setup item): ${recipients.length}`);
  console.log(`Skipped — not cohort-1: ${skippedNotCohort1}`);
  console.log(`Skipped — not admitted: ${skippedNotAdmitted}`);
  console.log(`Skipped — fully set up: ${skippedAllSetUp}`);
  console.log(`Skipped — already emailed (${STAMP_FIELD}): ${skippedAlreadyEmailed}`);
  console.log(`Skipped — missing userId or email: ${skippedNoUserIdOrEmail}`);
  let needD = 0, needG = 0, needS = 0;
  for (const r of recipients) {
    if (r.needsDiscord) needD++;
    if (r.needsGithub) needG++;
    if (r.needsSurvey) needS++;
  }
  console.log(`Breakdown: needs-discord=${needD}, needs-github=${needG}, needs-survey=${needS}`);

  if (dryRun) {
    console.log("\n--dry-run: no emails sent.\n");
    const sample = recipients[0];
    if (sample) {
      const { subject, html, text } = buildEmail(sample);
      console.log(`Sample to: ${sample.email}`);
      console.log(`Subject: ${subject}`);
      console.log(
        `Open items: discord=${sample.needsDiscord}, github=${sample.needsGithub}, survey=${sample.needsSurvey}`
      );
      console.log("\n--- HTML preview (first 2200 chars) ---");
      console.log(html.slice(0, 2200));
      console.log("\n--- Text preview (first 1500 chars) ---");
      console.log(text.slice(0, 1500));
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
