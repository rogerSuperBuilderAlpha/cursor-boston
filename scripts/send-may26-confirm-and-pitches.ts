#!/usr/bin/env node
/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 */

/**
 * May-26 broadcast — confirm-attendance push + capacity context + /game + Research/CFP.
 *
 * Source of recipients: the union of two CSV exports landed on 2026-05-23.
 *   1. Partiful-style guest list ("CursorBostonBostonTechWeek_5-23_guests.csv")
 *   2. Luma export ("Cursor Boston - AIC - Hult International - Boston Tech Week
 *      Speakers & Workshop - Guests - 2026-05-23-13-51-37.csv")
 *
 * For each CSV email (lowercased + trimmed, deduped):
 *   - Look up `eventContacts/{email}`.
 *   - If existing → use eventContacts firstName/name for personalization;
 *     skip if `unsubscribed === true`.
 *   - If new → batch-write a fresh eventContacts doc tagged with the May 26
 *     event name and source = "csv-may26-broadcast" so future suppression /
 *     unsubscribe handling covers them.
 *
 * Subject + body cover:
 *   - The 4 PM ET May 26 event at Hult International (10 AM doors).
 *   - The new "Confirm attendance" second step (200 guaranteed-entry cap,
 *     119 Cursor credit links to top 119 confirmed).
 *   - Full agenda from `content/events.json:cursor-boston-sports-hack-2026`.
 *   - Short pitch for /game.
 *   - Short pitch for /research + the First Global Algorithmacy Conference CFP
 *     (Trinidad, late October / early November 2026).
 *
 * Usage:
 *   npx tsx scripts/send-may26-confirm-and-pitches.ts --dry-run
 *   npx tsx scripts/send-may26-confirm-and-pitches.ts --send
 *
 * Requires: FIREBASE_SERVICE_ACCOUNT_JSON
 * For --send: MAILGUN_API_KEY, MAILGUN_DOMAIN, UNSUBSCRIBE_SECRET
 */

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import fs from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "../lib/firebase-admin";
import { sendEmail } from "../lib/mailgun";
import { syncMailgunSuppressions } from "../lib/mailgun-suppressions";
import { buildUnsubscribeUrl } from "../lib/unsubscribe-token";

// ──────────────────── Constants ────────────────────

const FROM = "Cursor Boston <hello@cursorboston.com>";

const EVENT_NAME_MAY26 =
  "Cursor Boston - AIC - Hult International - Boston Tech Week Speakers & Workshop";

const SIGNUP_URL =
  "https://www.cursorboston.com/hackathons/sports-hack-2026/signup";
const EVENT_URL =
  "https://www.cursorboston.com/hackathons/sports-hack-2026";
const GAME_URL = "https://www.cursorboston.com/game";
const RESEARCH_URL = "https://www.cursorboston.com/research";
const ALGORITHMACY_URL =
  "https://www.cursorboston.com/research/algorithmacy-scale-coauthor-search";

const CSV_PARTIFUL = join(
  homedir(),
  "Downloads",
  "CursorBostonBostonTechWeek_5-23_guests.csv"
);
const CSV_LUMA = join(
  homedir(),
  "Downloads",
  "Cursor Boston - AIC - Hult International - Boston Tech Week Speakers & Workshop - Guests - 2026-05-23-13-51-37.csv"
);

// ──────────────────── CSV parser (RFC4180-compliant, inline-copy idiom) ────────────────────

type CsvRow = Record<string, string>;

function parseCsv(content: string): CsvRow[] {
  // Strip UTF-8 BOM if present (Luma export ships with one).
  if (content.charCodeAt(0) === 0xfeff) content = content.slice(1);
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
      // skip — handled with the following \n
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
  if (row.some((cell) => cell.length > 0)) rows.push(row);
  if (rows.length < 2) return [];
  const header = rows[0]!.map((h) => h.trim());
  const out: CsvRow[] = [];
  for (let r = 1; r < rows.length; r++) {
    const line = rows[r]!;
    const obj: CsvRow = {};
    for (let j = 0; j < header.length; j++) obj[header[j]!] = (line[j] ?? "").trim();
    out.push(obj);
  }
  return out;
}

// ──────────────────── Contact ingest ────────────────────

interface CombinedContact {
  email: string;        // canonical lowercased
  name: string;
  firstName: string;
  lastName: string;
  sources: ("partiful" | "luma")[];
}

