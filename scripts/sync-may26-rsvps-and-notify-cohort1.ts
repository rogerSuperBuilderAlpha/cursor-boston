#!/usr/bin/env node
/**
 * Two-step sync run for a fresh Luma export of the May 26 immersion event:
 *   1. Compute the delta between the CSV and the current
 *      `hackathonLumaRegistrants` snapshot for `sports-hack-2026`.
 *   2. For cohort-1 applicants (in {pending, admitted}) whose email is
 *      newly in the CSV, send a short "✓ your May 26 RSVP came through"
 *      confirmation email (plus a reminder about the disclosures if those
 *      two fields are still null).
 *   3. Apply the CSV to `hackathonLumaRegistrants` via the same seeder
 *      logic `seed-luma-registrants.ts` uses, with prune.
 *
 * Order is "send first, seed second" so a partial Mailgun failure can be
 * retried from the same CSV (Firestore still reflects the OLD snapshot, so
 * the delta re-computes identically). If the seed step fails after a
 * successful send, re-run will compute an empty delta — that's the safer
 * direction.
 *
 * Usage:
 *   npx tsx scripts/sync-may26-rsvps-and-notify-cohort1.ts --csv <path> --dry-run
 *   npx tsx scripts/sync-may26-rsvps-and-notify-cohort1.ts --csv <path> --send
 *
 * Requires: FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS
 * For --send: MAILGUN_API_KEY, MAILGUN_DOMAIN
 */
import { spawnSync } from "child_process";
import { readFileSync } from "fs";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { getAdminDb } from "../lib/firebase-admin";
import { sendEmail } from "../lib/mailgun";
import { buildUnsubscribeUrl } from "../lib/unsubscribe-token";
import {
  SUMMER_COHORT_COLLECTION,
  SUMMER_COHORT_IMMERSION,
  isValidCohortId,
} from "../lib/summer-cohort";
import {
  getDeclinedEmailsForEvent,
  getJudgeEmailsForEvent,
} from "../lib/hackathon-event-signup";

const EVENT_ID = SUMMER_COHORT_IMMERSION.eventId;
const COHORT_URL = "https://cursorboston.com/summer-cohort";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** We only need email + approval to compute the delta; the actual seed
 *  (which needs name, GitHub login, etc.) is delegated to
 *  scripts/seed-luma-registrants.ts so we don't duplicate parsing logic. */
