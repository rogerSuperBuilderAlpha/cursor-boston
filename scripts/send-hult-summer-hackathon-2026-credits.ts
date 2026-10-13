#!/usr/bin/env node
/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Cursor Boston × Hult Summer Hackathon (Aug 24, 2026) — send Cursor credit
 * redemption links to attendees who checked in on Luma.
 *
 * Credits are assigned in check-in order (earliest `checked_in_at` first).
 * One unique link per checked-in guest from the credits JSON file.
 *
 * Usage:
 *   npx tsx scripts/send-hult-summer-hackathon-2026-credits.ts --dry-run
 *   npx tsx scripts/send-hult-summer-hackathon-2026-credits.ts --dry-run --only-email=you@example.com
 *   npx tsx scripts/send-hult-summer-hackathon-2026-credits.ts --send
 *
 * Optional flags:
 *   --csv <path>       Luma guest export (default: scripts/_data/hult-summer-hackathon-2026-guests-2026-08-24.csv)
 *   --credits <path>   JSON array of redemption URLs (default: scripts/_data/hult-summer-hackathon-2026-credits.json)
 *   --force            Re-send even if already logged in the idempotency file
 *   --allow-unsubscribed  Include unsubscribed addresses (manual override)
 *   --emails=a@x.com,b@y.com  Send only to these addresses (comma-separated)
 *
 * Requires: FIREBASE_SERVICE_ACCOUNT_JSON
 * For --send: MAILGUN_API_KEY, MAILGUN_DOMAIN, UNSUBSCRIBE_SECRET
 */
import { existsSync, readFileSync, appendFileSync } from "fs";
import { join } from "path";
import { loadEnv, escapeHtml, parseSendArgs, type SendArgs } from "./_lib/script-utils";
loadEnv();

import { getAdminDb } from "../lib/firebase-admin";
import { sendEmail } from "../lib/mailgun";
import { syncMailgunSuppressions } from "../lib/mailgun-suppressions";
import { buildUnsubscribeUrl } from "../lib/unsubscribe-token";

const EVENT_NAME = "Cursor Boston × Hult Summer Hackathon";
const EVENT_PAGE = "https://www.cursorboston.com/events/cursor-boston-hult-summer-hackathon-2026";
const FROM = "Roger <roger@cursorboston.com>";
const CREDIT_AMOUNT = "$50";

const DATA_DIR = join(__dirname, "_data");
const DEFAULT_CSV = join(DATA_DIR, "hult-summer-hackathon-2026-guests-2026-08-24.csv");
const DEFAULT_CREDITS = join(DATA_DIR, "hult-summer-hackathon-2026-credits.json");
const CAMPAIGN = "hult-summer-hackathon-2026-credits";
const ALREADY_SENT_JSON = join(DATA_DIR, `${CAMPAIGN}-already-sent.json`);
const SENT_LOG = join(DATA_DIR, `${CAMPAIGN}-sent.log`);

interface Recipient {
  email: string;
  firstName: string;
  name: string;
  checkedInAt: string;
  creditUrl: string;
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
    for (let j = 0; j < header.length; j++) {
      obj[header[j]!] = (rows[r]![j] ?? "").trim();
    }
    out.push(obj);
  }
  return out;
}

function loadAlreadySent(): Set<string> {
  const set = new Set<string>();
  if (existsSync(ALREADY_SENT_JSON)) {
    try {
      for (const e of JSON.parse(readFileSync(ALREADY_SENT_JSON, "utf8")) as string[]) {
        set.add(e.trim().toLowerCase());
      }
    } catch {
      /* ignore malformed seed */
    }
  }
  if (existsSync(SENT_LOG)) {
    for (const line of readFileSync(SENT_LOG, "utf8").split("\n")) {
      const e = line.trim().toLowerCase();
      if (e) set.add(e);
    }
  }
  return set;
}

