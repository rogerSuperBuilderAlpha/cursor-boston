#!/usr/bin/env node
/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Pre-event reminder to PyData May 13 website registrants:
 *   1. Verify the first + last name on the registration matches their photo ID
 *      (Moderna ID-checks at the door; mismatches get turned away).
 *   2. Offer a one-click withdraw button if they can't come — landing on a
 *      confirmation page (not auto-withdraw), so accidental clicks don't
 *      release seats.
 *
 * Footer is dynamic per recipient based on summerCohortApplications:
 *   - cohort-1 admit       → "tonight 6pm kickoff" reminder
 *   - any other applicant  → "you're signed up" acknowledgement
 *   - no application       → invite to Cohort 2 (Cohort 1 is closed)
 *
 * Includes a P.S. promoting /game.
 *
 * Idempotent via `pydataNameVerifyReminderEmailedAt` on the registration doc.
 *
 * Usage:
 *   npx tsx scripts/send-pydata-website-reg-reminder.ts --dry-run
 *   npx tsx scripts/send-pydata-website-reg-reminder.ts --send
 *   npx tsx scripts/send-pydata-website-reg-reminder.ts --send --force
 *
 * Requires: FIREBASE_SERVICE_ACCOUNT_JSON
 * For --send: MAILGUN_API_KEY, MAILGUN_DOMAIN
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "../lib/firebase-admin";
import { sendEmail } from "../lib/mailgun";
import {
  buildUnsubscribeUrl,
  buildPydataWithdrawUrl,
} from "../lib/unsubscribe-token";
import { PYDATA_2026_REGISTRATIONS_COLLECTION } from "../lib/pydata-2026";
import { SUMMER_COHORT_COLLECTION } from "../lib/summer-cohort";

const REGISTER_URL =
  "https://cursorboston.com/events/cursor-boston-pydata-2026/register";
const COHORT_URL = "https://cursorboston.com/summer-cohort";
const GAME_URL = "https://cursorboston.com/game";
const STAMP_FIELD = "pydataNameVerifyReminderEmailedAt";

type FooterVariant = "cohort1-kickoff" | "applied-other" | "invite-cohort2";

interface CohortInfo {
  status: string;
  cohorts: string[];
}

