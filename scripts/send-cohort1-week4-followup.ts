#!/usr/bin/env node
/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Follow-up nudge to every admitted Cohort 1 applicant for their Week 4 work.
 * Separate from the deadline-day blast (`send-cohort1-week4-edu-deadline.ts`):
 * this one re-states the two concrete deliverables and asks the stragglers to
 * close them out.
 *
 * Two deliverables:
 *   1. Integrate your app into Ludwitt via the creator portal
 *      (https://www.ludwitt.com/creator) — this is the step that counts and the
 *      one that earns you a revenue share.
 *   2. Open an overview PR to cursorboston (c1w4edu-submission branch) describing
 *      what you built, so it shows on the cohort page.
 *
 * Idempotent via its own stamp field `cohort1Week4FollowupEmailedAt`, so it
 * sends independently of the earlier deadline email. `--force` re-sends.
 * `--only-email=foo@bar` restricts to a single recipient.
 *
 * Usage:
 *   npx tsx scripts/send-cohort1-week4-followup.ts --dry-run
 *   npx tsx scripts/send-cohort1-week4-followup.ts --send --only-email=rhunt@bentley.edu
 *   npx tsx scripts/send-cohort1-week4-followup.ts --send
 *   npx tsx scripts/send-cohort1-week4-followup.ts --send --force
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
const STAMP_FIELD = "cohort1Week4FollowupEmailedAt";

function buildEmail(r: Cohort1Recipient): EmailContent {
  const first = escapeHtml(r.firstName?.trim() || "there");
  const firstText = r.firstName?.trim() || "there";
  const unsubUrl = buildUnsubscribeUrl(r.email);
  const withdrawUrl = buildWithdrawUrl(r.email, "cohort-1");

  const subject = "Week 4: integrate your app into Ludwitt + send the overview PR";

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:640px;">
<p>Hi ${first},</p>

<p>Quick follow-up on <strong>Week 4</strong>. If you haven't closed it out yet, there are just two things left to do — and they're the ones that pay you back, since every app integrated into Ludwitt earns its author a revenue share as users spend credits through it.</p>

<h3 style="margin-top:24px;margin-bottom:8px;font-size:16px;">Two things to wrap up</h3>
<ol style="padding-left:20px;margin-top:4px;">
  <li style="margin-bottom:10px;">
    <strong>Integrate your app into Ludwitt — this is the one that counts.</strong> Go through the creator portal and connect your tool:
    <br/>
    <a href="${CREATOR_PORTAL_URL}" style="display:inline-block;margin-top:8px;background:#10b981;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
      Integrate on the Ludwitt creator portal →
    </a>
  </li>
  <li style="margin-bottom:4px;">
    <strong>Open an overview PR to cursorboston</strong> on the <code>c1w4edu-submission</code> branch — a short write-up of what you built and how it plugs into Ludwitt. The PR is what makes your work show up on the cohort page.
  </li>
</ol>

<p style="margin-top:16px;">
  <a href="${COHORT_URL}" style="color:#0284c7;font-weight:600;">Open the Week 4 tab on the cohort page →</a>
</p>

<p style="margin-top:20px;">Even a small, focused tool counts — integrate it into Ludwitt and send the overview PR. Stuck on either step? Just reply and I'll help you over the line.</p>

<p>— Roger<br/>
<a href="mailto:roger@cursorboston.com">roger@cursorboston.com</a></p>

<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#888;">
You&apos;re receiving this because you&apos;re admitted to Cohort 1 of the Cursor Boston summer cohort.<br/>
<a href="${escapeHtml(unsubUrl)}" style="color:#888;">Unsubscribe from emails</a> · <a href="${escapeHtml(withdrawUrl)}" style="color:#888;">Withdraw from Cohort 1</a>
</p>
</body></html>`;

  const text = `Hi ${firstText},

Quick follow-up on Week 4. If you haven't closed it out yet, there are just two things left to do — and they're the ones that pay you back, since every app integrated into Ludwitt earns its author a revenue share as users spend credits through it.

TWO THINGS TO WRAP UP
  1. Integrate your app into Ludwitt — this is the one that counts. Go through the creator portal and connect your tool:
     ${CREATOR_PORTAL_URL}
  2. Open an overview PR to cursorboston on the c1w4edu-submission branch — a short write-up of what you built and how it plugs into Ludwitt. The PR is what makes your work show up on the cohort page.

Open the Week 4 tab on the cohort page: ${COHORT_URL}

Even a small, focused tool counts — integrate it into Ludwitt and send the overview PR. Stuck on either step? Just reply and I'll help you over the line.

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
    name: "Cohort 1 Week 4 follow-up (Ludwitt integration + overview PR)",
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