function splitName(full: string): { firstName: string; lastName: string } {
  const trimmed = full.trim();
  if (!trimmed) return { firstName: "", lastName: "" };
  const parts = trimmed.split(/\s+/);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

function ingestPartiful(path: string): CombinedContact[] {
  const text = fs.readFileSync(path, "utf8");
  const rows = parseCsv(text);
  const out: CombinedContact[] = [];
  for (const r of rows) {
    const rawEmail = (r["What is your email?"] ?? "").trim();
    if (!rawEmail || !rawEmail.includes("@")) continue;
    const email = rawEmail.toLowerCase();
    const name = (r["Name"] ?? "").trim();
    const { firstName, lastName } = splitName(name);
    out.push({ email, name, firstName, lastName, sources: ["partiful"] });
  }
  return out;
}

function ingestLuma(path: string): CombinedContact[] {
  const text = fs.readFileSync(path, "utf8");
  const rows = parseCsv(text);
  const out: CombinedContact[] = [];
  for (const r of rows) {
    const rawEmail = (r["email"] ?? "").trim();
    if (!rawEmail || !rawEmail.includes("@")) continue;
    const email = rawEmail.toLowerCase();
    const name = (r["name"] ?? "").trim();
    const firstName = (r["first_name"] ?? "").trim() || splitName(name).firstName;
    const lastName = (r["last_name"] ?? "").trim() || splitName(name).lastName;
    out.push({ email, name, firstName, lastName, sources: ["luma"] });
  }
  return out;
}

function dedupe(all: CombinedContact[]): Map<string, CombinedContact> {
  const map = new Map<string, CombinedContact>();
  for (const c of all) {
    const existing = map.get(c.email);
    if (!existing) {
      map.set(c.email, { ...c, sources: [...c.sources] });
      continue;
    }
    // Merge: prefer non-empty fields, union sources.
    map.set(c.email, {
      email: existing.email,
      name: existing.name || c.name,
      firstName: existing.firstName || c.firstName,
      lastName: existing.lastName || c.lastName,
      sources: Array.from(new Set([...existing.sources, ...c.sources])) as (
        | "partiful"
        | "luma"
      )[],
    });
  }
  return map;
}

// ──────────────────── Email body ────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface BuildEmailInput {
  email: string;
  firstName: string;
  name: string;
}

