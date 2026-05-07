#!/usr/bin/env node
/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Short reminder to every Luma RSVP for the May 13 PyData × Cursor Boston
 * event at Moderna who has NOT yet registered on cursorboston.com for their
 * badge. The full-context primer was already sent in
 * send-pydata-moderna-access.ts; this is a tighter nudge focused on the
 * Mon May 11 cutoff.
 *
 * Recipient set:
 *   - Luma CSV (--csv) ∩ NOT in pydataHack2026Registrations ∩ NOT unsubscribed
 *
 * Usage:
 *   npx tsx scripts/send-pydata-badge-reminder.ts --csv <path> --dry-run
 *   npx tsx scripts/send-pydata-badge-reminder.ts --csv <path> --send
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { readFileSync } from "fs";
import { getAdminDb } from "../lib/firebase-admin";
import { sendEmail } from "../lib/mailgun";
import { syncMailgunSuppressions } from "../lib/mailgun-suppressions";
import { buildUnsubscribeUrl } from "../lib/unsubscribe-token";
import { PYDATA_2026_REGISTRATIONS_COLLECTION } from "../lib/pydata-2026";

const REGISTER_URL =
  "https://www.cursorboston.com/events/cursor-boston-pydata-2026/register";
const EVENT_DETAIL_URL =
  "https://www.cursorboston.com/events/cursor-boston-pydata-2026";
const SUBMIT_DEADLINE_HUMAN = "Monday May 11, 11:59 PM ET";