interface CsvRow {
  email: string;
  approval: string;
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
      // skip
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

function loadCsvRows(csvPath: string): CsvRow[] {
  const raw = readFileSync(csvPath, "utf8");
  const rows = parseCsv(raw);
  const out: CsvRow[] = [];
  for (const r of rows) {
    const email = (r.email || "").trim().toLowerCase();
    if (!email) continue;
    out.push({
      email,
      approval: (r.approval_status || "").toLowerCase(),
    });
  }
  return out;
}

interface Cohort1Recipient {
  email: string;
  name: string;
  disclosuresComplete: boolean;
}

function buildConfirmationEmail(r: Cohort1Recipient): {
  subject: string;
  html: string;
  text: string;
} {
  const first = escapeHtml(r.name?.split(" ")[0]?.trim() || "there");
  const unsubUrl = buildUnsubscribeUrl(r.email);
  const subject = `✓ Your ${SUMMER_COHORT_IMMERSION.label} RSVP came through`;

  const disclosuresHtml = r.disclosuresComplete
    ? ""
    : `<p style="margin:16px 0;padding:10px 14px;background:#fffbeb;border-left:4px solid #f59e0b;border-radius:4px;">
  <strong>One thing still owed:</strong> we added two questions to the cohort application — locality + comfort with presenting/managing the platform — and you haven't filled them in yet. Quick update at <a href="${COHORT_URL}">${COHORT_URL}</a>.
</p>`;

  const disclosuresText = r.disclosuresComplete
    ? ""
    : `\nONE THING STILL OWED: we added two questions to the cohort application — locality + comfort with presenting/managing the platform — and you haven't filled them in yet. Quick update at ${COHORT_URL}.\n`;

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:640px;">
<p>Hi ${first},</p>

<p>Quick note — your <strong>${escapeHtml(SUMMER_COHORT_IMMERSION.label)}</strong> RSVP for the ${escapeHtml(SUMMER_COHORT_IMMERSION.title)} just came through on Luma. You're confirmed as Cohort 1 with priority on the 80-person cap. See you there.</p>

${disclosuresHtml}

<p>Reply to this email with any questions.</p>

<p>— Roger &amp; Cursor Boston<br/>
<a href="mailto:roger@cursorboston.com">roger@cursorboston.com</a><br/>
<a href="https://cursorboston.com">https://cursorboston.com</a></p>

<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#888;">
You're receiving this because you applied to Cohort 1 of the Cursor Boston Summer Cohort and just RSVP'd to the May 26 immersion event.<br/>
Don't want to hear from us? <a href="${escapeHtml(unsubUrl)}" style="color:#888;">Unsubscribe</a>
</p>
</body></html>`;

  const text = `Hi ${r.name?.split(" ")[0]?.trim() || "there"},

Quick note — your ${SUMMER_COHORT_IMMERSION.label} RSVP for the ${SUMMER_COHORT_IMMERSION.title} just came through on Luma. You're confirmed as Cohort 1 with priority on the 80-person cap. See you there.
${disclosuresText}
Reply to this email with any questions.

— Roger & Cursor Boston
roger@cursorboston.com
https://cursorboston.com

You're receiving this because you applied to Cohort 1 of the Cursor Boston Summer Cohort and just RSVP'd to the May 26 immersion event.
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
    console.error("Missing required --csv <path>.");
    process.exit(1);
  }
  return { dryRun, send, csvPath };
}

