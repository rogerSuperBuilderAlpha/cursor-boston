#!/usr/bin/env node
/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * One-off heads-up to every admitted Cohort 1 applicant: we're meeting on
 * Discord TONIGHT at 6:00 pm EST. Topic: what it looks like and means to plug
 * an ed-tech tool into Ludwitt. Moving to Discord so a single point of failure
 * (a flaky host connection) doesn't break the session flow.
 *
 * Idempotent via `cohort1DiscordTonightEmailedAt`.
 *
 * Usage:
 *   npx tsx scripts/send-cohort1-discord-tonight.ts --dry-run
 *   npx tsx scripts/send-cohort1-discord-tonight.ts --send
 *   npx tsx scripts/send-cohort1-discord-tonight.ts --send --force
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "../lib/firebase-admin";
import { sendEmail } from "../lib/mailgun";
import { buildUnsubscribeUrl } from "../lib/unsubscribe-token";
import { SUMMER_COHORT_COLLECTION } from "../lib/summer-cohort";

const DISCORD_URL = "https://discord.gg/Wsncg8YYqc";
const STAMP_FIELD = "cohort1DiscordTonightEmailedAt";

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

  const subject = "Tonight on Discord — 6 pm EST";

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:640px;">
<p>Hi ${first},</p>

<p><strong>Let's meet on Discord tonight at 6:00 pm EST.</strong></p>

<p>We're running this one on Discord on purpose — that way if my connection hiccups, me screwing up doesn't take the whole session down with it. The flow keeps going either way.</p>

<h3 style="margin-top:28px;margin-bottom:8px;font-size:16px;">What we'll talk about</h3>
<p>What it looks like — and what it actually means — to plug an ed-tech tool into <strong>Ludwitt</strong>. Come with questions.</p>

<h3 style="margin-top:28px;margin-bottom:8px;font-size:16px;">How to join</h3>
<p>You should already be in the Cursor Boston Discord (the invite's all over the site). Hop into the voice channel at 6. If you somehow aren't in yet:</p>
<p>
  <a href="${DISCORD_URL}" style="display:inline-block;background:#5865F2;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
    Join the Discord →
  </a>
</p>

<p>See you at 6.</p>

<p>— Roger<br/>
<a href="mailto:roger@cursorboston.com">roger@cursorboston.com</a></p>

<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#888;">
You're receiving this because you're admitted to Cohort 1 of the Cursor Boston summer cohort.<br/>
<a href="${escapeHtml(unsubUrl)}" style="color:#888;">Unsubscribe</a>
</p>
</body></html>`;

  const text = `Hi ${r.firstName?.trim() || "there"},

Let's meet on Discord tonight at 6:00 pm EST.

We're running this one on Discord on purpose — that way if my connection hiccups, me screwing up doesn't take the whole session down with it. The flow keeps going either way.

WHAT WE'LL TALK ABOUT
What it looks like — and what it actually means — to plug an ed-tech tool into Ludwitt. Come with questions.

HOW TO JOIN
You should already be in the Cursor Boston Discord (the invite's all over the site). Hop into the voice channel at 6. If you somehow aren't in yet:
${DISCORD_URL}

See you at 6.

— Roger
roger@cursorboston.com

---
You're receiving this because you're admitted to Cohort 1 of the Cursor Boston summer cohort.
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

  const appsSnap = await db.collection(SUMMER_COHORT_COLLECTION).get();

  const recipients: Recipient[] = [];
  let skippedNotCohort1 = 0;
  let skippedNotAdmitted = 0;
  let skippedAlreadyEmailed = 0;
  let skippedNoEmail = 0;

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

  console.log(`Eligible recipients (admitted cohort-1, not yet emailed): ${recipients.length}`);
  console.log(`Skipped — not cohort-1: ${skippedNotCohort1}`);
  console.log(`Skipped — not admitted: ${skippedNotAdmitted}`);
  console.log(`Skipped — no email: ${skippedNoEmail}`);
  console.log(`Skipped — already emailed (${STAMP_FIELD}): ${skippedAlreadyEmailed}`);

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
    console.log(`\nRecipient count: ${recipients.length}`);
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
    await sleep(250);
  }

  console.log(`\nDone. Sent ${sent}, failed ${failed}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