function parseCli(argv: string[]): SendArgs & {
  csvPath: string;
  creditsPath: string;
  allowUnsubscribed: boolean;
  emails: string[] | null;
} {
  const args = parseSendArgs(argv);
  const csvIdx = argv.indexOf("--csv");
  const creditsIdx = argv.indexOf("--credits");
  const emailsArg = argv.find((a) => a.startsWith("--emails="));
  return {
    ...args,
    csvPath: csvIdx >= 0 ? argv[csvIdx + 1] ?? DEFAULT_CSV : DEFAULT_CSV,
    creditsPath:
      creditsIdx >= 0 ? argv[creditsIdx + 1] ?? DEFAULT_CREDITS : DEFAULT_CREDITS,
    allowUnsubscribed: argv.includes("--allow-unsubscribed"),
    emails: emailsArg
      ? emailsArg
          .slice("--emails=".length)
          .split(",")
          .map((e) => e.trim().toLowerCase())
          .filter(Boolean)
      : null,
  };
}

function loadCreditUrls(path: string): string[] {
  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.some((x) => typeof x !== "string")) {
    throw new Error("Credits file must be a JSON array of URL strings.");
  }
  return parsed as string[];
}

function buildEmail(r: Recipient): { subject: string; html: string; text: string } {
  const first = escapeHtml(r.firstName || r.name.split(" ")[0] || "there");
  const firstText = r.firstName || r.name.split(" ")[0] || "there";
  const creditLink = escapeHtml(r.creditUrl);
  const unsubUrl = buildUnsubscribeUrl(r.email);

  const subject = `Your Cursor credit — ${EVENT_NAME}`;

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:640px;">
<p>Hi ${first},</p>

<p>Thanks for checking in at the <strong>${escapeHtml(EVENT_NAME)}</strong> on Monday! As promised, here is your <strong>${CREDIT_AMOUNT} Cursor credit</strong>.</p>

<p><strong>Redeem your credit here:</strong></p>
<p><a href="${creditLink}" style="display:inline-block;margin:8px 0;padding:12px 22px;background:#10b981;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Redeem Cursor credit</a></p>
<p style="font-size:14px;color:#555;word-break:break-all;">${creditLink}</p>

<p>Event page: <a href="${escapeHtml(EVENT_PAGE)}">${escapeHtml(EVENT_PAGE)}</a></p>

<p>Reply if anything looks off, or to share what you built.</p>

<p>— Roger<br/>
<a href="mailto:roger@cursorboston.com">roger@cursorboston.com</a></p>

<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#888;">
You&apos;re receiving this because you checked in at the ${escapeHtml(EVENT_NAME)} on August 24, 2026.<br/>
<a href="${escapeHtml(unsubUrl)}" style="color:#888;">Unsubscribe from emails</a>
</p>
</body></html>`;

  const text = `Hi ${firstText},

Thanks for checking in at the ${EVENT_NAME} on Monday! As promised, here is your ${CREDIT_AMOUNT} Cursor credit.

Redeem your credit here:
${r.creditUrl}

Event page: ${EVENT_PAGE}

Reply if anything looks off, or to share what you built.

— Roger
roger@cursorboston.com

---
You're receiving this because you checked in at the ${EVENT_NAME} on August 24, 2026.
Unsubscribe: ${unsubUrl}
`;

  return { subject, html, text };
}

async function loadRecipients(args: ReturnType<typeof parseCli>): Promise<Recipient[]> {
  const db = getAdminDb();
  if (!db) {
    throw new Error("Firebase Admin not configured.");
  }

  let raw = readFileSync(args.csvPath, "utf8");
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  const rows = parseCsv(raw);
  console.log(`Luma CSV: ${rows.length} rows from ${args.csvPath}`);

  const creditUrls = loadCreditUrls(args.creditsPath);
  console.log(`Credits: ${creditUrls.length} link(s) from ${args.creditsPath}`);

  const ec = await db.collection("eventContacts").get();
  const unsubbed = new Set<string>();
  for (const d of ec.docs) {
    const data = d.data();
    const email = (typeof data.email === "string" ? data.email : d.id).toLowerCase();
    if (data.unsubscribed === true) unsubbed.add(email);
  }

  const checkedIn = rows
    .filter((r) => {
      const status = (r.approval_status || "").toLowerCase();
      return status === "approved" && !!(r.checked_in_at || "").trim();
    })
    .map((r) => {
      const email = (r.email || "").trim().toLowerCase();
      const firstName = (r.first_name || "").trim();
      const name = (r.name || "").trim() || [firstName, (r.last_name || "").trim()].filter(Boolean).join(" ");
      return {
        email,
        firstName,
        name,
        checkedInAt: (r.checked_in_at || "").trim(),
      };
    })
    .filter((r) => r.email.includes("@") && !r.email.endsWith("@anysphere.co"))
    .sort((a, b) => a.checkedInAt.localeCompare(b.checkedInAt));

  const seen = new Set<string>();
  const deduped = checkedIn.filter((r) => {
    if (seen.has(r.email)) return false;
    seen.add(r.email);
    return true;
  });

  let skippedUnsub = 0;
  const eligible = deduped.filter((r) => {
    if (!args.allowUnsubscribed && unsubbed.has(r.email)) {
      skippedUnsub++;
      return false;
    }
    return true;
  });

  const alreadySent = args.force ? new Set<string>() : loadAlreadySent();
  let skippedAlreadySent = 0;
  const pending = eligible.filter((r) => {
    if (alreadySent.has(r.email)) {
      skippedAlreadySent++;
      return false;
    }
    return true;
  });

  let skippedOnlyEmail = 0;
  let filtered = pending;
  if (args.onlyEmail) {
    const before = filtered.length;
    filtered = filtered.filter((r) => r.email === args.onlyEmail);
    skippedOnlyEmail = before - filtered.length;
  }
  if (args.emails) {
    const allow = new Set(args.emails);
    const before = filtered.length;
    filtered = filtered.filter((r) => allow.has(r.email));
    skippedOnlyEmail += before - filtered.length;
  }

  const creditIndexByEmail = new Map(
    deduped.map((r, i) => [r.email, i] as const),
  );

  if (creditUrls.length < filtered.length) {
    console.warn(
      `[warn] Only ${creditUrls.length} credit link(s) for ${filtered.length} recipient(s). The last ${filtered.length - creditUrls.length} won't get a link.`,
    );
  }

  const recipients: Recipient[] = filtered
    .map((r) => ({
      ...r,
      creditUrl: creditUrls[creditIndexByEmail.get(r.email) ?? -1] ?? "",
    }))
    .filter((r) => r.creditUrl);

  console.log(
    `Checked in: ${checkedIn.length} | deduped: ${deduped.length} | unsub skipped: ${skippedUnsub} | already-sent skipped: ${skippedAlreadySent}` +
      (args.onlyEmail || args.emails ? ` | address filter excluded: ${skippedOnlyEmail}` : ""),
  );
  console.log(`Recipients to email: ${recipients.length}`);

  const pad = (s: string, n: number) => s.slice(0, n).padEnd(n);
  console.log(`\n${pad("Checked in", 22)} ${pad("Email", 36)} ${pad("Credit", 12)}`);
  console.log("-".repeat(72));
  for (const r of recipients) {
    console.log(`${pad(r.checkedInAt, 22)} ${pad(r.email, 36)} ASSIGNED`);
  }

  return recipients;
}

