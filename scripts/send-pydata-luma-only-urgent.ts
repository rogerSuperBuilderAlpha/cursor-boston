#!/usr/bin/env node
/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * URGENT email to people on the PyData May 13 Luma list who have NOT yet
 * registered on cursorboston.com. The website (Firestore
 * pydataHack2026Registrations) is the source of truth Moderna receives, so
 * Luma-only RSVPs will be turned away at security.
 *
 * No withdraw button here (per user direction) — the goal is to push them
 * onto the website while seats remain, not let them slip off the list.
 *
 * Dynamic cohort footer matches the website-reminder script:
 *   - cohort-1 admit       → "tonight 6pm kickoff" reminder
 *   - any other applicant  → "you're signed up" acknowledgement
 *   - no application       → invite to Cohort 2
 *
 * Idempotent via `pydataLumaOnlyUrgentEmailedAt` on the eventContacts doc.
 *
 * Usage:
 *   npx tsx scripts/send-pydata-luma-only-urgent.ts --dry-run --csv "<path>"
 *   npx tsx scripts/send-pydata-luma-only-urgent.ts --send    --csv "<path>"
 *   npx tsx scripts/send-pydata-luma-only-urgent.ts --send    --csv "<path>" --force
 *
 * Requires: FIREBASE_SERVICE_ACCOUNT_JSON
 * For --send: MAILGUN_API_KEY, MAILGUN_DOMAIN
 */
import { readFileSync } from "fs";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "../lib/firebase-admin";
import { sendEmail } from "../lib/mailgun";
import { buildUnsubscribeUrl } from "../lib/unsubscribe-token";
import { PYDATA_2026_REGISTRATIONS_COLLECTION } from "../lib/pydata-2026";
import { SUMMER_COHORT_COLLECTION } from "../lib/summer-cohort";

const REGISTER_URL =
  "https://cursorboston.com/events/cursor-boston-pydata-2026/register";
const COHORT_URL = "https://cursorboston.com/summer-cohort";
const GAME_URL = "https://cursorboston.com/game";
const EVENT_CONTACTS_COLLECTION = "eventContacts";
const STAMP_FIELD = "pydataLumaOnlyUrgentEmailedAt";

type FooterVariant = "cohort1-kickoff" | "applied-other" | "invite-cohort2";

interface CohortInfo {
  status: string;
  cohorts: string[];
}

interface CsvRow {
  email: string;
  firstName: string;
  lastName: string;
  approvalStatus: string;
}

interface Recipient {
  email: string;
  firstName: string;
  cohort: CohortInfo | null;
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
      /* skip */
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
  const out: Record<string, string>[] = [];
  for (let r = 1; r < rows.length; r++) {
    const line = rows[r]!;
    const obj: Record<string, string> = {};
    for (let j = 0; j < header.length; j++) obj[header[j]!] = (line[j] ?? "").trim();
    out.push(obj);
  }
  return out;
}

function chooseFooterVariant(cohort: CohortInfo | null): FooterVariant {
  if (!cohort) return "invite-cohort2";
  if (cohort.status === "admitted" && cohort.cohorts.includes("cohort-1")) {
    return "cohort1-kickoff";
  }
  return "applied-other";
}

function buildFooterHtml(variant: FooterVariant, cohort: CohortInfo | null): string {
  if (variant === "cohort1-kickoff") {
    return `<div style="margin-top:28px;padding:14px 16px;background:#ecfdf5;border:1px solid #10b981;border-radius:8px;">
  <p style="margin:0;color:#065f46;"><strong>🎯 Tonight at 6pm EST — Cohort 1 kickoff Zoom.</strong> The link is on your cohort dashboard. <a href="${COHORT_URL}" style="color:#065f46;text-decoration:underline;">Open it now</a>. See you there.</p>
</div>`;
  }
  if (variant === "applied-other") {
    const which = cohort?.cohorts.includes("cohort-2") ? "Cohort 2" : "the summer cohort";
    return `<div style="margin-top:28px;padding:14px 16px;background:#f3f4f6;border:1px solid #d1d5db;border-radius:8px;">
  <p style="margin:0;color:#374151;">You&apos;re signed up for <strong>${which}</strong>. We&apos;ll be in touch with next steps soon. <a href="${COHORT_URL}" style="color:#374151;text-decoration:underline;">Cohort page</a>.</p>
</div>`;
  }
  return `<div style="margin-top:28px;padding:14px 16px;background:#eff6ff;border:1px solid #3b82f6;border-radius:8px;">
  <p style="margin:0;color:#1e40af;"><strong>Cohort 1 just closed</strong> — but Cohort 2 applications are open. If you want in: <a href="${COHORT_URL}" style="color:#1e40af;text-decoration:underline;"><strong>Apply for Cohort 2</strong></a>.</p>
</div>`;
}

