#!/usr/bin/env node
/**
 * Send a one-time announcement to all eventContacts informing them about
 * the email list, listing which events they registered for, and giving
 * them an unsubscribe link.
 *
 * Usage:
 *   npx tsx scripts/send-contact-list-email.ts --dry-run
 *   npx tsx scripts/send-contact-list-email.ts --send
 *
 * Requires: FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS
 * For --send: MAILGUN_API_KEY, MAILGUN_DOMAIN
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { getAdminDb } from "../lib/firebase-admin";
import { sendEmail } from "../lib/mailgun";
import { syncMailgunSuppressions } from "../lib/mailgun-suppressions";
import { buildUnsubscribeUrl } from "../lib/unsubscribe-token";

// ---------------------------------------------------------------------------
// Email template
// ---------------------------------------------------------------------------

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
  events: {
    eventName: string;
    checkedIn: boolean;
    approvalStatus: string;
  }[];
}

function buildEmail(contact: ContactData): {
  subject: string;
  html: string;
  text: string;
} {
  const first = escapeHtml(
    contact.firstName?.trim() || contact.name?.split(" ")[0]?.trim() || "there"
  );
  const unsubUrl = buildUnsubscribeUrl(contact.email);

  const subject = "Cursor Boston — what's next (and how to get involved)";

  const eventNames = contact.events.map((e) => e.eventName).filter(Boolean);
  const uniqueEvents = [...new Set(eventNames)];
  const eventListHtml =
    uniqueEvents.length > 0
      ? uniqueEvents.map((n) => escapeHtml(n)).join(", ")
      : "a Cursor Boston event";
  const eventListText =
    uniqueEvents.length > 0
      ? uniqueEvents.join(", ")
      : "a Cursor Boston event";

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:640px;">
<p>Hi ${first},</p>

<p>Thank you again for being part of <strong>${eventListHtml}</strong> and the broader Cursor Boston community. Whether you shipped a PR, showed up on the waitlist, or just helped someone else in the repo, it matters.</p>

<h3 style="margin-top:24px;margin-bottom:8px;">What we're building toward</h3>

<p>Cursor Boston isn't meant to be a one-off. The goal is a <strong>sustainable community</strong>: more events, shared ownership of the site and repo, and clearer paths for people who want to <strong>organize</strong>, <strong>maintain</strong>, or <strong>host</strong> — not only attend.</p>

<h3 style="margin-top:24px;margin-bottom:8px;">Ways to plug in</h3>

<p><strong>Venues &amp; partnerships</strong> — If you have (or can intro) space for meetups or hack nights, reply to this email or write <a href="mailto:roger@cursorboston.com">roger@cursorboston.com</a>. We'll work with you on format and logistics.</p>

<p><strong>Repo &amp; site</strong> — We'll be reaching out about <strong>maintainers</strong> and clearer contribution paths so the project isn't dependent on one person. If you're interested in helping triage issues/PRs or shape how the site evolves, say so in a reply.</p>

<p><strong>Future events</strong> — Tell us what you want next (workshops, sprints, socials, hybrid, etc.). Concrete ideas and "I'd help with X" notes are especially useful.</p>

<h3 style="margin-top:24px;margin-bottom:8px;">Honest note</h3>

<p>The site and backend will keep moving toward <strong>community-run</strong> processes where it makes sense. That takes time, but the direction is set: more voices, more shared responsibility, and more room for people who want to lead small pieces.</p>

<p>Thanks for helping make this community what it is already. We're glad you're here.</p>

<p>— Roger &amp; Cursor Boston<br/>
<a href="mailto:roger@cursorboston.com">roger@cursorboston.com</a><br/>
<a href="https://cursorboston.com">https://cursorboston.com</a></p>

<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#888;">
You're receiving this because you registered for a Cursor Boston event on Luma.<br/>
Don't want to hear from us? <a href="${escapeHtml(unsubUrl)}" style="color:#888;">Unsubscribe</a>
</p>
</body></html>`;

  const text = `Hi ${contact.firstName?.trim() || contact.name?.split(" ")[0]?.trim() || "there"},

Thank you again for being part of ${eventListText} and the broader Cursor Boston community. Whether you shipped a PR, showed up on the waitlist, or just helped someone else in the repo, it matters.

WHAT WE'RE BUILDING TOWARD

Cursor Boston isn't meant to be a one-off. The goal is a sustainable community: more events, shared ownership of the site and repo, and clearer paths for people who want to organize, maintain, or host — not only attend.

WAYS TO PLUG IN

Venues & partnerships — If you have (or can intro) space for meetups or hack nights, reply to this email or write roger@cursorboston.com. We'll work with you on format and logistics.

Repo & site — We'll be reaching out about maintainers and clearer contribution paths so the project isn't dependent on one person. If you're interested in helping triage issues/PRs or shape how the site evolves, say so in a reply.

Future events — Tell us what you want next (workshops, sprints, socials, hybrid, etc.). Concrete ideas and "I'd help with X" notes are especially useful.

HONEST NOTE

The site and backend will keep moving toward community-run processes where it makes sense. That takes time, but the direction is set: more voices, more shared responsibility, and more room for people who want to lead small pieces.

Thanks for helping make this community what it is already. We're glad you're here.

— Roger & Cursor Boston
roger@cursorboston.com
https://cursorboston.com

You're receiving this because you registered for a Cursor Boston event on Luma.
Unsubscribe: ${unsubUrl}`;

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

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

  // Mirror Mailgun bounces + complaints onto eventContacts.unsubscribed
  // before reading the list. No-op if MAILGUN_PRIVATE_API_KEY is unset.
  await syncMailgunSuppressions(db);

  console.log("Loading contacts from eventContacts…");
  const snap = await db.collection("eventContacts").get();
  console.log(`Total contacts: ${snap.size}`);

  const contacts: ContactData[] = [];
  let skippedUnsubscribed = 0;
  let skippedDeclinedOnly = 0;

  for (const doc of snap.docs) {
    const data = doc.data();

    // Skip unsubscribed contacts
    if (data.unsubscribed === true) {
      skippedUnsubscribed++;
      continue;
    }

    const events: ContactData["events"] = (data.events || []).map(
      (e: { eventName?: string; checkedIn?: boolean; approvalStatus?: string }) => ({
        eventName: e.eventName || "",
        checkedIn: e.checkedIn || false,
        approvalStatus: e.approvalStatus || "",
      })
    );

    // Count declined-only for reporting but still include them
    if (events.length > 0 && events.every((e) => e.approvalStatus === "declined")) {
      skippedDeclinedOnly++;
    }

    contacts.push({
      email: data.email || doc.id,
      name: data.name || "",
      firstName: data.firstName || "",
      events,
    });
  }

  console.log(
    `Eligible: ${contacts.length} | Skipped unsubscribed: ${skippedUnsubscribed} | Declined-only (still included): ${skippedDeclinedOnly}`
  );

  if (dryRun) {
    console.log("\n--dry-run: no emails sent.\n");

    // Show sample
    const sample = contacts[0];
    if (sample) {
      const { subject, html } = buildEmail(sample);
      console.log(`Sample email to: ${sample.email}`);
      console.log(`Subject: ${subject}`);
      console.log(`Events: ${sample.events.map((e) => e.eventName).join(", ")}`);
      console.log(`\nHTML preview:\n---\n${html.slice(0, 600)}…\n---`);
    }

    console.log(`\nWould send to ${contacts.length} contacts.`);
    return;
  }

  // Send emails
  let sent = 0;
  let failed = 0;

  for (const contact of contacts) {
    const { subject, html, text } = buildEmail(contact);
    try {
      await sendEmail({ to: contact.email, subject, html, text });
      sent++;
      if (sent % 50 === 0) {
        console.log(`  Progress: ${sent}/${contacts.length}`);
      }
    } catch (e) {
      failed++;
      console.error(`Failed: ${contact.email}`, e);
    }
    await sleep(450);
  }

  console.log(
    `\nDone. Sent ${sent}, failed ${failed}, skipped ${skippedUnsubscribed + skippedDeclinedOnly}.`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
