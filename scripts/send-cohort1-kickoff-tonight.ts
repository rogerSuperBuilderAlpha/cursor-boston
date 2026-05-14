#!/usr/bin/env node
/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Kickoff-day (May 11, 2026) email to every admitted Cohort 1 applicant.
 *
 * Always-included:
 *   - "Kickoff is TONIGHT at 6 pm EST" headline
 *   - Zoom join block (URL + Meeting ID + Passcode + tap-to-dial)
 *
 * Per-recipient dynamic:
 *   - If they're missing Discord / GitHub / intake survey, the email
 *     lists exactly the open items they still need to clear before the
 *     call. Recipients with everything done get a "you're all set" line
 *     instead — no fake to-dos.
 *
 * Idempotent via `cohort1KickoffTonightEmailedAt` (distinct from the
 * Sunday-night `cohort1SetupFollowupEmailedAt` stamp from the previous
 * script). `--force` re-sends and re-stamps regardless.
 *
 * Usage:
 *   npx tsx scripts/send-cohort1-kickoff-tonight.ts --dry-run
 *   npx tsx scripts/send-cohort1-kickoff-tonight.ts --send
 *   npx tsx scripts/send-cohort1-kickoff-tonight.ts --send --force
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
const STAMP_FIELD = "cohort1KickoffTonightEmailedAt";

const ZOOM_URL =
  "https://bentley.zoom.us/j/94435931870?pwd=0rLlEfYcJRMsAvpB1q34KOZU740Sgb.1";
const ZOOM_MEETING_ID = "944 3593 1870";
const ZOOM_PASSCODE = "Uv8s&m";
const ZOOM_DIAL_NY = "+1 646 876 9923,,94435931870#,,,,*813695#";
const ZOOM_DIAL_US = "+1 646 931 3860,,94435931870#,,,,*813695#";

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

  const hasOpenItems = openItems.length > 0;
  const subject = hasOpenItems
    ? "Cohort 1 kicks off TONIGHT at 6 pm EST — Zoom link + open setup items"
    : "Cohort 1 kicks off TONIGHT at 6 pm EST — Zoom link inside";

  const setupBlockHtml = hasOpenItems
    ? `<h3 style="margin-top:28px;margin-bottom:8px;font-size:16px;">Before the call, please knock these out:</h3>
<ul style="padding-left:20px;margin-top:8px;">${openItems.join("")}</ul>
<p>All of these live on the cohort page; one click per item.</p>
<p>
  <a href="${COHORT_URL}" style="display:inline-block;background:#10b981;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
    Open the cohort page →
  </a>
</p>
<p style="font-size:14px;color:#6b7280;">Local-machine setup (Node, Git, Cursor) not done? 20-min walkthrough: <a href="${ALC_URL}">ludwitt.com/alc</a> — worth doing before the call.</p>`
    : `<h3 style="margin-top:28px;margin-bottom:8px;color:#047857;font-size:16px;">✅ You're all set</h3>
<p>Discord, GitHub, and intake survey all done. See you on the call.</p>`;

  const setupBlockText = hasOpenItems
    ? `BEFORE THE CALL, PLEASE COMPLETE:

${openItemsText.join("\n")}

All of these live on the cohort page; one click per item: ${COHORT_URL}

Local-machine setup (Node, Git, Cursor) not done? 20-min walkthrough: ${ALC_URL}`
    : `YOU'RE ALL SET — Discord, GitHub, and intake survey all done. See you on the call.`;

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:640px;">
<p>Hi ${first},</p>

<p><strong>Cohort 1 kicks off TONIGHT — Mon May 11 at 6:00 pm EST.</strong> Same time every Monday for 10 weeks.</p>

<div style="border:1px solid #d1d5db;border-radius:8px;padding:16px;margin:16px 0;background:#f9fafb;">
  <h3 style="margin:0 0 12px 0;font-size:16px;color:#111;">📹 Zoom — 6:00 pm EST</h3>
  <p style="margin:0 0 10px 0;">
    <a href="${escapeHtml(ZOOM_URL)}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;">
      Join Zoom Meeting →
    </a>
  </p>
  <p style="margin:0;font-size:13px;color:#374151;">
    Meeting ID: <strong>${ZOOM_MEETING_ID}</strong><br/>
    Passcode: <strong>${escapeHtml(ZOOM_PASSCODE)}</strong>
  </p>
  <p style="margin:8px 0 0 0;font-size:12px;color:#6b7280;">
    Dial-in (US): ${ZOOM_DIAL_NY}
  </p>
