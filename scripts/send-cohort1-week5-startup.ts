#!/usr/bin/env node
/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Week 5 kickoff to every admitted Cohort 1 applicant.
 *
 * Two beats:
 *   1. Celebrate Week 4 — a bunch of apps got connected into Ludwitt, and as a
 *      thank-you everyone got $5 of Ludwitt credit added to their account for
 *      their apps.
 *   2. Week 5 is "Create a startup." Deliverables: a pitch deck AND a full,
 *      production application that real users can actually use. PR the writeup
 *      to cursorboston on the `c1w5startup-submission` branch so it shows on the
 *      cohort page.
 *
 * Idempotent via its own stamp field `cohort1Week5StartupEmailedAt`. `--force`
 * re-sends. `--only-email=foo@bar` restricts to a single recipient.
 *
 * Usage:
 *   npx tsx scripts/send-cohort1-week5-startup.ts --dry-run
 *   npx tsx scripts/send-cohort1-week5-startup.ts --send --only-email=rhunt@bentley.edu
 *   npx tsx scripts/send-cohort1-week5-startup.ts --send
 *   npx tsx scripts/send-cohort1-week5-startup.ts --send --force
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
const LUDWITT_URL = "https://www.ludwitt.com";
const STAMP_FIELD = "cohort1Week5StartupEmailedAt";

function buildEmail(r: Cohort1Recipient): EmailContent {
  const first = escapeHtml(r.firstName?.trim() || "there");
  const firstText = r.firstName?.trim() || "there";
  const unsubUrl = buildUnsubscribeUrl(r.email);
  const withdrawUrl = buildWithdrawUrl(r.email, "cohort-1");

  const subject = "Week 5: build a startup 🚀 (+ $5 Ludwitt credit is in your account)";

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:640px;">
<p>Hi ${first},</p>

<p><strong>Week 4 was a hit.</strong> A bunch of you got real apps connected into Ludwitt — genuinely great work. As a thank-you, <strong>we've added $5 of Ludwitt credit to everyone's account</strong> for the apps you shipped. It's already there; go spend it.</p>

<div style="border:1px solid #a7f3d0;border-radius:8px;padding:14px 16px;margin:20px 0;background:#ecfdf5;font-size:14px;color:#065f46;">
  💸 <strong>$5 of Ludwitt credit has been added to your account.</strong> <a href="${LUDWITT_URL}" style="color:#047857;font-weight:600;">Open Ludwitt →</a>
</div>

<h3 style="margin-top:28px;margin-bottom:8px;font-size:16px;">This week: create a startup 🚀</h3>
<p>Week 5 is the big one. Take what you've built and turn it into a company. By the end of the week you should have:</p>
<ul style="padding-left:20px;margin-top:4px;">
  <li style="margin-bottom:8px;"><strong>A pitch deck</strong> — the story: problem, solution, who it's for, why now, and where it goes.</li>
  <li style="margin-bottom:8px;"><strong>A full production application</strong> — not a prototype. Something real users can sign up for and actually use today.</li>
</ul>

<h3 style="margin-top:24px;margin-bottom:8px;font-size:16px;">How to submit</h3>
<p>Open a PR to cursorboston on the <code>c1w5startup-submission</code> branch with your deck and a link to the live app, so it shows up on the cohort page.</p>

<p style="margin-top:16px;">
  <a href="${COHORT_URL}" style="display:inline-block;background:#10b981;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
    Open the Week 5 tab on the cohort page →
  </a>
</p>

<p style="margin-top:20px;">Ship something you'd actually put your name on. Stuck on scope, the deck, or going live? Just reply — happy to help you shape it.</p>

<p>— Roger<br/>
<a href="mailto:roger@cursorboston.com">roger@cursorboston.com</a></p>

<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#888;">
You&apos;re receiving this because you&apos;re admitted to Cohort 1 of the Cursor Boston summer cohort.<br/>
<a href="${escapeHtml(unsubUrl)}" style="color:#888;">Unsubscribe from emails</a> · <a href="${escapeHtml(withdrawUrl)}" style="color:#888;">Withdraw from Cohort 1</a>
</p>
</body></html>`;

  const text = `Hi ${firstText},

Week 4 was a hit. A bunch of you got real apps connected into Ludwitt — genuinely great work. As a thank-you, we've added $5 of Ludwitt credit to everyone's account for the apps you shipped. It's already there; go spend it.

💸 $5 of Ludwitt credit has been added to your account. Open Ludwitt: ${LUDWITT_URL}

THIS WEEK: CREATE A STARTUP 🚀
Week 5 is the big one. Take what you've built and turn it into a company. By the end of the week you should have:
  1. A pitch deck — the story: problem, solution, who it's for, why now, and where it goes.
  2. A full production application — not a prototype. Something real users can sign up for and actually use today.

HOW TO SUBMIT
Open a PR to cursorboston on the c1w5startup-submission branch with your deck and a link to the live app, so it shows up on the cohort page.

Open the Week 5 tab on the cohort page: ${COHORT_URL}

Ship something you'd actually put your name on. Stuck on scope, the deck, or going live? Just reply — happy to help you shape it.

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
    name: "Cohort 1 Week 5 startup kickoff (+ $5 Ludwitt credit)",
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
