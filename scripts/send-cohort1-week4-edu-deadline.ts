#!/usr/bin/env node
/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Deadline-day broadcast (Fri Jun 5, 2026) to every admitted Cohort 1
 * applicant: Week 4 (Ludwitt Education Tool) is due TODAY by 5pm EST.
 *
 * Two steps:
 *   1. Submit the tool through the creator portal at https://www.ludwitt.com/creator
 *      — this is the step that counts.
 *   2. Open a PR to cursorboston (c1w4edu-submission branch) reporting your move,
 *      so it shows on the cohort page.
 *
 * Idempotent via `cohort1Week4EduDeadlineEmailedAt`. `--force` re-sends.
 * `--only-email=foo@bar` restricts to a single recipient.
 *
 * Usage:
 *   npx tsx scripts/send-cohort1-week4-edu-deadline.ts --dry-run
 *   npx tsx scripts/send-cohort1-week4-edu-deadline.ts --send --only-email=rhunt@bentley.edu
 *   npx tsx scripts/send-cohort1-week4-edu-deadline.ts --send
 *   npx tsx scripts/send-cohort1-week4-edu-deadline.ts --send --force
 */
import { loadEnv, escapeHtml, parseSendArgs } from "./_lib/script-utils";
loadEnv();

import { runEmailCampaign, type EmailContent } from "./_lib/campaign-runner";
import {
  loadAdmittedCohort1Recipients,
  stampCohort1,
  type Cohort1Recipient,
} from "./_lib/cohort1-recipients";
import { buildUnsubscribeUrl, buildWithdrawUrl } from "../lib/unsubscribe-token";

const COHORT_URL = "https://cursorboston.com/summer-cohort";
const CREATOR_PORTAL_URL = "https://www.ludwitt.com/creator";
const STAMP_FIELD = "cohort1Week4EduDeadlineEmailedAt";

function buildEmail(r: Cohort1Recipient): EmailContent {
  const first = escapeHtml(r.firstName?.trim() || "there");
  const firstText = r.firstName?.trim() || "there";
  const unsubUrl = buildUnsubscribeUrl(r.email);
  const withdrawUrl = buildWithdrawUrl(r.email, "cohort-1");

  const subject = "Week 4 due TODAY 5pm — ship your Ludwitt education tool 🎓";

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:640px;">
<p>Hi ${first},</p>

<p><strong>Week 4 — your Ludwitt education tool — is due today by 5pm EST.</strong> This is the week that pays you back: every tool that ships and merges earns its author a revenue share as users spend Ludwitt credits through it.</p>

<h3 style="margin-top:24px;margin-bottom:8px;font-size:16px;">Two steps to be counted</h3>
<ol style="padding-left:20px;margin-top:4px;">
  <li style="margin-bottom:10px;">
    <strong>Submit on Ludwitt — this is the one that counts.</strong> Go through the creator portal and submit your tool:
    <br/>
    <a href="${CREATOR_PORTAL_URL}" style="display:inline-block;margin-top:8px;background:#10b981;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
      Submit on the Ludwitt creator portal →
    </a>
  </li>
  <li style="margin-bottom:4px;">
    <strong>Open a PR to cursorboston</strong> for Week 4 with your project (the <code>c1w4edu-submission</code> branch). The PR reports your move so it shows up on the cohort page — but the Ludwitt submission is what actually counts.
  </li>
</ol>

<p style="margin-top:16px;">
  <a href="${COHORT_URL}" style="color:#0284c7;font-weight:600;">Open the Week 4 tab on the cohort page →</a>
</p>

<div style="border:1px solid #fde68a;border-radius:8px;padding:14px 16px;margin:20px 0;background:#fffbeb;font-size:14px;color:#111;">
  <strong>⏰ Deadline: today, Fri Jun 5 · 5:00 pm EST.</strong> We batch-merge qualifying tools through the weekend, so get it in by 5.
</div>

<p>Even a small, focused tool counts — ship it, submit it on Ludwitt, and PR it. Questions? Just reply.</p>

<p>— Roger<br/>
<a href="mailto:roger@cursorboston.com">roger@cursorboston.com</a></p>

<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#888;">
You&apos;re receiving this because you&apos;re admitted to Cohort 1 of the Cursor Boston summer cohort.<br/>
<a href="${escapeHtml(unsubUrl)}" style="color:#888;">Unsubscribe from emails</a> · <a href="${escapeHtml(withdrawUrl)}" style="color:#888;">Withdraw from Cohort 1</a>
</p>
</body></html>`;

  const text = `Hi ${firstText},

Week 4 — your Ludwitt education tool — is due today by 5pm EST. This is the week that pays you back: every tool that ships and merges earns its author a revenue share as users spend Ludwitt credits through it.

TWO STEPS TO BE COUNTED
  1. Submit on Ludwitt — this is the one that counts. Go through the creator portal and submit your tool:
     ${CREATOR_PORTAL_URL}
  2. Open a PR to cursorboston for Week 4 with your project (the c1w4edu-submission branch). The PR reports your move so it shows on the cohort page — but the Ludwitt submission is what actually counts.

Open the Week 4 tab on the cohort page: ${COHORT_URL}

⏰ DEADLINE: today, Fri Jun 5 · 5:00 pm EST. We batch-merge qualifying tools through the weekend, so get it in by 5.

Even a small, focused tool counts — ship it, submit it on Ludwitt, and PR it. Questions? Just reply.

— Roger
roger@cursorboston.com

---
You're receiving this because you're admitted to Cohort 1 of the Cursor Boston summer cohort.
Unsubscribe from emails: ${unsubUrl}
Withdraw from Cohort 1:  ${withdrawUrl}
`;

  return { subject, html, text };
}

async function main(): Promise<void> {
  const args = parseSendArgs();

  await runEmailCampaign<Cohort1Recipient>({
    args,
    name: "Cohort 1 Week 4 education-tool deadline",
    previewMode: "text",
    getEmail: (r) => r.email,
    buildEmail,
    loadRecipients: (ctx) => loadAdmittedCohort1Recipients(ctx, STAMP_FIELD),
    onSent: (r, { db }) => stampCohort1(db, r.applicationId, STAMP_FIELD),
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