interface Recipient {
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

function parseCsv(content: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < content.length; i++) {
    const c = content[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\r") {
      // ignore
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  row.push(field);
  if (row.some((c) => c.length > 0)) rows.push(row);
  if (rows.length < 2) return [];
  const header = rows[0]!.map((h) => h.trim());
  const out: Record<string, string>[] = [];
  for (let r = 1; r < rows.length; r++) {
    const obj: Record<string, string> = {};
    for (let j = 0; j < header.length; j++)
      obj[header[j]!] = (rows[r]![j] ?? "").trim();
    out.push(obj);
  }
  return out;
}

function buildEmail(r: Recipient): { subject: string; text: string; html: string } {
  const greet = r.firstName ? `Hi ${r.firstName},` : "Hi,";
  const unsub = buildUnsubscribeUrl(r.email);
  const subject =
    "Reminder: register your badge for Wed May 13 PyData × Cursor Boston (deadline Mon)";

  const text = `${greet}

Quick reminder — you RSVP'd on Luma for the Cursor Boston × PyData Data Science Hack on Wednesday, May 13 at Moderna HQ in Cambridge, but you haven't yet registered on cursorboston.com to get your badge.

DEADLINE: ${SUBMIT_DEADLINE_HUMAN}.

That's the moment we hand the final guest list to Moderna. Names submitted after that point cannot be added — Moderna security will turn anyone away who isn't on the list, no exceptions.

Register here (takes ~60 seconds):
→ ${REGISTER_URL}

What you'll need:
  - Your full legal name as it appears on your government ID (driver's license or passport). "Mike" on the form vs. "Michael" on your ID will get you turned away.
  - Email + (optional) phone + company.

After the cutoff, Envoy emails you an NDA to sign and your unique entry QR code. Bring the QR + ID on the 13th.

Event details: ${EVENT_DETAIL_URL}

If you can't make it, just reply to this email so we can free up the slot for someone on the waitlist.

— Roger
Cursor Boston

---
You're getting this because you RSVP'd on Luma but haven't registered for your badge yet.
Unsubscribe: ${unsub}
`;

  const html = `<!doctype html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111;max-width:640px;margin:0 auto;padding:24px;line-height:1.55;">
  <p>${escapeHtml(greet)}</p>

  <p>Quick reminder — you RSVP'd on Luma for the <strong>Cursor Boston × PyData Data Science Hack</strong> on <strong>Wednesday, May 13 at Moderna HQ in Cambridge</strong>, but you haven&apos;t yet registered on cursorboston.com to get your badge.</p>

  <div style="margin:24px 0;padding:16px;border-left:4px solid #dc2626;background:#fef2f2;border-radius:6px;">
    <p style="margin:0;color:#991b1b;font-size:16px;"><strong>Deadline: ${escapeHtml(SUBMIT_DEADLINE_HUMAN)}.</strong></p>
    <p style="margin:8px 0 0 0;color:#991b1b;">That&apos;s the moment we hand the final guest list to Moderna. Names submitted after that point cannot be added — Moderna security will turn anyone away who isn&apos;t on the list, no exceptions.</p>
    <p style="margin:16px 0 0 0;"><a href="${REGISTER_URL}" style="display:inline-block;padding:12px 24px;background:#dc2626;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">Register your badge now →</a></p>
  </div>

  <p><strong>What you&apos;ll need (~60 seconds):</strong></p>
  <ul style="color:#444;">
    <li>Your full legal name as it appears on your government ID (driver&apos;s license or passport). &quot;Mike&quot; on the form vs. &quot;Michael&quot; on your ID will get you turned away.</li>
    <li>Email + (optional) phone + company.</li>
  </ul>

  <p>After the cutoff, Envoy emails you an NDA to sign and your unique entry QR code. Bring the QR + ID on the 13th.</p>

  <p style="margin-top:24px;color:#555;">Event details: <a href="${EVENT_DETAIL_URL}" style="color:#10b981;">cursorboston.com</a></p>

  <p>If you can&apos;t make it, just reply to this email so we can free up the slot for someone on the waitlist.</p>

  <p>— Roger<br>Cursor Boston</p>

  <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 16px;">
  <p style="font-size:12px;color:#999;">
    You&apos;re getting this because you RSVP&apos;d on Luma for the May 13 PyData × Cursor Boston event but haven&apos;t registered for your badge yet.
    <a href="${unsub}" style="color:#999;">Unsubscribe</a>
  </p>
</body>
</html>`;

  return { subject, text, html };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const send = args.includes("--send");
  if ((dryRun && send) || (!dryRun && !send)) {
    console.error("Specify exactly one of: --dry-run | --send");
    process.exit(1);
  }
  const csvIdx = args.indexOf("--csv");
  if (csvIdx === -1 || !args[csvIdx + 1]) {
    console.error("Pass --csv <path-to-luma-export.csv>");
    process.exit(1);
  }
  const csvPath = args[csvIdx + 1]!;

  if (send) {
    if (!process.env.MAILGUN_API_KEY || !process.env.MAILGUN_DOMAIN) {
      console.error("For --send, set MAILGUN_API_KEY and MAILGUN_DOMAIN.");
      process.exit(1);
    }
  }

  const db = getAdminDb();
  if (!db) {
    console.error("Firebase Admin not configured.");
    process.exit(1);
  }

  if (send) await syncMailgunSuppressions(db);

  // Load Luma CSV
  let raw = readFileSync(csvPath, "utf8");
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  const lumaRows = parseCsv(raw);
  console.log(`Luma CSV: ${lumaRows.length} rows`);

  // eventContacts → unsubscribed + best-known firstName
  const ec = await db.collection("eventContacts").get();
  const unsubbed = new Set<string>();
  const ecNameByEmail = new Map<string, string>();
  for (const d of ec.docs) {
    const data = d.data();
    const email = (typeof data.email === "string" ? data.email : d.id).toLowerCase();
    if (data.unsubscribed === true) unsubbed.add(email);
    const fname = typeof data.firstName === "string" ? data.firstName : "";
    if (fname) ecNameByEmail.set(email, fname);
  }

  // Site registrations (badge-issued set). Excluded statuses: cancelled.
  const siteRegSnap = await db.collection(PYDATA_2026_REGISTRATIONS_COLLECTION).get();
  const siteRegisteredEmails = new Set<string>();
  let cancelledCount = 0;
  for (const d of siteRegSnap.docs) {
    const data = d.data();
    const e = (data.email || "").toString().toLowerCase();
    if (!e) continue;
    if (data.status === "cancelled") {
      cancelledCount++;
      continue;
    }
    siteRegisteredEmails.add(e);
  }

  // Build recipient list — Luma rows ∩ NOT registered ∩ NOT unsubscribed
  const seen = new Set<string>();
  const recipients: Recipient[] = [];
  let skippedRegistered = 0;
  let skippedUnsub = 0;
  let skippedDup = 0;
  let skippedNoEmail = 0;
  let skippedDeclined = 0;

  for (const r of lumaRows) {
    const email = (r.email || "").trim().toLowerCase();
    if (!email) {
      skippedNoEmail++;
      continue;
    }
    if (seen.has(email)) {
      skippedDup++;
      continue;
    }
    seen.add(email);
    if ((r.approval_status || "").toLowerCase() === "declined") {
      skippedDeclined++;
      continue;
    }
    if (unsubbed.has(email)) {
      skippedUnsub++;
      continue;
    }
    if (siteRegisteredEmails.has(email)) {
      skippedRegistered++;
      continue;
    }
    const firstName =
      (r.first_name || "").trim() ||
      ecNameByEmail.get(email) ||
      ((r.name || "").split(" ")[0] || "").trim();
    recipients.push({ email, firstName });
  }

  console.log(
    `\nLuma list: ${lumaRows.length} rows`
  );
  console.log(
    `Site registrations: ${siteRegSnap.size} (${cancelledCount} cancelled, ${siteRegisteredEmails.size} active)`
  );
  console.log(
    `\nRecipients (Luma RSVP'd but no badge yet): ${recipients.length}`
  );
  console.log(
    `Skipped: ${skippedRegistered} already-registered, ${skippedUnsub} unsubscribed, ${skippedDeclined} luma-declined, ${skippedDup} dupes, ${skippedNoEmail} blank-email`
  );

  if (dryRun) {
    const sample = recipients[0];
    if (sample) {
      const { subject, text } = buildEmail(sample);
      console.log(`\n--- sample to ${sample.email} (${sample.firstName || "(no first name)"}) ---`);
      console.log(`Subject: ${subject}\n`);
      console.log(text);
    } else {
      console.log("\n(no recipients — nothing to preview)");
    }
    console.log(`\nWould send to ${recipients.length} recipients.`);
    return;
  }

  console.log(`\nSending to ${recipients.length} recipients…`);
  let sent = 0;
  let failed = 0;
  for (const r of recipients) {
    const { subject, text, html } = buildEmail(r);
    try {
      await sendEmail({ to: r.email, subject, text, html });
      sent++;
      if (sent % 25 === 0 || sent === recipients.length) {
        console.log(`  sent ${sent}/${recipients.length}`);
      }
    } catch (e) {
      failed++;
      console.error(`  FAILED ${r.email}: ${e instanceof Error ? e.message : e}`);
    }
    await new Promise((res) => setTimeout(res, 80));
  }

  console.log(`\nDone. Sent ${sent}, failed ${failed}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
