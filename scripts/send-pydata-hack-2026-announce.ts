#!/usr/bin/env node
/**
 * One-off announcement to the general email list (Firestore `eventContacts`)
 * for Cursor Boston × PyData Data Science Hack at Moderna HQ on 2026-05-13.
 *
 * Sign-up closes 48 hours prior (Moderna security), so this goes out early.
 *
 * Usage:
 *   npx tsx scripts/send-pydata-hack-2026-announce.ts --dry-run
 *   npx tsx scripts/send-pydata-hack-2026-announce.ts --send
 *
 * Requires: FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS
 * For --send: MAILGUN_API_KEY, MAILGUN_DOMAIN
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { getAdminDb } from "../lib/firebase-admin";
import { sendEmail } from "../lib/mailgun";
import { buildUnsubscribeUrl } from "../lib/unsubscribe-token";

const LUMA_URL = "https://luma.com/ggjlxdnk";
const EVENT_DETAIL_URL =
  "https://www.cursorboston.com/events/cursor-boston-pydata-2026";

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

function buildEmail(contact: ContactData): {
  subject: string;
  html: string;
  text: string;
} {
  const firstHtml = escapeHtml(
    contact.firstName?.trim() || contact.name?.split(" ")[0]?.trim() || "there"
  );
  const firstText =
    contact.firstName?.trim() || contact.name?.split(" ")[0]?.trim() || "there";
  const unsubUrl = buildUnsubscribeUrl(contact.email);

  const subject =
    "May 13 — Cursor Boston × PyData data-science hack at Moderna HQ (sign-up closes 48h prior)";

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:640px;">
<p>Hi ${firstHtml},</p>

<p>Quick one for the calendar — <strong>Cursor Boston × PyData Data Science Hack</strong>, Wednesday <strong>May 13, 6:30 PM – 9:30 PM ET</strong>, at <strong>Moderna HQ in Cambridge</strong> (325 Binney St).</p>

<p>An evening hackathon co-hosted with PyData Boston. Short talk from <strong>Eric Ma</strong>, then we break into a focused build session on data-science workflows in Cursor. Pizza, community, and Cursor credits.</p>

<h3 style="margin-top:24px;margin-bottom:8px;">Agenda</h3>
<p style="margin-top:0;">
6:30 doors open · 7:00 welcome · 7:15 Eric Ma · ~8:05 hack · ~9:10 optional demos · 9:30 end
</p>

<h3 style="margin-top:24px;margin-bottom:8px;">Register on Luma</h3>
<p><a href="${LUMA_URL}" style="display:inline-block;padding:10px 20px;background:#10b981;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">${LUMA_URL}</a></p>

<p><strong>Important — Moderna security:</strong> sign-up closes <strong>48 hours before the event</strong>. RSVPs need first name, last name, email, and organization. After approval you&apos;ll get an email from <code>no-reply@envoy.com</code> — complete the Envoy NDA sign-in before arriving. That generates the QR code you need to enter the building. No QR, no entry. Don&apos;t include Moderna branding in any photos.</p>

<h3 style="margin-top:24px;margin-bottom:8px;">Bring</h3>
<p style="margin-top:0;">Laptop, charger, Cursor IDE installed, Cursor account registered.</p>

<p>Full detail: <a href="${EVENT_DETAIL_URL}">${EVENT_DETAIL_URL}</a></p>

<p>See you May 13.</p>

<p>— Roger &amp; the Cursor Boston + PyData Boston hosts<br/>
<a href="mailto:roger@cursorboston.com">roger@cursorboston.com</a> · <a href="https://cursorboston.com">https://cursorboston.com</a></p>

<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#888;">
You&apos;re receiving this because you registered for a Cursor Boston event.<br/>
Don&apos;t want to hear from us? <a href="${escapeHtml(unsubUrl)}" style="color:#888;">Unsubscribe</a>
</p>
</body></html>`;

  const text = `Hi ${firstText},

Quick one for the calendar — Cursor Boston × PyData Data Science Hack, Wednesday May 13, 6:30 PM – 9:30 PM ET, at Moderna HQ in Cambridge (325 Binney St).

An evening hackathon co-hosted with PyData Boston. Short talk from Eric Ma, then we break into a focused build session on data-science workflows in Cursor. Pizza, community, and Cursor credits.

AGENDA
6:30 doors open · 7:00 welcome · 7:15 Eric Ma · ~8:05 hack · ~9:10 optional demos · 9:30 end

REGISTER ON LUMA
→ ${LUMA_URL}

IMPORTANT — MODERNA SECURITY
Sign-up closes 48 hours before the event. RSVPs need first name, last name, email, and organization. After approval you'll get an email from no-reply@envoy.com — complete the Envoy NDA sign-in before arriving. That generates the QR code you need to enter the building. No QR, no entry. Don't include Moderna branding in any photos.

BRING
Laptop, charger, Cursor IDE installed, Cursor account registered.

Full detail: ${EVENT_DETAIL_URL}

See you May 13.

— Roger & the Cursor Boston + PyData Boston hosts
roger@cursorboston.com
https://cursorboston.com

---
You're receiving this because you registered for a Cursor Boston event.
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

  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.unsubscribed === true) {
      skippedUnsubscribed++;
      continue;
    }
    contacts.push({
      email: data.email || doc.id,
      name: data.name || "",
      firstName: data.firstName || "",
    });
  }

  console.log(
    `Eligible: ${contacts.length} | Skipped unsubscribed: ${skippedUnsubscribed}`
  );

  if (dryRun) {
    console.log("\n--dry-run: no emails sent.\n");
    const sample = contacts[0];
    if (sample) {
      const { subject, text } = buildEmail(sample);
      console.log(`Sample email to: ${sample.email}`);
      console.log(`Subject: ${subject}`);
      console.log(`\n--- text preview ---\n${text}\n--- end ---`);
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
    `\nDone. Sent ${sent}, failed ${failed}, skipped ${skippedUnsubscribed}.`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
