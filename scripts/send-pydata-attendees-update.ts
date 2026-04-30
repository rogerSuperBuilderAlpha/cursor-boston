#!/usr/bin/env node
/**
 * One-off update email to approved PyData attendees only (NOT the general
 * eventContacts list). Reads a Luma-export CSV and emails each row whose
 * approval_status == "approved".
 *
 * Covers:
 *   - Capacity update (150 spots, ~100 confirmed → asks no-shows to update Luma)
 *   - Cursor credits (50 codes for attendees; allocation method TBD)
 *   - Promotion of the May 26 Hult event
 *   - Heads-up that the May 30 AIC Open Source Workshop has been merged
 *     into the May 26 Hult event and removed from the site
 *
 * Usage:
 *   npx tsx scripts/send-pydata-attendees-update.ts --dry-run --csv "<path>"
 *   npx tsx scripts/send-pydata-attendees-update.ts --send    --csv "<path>"
 *
 * Requires for --send: MAILGUN_API_KEY, MAILGUN_DOMAIN
 */
import { readFileSync } from "fs";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { sendEmail } from "../lib/mailgun";
import { buildUnsubscribeUrl } from "../lib/unsubscribe-token";

const PYDATA_LUMA_URL = "https://luma.com/ggjlxdnk";

const HULT_LUMA_URL = "https://luma.com/t5vseeed";
const HULT_WEBSITE_SIGNUP_URL =
  "https://www.cursorboston.com/hackathons/sports-hack-2026/signup";
const HULT_DETAIL_URL =
  "https://www.cursorboston.com/events/cursor-boston-sports-hack-2026";
const COMMUNITY_REPO_URL =
  "https://github.com/rogerSuperBuilderAlpha/cursor-boston";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface CsvRow {
  email: string;
  first_name: string;
  last_name: string;
  name: string;
  approval_status: string;
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
        if (content[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else { field += c; }
    } else if (c === '"') { inQuotes = true; }
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\r") { /* skip */ }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else { field += c; }
  }
  row.push(field);
  if (row.some((cell) => cell.length > 0)) rows.push(row);
  if (rows.length < 2) return [];
  const header = rows[0]!.map((h) => h.trim());
  const out: Record<string, string>[] = [];
  for (let r = 1; r < rows.length; r++) {
    const line = rows[r]!;
    const obj: Record<string, string> = {};
    for (let j = 0; j < header.length; j++) obj[header[j]!] = (line[j] ?? "").trim();
    out.push(obj);
  }
  return out;
}