function buildFooterText(variant: FooterVariant, cohort: CohortInfo | null): string {
  if (variant === "cohort1-kickoff") {
    return `\n🎯 TONIGHT AT 6PM EST — COHORT 1 KICKOFF ZOOM.\nThe link is on your cohort dashboard: ${COHORT_URL}\nSee you there.\n`;
  }
  if (variant === "applied-other") {
    const which = cohort?.cohorts.includes("cohort-2") ? "Cohort 2" : "the summer cohort";
    return `\nYou're signed up for ${which}. We'll be in touch with next steps soon.\nCohort page: ${COHORT_URL}\n`;
  }
  return `\nCohort 1 just closed — but Cohort 2 applications are open.\nIf you want in, apply here: ${COHORT_URL}\n`;
}

function buildEmail(r: Recipient): {
  subject: string;
  html: string;
  text: string;
} {
  const firstName = r.firstName?.trim() || "there";
  const firstHtml = escapeHtml(firstName);
  const unsubUrl = buildUnsubscribeUrl(r.email);

  const variant = chooseFooterVariant(r.cohort);
  const footerHtml = buildFooterHtml(variant, r.cohort);
  const footerText = buildFooterText(variant, r.cohort);

  const subject =
    "URGENT — register on cursorboston.com or you won't be admitted to PyData May 13";

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:640px;">
<p>Hi ${firstHtml},</p>

<p>You&apos;re on the <strong>Luma list</strong> for the Cursor Boston × PyData Data Science Hack on <strong>Wednesday, May 13 at Moderna HQ</strong> — but <strong>we don&apos;t have a website registration from you yet.</strong></p>

<div style="margin:20px 0;padding:16px;background:#fee2e2;border-left:4px solid #dc2626;border-radius:4px;">
  <p style="margin:0;"><strong>The website registration on cursorboston.com is what Moderna actually uses for badge access.</strong> Luma RSVPs <strong>do not</strong> get you in the door. If you don&apos;t register on the website, you will be turned away at security.</p>
</div>

<p><strong>Register now — takes 30 seconds:</strong></p>
<p>
  <a href="${REGISTER_URL}" style="display:inline-block;background:#dc2626;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;">
    Register on cursorboston.com →
  </a>
</p>

<div style="margin-top:20px;padding:14px 16px;background:#fef3c7;border:1px solid #f59e0b;border-radius:6px;">
  <p style="margin:0;"><strong>Heads-up:</strong> the first + last name you enter <strong>must match your driver&apos;s license / passport exactly</strong>, or Moderna security will turn you away.</p>
</div>

<p style="margin-top:20px;">We&apos;re close to the 150-seat cap and Moderna closes their list 48 hours before the event. Don&apos;t wait — register now.</p>

<p>See you Wednesday (assuming you register today).</p>

<p>— Roger<br/>
<a href="mailto:roger@cursorboston.com">roger@cursorboston.com</a></p>

${footerHtml}

<p style="margin-top:24px;font-size:14px;color:#6b7280;"><strong>P.S.</strong> — Try <a href="${GAME_URL}" style="color:#6b7280;"><code>/game</code></a>, our Cursor Boston strategy game. Claim hexes, build armies, weekly turn grants. <a href="${GAME_URL}" style="color:#6b7280;">cursorboston.com/game</a></p>

<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#888;">
You&apos;re receiving this because you RSVP&apos;d on Luma for the May 13 PyData hack.<br/>
<a href="${escapeHtml(unsubUrl)}" style="color:#888;">Unsubscribe</a>
</p>
</body></html>`;

  const text = `Hi ${firstName},

You're on the LUMA LIST for the Cursor Boston × PyData Data Science Hack on Wednesday, May 13 at Moderna HQ — but we don't have a website registration from you yet.

🚨 THE WEBSITE REGISTRATION ON CURSORBOSTON.COM IS WHAT MODERNA ACTUALLY USES FOR BADGE ACCESS.
   Luma RSVPs DO NOT get you in the door. If you don't register on the website, you will be turned away at security.

REGISTER NOW — TAKES 30 SECONDS:
${REGISTER_URL}

⚠️  HEADS-UP: the first + last name you enter MUST MATCH your driver's license / passport EXACTLY, or Moderna security will turn you away.

We're close to the 150-seat cap and Moderna closes their list 48 hours before the event. Don't wait — register now.

See you Wednesday (assuming you register today).

— Roger
roger@cursorboston.com

${footerText}

P.S. — Try /game, our Cursor Boston strategy game. Claim hexes, build armies, weekly turn grants.
${GAME_URL}


---
You're receiving this because you RSVP'd on Luma for the May 13 PyData hack.
Unsubscribe: ${unsubUrl}
`;

  return { subject, html, text };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function parseArgs(argv: string[]) {
  const dryRun = argv.includes("--dry-run");
  const send = argv.includes("--send");
  const force = argv.includes("--force");
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
  return { dryRun, force, csvPath };
}

async function main(): Promise<void> {
  const { dryRun, force, csvPath } = parseArgs(process.argv.slice(2));

  if (!dryRun) {
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

  // Parse Luma CSV
  const raw = readFileSync(csvPath, "utf8");
  const cleaned = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  const rows = parseCsv(cleaned);
  console.log(`Loaded ${rows.length} rows from CSV`);

  const csvRows: CsvRow[] = [];
  const csvSeen = new Set<string>();
  let csvSkippedNotApproved = 0;
  let csvSkippedNoEmail = 0;
  let csvSkippedDup = 0;
  for (const r of rows) {
    const email = (r.email || "").trim().toLowerCase();
    if (!email) {
      csvSkippedNoEmail++;
      continue;
    }
    const status = (r.approval_status || "").trim().toLowerCase();
    if (status !== "approved") {
      csvSkippedNotApproved++;
      continue;
    }
    if (csvSeen.has(email)) {
      csvSkippedDup++;
      continue;
    }
    csvSeen.add(email);
    csvRows.push({
      email,
      firstName: r.first_name || "",
      lastName: r.last_name || "",
      approvalStatus: status,
    });
  }
  console.log(
    `Luma approved (deduped): ${csvRows.length} | skipped: ${csvSkippedNotApproved} not-approved, ${csvSkippedNoEmail} no-email, ${csvSkippedDup} duplicate`
  );

  // Pull all PyData website registrations to filter out
  console.log("Loading pydataHack2026Registrations to filter…");
  const regsSnap = await db.collection(PYDATA_2026_REGISTRATIONS_COLLECTION).get();
  const registeredEmails = new Set<string>();
  for (const doc of regsSnap.docs) {
    const d = doc.data() as { email?: string; status?: string };
    if (!d.email) continue;
    // Skip cancelled regs — if you cancelled your website reg, we still treat
    // you as Luma-only and nudge you back if you came back via Luma.
    if (d.status === "cancelled") continue;
    registeredEmails.add(d.email.toLowerCase().trim());
  }
  console.log(`Active website registrations: ${registeredEmails.size}`);

  // Build cohort lookup map
  console.log("Loading summerCohortApplications…");
  const cohortSnap = await db.collection(SUMMER_COHORT_COLLECTION).get();
  const cohortByEmail = new Map<string, CohortInfo>();
  for (const doc of cohortSnap.docs) {
    const d = doc.data() as {
      email?: string;
      status?: string;
      cohorts?: string[];
    };
    if (!d.email) continue;
    const key = d.email.toLowerCase().trim();
    if (!key) continue;
    cohortByEmail.set(key, {
      status: d.status ?? "",
      cohorts: Array.isArray(d.cohorts) ? d.cohorts : [],
    });
  }
  console.log(`Cohort applications indexed: ${cohortByEmail.size}`);

  // Pull idempotency stamps from eventContacts (in one scan rather than 215 reads)
  const stampedSet = new Set<string>();
  if (!force) {
    console.log("Loading eventContacts idempotency stamps…");
    const ecSnap = await db.collection(EVENT_CONTACTS_COLLECTION).get();
    for (const doc of ecSnap.docs) {
      const d = doc.data() as Record<string, unknown>;
      if (d[STAMP_FIELD]) stampedSet.add(doc.id);
    }
    console.log(`Already-emailed contacts: ${stampedSet.size}`);
  }

  // Filter to Luma-only + un-emailed
  const recipients: Recipient[] = [];
  let skippedRegistered = 0;
  let skippedAlreadyEmailed = 0;
  for (const row of csvRows) {
    if (registeredEmails.has(row.email)) {
      skippedRegistered++;
      continue;
    }
    if (!force && stampedSet.has(row.email)) {
      skippedAlreadyEmailed++;
      continue;
    }
    recipients.push({
      email: row.email,
      firstName: row.firstName,
      cohort: cohortByEmail.get(row.email) ?? null,
    });
  }

  // Footer breakdown
  let cohort1 = 0;
  let appliedOther = 0;
  let invite = 0;
  for (const r of recipients) {
    const v = chooseFooterVariant(r.cohort);
    if (v === "cohort1-kickoff") cohort1++;
    else if (v === "applied-other") appliedOther++;
    else invite++;
  }

  console.log(`\nEligible (Luma-only, not-yet-registered): ${recipients.length}`);
  console.log(`  cohort-1 kickoff variant: ${cohort1}`);
  console.log(`  already-applied variant: ${appliedOther}`);
  console.log(`  invite-to-cohort-2 variant: ${invite}`);
  console.log(`Skipped — already website-registered: ${skippedRegistered}`);
  console.log(`Skipped — already emailed (${STAMP_FIELD}): ${skippedAlreadyEmailed}`);

  if (dryRun) {
    console.log("\n--dry-run: no emails sent.\n");
    const samples: Recipient[] = [];
    const seenVariants = new Set<FooterVariant>();
    for (const r of recipients) {
      const v = chooseFooterVariant(r.cohort);
      if (!seenVariants.has(v)) {
        seenVariants.add(v);
        samples.push(r);
      }
      if (samples.length >= 3) break;
    }
    for (const sample of samples) {
      const { subject, text } = buildEmail(sample);
      console.log(
        `\n=== sample (variant: ${chooseFooterVariant(sample.cohort)}) ===`
      );
      console.log(`To: ${sample.email}`);
      console.log(`Subject: ${subject}`);
      console.log(`--- TEXT preview ---`);
      console.log(text);
      console.log(`--- end ---`);
    }
    console.log(`\nWould send to ${recipients.length} recipients.`);
    return;
  }

  let sent = 0;
  let failed = 0;
  for (const r of recipients) {
    const { subject, html, text } = buildEmail(r);
    try {
      await sendEmail({ to: r.email, subject, html, text });
      // Stamp idempotency on eventContacts (doc ID is the lowercased email).
      // Merge in case the contact doc doesn't exist yet (rare — should be
      // synced from CSV first — but harmless if it creates a sparse doc).
      await db
        .collection(EVENT_CONTACTS_COLLECTION)
        .doc(r.email)
        .set({ [STAMP_FIELD]: FieldValue.serverTimestamp() }, { merge: true });
      sent++;
      if (sent % 25 === 0) {
        console.log(`  Progress: ${sent}/${recipients.length}`);
      }
    } catch (e) {
      failed++;
      console.error(`Failed: ${r.email}`, e);
    }
    await sleep(450);
  }

  console.log(`\nDone. Sent ${sent}, failed ${failed}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
