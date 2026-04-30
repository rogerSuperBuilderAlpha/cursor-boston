#!/usr/bin/env node
/**
 * Promote the Cursor Boston Summer Cohort to the full eventContacts list.
 *
 * Usage:
 *   npx tsx scripts/send-summer-cohort-announce.ts --dry-run
 *   npx tsx scripts/send-summer-cohort-announce.ts --send
 *
 * Requires: FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS
 * For --send: MAILGUN_API_KEY, MAILGUN_DOMAIN
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { getAdminDb } from "../lib/firebase-admin";
import { sendEmail } from "../lib/mailgun";
import { buildUnsubscribeUrl } from "../lib/unsubscribe-token";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface ContactData {
  email: string;
  name: string;
  firstName: string;
}

const APPLY_URL = "https://cursorboston.com/summer-cohort";

function buildEmail(contact: ContactData): {
  subject: string;
  html: string;
  text: string;
} {
  const first = escapeHtml(
    contact.firstName?.trim() || contact.name?.split(" ")[0]?.trim() || "there"
  );
  const unsubUrl = buildUnsubscribeUrl(contact.email);

  const subject = "Apply by May 9 — Cursor Boston Summer Cohort";

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:640px;">
<p>Hi ${first},</p>

<p>We're running the first <strong>Cursor Boston Summer Cohort</strong> — two six-week sessions to build with Cursor alongside other Boston developers, founders, and students.</p>

<h3 style="margin-top:24px;margin-bottom:8px;">The two cohorts</h3>

<ul style="margin:8px 0;padding-left:20px;">
  <li><strong>Cohort 1</strong> — Mon, May 11 → Fri, Jun 19, 2026</li>
  <li><strong>Cohort 2</strong> — Mon, Jun 29 → Fri, Aug 7, 2026</li>
</ul>

<p>You can apply for one or both — pick what works for your summer.</p>

<h3 style="margin-top:24px;margin-bottom:8px;">Key dates</h3>

<ul style="margin:8px 0;padding-left:20px;">
  <li><strong>Sat, May 9</strong> — applications close (last day to apply)</li>
  <li><strong>Sun, May 10</strong> — invites sent to accepted participants</li>
  <li><strong>Mon, May 11</strong> — first day: kickoff Zoom call</li>
</ul>

<p style="margin-top:20px;">
  <a href="${APPLY_URL}" style="display:inline-block;background:#10b981;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Apply now →</a>
</p>

<p style="margin-top:8px;color:#555;font-size:14px;">Or paste this link into your browser: <a href="${APPLY_URL}">${APPLY_URL}</a></p>

<h3 style="margin-top:24px;margin-bottom:8px;">What you'll need</h3>

<p>The form takes a minute — name, email, phone, and which cohort(s) you want. We'll also nudge you to connect GitHub and Discord so we can add you to the cohort channel after acceptance.</p>

<p>If you have questions, just reply to this email.</p>

<p>— Roger &amp; Cursor Boston<br/>
<a href="mailto:roger@cursorboston.com">roger@cursorboston.com</a><br/>
<a href="https://cursorboston.com">https://cursorboston.com</a></p>

<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#888;">
You're receiving this because you registered for a Cursor Boston event on Luma.<br/>
Don't want to hear from us? <a href="${escapeHtml(unsubUrl)}" style="color:#888;">Unsubscribe</a>
</p>
</body></html>`;

  const text = `Hi ${contact.firstName?.trim() || contact.name?.split(" ")[0]?.trim() || "there"},

We're running the first Cursor Boston Summer Cohort — two six-week sessions to build with Cursor alongside other Boston developers, founders, and students.

THE TWO COHORTS

  • Cohort 1 — Mon, May 11 → Fri, Jun 19, 2026
  • Cohort 2 — Mon, Jun 29 → Fri, Aug 7, 2026

You can apply for one or both — pick what works for your summer.

KEY DATES

  • Sat, May 9   — applications close (last day to apply)
  • Sun, May 10  — invites sent to accepted participants
  • Mon, May 11  — first day: kickoff Zoom call

APPLY: ${APPLY_URL}

WHAT YOU'LL NEED

The form takes a minute — name, email, phone, and which cohort(s) you want. We'll also nudge you to connect GitHub and Discord so we can add you to the cohort channel after acceptance.

If you have questions, just reply to this email.

— Roger & Cursor Boston
roger@cursorboston.com
https://cursorboston.com

You're receiving this because you registered for a Cursor Boston event on Luma.
Unsubscribe: ${unsubUrl}`;

  return { subject, html, text };
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const send = args.includes("--send");

  if ((dryRun && send) || (!dryRun && !send)) {
    console.error("Specify exactly one of: --dry-run | --send");
    process.exit(1);
  }

  if (send) {
    if (!process.env.MAILGUN_API_KEY || !process.env.MAILGUN_DOMAIN) {
      console.error("For --send, set MAILGUN_API_KEY and MAILGUN_DOMAIN.");
      process.exit(1);
    }
  }

  const db = getAdminDb();
  if (!db) {
    console.error(
      "Firebase Admin not configured (FIREBASE_SERVICE_ACCOUNT_JSON / GOOGLE_APPLICATION_CREDENTIALS)."
    );
    process.exit(1);
  }

  console.log("Loading contacts from eventContacts…");
  const snap = await db.collection("eventContacts").get();
  console.log(`Total contacts: ${snap.size}`);

  const contacts: ContactData[] = [];
  let skippedUnsubscribed = 0;
  let skippedNoEmail = 0;

  for (const doc of snap.docs) {
    const data = doc.data();

    if (data.unsubscribed === true) {
      skippedUnsubscribed++;
      continue;
    }
    const email = (data.email || doc.id || "").toString().trim();
    if (!email || !email.includes("@")) {
      skippedNoEmail++;
      continue;
    }

    contacts.push({
      email,
      name: data.name || "",
      firstName: data.firstName || "",
    });
  }

  console.log(
    `Eligible: ${contacts.length} | Skipped unsubscribed: ${skippedUnsubscribed} | Skipped no-email: ${skippedNoEmail}`
  );

  if (dryRun) {
    console.log("\n--dry-run: no emails sent.\n");
    const sample = contacts[0];
    if (sample) {
      const { subject, html, text } = buildEmail(sample);
      console.log(`Sample email to: ${sample.email}`);
      console.log(`Subject: ${subject}`);
      console.log(`\n---- HTML preview (first 1200 chars) ----\n${html.slice(0, 1200)}\n…`);
      console.log(`\n---- TEXT preview ----\n${text}`);
    }
    console.log(`\nWould send to ${contacts.length} contacts.`);
    return;
  }

  let sent = 0;
  let failed = 0;

  for (const contact of contacts) {
    const { subject, html, text } = buildEmail(contact);
    try {
      await sendEmail({ to: contact.email, subject, html, text });
      sent++;
      if (sent % 25 === 0) {
        console.log(`  Progress: ${sent}/${contacts.length}`);
      }
    } catch (e) {
      failed++;
      console.error(`Failed: ${contact.email}`, e);
    }
    await sleep(450);
  }

  console.log(
    `\nDone. Sent ${sent}, failed ${failed}, skipped ${skippedUnsubscribed + skippedNoEmail}.`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