function buildEmail(contact: CsvRow): {
  subject: string;
  html: string;
  text: string;
} {
  const firstName =
    contact.first_name?.trim() || contact.name?.split(" ")[0]?.trim() || "there";
  const firstHtml = escapeHtml(firstName);
  const firstText = firstName;
  const unsubUrl = buildUnsubscribeUrl(contact.email);

  const subject =
    "PyData May 13 — capacity update, Cursor credits info, and a heads-up on May 26";

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:640px;">
<p>Hi ${firstHtml},</p>

<p>Quick update on the <strong>Cursor Boston × PyData Data Science Hack</strong> at Moderna HQ on <strong>Wednesday, May 13</strong> — three things to know.</p>

<h3 style="margin-top:24px;margin-bottom:8px;">1. Capacity — please update Luma if you can&apos;t make it</h3>
<p style="margin-top:0;">We&apos;ve got <strong>150 spots</strong> for the room and <strong>about 100 confirmed</strong> right now. If your plans changed and you can&apos;t attend, please <strong>update your status on Luma</strong> so we can hand the seat to someone on the waitlist. Reminder: Moderna closes sign-up 48 hours before the event, so a clean list helps everyone.</p>
<p>Manage your RSVP: <a href="${PYDATA_LUMA_URL}">${PYDATA_LUMA_URL}</a></p>

<h3 style="margin-top:24px;margin-bottom:8px;">2. Cursor credits</h3>
<p style="margin-top:0;">We have <strong>50 Cursor credit codes</strong> set aside for attendees. We&apos;re still finalizing exactly how we&apos;ll distribute them — we&apos;ll send out the method before the event so you know what to expect.</p>

<h3 style="margin-top:24px;margin-bottom:8px;">3. Heads-up about May 30 → moved to May 26</h3>
<p style="margin-top:0;">If you also RSVP&apos;d for the <strong>May 30 AIC Open Source Workshop</strong>: we&apos;ve folded it into the <strong>May 26 Cursor Boston × AIC × Hult International</strong> event and taken the standalone May 30 listing off cursorboston.com. Same Cursor + AIC team, more partners, longer day.</p>

<h3 style="margin-top:24px;margin-bottom:8px;">Bonus — May 26 at Hult</h3>
<p style="margin-top:0;">Speaking of: if you haven&apos;t already, take a look at <strong>May 26, 10 AM – 4 PM at Hult</strong>. A guest lecture from <strong>Antonio Mele (London School of Economics)</strong>, lunch, a 2-hour hackathon sprint, AI-powered scoring, and live pitches. Co-run with BeatM, Red Bull, NFX, and MIT Sports Lab. <strong>$50 Cursor credits + Red Bull merch</strong> for selected participants and a <strong>$1,200 prize pool</strong>.</p>

<p>80 confirmed seats — selection prioritizes contributors. Two steps to lock yours in:</p>
<ol style="margin-top:0;">
  <li>RSVP on Luma: <a href="${HULT_LUMA_URL}">${HULT_LUMA_URL}</a></li>
  <li>Register on the website: <a href="${HULT_WEBSITE_SIGNUP_URL}">${HULT_WEBSITE_SIGNUP_URL}</a></li>
</ol>
<p>Then merge PRs to the cursor-boston community repo to climb the leaderboard: <a href="${COMMUNITY_REPO_URL}">${COMMUNITY_REPO_URL}</a></p>
<p style="font-size:14px;color:#555;">Full detail: <a href="${HULT_DETAIL_URL}">${HULT_DETAIL_URL}</a></p>

<p>See you May 13 (and hopefully May 26 too).</p>

<p>— Roger &amp; the Cursor Boston + PyData Boston hosts<br/>
<a href="mailto:roger@cursorboston.com">roger@cursorboston.com</a> · <a href="https://cursorboston.com">https://cursorboston.com</a></p>

<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#888;">
You&apos;re receiving this because you registered for the May 13 PyData hack on Luma.<br/>
Don&apos;t want to hear from us? <a href="${escapeHtml(unsubUrl)}" style="color:#888;">Unsubscribe</a>
</p>
</body></html>`;

  const text = `Hi ${firstText},

Quick update on the Cursor Boston × PyData Data Science Hack at Moderna HQ on Wednesday, May 13 — three things to know.


1. CAPACITY — PLEASE UPDATE LUMA IF YOU CAN'T MAKE IT

We've got 150 spots for the room and about 100 confirmed right now. If your plans changed and you can't attend, please update your status on Luma so we can hand the seat to someone on the waitlist. Reminder: Moderna closes sign-up 48 hours before the event, so a clean list helps everyone.

Manage your RSVP: ${PYDATA_LUMA_URL}


2. CURSOR CREDITS

We have 50 Cursor credit codes set aside for attendees. We're still finalizing exactly how we'll distribute them — we'll send out the method before the event so you know what to expect.


3. HEADS-UP ABOUT MAY 30 → MOVED TO MAY 26

If you also RSVP'd for the May 30 AIC Open Source Workshop: we've folded it into the May 26 Cursor Boston × AIC × Hult International event and taken the standalone May 30 listing off cursorboston.com. Same Cursor + AIC team, more partners, longer day.


BONUS — MAY 26 AT HULT

Speaking of: if you haven't already, take a look at May 26, 10 AM – 4 PM at Hult. A guest lecture from Antonio Mele (London School of Economics), lunch, a 2-hour hackathon sprint, AI-powered scoring, and live pitches. Co-run with BeatM, Red Bull, NFX, and MIT Sports Lab. $50 Cursor credits + Red Bull merch for selected participants and a $1,200 prize pool.

80 confirmed seats — selection prioritizes contributors. Two steps to lock yours in:
  1. RSVP on Luma: ${HULT_LUMA_URL}
  2. Register on the website: ${HULT_WEBSITE_SIGNUP_URL}

Then merge PRs to the cursor-boston community repo to climb the leaderboard:
   → ${COMMUNITY_REPO_URL}

Full detail: ${HULT_DETAIL_URL}


See you May 13 (and hopefully May 26 too).

— Roger & the Cursor Boston + PyData Boston hosts
roger@cursorboston.com
https://cursorboston.com

---
You're receiving this because you registered for the May 13 PyData hack on Luma.
Unsubscribe: ${unsubUrl}`;

  return { subject, html, text };
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseArgs(argv: string[]) {
  const dryRun = argv.includes("--dry-run");
  const send = argv.includes("--send");
  const csvIdx = argv.indexOf("--csv");
  const csvPath = csvIdx >= 0 ? argv[csvIdx + 1] : undefined;
  if ((dryRun && send) || (!dryRun && !send)) {
    console.error("Specify exactly one of: --dry-run | --send");
    process.exit(1);
  }
  if (!csvPath) {
    console.error("Missing --csv <path>");
    process.exit(1);
  }
  return { dryRun, csvPath };
}

async function main() {
  const { dryRun, csvPath } = parseArgs(process.argv.slice(2));

  if (!dryRun) {
    if (!process.env.MAILGUN_API_KEY || !process.env.MAILGUN_DOMAIN) {
      console.error("For --send, set MAILGUN_API_KEY and MAILGUN_DOMAIN.");
      process.exit(1);
    }
  }

  const raw = readFileSync(csvPath, "utf8");
  const rows = parseCsv(raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw);
  console.log(`Loaded ${rows.length} rows from ${csvPath}`);

  // Filter to approved only, dedupe by lowercased email
  const seen = new Set<string>();
  const recipients: CsvRow[] = [];
  let skippedNotApproved = 0;
  let skippedNoEmail = 0;
  let skippedDup = 0;

  for (const r of rows) {
    const email = (r.email || "").trim().toLowerCase();
    if (!email) { skippedNoEmail++; continue; }
    const status = (r.approval_status || "").trim().toLowerCase();
    if (status !== "approved") { skippedNotApproved++; continue; }
    if (seen.has(email)) { skippedDup++; continue; }
    seen.add(email);
    recipients.push({
      email,
      first_name: r.first_name || "",
      last_name: r.last_name || "",
      name: r.name || "",
      approval_status: status,
    });
  }

  console.log(
    `Eligible (approved, deduped): ${recipients.length} | Skipped: ${skippedNotApproved} not-approved, ${skippedNoEmail} no-email, ${skippedDup} duplicate`
  );

  if (dryRun) {
    console.log("\n--dry-run: no emails sent.\n");
    const sample = recipients[0];
    if (sample) {
      const { subject, text } = buildEmail(sample);
      console.log(`Sample to: ${sample.email}`);
      console.log(`Subject: ${subject}`);
      console.log(`\n--- text preview ---\n${text}\n--- end ---`);
    }
    console.log(`\nWould send to ${recipients.length} approved attendees.`);
    return;
  }

  let sent = 0;
  let failed = 0;
  for (const c of recipients) {
    const { subject, html, text } = buildEmail(c);
    try {
      await sendEmail({ to: c.email, subject, html, text });
      sent++;
      if (sent % 25 === 0) console.log(`  Progress: ${sent}/${recipients.length}`);
    } catch (e) {
      failed++;
      console.error(`Failed: ${c.email}`, e);
    }
    await sleep(450);
  }
  console.log(`\nDone. Sent ${sent}, failed ${failed}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