async function main() {
  const { dryRun, send, csvPath } = parseArgs(process.argv.slice(2));

  if (send && (!process.env.MAILGUN_API_KEY || !process.env.MAILGUN_DOMAIN)) {
    console.error("For --send, set MAILGUN_API_KEY and MAILGUN_DOMAIN.");
    process.exit(1);
  }

  const db = getAdminDb();
  if (!db) {
    console.error("Firebase Admin not configured.");
    process.exit(1);
  }

  // 1. Load CSV (filter out declined + judge/declined-overrides), extract email set.
  const csvRows = loadCsvRows(csvPath);
  const judgeEmails = getJudgeEmailsForEvent(EVENT_ID);
  const declinedEmails = getDeclinedEmailsForEvent(EVENT_ID);
  const csvEmails = new Set<string>();
  let csvDeclined = 0;
  let csvJudgeOrOpsDecline = 0;
  for (const row of csvRows) {
    if (row.approval === "declined") {
      csvDeclined++;
      continue;
    }
    if (judgeEmails.has(row.email) || declinedEmails.has(row.email)) {
      csvJudgeOrOpsDecline++;
      continue;
    }
    csvEmails.add(row.email);
  }
  console.log(`CSV: ${csvRows.length} rows | accepted: ${csvEmails.size} | declined: ${csvDeclined} | judge/ops-declined: ${csvJudgeOrOpsDecline}`);

  // 2. Snapshot Firestore Luma list BEFORE any writes (this is the "before" set).
  const lumaSnap = await db
    .collection("hackathonLumaRegistrants")
    .where("eventId", "==", EVENT_ID)
    .get();
  const beforeEmails = new Set<string>();
  for (const doc of lumaSnap.docs) {
    const e = (doc.data().email || "").toString().trim().toLowerCase();
    if (e) beforeEmails.add(e);
  }
  console.log(`Firestore (before): ${beforeEmails.size} RSVPs already on file.`);

  // 3. Compute newly-added emails.
  const newlyAdded = new Set<string>();
  for (const e of csvEmails) if (!beforeEmails.has(e)) newlyAdded.add(e);
  const dropped = new Set<string>();
  for (const e of beforeEmails) if (!csvEmails.has(e)) dropped.add(e);
  console.log(`Newly added (CSV but not in Firestore): ${newlyAdded.size}`);
  console.log(`Dropped (in Firestore but not in CSV): ${dropped.size}`);

  // 4. Find cohort-1 applicants (status in {pending, admitted}) whose email is newly added.
  const appsSnap = await db
    .collection(SUMMER_COHORT_COLLECTION)
    .orderBy("createdAt", "asc")
    .get();
  const recipients: Cohort1Recipient[] = [];
  for (const doc of appsSnap.docs) {
    const data = doc.data();
    const email = (data.email || "").toString().trim();
    if (!email) continue;
    const cohorts = Array.isArray(data.cohorts)
      ? data.cohorts.filter(isValidCohortId)
      : [];
    if (!cohorts.includes("cohort-1")) continue;
    const status = typeof data.status === "string" ? data.status : "pending";
    if (status !== "pending" && status !== "admitted") continue;
    if (!newlyAdded.has(email.toLowerCase())) continue;
    recipients.push({
      email,
      name: typeof data.name === "string" ? data.name : "",
      disclosuresComplete:
        typeof data.isLocal === "boolean" &&
        typeof data.wantsToPresent === "boolean",
    });
  }

  console.log(`\nCohort-1 applicants with NEW May 26 RSVPs: ${recipients.length}`);
  for (const r of recipients) {
    console.log(`  • ${r.name} <${r.email}>${r.disclosuresComplete ? "" : " [disclosures missing]"}`);
  }

  // 5. Dry-run preview.
  if (dryRun) {
    console.log("\n--dry-run: nothing sent, nothing seeded.\n");
    if (recipients.length > 0) {
      const sample = recipients[0]!;
      const { subject, html, text } = buildConfirmationEmail(sample);
      console.log("============================================================");
      console.log("SAMPLE confirmation email");
      console.log("============================================================");
      console.log(`To:      ${sample.email} (${sample.name || "(no name)"})`);
      console.log(`Subject: ${subject}`);
      console.log(`\n---- TEXT BODY ----\n${text}\n`);
      console.log(`---- HTML PREVIEW (first 1500 chars) ----\n${html.slice(0, 1500)}\n…`);
    } else {
      console.log("(no recipients — no emails would be sent)");
    }
    console.log(`\nWould then seed ${csvEmails.size} accepted RSVPs into hackathonLumaRegistrants and prune ${dropped.size} stale rows.`);
    return;
  }

  // 6. Send confirmation emails (BEFORE seeding so the delta stays computable on partial failure).
  let sent = 0;
  let failed = 0;
  for (const r of recipients) {
    const { subject, html, text } = buildConfirmationEmail(r);
    try {
      await sendEmail({ to: r.email, subject, html, text });
      sent++;
    } catch (e) {
      failed++;
      console.error(`Failed to send to ${r.email}`, e);
    }
    await sleep(450);
  }
  console.log(`\nEmail send complete: sent=${sent}, failed=${failed}`);

  // 7. Delegate the actual Firestore seed to scripts/seed-luma-registrants.ts —
  //    keeps the CSV→GitHub-login parsing logic in one place and avoids
  //    duplicating the per-row writes here.
  console.log("\nDelegating Firestore seed to scripts/seed-luma-registrants.ts…");
  const seedResult = spawnSync(
    "npx",
    [
      "tsx",
      "scripts/seed-luma-registrants.ts",
      "--apply",
      "--prune",
      "--event-id",
      EVENT_ID,
      "--csv",
      csvPath,
    ],
    { stdio: "inherit" }
  );
  if (seedResult.status !== 0) {
    console.error(
      `Seed step failed (exit ${seedResult.status}). Emails were sent — re-run the seeder manually.`
    );
    process.exit(seedResult.status ?? 1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