async function main() {
  const args = parseCli(process.argv.slice(2));

  if (args.send) {
    if (!process.env.MAILGUN_API_KEY || !process.env.MAILGUN_DOMAIN) {
      console.error("For --send, set MAILGUN_API_KEY and MAILGUN_DOMAIN.");
      process.exit(1);
    }
    const db = getAdminDb();
    if (!db) {
      console.error("Firebase Admin not configured.");
      process.exit(1);
    }
    await syncMailgunSuppressions(db);
  }

  const recipients = await loadRecipients(args);
  if (recipients.length === 0) {
    console.log("Nothing to send.");
    return;
  }

  if (args.dryRun) {
    const sample = recipients[0]!;
    const { subject, text } = buildEmail(sample);
    console.log(`\nSample email to: ${sample.email}`);
    console.log(`Subject: ${subject}`);
    console.log("\n--- Text ---");
    console.log(text);
    console.log("\n--dry-run: no emails sent.");
    return;
  }

  let sent = 0;
  let failed = 0;
  for (const r of recipients) {
    const { subject, html, text } = buildEmail(r);
    try {
      await sendEmail({
        from: FROM,
        to: r.email,
        subject,
        html,
        text,
      });
      appendFileSync(SENT_LOG, `${r.email}\n`);
      sent++;
      console.log(`  [ok] ${r.email}`);
    } catch (e) {
      failed++;
      console.error(`  [fail] ${r.email}`, e);
    }
    await new Promise((res) => setTimeout(res, 450));
  }

  console.log(`\nDone. Sent ${sent}, failed ${failed}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
