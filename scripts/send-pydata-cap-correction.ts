#!/usr/bin/env node
/**
 * Short follow-up to the May 4 PyData Moderna-access blast clarifying that
 * Moderna has a hard cap of 150 attendees, allocated by registration order
 * on cursorboston.com (NOT by Luma RSVP order).
 *
 * Recipient set: same Luma CSV as the original blast, suppressed addresses
 * skipped via the auto-mirror sync at the top of main().
 *
 * Usage:
 *   npx tsx scripts/send-pydata-cap-correction.ts --csv <path> --dry-run
 *   npx tsx scripts/send-pydata-cap-correction.ts --csv <path> --send
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { readFileSync } from "fs";
import { getAdminDb } from "../lib/firebase-admin";
import { sendEmail } from "../lib/mailgun";
import { syncMailgunSuppressions } from "../lib/mailgun-suppressions";
import { buildUnsubscribeUrl } from "../lib/unsubscribe-token";
import {
  PYDATA_2026_CAPACITY,
  PYDATA_2026_REGISTRATIONS_COLLECTION,
} from "../lib/pydata-2026";

const REGISTER_URL =
  "https://www.cursorboston.com/events/cursor-boston-pydata-2026/register";
const EVENT_DETAIL_URL =
  "https://www.cursorboston.com/events/cursor-boston-pydata-2026";
const SUBMIT_DEADLINE_HUMAN = "Monday May 11, 11:59 PM ET";

interface Recipient {
  email: string;
  firstName: string;
  registeredOnSite: boolean;
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

  const subject = r.registeredOnSite
    ? `PyData May 13 — your spot is locked in (${PYDATA_2026_CAPACITY}-person hard cap)`
    : `PyData May 13 — ${PYDATA_2026_CAPACITY}-person HARD CAP, register on cursorboston.com to claim a spot`;

  const statusBlockText = r.registeredOnSite
    ? `Good news: you're already registered on cursorboston.com, so your spot is in the queue. Spots are awarded by order of registration on the website, so the earlier you registered, the safer you are.`
    : `IMPORTANT: you have not yet registered on cursorboston.com. Spots fill in the order people register on the site — Luma RSVPs do not count. If we hit ${PYDATA_2026_CAPACITY} before you register, you go on the waitlist with no guarantee of admission.`;

  const text = `${greet}

Quick correction / clarification on this morning's email about the May 13 PyData × Cursor Boston event at Moderna:

Moderna has a HARD CAP of ${PYDATA_2026_CAPACITY} attendees. Spots are first come, first served, allocated by the order of registrations on cursorboston.com — NOT by Luma RSVP order. A Luma RSVP from months ago does not put you ahead of someone who registers on the website today.

${statusBlockText}

Register here: ${REGISTER_URL}

Deadline either way: ${SUBMIT_DEADLINE_HUMAN}. After that we send Moderna the top ${PYDATA_2026_CAPACITY} and stop.

Everything else from this morning's email still applies (full process explainer at ${EVENT_DETAIL_URL}, Envoy NDA after the cutoff, government ID at the door, etc.).

Sorry for the back-to-back emails — wanted you to have the cap policy clearly in writing.

— Roger
Cursor Boston

---
Unsubscribe: ${unsub}
`;

  const statusBlockHtml = r.registeredOnSite
    ? `
<div style="margin:24px 0;padding:16px;border-left:4px solid #10b981;background:#ecfdf5;border-radius:6px;color:#065f46;">
  <p style="margin:0;"><strong>Good news: you're already registered on cursorboston.com</strong>, so your spot is in the queue.</p>
  <p style="margin:8px 0 0 0;font-size:14px;">Spots are awarded by order of registration on the website, so the earlier you registered, the safer you are.</p>
</div>`
    : `
<div style="margin:24px 0;padding:16px;border-left:4px solid #dc2626;background:#fef2f2;border-radius:6px;color:#991b1b;">
  <p style="margin:0;font-size:16px;"><strong>You have not yet registered on cursorboston.com.</strong></p>
  <p style="margin:8px 0 0 0;">Spots fill in the order people register on the site — Luma RSVPs do not count. If we hit ${PYDATA_2026_CAPACITY} before you register, you go on the waitlist with no guarantee of admission.</p>
  <p style="margin:16px 0 0 0;"><a href="${REGISTER_URL}" style="display:inline-block;padding:12px 24px;background:#dc2626;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">Register now to claim a spot →</a></p>
</div>`;

  const html = `<!doctype html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111;max-width:640px;margin:0 auto;padding:24px;line-height:1.55;">
  <p>${escapeHtml(greet)}</p>

  <p>Quick correction / clarification on this morning's email about the <strong>May 13 PyData × Cursor Boston</strong> event at Moderna:</p>

  <div style="margin:20px 0;padding:16px;border:2px solid #dc2626;border-radius:8px;background:#fff;">
    <p style="margin:0;font-size:16px;color:#111;">
      <strong>Moderna has a HARD CAP of ${PYDATA_2026_CAPACITY} attendees.</strong>
    </p>
    <p style="margin:8px 0 0 0;color:#444;">
      Spots are first come, first served, allocated by the order of
      registrations on <strong>cursorboston.com</strong> — NOT by Luma RSVP
      order. A Luma RSVP from months ago does not put you ahead of someone
      who registers on the website today.
    </p>
  </div>

  ${statusBlockHtml}

  <p style="margin-top:24px;">
    <strong>Register here:</strong>
    <a href="${REGISTER_URL}" style="color:#10b981;">${REGISTER_URL}</a>
  </p>
  <p>
    <strong>Deadline either way:</strong> ${escapeHtml(SUBMIT_DEADLINE_HUMAN)}. After
    that we send Moderna the top ${PYDATA_2026_CAPACITY} and stop.
  </p>

  <p style="color:#555;">Everything else from this morning's email still applies — full process explainer is on the <a href="${EVENT_DETAIL_URL}" style="color:#10b981;">event page</a>: Envoy NDA after the cutoff, government ID at the door, etc.</p>

  <p style="color:#555;">Sorry for the back-to-back emails — wanted you to have the cap policy clearly in writing.</p>

  <p>— Roger<br>Cursor Boston</p>

  <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 16px;">
  <p style="font-size:12px;color:#999;">
    You're getting this because you RSVP'd on Luma for the May 13 PyData × Cursor Boston event.
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

  await syncMailgunSuppressions(db);

  let raw = readFileSync(csvPath, "utf8");
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  const lumaRows = parseCsv(raw);
  console.log(`Luma CSV: ${lumaRows.length} rows`);

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

  const siteRegSnap = await db.collection(PYDATA_2026_REGISTRATIONS_COLLECTION).get();
  const siteEmails = new Set<string>();
  for (const d of siteRegSnap.docs) {
    const e = (d.data().email || "").toLowerCase();
    if (e) siteEmails.add(e);
  }

  const seen = new Set<string>();
  const recipients: Recipient[] = [];
  let skippedUnsub = 0;
  let skippedDup = 0;

  for (const r of lumaRows) {
    const email = (r.email || "").trim().toLowerCase();
    if (!email) continue;
    if (seen.has(email)) {
      skippedDup++;
      continue;
    }
    seen.add(email);
    if (unsubbed.has(email)) {
      skippedUnsub++;
      continue;
    }
    const firstName =
      (r.first_name || "").trim() ||
      ecNameByEmail.get(email) ||
      ((r.name || "").split(" ")[0] || "").trim();
    recipients.push({
      email,
      firstName,
      registeredOnSite: siteEmails.has(email),
    });
  }

  const onSite = recipients.filter((r) => r.registeredOnSite).length;
  const notOnSite = recipients.filter((r) => !r.registeredOnSite).length;
  console.log(
    `Recipients: ${recipients.length} (on site: ${onSite}, not yet: ${notOnSite})`
  );
  console.log(`Skipped: ${skippedUnsub} suppressed, ${skippedDup} duplicates`);

  if (dryRun) {
    const sNot = recipients.find((r) => !r.registeredOnSite);
    const sOn = recipients.find((r) => r.registeredOnSite);
    if (sNot) {
      const { subject, text } = buildEmail(sNot);
      console.log(`\n--- sample to ${sNot.email} (NOT on site) ---`);
      console.log(`Subject: ${subject}\n`);
      console.log(text);
    }
    if (sOn) {
      const { subject } = buildEmail(sOn);
      console.log(`\n--- subject for already-on-site (${sOn.email}) ---`);
      console.log(`Subject: ${subject}`);
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
