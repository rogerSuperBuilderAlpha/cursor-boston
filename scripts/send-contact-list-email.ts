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
import { buildUnsubscribeUrl } from "../lib/unsubscribe-token";

const SITE_ORIGIN = (
  process.env.NEXT_PUBLIC_APP_URL || "https://cursorboston.com"
).replace(/\/$/, "");

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

  // Event list
  const eventLines = contact.events.map((e) => {
    const status = e.checkedIn ? "Attended" : e.approvalStatus === "approved" ? "Registered" : "Registered";
    return `<li><strong>${escapeHtml(e.eventName)}</strong> — ${status}</li>`;
  });

  const eventTextLines = contact.events.map((e) => {
    const status = e.checkedIn ? "Attended" : "Registered";
    return `  - ${e.eventName} (${status})`;
  });

  const subject = "Cursor Boston — Your event history & community updates";

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:640px;">
<p>Hi ${first},</p>

<p>Thank you for being part of the Cursor Boston community! We're putting together a contact list so we can keep you posted on upcoming events, workshops, and community news.</p>

<p><strong>Your Cursor Boston events:</strong></p>
<ul>
${eventLines.join("\n")}
</ul>

<p>This email list is built from your Luma event registrations. Going forward, we'll send occasional updates about new events, community highlights, and opportunities. We'll keep it useful and infrequent — no spam.</p>

<p><strong>Upcoming:</strong></p>
<ul>
<li><strong>Hack-a-Sprint</strong> — April 13, 2026, 4:00–8:00 PM ET, Back Bay, Boston (<a href="https://luma.com/uixo8hl6">Luma</a>)</li>
<li><strong>Open Source Workshop</strong> — May 30, 2026, 12:00–5:00 PM ET, Boston (<a href="https://luma.com/w4gvg7fl">Luma</a>)</li>
</ul>

<p>Visit <a href="${escapeHtml(SITE_ORIGIN)}">${escapeHtml(SITE_ORIGIN)}</a> to see all events, join the community, and connect your GitHub profile.</p>

<p>See you at the next one!</p>

<p>— The Cursor Boston Team</p>

<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#888;">
You're receiving this because you registered for a Cursor Boston event on Luma.<br/>
Don't want to hear from us? <a href="${escapeHtml(unsubUrl)}" style="color:#888;">Unsubscribe</a>
</p>
</body></html>`;

  const text = `Hi ${contact.firstName?.trim() || contact.name?.split(" ")[0]?.trim() || "there"},

Thank you for being part of the Cursor Boston community! We're putting together a contact list so we can keep you posted on upcoming events, workshops, and community news.

Your Cursor Boston events:
${eventTextLines.join("\n")}

This email list is built from your Luma event registrations. Going forward, we'll send occasional updates about new events, community highlights, and opportunities.

Upcoming:
  - Hack-a-Sprint — April 13, 2026, 4:00-8:00 PM ET, Back Bay, Boston (https://luma.com/uixo8hl6)
  - Open Source Workshop — May 30, 2026, 12:00-5:00 PM ET, Boston (https://luma.com/w4gvg7fl)

Visit ${SITE_ORIGIN} to see all events and join the community.

See you at the next one!
— The Cursor Boston Team

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
