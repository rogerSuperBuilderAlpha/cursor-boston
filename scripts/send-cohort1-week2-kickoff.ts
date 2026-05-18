#!/usr/bin/env node
/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Mon May 18, 2026 6pm EST Zoom invite to every admitted Cohort 1 applicant.
 * The call has two halves: a relaxed walk-through of what people shipped in
 * Week 1, then the Week 2 (Comms build) kickoff. Tone: warm + excited — show
 * up even if you didn't ship last week.
 *
 * Idempotent via `cohort1Week2KickoffEmailedAt`. `--force` re-sends.
 * `--only-email=foo@bar` restricts to a single recipient.
 *
 * Usage:
 *   npx tsx scripts/send-cohort1-week2-kickoff.ts --dry-run
 *   npx tsx scripts/send-cohort1-week2-kickoff.ts --send --only-email=roger@cursorboston.com
 *   npx tsx scripts/send-cohort1-week2-kickoff.ts --send
 *   npx tsx scripts/send-cohort1-week2-kickoff.ts --send --force
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "../lib/firebase-admin";
import { sendEmail } from "../lib/mailgun";
import { buildUnsubscribeUrl, buildWithdrawUrl } from "../lib/unsubscribe-token";
import { SUMMER_COHORT_COLLECTION } from "../lib/summer-cohort";

const COHORT_URL = "https://cursorboston.com/summer-cohort";
const STAMP_FIELD = "cohort1Week2KickoffEmailedAt";

const ZOOM_URL = "https://bentley.zoom.us/j/92415077928";
const ZOOM_CHAT_URL = "https://bentley.zoom.us/launch/jc/92415077928";
const ZOOM_MEETING_ID = "924 1507 7928";
const ZOOM_ONE_TAP_1 = "+13017158592,,92415077928# US (Washington DC)";
const ZOOM_ONE_TAP_2 = "+13052241968,,92415077928# US";

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

  const subject = "Tonight 6pm EST — Week 1 review + Week 2 kickoff 🚀";

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:640px;">
<p>Hi ${first},</p>

<p><strong>Quick one — tonight at 6pm EST we&apos;re back on Zoom.</strong> Two things on the agenda:</p>

<ol style="padding-left:20px;">
  <li style="margin-bottom:8px;"><strong>Week 1 review.</strong> We&apos;ll walk through what people built — PM tools, dashboards, you name it. Come look at each other&apos;s work, ask questions, swap notes.</li>
  <li style="margin-bottom:8px;"><strong>Week 2 kickoff.</strong> Week 2 is the <strong>Comms build</strong> — everyone ships a cohort comms platform, same vote-and-pick-a-winner format. We&apos;ll talk through the prompt live on the call.</li>
</ol>

<p>Even if you didn&apos;t ship in Week 1, come hang out. The point is the room — meet the people, see what&apos;s shipping, trade ideas for Week 2.</p>

<p>
  <a href="${COHORT_URL}" style="display:inline-block;background:#0284c7;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
    Open the cohort page →
  </a>
</p>

<p style="margin-top:8px;font-size:13px;color:#555;">
  The Week 2 prompt + submission form is live now under the <strong>&quot;Week 2: Comms&quot;</strong> tab. Take a peek before the call if you want a head start.
</p>

<div style="border:1px solid #d1d5db;border-radius:8px;padding:16px;margin:20px 0;background:#f9fafb;font-size:14px;color:#111;">
  <p style="margin:0 0 10px 0;"><strong>Zoom — tonight, Mon May 18 · 6:00 pm EST</strong></p>
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

<p>See you at 6.</p>

<p>— Roger<br/>
<a href="mailto:roger@cursorboston.com">roger@cursorboston.com</a></p>

<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#888;">
You&apos;re receiving this because you&apos;re admitted to Cohort 1 of the Cursor Boston summer cohort.<br/>
<a href="${escapeHtml(unsubUrl)}" style="color:#888;">Unsubscribe from emails</a> · <a href="${escapeHtml(withdrawUrl)}" style="color:#888;">Withdraw from Cohort 1</a>
</p>
</body></html>`;

  const text = `Hi ${firstText},

Quick one — tonight at 6pm EST we're back on Zoom. Two things on the agenda:

  1. Week 1 review. We'll walk through what people built — PM tools, dashboards, you name it. Come look at each other's work, ask questions, swap notes.

  2. Week 2 kickoff. Week 2 is the Comms build — everyone ships a cohort comms platform, same vote-and-pick-a-winner format. We'll talk through the prompt live on the call.

Even if you didn't ship in Week 1, come hang out. The point is the room — meet the people, see what's shipping, trade ideas for Week 2.

Open the cohort page: ${COHORT_URL}
The Week 2 prompt + submission form is live now under the "Week 2: Comms" tab. Take a peek before the call if you want a head start.

ZOOM — TONIGHT, MON MAY 18 · 6:00 PM EST
  Join: ${ZOOM_URL}
  Meeting chat: ${ZOOM_CHAT_URL}
  Meeting ID: ${ZOOM_MEETING_ID}
  One-tap mobile: ${ZOOM_ONE_TAP_1} · ${ZOOM_ONE_TAP_2}

See you at 6.

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
