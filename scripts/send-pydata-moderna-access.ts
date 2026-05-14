#!/usr/bin/env node
/**
 * Targeted email to every person on the May 13 PyData Luma list explaining
 * the cursorboston.com → Moderna → Envoy → QR-code flow. Hard-line copy:
 * if they don't register on cursorboston.com before the 48h cutoff, their
 * name does not go to Moderna and they will be turned away at the door.
 *
 * Recipient set:
 *   - Read the Luma CSV passed as --csv <path>
 *   - Skip any address marked unsubscribed in eventContacts (Mailgun bounces
 *     are auto-mirrored at the top of main() before we read the list)
 *   - Personalize: greet by first name + flag whether they've already
 *     registered on the site (only ~1 today; the other 167 haven't).
 *
 * Usage:
 *   npx tsx scripts/send-pydata-moderna-access.ts --csv <path> --dry-run
 *   npx tsx scripts/send-pydata-moderna-access.ts --csv <path> --send
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
const LUMA_URL = "https://luma.com/ggjlxdnk";
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

  // Two-block opening: hard requirement + "if you've already registered" reassurance.
  const statusBlockText = r.registeredOnSite
    ? `You're already registered on cursorboston.com — thank you. The rest of this email is for context, but you can stop reading after step 4 if you want. The key thing for you is: watch for the Envoy email after the cutoff.`
    : `Action required: you have NOT yet registered on cursorboston.com. If you do not register before the ${SUBMIT_DEADLINE_HUMAN} cutoff, we will NOT send your name to Moderna, and you WILL NOT be admitted under any circumstance.`;

  const subject = r.registeredOnSite
    ? `PyData × Cursor Boston May 13 — what to expect (you're already registered on the site)`
    : `ACTION REQUIRED: PyData × Cursor Boston May 13 — register on cursorboston.com or you can't get in`;

  const text = `${greet}

You RSVP'd on Luma for the Cursor Boston × PyData Data Science Hack on Wednesday May 13 at Moderna HQ in Cambridge. We're emailing every Luma RSVP because Moderna's security process is unusually strict and a Luma RSVP alone will not get you through the door.

${statusBlockText}

────────────────────────────────────────
THE PROCESS — every step between now and the door
────────────────────────────────────────

1. NOW · Register on cursorboston.com
   Go to: ${REGISTER_URL}
   Enter your full legal name (matching your government ID — driver's license or passport), email, and optionally phone + company.
   Why this exists: Moderna requires a CSV of confirmed attendees with names that match government ID. We can only send what you enter into this form.

2. ${SUBMIT_DEADLINE_HUMAN} · 48-HOUR HARD CUTOFF
   We send the registration list to Moderna. After this point, no new names can be added. Period.
   If you are not on this list, Moderna will turn you away at the door with no chance to sign in.

3. ~1-2 days after the cutoff · Envoy emails you NDA paperwork
   You'll get an email from "Moderna HQ <no-reply@envoy.com>" with a link to sign their NDA online.
   Check your spam folder if you don't see it within 48 hours of the cutoff.

4. Before May 13 · Sign the NDA → receive your QR code
   Click the Envoy link, sign the paperwork, submit. Envoy then emails you a UNIQUE QR CODE. Save it to your phone — that QR is your entry pass.

5. Wednesday May 13, 6:30 PM ET · Show up at 325 Binney St, Cambridge
   - Show the QR code on your phone
   - Show a government-issued ID with the same name you submitted in step 1
   If your ID name does not match the name we sent, you will be turned away.

────────────────────────────────────────
IF SOMETHING GOES SIDEWAYS
────────────────────────────────────────

- Envoy email never arrived: Check spam first. If it's still missing the day-of, you can sign the NDA on paper at the door — but ONLY if your name is on the CSV from step 2. No paper sign-in for walk-ups.
- Lost your QR code: Same fallback — paper sign-in at the door, provided you're on the list.
- Name on your ID doesn't match what you submitted: Click "Edit details" on your registration page (${REGISTER_URL}) before the cutoff and fix it.
- Need to cancel: Reply to this email so we can free up the slot.

────────────────────────────────────────
A FEW EXTRA THINGS
────────────────────────────────────────

- Photos are fine, but don't include the Moderna logo or branding in anything you post.
- Bring: laptop, charger, Cursor IDE installed, registered Cursor account.
- Schedule: doors 6:30 PM, talk at 7:00, hack starts ~8:05, wrap by 9:30.

Event details: ${EVENT_DETAIL_URL}
Luma: ${LUMA_URL}

Questions? Reply to this email.

— Roger
Cursor Boston

---
Unsubscribe: ${unsub}
`;

  // Status block coloring varies by whether they're already registered.
  const statusBlockHtml = r.registeredOnSite
    ? `
<div style="margin:24px 0;padding:16px;border-left:4px solid #10b981;background:#ecfdf5;border-radius:6px;">
  <p style="margin:0;color:#065f46;"><strong>You're already registered on cursorboston.com — thank you.</strong></p>
  <p style="margin:8px 0 0 0;color:#065f46;font-size:14px;">The rest of this email is for context. The key thing for you is: watch for the Envoy email after the cutoff.</p>
</div>`
    : `
<div style="margin:24px 0;padding:16px;border-left:4px solid #dc2626;background:#fef2f2;border-radius:6px;">
  <p style="margin:0;color:#991b1b;font-size:16px;"><strong>Action required: you have NOT yet registered on cursorboston.com.</strong></p>
  <p style="margin:8px 0 0 0;color:#991b1b;">If you do not register before the <strong>${SUBMIT_DEADLINE_HUMAN}</strong> cutoff, we will <strong>NOT</strong> send your name to Moderna, and you <strong>WILL NOT</strong> be admitted under any circumstance.</p>
  <p style="margin:16px 0 0 0;"><a href="${REGISTER_URL}" style="display:inline-block;padding:12px 24px;background:#dc2626;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">Register now on cursorboston.com →</a></p>
</div>`;

  const html = `<!doctype html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111;max-width:640px;margin:0 auto;padding:24px;line-height:1.55;">
  <p>${escapeHtml(greet)}</p>

  <p>You RSVP'd on Luma for the <strong>Cursor Boston × PyData Data Science Hack</strong> on <strong>Wednesday May 13 at Moderna HQ in Cambridge</strong>. We're emailing every Luma RSVP because Moderna's security process is unusually strict and a Luma RSVP alone will not get you through the door.</p>

  ${statusBlockHtml}

  <h2 style="margin-top:32px;color:#111;font-size:18px;border-bottom:2px solid #111;padding-bottom:8px;">The process — every step between now and the door</h2>

  <ol style="padding-left:20px;">
    <li style="margin-bottom:16px;">
      <strong>Now · Register on cursorboston.com</strong><br>
      <a href="${REGISTER_URL}" style="color:#10b981;">${REGISTER_URL}</a><br>
      <span style="color:#555;">Enter your full legal name (matching your government ID — driver's license or passport), email, and optionally phone + company. Moderna requires a CSV of confirmed attendees with names that match government ID. We can only send what you enter into this form.</span>
    </li>

    <li style="margin-bottom:16px;">
      <strong style="color:#dc2626;">${escapeHtml(SUBMIT_DEADLINE_HUMAN)} · 48-hour hard cutoff</strong><br>
      <span style="color:#555;">We send the registration list to Moderna. After this point, no new names can be added. Period. If you are not on this list, Moderna will turn you away at the door with no chance to sign in.</span>
    </li>

    <li style="margin-bottom:16px;">
      <strong>~1–2 days after the cutoff · Envoy emails you NDA paperwork</strong><br>
      <span style="color:#555;">From <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;">Moderna HQ &lt;no-reply@envoy.com&gt;</code>. Check spam if you don't see it within 48 hours of the cutoff.</span>
    </li>

    <li style="margin-bottom:16px;">
      <strong>Before May 13 · Sign the NDA → receive your QR code</strong><br>
      <span style="color:#555;">Click the Envoy link, sign the paperwork, submit. Envoy then emails you a unique QR code. Save it to your phone — that QR is your entry pass.</span>
    </li>

    <li style="margin-bottom:16px;">
      <strong>Wednesday May 13, 6:30 PM ET · Show up at 325 Binney St, Cambridge</strong>
      <ul style="margin:8px 0;color:#555;">
        <li>Show the QR code on your phone</li>
        <li>Show a <strong>government-issued ID</strong> with the same name you submitted in step 1</li>
      </ul>
      <span style="color:#555;">If your ID name does not match the name we sent, you will be turned away.</span>
    </li>
  </ol>

  <h2 style="margin-top:32px;color:#111;font-size:18px;border-bottom:2px solid #111;padding-bottom:8px;">If something goes sideways</h2>
  <ul style="color:#555;">
    <li><strong>Envoy email never arrived:</strong> Check spam first. If it's still missing the day-of, you can sign the NDA on paper at the door — but only if your name is on the CSV from step 2. No paper sign-in for walk-ups.</li>
    <li><strong>Lost your QR code:</strong> Same fallback — paper sign-in at the door, provided you're on the list.</li>
    <li><strong>Name on your ID doesn't match what you submitted:</strong> Click "Edit details" on your registration page before the cutoff and fix it.</li>
    <li><strong>Need to cancel:</strong> Reply to this email so we can free up the slot.</li>
  </ul>

  <h2 style="margin-top:32px;color:#111;font-size:18px;border-bottom:2px solid #111;padding-bottom:8px;">A few extra things</h2>
  <ul style="color:#555;">
    <li>Photos are fine, but don't include the Moderna logo or branding in anything you post.</li>
    <li>Bring: laptop, charger, Cursor IDE installed, registered Cursor account.</li>
    <li>Schedule: doors 6:30 PM, talk at 7:00, hack starts ~8:05, wrap by 9:30.</li>
  </ul>

  <p style="margin-top:32px;color:#555;">
    Event details: <a href="${EVENT_DETAIL_URL}" style="color:#10b981;">cursorboston.com</a> · Luma: <a href="${LUMA_URL}" style="color:#10b981;">${LUMA_URL}</a>
  </p>

  <p>Questions? Reply to this email.</p>

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

  // Sync Mailgun suppressions onto eventContacts before reading the list.
  await syncMailgunSuppressions(db);

  // Load Luma CSV
  let raw = readFileSync(csvPath, "utf8");
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  const lumaRows = parseCsv(raw);
  console.log(`Luma CSV: ${lumaRows.length} rows`);

  // Load suppression set + site registration set
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

  // Build dedup recipient list
  const seen = new Set<string>();
  const recipients: Recipient[] = [];
  let skippedUnsub = 0;
  let skippedDup = 0;
  let skippedNoEmail = 0;

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
    `Recipients: ${recipients.length} (already on site: ${onSite}, not yet: ${notOnSite})`
  );
  console.log(
    `Skipped: ${skippedUnsub} suppressed, ${skippedDup} duplicates, ${skippedNoEmail} blank-email`
  );

  if (dryRun) {
    const sampleNotOnSite = recipients.find((r) => !r.registeredOnSite);
    const sampleOnSite = recipients.find((r) => r.registeredOnSite);
    if (sampleNotOnSite) {
      const { subject, text } = buildEmail(sampleNotOnSite);
      console.log(`\n--- sample to ${sampleNotOnSite.email} (NOT yet on site) ---`);
      console.log(`Subject: ${subject}\n`);
      console.log(text);
    }
    if (sampleOnSite) {
      const { subject } = buildEmail(sampleOnSite);
      console.log(`\n--- subject for already-on-site recipient (${sampleOnSite.email}) ---`);
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
      await sendEmail({
        to: r.email,
        subject,
        text,
        html,
      });
      sent++;
      if (sent % 25 === 0 || sent === recipients.length) {
        console.log(`  sent ${sent}/${recipients.length}`);
      }
    } catch (e) {
      failed++;
      console.error(`  FAILED ${r.email}: ${e instanceof Error ? e.message : e}`);
    }
    // Light throttle to keep Mailgun happy.
    await new Promise((res) => setTimeout(res, 80));
  }

  console.log(`\nDone. Sent ${sent}, failed ${failed}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