function buildEmail(c: BuildEmailInput): { subject: string; html: string; text: string } {
  const first = escapeHtml(
    (c.firstName?.trim() || c.name?.split(" ")[0]?.trim() || "there")
  );
  const unsubUrl = buildUnsubscribeUrl(c.email);

  const subject = "Confirm your seat — Tue May 26 at Hult";

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:640px;margin:0 auto;padding:16px;">

<p>Hi ${first},</p>

<p>We're nine days out from the <strong>Boston Tech Week Sports Hack</strong> at <strong>Hult International</strong> in Cambridge — <strong>Tuesday May 26, 10 AM – 4 PM ET</strong>. Please take 10 seconds to confirm whether you'll be there.</p>

<p style="background:#ecfdf5;border-left:4px solid #10b981;padding:12px 16px;margin:16px 0;">
  <strong>Why we're asking:</strong> we just shipped a second step on top of the existing claim. Hult's room caps at <strong>200 guaranteed seats</strong> (rank 201+ is the day-of waitlist — you can still show up, just not guaranteed), and we have <strong>119 Cursor credit links</strong> to allocate to the top 119 confirmed by leaderboard rank. So your confirmation drives both the seating headcount and credit eligibility.
</p>

<p style="text-align:center;margin:24px 0;">
  <a href="${SIGNUP_URL}" style="background:#10b981;color:white;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;display:inline-block;">Confirm or decline →</a>
</p>

<p style="font-size:13px;color:#555;text-align:center;margin-top:-12px;">
  (If you've already confirmed, you're set — nothing else to do.)
</p>

<h3 style="margin-top:32px;margin-bottom:8px;">Agenda — Tuesday May 26 at Hult</h3>
<ul style="margin:0;padding-left:20px;">
  <li><strong>10:00 AM</strong> — Doors, coffee, networking</li>
  <li><strong>10:30 AM – 12:00 PM</strong> — Guest lecture: <strong>Antonio Mele</strong> (London School of Economics)</li>
  <li><strong>12:00 – 12:30 PM</strong> — Lunch</li>
  <li><strong>12:30 – 2:30 PM</strong> — 2-hour hackathon sprint</li>
  <li><strong>2:30 – 3:00 PM</strong> — AI-powered scoring</li>
  <li><strong>3:00 – 3:30 PM</strong> — Top-10 live pitches</li>
  <li><strong>3:30 – 4:00 PM</strong> — Judges' analysis + winners</li>
</ul>
<p style="font-size:13px;color:#555;margin-top:8px;">
  Full details + the public submissions page: <a href="${EVENT_URL}">cursorboston.com/hackathons/sports-hack-2026</a>.
</p>

<hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0;">

<h3 style="margin-top:0;margin-bottom:8px;">While you're on the site — two new things</h3>

<p style="margin-bottom:16px;">
  <strong>1. <a href="${GAME_URL}">/game</a> is live.</strong> Cursor Boston's turn-based strategy game built by the community. Enlist a player, claim tiles, attack neighbors, earn artifacts. Designed to be picked up in 2 minutes a day. If you're into game design or game dev, the contribution surface is wide open — units, lore, spells, balance, UI.
</p>

<p style="margin-bottom:16px;">
  <strong>2. <a href="${RESEARCH_URL}">/research</a> just opened</strong> — a community space for pre-prints, datasets, and study recruitment. Headlining the launch is the <strong><a href="${ALGORITHMACY_URL}">First Global Algorithmacy Conference</a></strong> at La Brea Pitch Lake, Trinidad &amp; Tobago, late October / early November 2026. The CFP is open right now: propose a talk by opening a PR with a Markdown abstract + outline + APA references. Algorithmacy is the worker-level communication competency for coordinating through algorithmic third parties — distinct from oracy and literacy. If you have a stake in platform work, HCI, or AI-mediated communication, this is the room.
</p>

<hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0;">

<p>See you Tuesday.</p>

<p>— Roger Hunt, Cursor Boston</p>

<p style="font-size:11px;color:#888;margin-top:32px;">
  <a href="${escapeHtml(unsubUrl)}" style="color:#888;">Unsubscribe</a>
</p>

</body></html>`;

  const text = `Hi ${c.firstName?.trim() || c.name?.split(" ")[0]?.trim() || "there"},

We're nine days out from the Boston Tech Week Sports Hack at Hult International in Cambridge — Tuesday May 26, 10 AM – 4 PM ET. Please take 10 seconds to confirm whether you'll be there.

Why we're asking: we just shipped a second step on top of the existing claim. Hult's room caps at 200 guaranteed seats (rank 201+ is the day-of waitlist — you can still show up, just not guaranteed), and we have 119 Cursor credit links to allocate to the top 119 confirmed by leaderboard rank. Your confirmation drives both the seating headcount and credit eligibility.

Confirm or decline: ${SIGNUP_URL}

(If you've already confirmed, you're set — nothing else to do.)

Agenda — Tuesday May 26 at Hult
  10:00 AM         Doors, coffee, networking
  10:30 – 12:00    Guest lecture: Antonio Mele (London School of Economics)
  12:00 – 12:30    Lunch
  12:30 – 2:30     2-hour hackathon sprint
  2:30 – 3:00      AI-powered scoring
  3:00 – 3:30      Top-10 live pitches
  3:30 – 4:00      Judges' analysis + winners

Full details + public submissions: ${EVENT_URL}

While you're on the site — two new things

1. /game is live. Cursor Boston's turn-based strategy game built by the community.
   Enlist a player, claim tiles, attack neighbors, earn artifacts. Designed to be
   picked up in 2 minutes a day. Contribution surface is wide open.
   ${GAME_URL}

2. /research just opened — community space for pre-prints, datasets, and study
   recruitment. Headlining: the First Global Algorithmacy Conference at La Brea
   Pitch Lake, Trinidad & Tobago, late Oct / early Nov 2026. CFP open: propose a
   talk via PR (abstract + outline + APA refs). Algorithmacy is the worker-level
   competency for coordinating through algorithmic third parties — distinct from
   oracy and literacy. If platform work, HCI, or AI-mediated communication are
   your beat, this is the room.
   ${RESEARCH_URL}
   ${ALGORITHMACY_URL}

See you Tuesday.

— Roger Hunt, Cursor Boston

Unsubscribe: ${unsubUrl}
`;

  return { subject, html, text };
}

// ──────────────────── Main ────────────────────

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function buildEventContactsDoc(c: CombinedContact) {
  const now = Timestamp.now();
  const nowIso = new Date().toISOString();
  return {
    email: c.email,
    name: c.name,
    firstName: c.firstName,
    lastName: c.lastName,
    events: [
      {
        eventName: EVENT_NAME_MAY26,
        checkedIn: false,
        approvalStatus: "invited",
      },
    ],
    eventNames: [EVENT_NAME_MAY26],
    totalEvents: 1,
    firstSeenAt: nowIso,
    lastSeenAt: nowIso,
    updatedAt: now,
    sources: ["csv-may26-broadcast"],
  };
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
    if (!process.env.UNSUBSCRIBE_SECRET) {
      console.error("For --send, set UNSUBSCRIBE_SECRET (≥32 bytes).");
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

  // 1. Ingest CSVs
  console.log("Ingesting CSVs…");
  const partiful = ingestPartiful(CSV_PARTIFUL);
  const luma = ingestLuma(CSV_LUMA);
  const combined = dedupe([...partiful, ...luma]);
  console.log(
    `  Partiful rows with email: ${partiful.length}, Luma rows with email: ${luma.length}`
  );
  console.log(`  Combined unique emails: ${combined.size}`);

  // 2. Suppression sync (mirrors Mailgun bounces/complaints onto eventContacts.unsubscribed)
  console.log("\nSyncing Mailgun suppressions onto eventContacts…");
  try {
    await syncMailgunSuppressions(db);
  } catch (e) {
    // Non-fatal in dry-run; warn and continue. send mode still has db-level unsubscribed checks.
    console.warn("  Suppression sync failed (continuing):", (e as Error).message);
  }

  // 3. Cross-reference vs eventContacts. We read the full collection once and
  //    look up by doc id (email-lowercased).
  console.log("\nLoading eventContacts…");
  const ecSnap = await db.collection("eventContacts").get();
  console.log(`  eventContacts total: ${ecSnap.size}`);

  const existingByEmail = new Map<
    string,
    { name?: string; firstName?: string; unsubscribed?: boolean }
  >();
  for (const doc of ecSnap.docs) {
    const data = doc.data();
    existingByEmail.set(doc.id, {
      name: typeof data.name === "string" ? data.name : undefined,
      firstName: typeof data.firstName === "string" ? data.firstName : undefined,
      unsubscribed: data.unsubscribed === true,
    });
  }

  // 4. Build new-contact set (CSV emails not in eventContacts).
  const newContacts: CombinedContact[] = [];
  let existing = 0;
  let unsubscribedCount = 0;
  for (const c of combined.values()) {
    const ec = existingByEmail.get(c.email);
    if (ec) {
      existing++;
      if (ec.unsubscribed) unsubscribedCount++;
    } else {
      newContacts.push(c);
    }
  }
  console.log(
    `  Existing in eventContacts: ${existing} (of which unsubscribed: ${unsubscribedCount})`
  );
  console.log(`  New (to be added): ${newContacts.length}`);

  // 5. Write new contacts to eventContacts in batches of 400.
  if (newContacts.length > 0) {
    console.log(
      `\n${dryRun ? "[dry-run] WOULD write" : "Writing"} ${newContacts.length} new eventContacts docs in batches of 400…`
    );
    if (!dryRun) {
      let written = 0;
      for (let i = 0; i < newContacts.length; i += 400) {
        const slice = newContacts.slice(i, i + 400);
        const batch = db.batch();
        for (const c of slice) {
          const ref = db.collection("eventContacts").doc(c.email);
          batch.set(ref, buildEventContactsDoc(c), { merge: false });
        }
        await batch.commit();
        written += slice.length;
        console.log(`    wrote ${written}/${newContacts.length}`);
      }
    }
  }

  // 6. Build final recipient list (non-unsubscribed only).
  type Recipient = { email: string; firstName: string; name: string };
  const recipients: Recipient[] = [];
  for (const c of combined.values()) {
    const ec = existingByEmail.get(c.email);
    if (ec?.unsubscribed) continue;
    recipients.push({
      email: c.email,
      // Prefer eventContacts-stored name (likely more polished) over CSV-derived.
      firstName: (ec?.firstName?.trim() || c.firstName).trim(),
      name: (ec?.name?.trim() || c.name).trim(),
    });
  }

  console.log(
    `\nFinal recipients (post-unsubscribe filter): ${recipients.length}`
  );
  console.log(`  Skipped unsubscribed: ${unsubscribedCount}`);

  if (dryRun) {
    console.log("\n--dry-run: no emails sent.");
    const sample = recipients.find((r) => r.firstName) ?? recipients[0];
    if (sample) {
      const { subject, html, text } = buildEmail(sample);
      console.log(`\nSample to: ${sample.email}  (firstName: "${sample.firstName}")`);
      console.log(`Subject: ${subject}`);
      console.log("\n--- HTML preview (first 1800 chars) ---");
      console.log(html.slice(0, 1800));
      console.log("\n--- Text preview ---");
      console.log(text);
    }
    console.log(
      `\nDry-run summary: would send to ${recipients.length} unique recipients.`
    );
    return;
  }

  // 7. Send loop.
  console.log(`\nSending to ${recipients.length} recipients…`);
  let sent = 0;
  let failed = 0;
  for (const r of recipients) {
    const { subject, html, text } = buildEmail(r);
    try {
      await sendEmail({ to: r.email, subject, html, text, from: FROM });
      sent++;
      if (sent % 50 === 0) {
        console.log(`  Progress: ${sent}/${recipients.length}`);
      }
    } catch (e) {
      failed++;
      console.error(`  FAILED: ${r.email}`, (e as Error).message);
    }
    await sleep(450);
  }

  console.log(
    `\nDone. Sent ${sent}, failed ${failed}, skipped-unsubscribed ${unsubscribedCount}, added-to-eventContacts ${newContacts.length}.`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