interface Recipient {
  docId: string;
  email: string;
  firstName: string;
  lastName: string;
  cohort: CohortInfo | null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function chooseFooterVariant(cohort: CohortInfo | null): FooterVariant {
  if (!cohort) return "invite-cohort2";
  if (cohort.status === "admitted" && cohort.cohorts.includes("cohort-1")) {
    return "cohort1-kickoff";
  }
  return "applied-other";
}

function buildFooterHtml(variant: FooterVariant, cohort: CohortInfo | null): string {
  if (variant === "cohort1-kickoff") {
    return `<div style="margin-top:28px;padding:14px 16px;background:#ecfdf5;border:1px solid #10b981;border-radius:8px;">
  <p style="margin:0;color:#065f46;"><strong>🎯 Tonight at 6pm EST — Cohort 1 kickoff Zoom.</strong> The link is on your cohort dashboard. <a href="${COHORT_URL}" style="color:#065f46;text-decoration:underline;">Open it now</a>. See you there.</p>
</div>`;
  }
  if (variant === "applied-other") {
    const which = cohort?.cohorts.includes("cohort-2") ? "Cohort 2" : "the summer cohort";
    return `<div style="margin-top:28px;padding:14px 16px;background:#f3f4f6;border:1px solid #d1d5db;border-radius:8px;">
  <p style="margin:0;color:#374151;">You&apos;re signed up for <strong>${which}</strong>. We&apos;ll be in touch with next steps soon. <a href="${COHORT_URL}" style="color:#374151;text-decoration:underline;">Cohort page</a>.</p>
</div>`;
  }
  return `<div style="margin-top:28px;padding:14px 16px;background:#eff6ff;border:1px solid #3b82f6;border-radius:8px;">
  <p style="margin:0;color:#1e40af;"><strong>Cohort 1 just closed</strong> — but Cohort 2 applications are open. If you want in: <a href="${COHORT_URL}" style="color:#1e40af;text-decoration:underline;"><strong>Apply for Cohort 2</strong></a>.</p>
</div>`;
}

function buildFooterText(variant: FooterVariant, cohort: CohortInfo | null): string {
  if (variant === "cohort1-kickoff") {
    return `\n🎯 TONIGHT AT 6PM EST — COHORT 1 KICKOFF ZOOM.\nThe link is on your cohort dashboard: ${COHORT_URL}\nSee you there.\n`;
  }
  if (variant === "applied-other") {
    const which = cohort?.cohorts.includes("cohort-2") ? "Cohort 2" : "the summer cohort";
    return `\nYou're signed up for ${which}. We'll be in touch with next steps soon.\nCohort page: ${COHORT_URL}\n`;
  }
  return `\nCohort 1 just closed — but Cohort 2 applications are open.\nIf you want in, apply here: ${COHORT_URL}\n`;
}

function buildEmail(r: Recipient): {
  subject: string;
  html: string;
  text: string;
} {
  const firstName = r.firstName?.trim() || "there";
  const firstHtml = escapeHtml(firstName);
  const lastNameHtml = escapeHtml(r.lastName?.trim() || "");
  const emailHtml = escapeHtml(r.email);

  const unsubUrl = buildUnsubscribeUrl(r.email);
  const withdrawUrl = buildPydataWithdrawUrl(r.email);

  const variant = chooseFooterVariant(r.cohort);
  const footerHtml = buildFooterHtml(variant, r.cohort);
  const footerText = buildFooterText(variant, r.cohort);

  const subject =
    "PyData May 13 — verify the name on your registration matches your photo ID";

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:640px;">
<p>Hi ${firstHtml},</p>

<p>You&apos;re registered for the <strong>Cursor Boston × PyData Data Science Hack</strong> on <strong>Wednesday, May 13, 6:30 PM</strong> at Moderna HQ (325 Binney St, Cambridge). One critical thing before the event:</p>

<div style="margin:20px 0;padding:16px;background:#fef3c7;border-left:4px solid #f59e0b;border-radius:4px;">
  <p style="margin:0;"><strong>Moderna security checks every attendee&apos;s photo ID against the badge list.</strong> The first + last name on your registration <strong>must match your driver&apos;s license / passport exactly</strong>. If they don&apos;t match, you will be turned away at the door.</p>
</div>

<p>Your current registration on file:</p>
<p style="margin:8px 0 0 0;padding:12px 16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;font-family:ui-monospace,SFMono-Regular,monospace;font-size:14px;">
  <strong>${firstHtml} ${lastNameHtml}</strong><br/>
  ${emailHtml}
</p>

<p style="margin-top:20px;">If that does <strong>not</strong> match the name on your photo ID, please update it now (takes 30 seconds):</p>
<p>
  <a href="${REGISTER_URL}" style="display:inline-block;background:#10b981;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
    Edit my registration →
  </a>
</p>

<h3 style="margin-top:32px;margin-bottom:8px;color:#b91c1c;font-size:16px;">Can&apos;t make it anymore?</h3>
<p style="margin:0 0 12px 0;">We&apos;re close to the 150-seat cap. If you can&apos;t come, please withdraw so someone on the waitlist can take your spot. (You&apos;ll land on a confirmation page — no accidental clicks.)</p>
<p style="margin:0 0 24px 0;">
  <a href="${escapeHtml(withdrawUrl)}" style="display:inline-block;background:#fff;color:#b91c1c;border:1px solid #b91c1c;padding:8px 16px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
    Withdraw from May 13
  </a>
</p>

<p>See you Wednesday.</p>

<p>— Roger<br/>
<a href="mailto:roger@cursorboston.com">roger@cursorboston.com</a></p>

${footerHtml}

<p style="margin-top:24px;font-size:14px;color:#6b7280;"><strong>P.S.</strong> — Try <a href="${GAME_URL}" style="color:#6b7280;"><code>/game</code></a>, our Cursor Boston strategy game. Claim hexes, build armies, weekly turn grants. <a href="${GAME_URL}" style="color:#6b7280;">cursorboston.com/game</a></p>

<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#888;">
You&apos;re receiving this because you registered for the May 13 PyData hack on cursorboston.com.<br/>
<a href="${escapeHtml(unsubUrl)}" style="color:#888;">Unsubscribe from emails</a> (different from withdrawing from the event).
</p>
</body></html>`;

  const text = `Hi ${firstName},

You're registered for the Cursor Boston × PyData Data Science Hack on Wednesday, May 13, 6:30 PM at Moderna HQ (325 Binney St, Cambridge). One critical thing before the event:

⚠️  MODERNA SECURITY CHECKS EVERY ATTENDEE'S PHOTO ID AGAINST THE BADGE LIST.
    The first + last name on your registration MUST MATCH your driver's license / passport EXACTLY. If they don't match, you will be turned away at the door.

Your current registration on file:
  ${r.firstName?.trim()} ${r.lastName?.trim()}
  ${r.email}

If that does NOT match the name on your photo ID, please update it now (takes 30 seconds):
${REGISTER_URL}


CAN'T MAKE IT ANYMORE?

We're close to the 150-seat cap. If you can't come, please withdraw so someone on the waitlist can take your spot. (You'll land on a confirmation page — no accidental clicks.)

${withdrawUrl}


See you Wednesday.

— Roger
roger@cursorboston.com

${footerText}

P.S. — Try /game, our Cursor Boston strategy game. Claim hexes, build armies, weekly turn grants.
${GAME_URL}


---
You're receiving this because you registered for the May 13 PyData hack on cursorboston.com.
Unsubscribe (different from withdrawing from the event): ${unsubUrl}
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

  // Build cohort lookup map (email lowercased → status + cohorts)
  console.log("Loading summerCohortApplications…");
  const cohortSnap = await db.collection(SUMMER_COHORT_COLLECTION).get();
  const cohortByEmail = new Map<string, CohortInfo>();
  for (const doc of cohortSnap.docs) {
    const d = doc.data() as {
      email?: string;
      status?: string;
      cohorts?: string[];
    };
    if (!d.email) continue;
    const key = d.email.toLowerCase().trim();
    if (!key) continue;
    cohortByEmail.set(key, {
      status: d.status ?? "",
      cohorts: Array.isArray(d.cohorts) ? d.cohorts : [],
    });
  }
  console.log(`Cohort applications indexed: ${cohortByEmail.size}`);

  console.log("Loading pydataHack2026Registrations…");
  const regsSnap = await db.collection(PYDATA_2026_REGISTRATIONS_COLLECTION).get();
  console.log(`Total registrations: ${regsSnap.size}`);

  const recipients: Recipient[] = [];
  let skippedCancelled = 0;
  let skippedNoEmail = 0;
  let skippedAlreadyEmailed = 0;

  for (const regDoc of regsSnap.docs) {
    const d = regDoc.data() as {
      email?: string;
      firstName?: string;
      lastName?: string;
      status?: string;
      [STAMP_FIELD]?: unknown;
    };
    if (!d.email) {
      skippedNoEmail++;
      continue;
    }
    if (d.status === "cancelled") {
      skippedCancelled++;
      continue;
    }
    if (!force && d[STAMP_FIELD]) {
      skippedAlreadyEmailed++;
      continue;
    }
    const emailKey = d.email.toLowerCase().trim();
    recipients.push({
      docId: regDoc.id,
      email: d.email.trim(),
      firstName: d.firstName ?? "",
      lastName: d.lastName ?? "",
      cohort: cohortByEmail.get(emailKey) ?? null,
    });
  }

  // Footer breakdown for sanity
  let cohort1 = 0;
  let appliedOther = 0;
  let invite = 0;
  for (const r of recipients) {
    const v = chooseFooterVariant(r.cohort);
    if (v === "cohort1-kickoff") cohort1++;
    else if (v === "applied-other") appliedOther++;
    else invite++;
  }

  console.log(`\nEligible recipients: ${recipients.length}`);
  console.log(`  cohort-1 kickoff variant: ${cohort1}`);
  console.log(`  already-applied variant: ${appliedOther}`);
  console.log(`  invite-to-cohort-2 variant: ${invite}`);
  console.log(`Skipped — cancelled: ${skippedCancelled}`);
  console.log(`Skipped — no email: ${skippedNoEmail}`);
  console.log(`Skipped — already emailed (${STAMP_FIELD}): ${skippedAlreadyEmailed}`);

  if (dryRun) {
    console.log("\n--dry-run: no emails sent.\n");
    const samples: Recipient[] = [];
    const seenVariants = new Set<FooterVariant>();
    for (const r of recipients) {
      const v = chooseFooterVariant(r.cohort);
      if (!seenVariants.has(v)) {
        seenVariants.add(v);
        samples.push(r);
      }
      if (samples.length >= 3) break;
    }
    for (const sample of samples) {
      const { subject, text } = buildEmail(sample);
      console.log(
        `\n=== sample (variant: ${chooseFooterVariant(sample.cohort)}) ===`
      );
      console.log(`To: ${sample.email}`);
      console.log(`Subject: ${subject}`);
      console.log(`--- TEXT preview ---`);
      console.log(text);
      console.log(`--- end ---`);
    }
    console.log(`\nWould send to ${recipients.length} recipients.`);
    return;
  }

  if (!process.env.MAILGUN_API_KEY || !process.env.MAILGUN_DOMAIN) {
    console.error("For --send, set MAILGUN_API_KEY and MAILGUN_DOMAIN.");
    process.exit(1);
  }

  let sent = 0;
  let failed = 0;
  for (const r of recipients) {
    const { subject, html, text } = buildEmail(r);
    try {
      await sendEmail({ to: r.email, subject, html, text });
      await db
        .collection(PYDATA_2026_REGISTRATIONS_COLLECTION)
        .doc(r.docId)
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