</div>

${setupBlockHtml}

<h3 style="margin-top:32px;margin-bottom:8px;color:#b91c1c;font-size:16px;">Not joining anymore?</h3>
<p style="margin:0 0 12px 0;">Totally fine — one click to free your spot for the waitlist:</p>
<p style="margin:0 0 24px 0;">
  <a href="${escapeHtml(withdrawUrl)}" style="display:inline-block;background:#fff;color:#b91c1c;border:1px solid #b91c1c;padding:8px 16px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
    Withdraw from Cohort 1
  </a>
</p>

<p>See you tonight at 6.</p>

<p>— Roger<br/>
<a href="mailto:roger@cursorboston.com">roger@cursorboston.com</a></p>

<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#888;">
You're receiving this because you're admitted to Cohort 1 of the Cursor Boston summer cohort.<br/>
<a href="${escapeHtml(unsubUrl)}" style="color:#888;">Unsubscribe from emails</a> (different from withdrawing).
</p>
</body></html>`;

  const text = `Hi ${r.firstName?.trim() || "there"},

Cohort 1 kicks off TONIGHT — Mon May 11 at 6:00 pm EST. Same time every Monday for 10 weeks.

==========================
ZOOM — 6:00 pm EST
==========================
Join: ${ZOOM_URL}
Meeting ID: ${ZOOM_MEETING_ID}
Passcode: ${ZOOM_PASSCODE}
Dial-in (US, NY): ${ZOOM_DIAL_NY}
Dial-in (US):     ${ZOOM_DIAL_US}

${setupBlockText}

NOT JOINING ANYMORE?
Totally fine — one click to free your spot for the waitlist:
${withdrawUrl}

See you tonight at 6.

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

  console.log(`Eligible recipients (all admitted cohort-1): ${recipients.length}`);
  console.log(`Skipped — not cohort-1: ${skippedNotCohort1}`);
  console.log(`Skipped — not admitted: ${skippedNotAdmitted}`);
  console.log(`Skipped — already emailed (${STAMP_FIELD}): ${skippedAlreadyEmailed}`);
  console.log(`Skipped — missing userId or email: ${skippedNoUserIdOrEmail}`);
  let allSet = 0, needD = 0, needG = 0, needS = 0;
  for (const r of recipients) {
    if (r.needsDiscord) needD++;
    if (r.needsGithub) needG++;
    if (r.needsSurvey) needS++;
    if (!r.needsDiscord && !r.needsGithub && !r.needsSurvey) allSet++;
  }
  console.log(
    `Breakdown: all-set=${allSet}, needs-discord=${needD}, needs-github=${needG}, needs-survey=${needS}`
  );

  if (dryRun) {
    console.log("\n--dry-run: no emails sent.\n");
    const openSample = recipients.find((r) => r.needsDiscord || r.needsGithub || r.needsSurvey);
    const completeSample = recipients.find((r) => !r.needsDiscord && !r.needsGithub && !r.needsSurvey);
    for (const [label, sample] of [
      ["WITH OPEN ITEMS", openSample],
      ["ALL SET", completeSample],
    ] as const) {
      if (!sample) {
        console.log(`\n--- ${label} sample: (none in cohort) ---`);
        continue;
      }
      const { subject, html, text } = buildEmail(sample);
      console.log(`\n--- ${label} sample ---`);
      console.log(`To: ${sample.email}`);
      console.log(`Subject: ${subject}`);
      console.log(
        `Open items: discord=${sample.needsDiscord}, github=${sample.needsGithub}, survey=${sample.needsSurvey}`
      );
      console.log("\nHTML preview (first 2400 chars):");
      console.log(html.slice(0, 2400));
      console.log("\nText preview (first 1600 chars):");
      console.log(text.slice(0, 1600));
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
