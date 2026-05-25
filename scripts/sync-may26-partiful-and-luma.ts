#!/usr/bin/env node
/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Merge a Partiful CSV + a Luma CSV for the May 26 Boston Tech Week Sports
 * Hack into one canonical attendee list, then:
 *
 *   1. Write a deduped merged CSV (status normalized to
 *      approved | invited/maybe | not going). Dedupe key: lowercased email.
 *      Rows without an email (most Partiful rows) are emitted but cannot
 *      participate in any of the downstream Firestore writes.
 *
 *   2. Upsert every emailed contact into `eventContacts` under the shared
 *      event name "Boston Tech Week Sports Hack — May 26 2026". New emails
 *      get a fresh doc; existing emails get the May 26 event appended to
 *      their `events` array (idempotent re-runs).
 *
 *   3. Refresh `hackathonLumaRegistrants` for `sports-hack-2026` so the
 *      event page leaderboard reflects both Luma `approved` and Partiful
 *      `Going` attendees. Run with --prune to drop rows that fell out of
 *      both lists.
 *
 * Usage:
 *   npx tsx scripts/sync-may26-partiful-and-luma.ts \
 *     --partiful <partiful.csv> --luma <luma.csv> \
 *     --out <merged.csv> --dry-run
 *
 *   npx tsx scripts/sync-may26-partiful-and-luma.ts \
 *     --partiful <partiful.csv> --luma <luma.csv> \
 *     --out <merged.csv> --write [--prune]
 *
 * Requires: FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS.
 */
import { readFileSync, writeFileSync } from "fs";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "../lib/firebase-admin";
import { parseGithubLogin } from "./_lib/parse-github-login";

const SHARED_EVENT_NAME = "Boston Tech Week Sports Hack — May 26 2026";
const SPORTS_HACK_EVENT_ID = "sports-hack-2026";
const EVENT_CONTACTS_COLLECTION = "eventContacts";
const LUMA_REGISTRANTS_COLLECTION = "hackathonLumaRegistrants";

// ---------------------------------------------------------------------------
// CSV parsing (same shape as scripts/sync-event-contacts.ts)
// ---------------------------------------------------------------------------

type CsvRow = Record<string, string>;

function parseCsv(content: string): CsvRow[] {
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
      /* ignore */
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

function loadCsv(path: string): CsvRow[] {
  let raw = readFileSync(path, "utf8");
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  return parseCsv(raw);
}

// ---------------------------------------------------------------------------
// Status normalization
// ---------------------------------------------------------------------------

type NormalizedStatus = "approved" | "invited/maybe" | "not going";

function rankStatus(s: NormalizedStatus): number {
  // Higher wins when consolidating duplicate emails across sources.
  if (s === "approved") return 2;
  if (s === "invited/maybe") return 1;
  return 0;
}

function partifulStatus(raw: string): NormalizedStatus | null {
  const v = raw.replace(/ /g, " ").trim().toLowerCase();
  // Partiful re-labeled "Going" as "Approved" in newer exports
  // (observed 2026-05-25 May 26 final pull) — same confirmed state.
  if (v === "going" || v === "approved") return "approved";
  if (v === "invited" || v === "maybe" || v === "interested") return "invited/maybe";
  if (v === "can't go" || v === "cant go" || v === "can’t go") return "not going";
  if (v === "error") return "not going";
  return null;
}

function lumaStatus(raw: string): NormalizedStatus | null {
  const v = raw.trim().toLowerCase();
  if (v === "approved") return "approved";
  if (v === "invited") return "invited/maybe";
  if (v === "declined") return "not going";
  return null;
}

// ---------------------------------------------------------------------------
// Merge
// ---------------------------------------------------------------------------

interface MergedRow {
  email: string | null;            // null when neither source had one
  name: string;
  firstName: string;
  lastName: string;
  status: NormalizedStatus;
  sources: ("partiful" | "luma")[];
  partifulRawStatus: string | null;
  lumaRawStatus: string | null;
  githubLogin: string | null;
  linkedinUrl: string | null;
  company: string | null;
  jobTitle: string | null;
  lumaCreatedAt: string | null;
  partifulRsvpDate: string | null;
  partifulName: string | null;     // kept for emailless rows
}

function splitName(full: string): { first: string; last: string } {
  const t = full.trim();
  if (!t) return { first: "", last: "" };
  const parts = t.split(/\s+/);
  return { first: parts[0]!, last: parts.slice(1).join(" ") };
}

function mergeRows(
  partifulRows: CsvRow[],
  lumaRows: CsvRow[]
): { byEmail: Map<string, MergedRow>; emaillessPartiful: MergedRow[] } {
  const byEmail = new Map<string, MergedRow>();
  const emaillessPartiful: MergedRow[] = [];

  for (const r of partifulRows) {
    const rawStatus = r["Status"] || "";
    const status = partifulStatus(rawStatus);
    if (!status) continue; // skip "AKA", parsing junk
    const emailRaw = (r["What is your email?"] || "").trim();
    const name = (r["Name"] || "").trim();
    const { first, last } = splitName(name);
    const linkedin = (r["What's your LinkedIn URL?"] || "").trim() || null;
    const company =
      (r["What's is the name of your company?"] || r["What's the name of your company?"] || "").trim() ||
      null;
    const jobTitle = (r["What is your job title?"] || "").trim() || null;
    const githubRaw = (r["What is your GitHub?"] || "").trim();
    const githubLogin = parseGithubLogin(githubRaw);

    const base: MergedRow = {
      email: emailRaw ? emailRaw.toLowerCase() : null,
      name,
      firstName: first,
      lastName: last,
      status,
      sources: ["partiful"],
      partifulRawStatus: rawStatus,
      lumaRawStatus: null,
      githubLogin,
      linkedinUrl: linkedin,
      company,
      jobTitle,
      lumaCreatedAt: null,
      partifulRsvpDate: (r["RSVP date"] || "").trim() || null,
      partifulName: name,
    };

    if (!base.email) {
      emaillessPartiful.push(base);
      continue;
    }
    const existing = byEmail.get(base.email);
    if (existing) {
      // Same email already from Partiful (shouldn't happen, but just in case).
      if (rankStatus(base.status) > rankStatus(existing.status)) {
        existing.status = base.status;
      }
      existing.partifulRawStatus = existing.partifulRawStatus || base.partifulRawStatus;
      existing.linkedinUrl = existing.linkedinUrl || base.linkedinUrl;
      existing.company = existing.company || base.company;
      existing.jobTitle = existing.jobTitle || base.jobTitle;
      existing.githubLogin = existing.githubLogin || base.githubLogin;
      existing.partifulRsvpDate = existing.partifulRsvpDate || base.partifulRsvpDate;
      if (!existing.sources.includes("partiful")) existing.sources.push("partiful");
    } else {
      byEmail.set(base.email, base);
    }
  }

  for (const r of lumaRows) {
    const rawStatus = r["approval_status"] || "";
    const status = lumaStatus(rawStatus);
    if (!status) continue;
    const emailRaw = (r["email"] || "").trim();
    if (!emailRaw) continue;
    const email = emailRaw.toLowerCase();
    const firstName = (r["first_name"] || "").trim();
    const lastName = (r["last_name"] || "").trim();
    const name = (r["name"] || `${firstName} ${lastName}`.trim()).trim();
    const githubRaw = (r["What is your GitHub username?"] || "").trim();
    const githubLogin = parseGithubLogin(githubRaw);

    const existing = byEmail.get(email);
    if (existing) {
      if (rankStatus(status) > rankStatus(existing.status)) {
        existing.status = status;
      }
      existing.lumaRawStatus = rawStatus;
      if (!existing.sources.includes("luma")) existing.sources.push("luma");
      existing.githubLogin = existing.githubLogin || githubLogin;
      existing.lumaCreatedAt = existing.lumaCreatedAt || (r["created_at"] || "").trim() || null;
      // Prefer Luma's structured first/last when ours was a single-token guess.
      if (!existing.firstName && firstName) existing.firstName = firstName;
      if (!existing.lastName && lastName) existing.lastName = lastName;
      if (!existing.name) existing.name = name;
    } else {
      byEmail.set(email, {
        email,
        name,
        firstName,
        lastName,
        status,
        sources: ["luma"],
        partifulRawStatus: null,
        lumaRawStatus: rawStatus,
        githubLogin,
        linkedinUrl: null,
        company: null,
        jobTitle: null,
        lumaCreatedAt: (r["created_at"] || "").trim() || null,
        partifulRsvpDate: null,
        partifulName: null,
      });
    }
  }

  return { byEmail, emaillessPartiful };
}

// ---------------------------------------------------------------------------
// Merged CSV writer
// ---------------------------------------------------------------------------

function csvEscape(s: string | null | undefined): string {
  if (s === null || s === undefined) return "";
  const needs = /[",\n\r]/.test(s);
  const out = s.replace(/"/g, '""');
  return needs ? `"${out}"` : out;
}

function writeMergedCsv(
  outPath: string,
  byEmail: Map<string, MergedRow>,
  emailless: MergedRow[]
): void {
  const header = [
    "email",
    "name",
    "status",
    "sources",
    "partiful_raw_status",
    "luma_raw_status",
    "github_login",
    "linkedin_url",
    "company",
    "job_title",
    "luma_created_at",
    "partiful_rsvp_date",
  ];

  // Sort: approved → invited/maybe → not going, then by email.
  const statusOrder = (s: NormalizedStatus) => -rankStatus(s);
  const rows = [...byEmail.values()].sort(
    (a, b) =>
      statusOrder(a.status) - statusOrder(b.status) ||
      (a.email ?? "").localeCompare(b.email ?? "")
  );

  const lines: string[] = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.email,
        r.name,
        r.status,
        r.sources.join("+"),
        r.partifulRawStatus,
        r.lumaRawStatus,
        r.githubLogin,
        r.linkedinUrl,
        r.company,
        r.jobTitle,
        r.lumaCreatedAt,
        r.partifulRsvpDate,
      ]
        .map(csvEscape)
        .join(",")
    );
  }

  // Emailless block — kept separate so downstream pipelines can ignore it.
  if (emailless.length > 0) {
    lines.push("");
    lines.push("# Partiful guests without email (cannot dedupe or sync — name only)");
    lines.push(["email", "name", "status", "sources", "partiful_raw_status"].join(","));
    const sorted = emailless.sort((a, b) =>
      statusOrder(a.status) - statusOrder(b.status) || a.name.localeCompare(b.name)
    );
    for (const r of sorted) {
      lines.push(
        ["", r.name, r.status, r.sources.join("+"), r.partifulRawStatus]
          .map(csvEscape)
          .join(",")
      );
    }
  }

  writeFileSync(outPath, lines.join("\n") + "\n", "utf8");
}

// ---------------------------------------------------------------------------
// Firestore: eventContacts
// ---------------------------------------------------------------------------

interface EventAttendance {
  eventName: string;
  csvFile: string;
  registeredAt: string;
  approvalStatus: string;
  checkedIn: boolean;
  checkedInAt: string | null;
  ticketType: string | null;
}

async function upsertEventContacts(
  db: FirebaseFirestore.Firestore,
  byEmail: Map<string, MergedRow>,
  dryRun: boolean
): Promise<{ created: number; updated: number; alreadyHasEvent: number }> {
  let created = 0;
  let updated = 0;
  let alreadyHasEvent = 0;

  for (const [email, r] of byEmail) {
    const docRef = db.collection(EVENT_CONTACTS_COLLECTION).doc(email);
    const existing = await docRef.get();

    const registeredAt =
      r.lumaCreatedAt ||
      r.partifulRsvpDate ||
      "";
    const approvalStatus = r.status; // approved | invited/maybe | not going
    const attendance: EventAttendance = {
      eventName: SHARED_EVENT_NAME,
      csvFile: r.sources.join("+"),
      registeredAt,
      approvalStatus,
      checkedIn: false,
      checkedInAt: null,
      ticketType: null,
    };

    if (existing.exists) {
      const data = existing.data()!;
      const existingEvents: EventAttendance[] = Array.isArray(data.events) ? data.events : [];
      const idx = existingEvents.findIndex((e) => e.eventName === SHARED_EVENT_NAME);

      let mergedEvents: EventAttendance[];
      if (idx >= 0) {
        // Update the existing entry in place (status may have changed)
        mergedEvents = existingEvents.slice();
        mergedEvents[idx] = { ...mergedEvents[idx]!, ...attendance };
        alreadyHasEvent++;
      } else {
        mergedEvents = [...existingEvents, attendance];
        updated++;
      }

      const mergedEventNames = [...new Set(mergedEvents.map((e) => e.eventName))];
      const mergedDates = mergedEvents.map((e) => e.registeredAt).filter(Boolean).sort();

      if (!dryRun) {
        await docRef.update({
          name: r.name || data.name || "",
          firstName: r.firstName || data.firstName || "",
          lastName: r.lastName || data.lastName || "",
          events: mergedEvents,
          eventNames: mergedEventNames,
          totalEvents: mergedEventNames.length,
          firstSeenAt: mergedDates[0] || data.firstSeenAt || "",
          lastSeenAt: mergedDates[mergedDates.length - 1] || data.lastSeenAt || "",
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    } else {
      created++;
      if (!dryRun) {
        await docRef.set({
          email,
          name: r.name,
          firstName: r.firstName,
          lastName: r.lastName,
          events: [attendance],
          eventNames: [SHARED_EVENT_NAME],
          totalEvents: 1,
          firstSeenAt: registeredAt,
          lastSeenAt: registeredAt,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }
  }

  return { created, updated, alreadyHasEvent };
}

// ---------------------------------------------------------------------------
// Firestore: hackathonLumaRegistrants (page leaderboard)
// ---------------------------------------------------------------------------

interface PageRegistrant {
  email: string;
  name: string;
  githubLogin: string | null;
  lumaCreatedAt: string;
  lumaApprovalStatus: string;
  sourceTag: string;
}

async function seedHackathonLumaRegistrants(
  db: FirebaseFirestore.Firestore,
  byEmail: Map<string, MergedRow>,
  dryRun: boolean,
  prune: boolean
): Promise<{ seeded: number; pruned: number }> {
  // Only rows that should appear on the leaderboard:
  //  - approved (Luma) OR Going (Partiful) → status === "approved"
  //  - must have email (no leaderboard slot otherwise)
  const eligible: PageRegistrant[] = [];
  for (const [email, r] of byEmail) {
    if (r.status !== "approved") continue;
    eligible.push({
      email,
      name: r.name || `${r.firstName} ${r.lastName}`.trim(),
      githubLogin: r.githubLogin,
      // Sort key for the leaderboard prefers the Luma timestamp when present.
      lumaCreatedAt: r.lumaCreatedAt || r.partifulRsvpDate || "",
      lumaApprovalStatus: r.sources.includes("luma") ? "approved" : "partiful-going",
      sourceTag: r.sources.join("+"),
    });
  }

  const approvedEmails = new Set(eligible.map((r) => r.email));

  let seeded = 0;
  if (!dryRun) {
    for (const r of eligible) {
      const docId = `${SPORTS_HACK_EVENT_ID}__${r.email}`;
      await db
        .collection(LUMA_REGISTRANTS_COLLECTION)
        .doc(docId)
        .set(
          {
            eventId: SPORTS_HACK_EVENT_ID,
            email: r.email,
            name: r.name,
            githubLogin: r.githubLogin,
            lumaCreatedAt: r.lumaCreatedAt,
            lumaApprovalStatus: r.lumaApprovalStatus,
            rsvpSource: r.sourceTag,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      seeded++;
    }
  } else {
    seeded = eligible.length;
  }

  let pruned = 0;
  if (prune && !dryRun) {
    const existing = await db
      .collection(LUMA_REGISTRANTS_COLLECTION)
      .where("eventId", "==", SPORTS_HACK_EVENT_ID)
      .get();
    for (const doc of existing.docs) {
      const em = String(doc.data().email ?? "").toLowerCase();
      if (!approvedEmails.has(em)) {
        await doc.ref.delete();
        pruned++;
      }
    }
  }

  return { seeded, pruned };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function getFlag(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx < 0) return undefined;
  return process.argv[idx + 1];
}

async function main(): Promise<void> {
  const partifulPath = getFlag("--partiful");
  const lumaPath = getFlag("--luma");
  const outPath = getFlag("--out");
  const dryRun = process.argv.includes("--dry-run");
  const write = process.argv.includes("--write");
  const prune = process.argv.includes("--prune");

  if (!partifulPath || !lumaPath || !outPath) {
    console.error("Usage: --partiful <csv> --luma <csv> --out <merged.csv> --dry-run | --write [--prune]");
    process.exit(1);
  }
  if ((dryRun && write) || (!dryRun && !write)) {
    console.error("Specify exactly one of --dry-run | --write.");
    process.exit(1);
  }
  if (prune && !write) {
    console.error("--prune requires --write.");
    process.exit(1);
  }

  console.log(`Partiful CSV: ${partifulPath}`);
  console.log(`Luma CSV:     ${lumaPath}`);
  const partifulRows = loadCsv(partifulPath);
  const lumaRows = loadCsv(lumaPath);
  console.log(`  Partiful rows: ${partifulRows.length}`);
  console.log(`  Luma rows:     ${lumaRows.length}`);

  const { byEmail, emaillessPartiful } = mergeRows(partifulRows, lumaRows);

  const statusCounts: Record<NormalizedStatus, number> = {
    approved: 0,
    "invited/maybe": 0,
    "not going": 0,
  };
  const sourceCounts = { "partiful": 0, "luma": 0, "partiful+luma": 0 };
  for (const r of byEmail.values()) {
    statusCounts[r.status]++;
    const tag = r.sources.length === 2 ? "partiful+luma" : (r.sources[0] as "partiful" | "luma");
    sourceCounts[tag]++;
  }

  console.log("\n=== Merged (deduped by email) ===");
  console.log(`  unique emails:  ${byEmail.size}`);
  console.log(`  approved:       ${statusCounts.approved}`);
  console.log(`  invited/maybe:  ${statusCounts["invited/maybe"]}`);
  console.log(`  not going:      ${statusCounts["not going"]}`);
  console.log(`  source breakdown — partiful only: ${sourceCounts.partiful}, luma only: ${sourceCounts.luma}, both: ${sourceCounts["partiful+luma"]}`);
  console.log(`  Partiful guests w/o email:        ${emaillessPartiful.length} (in CSV, not synced)`);

  writeMergedCsv(outPath, byEmail, emaillessPartiful);
  console.log(`\nMerged CSV written: ${outPath}`);

  const db = getAdminDb();
  if (!db) {
    console.error("Firebase Admin not configured.");
    process.exit(1);
  }

  // --- eventContacts ---
  console.log(`\n=== eventContacts (collection: ${EVENT_CONTACTS_COLLECTION}) ===`);
  console.log(`Looking up which of the ${byEmail.size} emails are already on file…`);
  const existingEmails = new Set<string>();
  const ecSnap = await db.collection(EVENT_CONTACTS_COLLECTION).select().get();
  for (const doc of ecSnap.docs) existingEmails.add(doc.id);
  let newEmails = 0;
  let dbHits = 0;
  for (const email of byEmail.keys()) {
    if (existingEmails.has(email)) dbHits++;
    else newEmails++;
  }
  console.log(`  Already in eventContacts: ${dbHits}`);
  console.log(`  New to eventContacts:     ${newEmails}`);

  if (dryRun) {
    console.log(`  [dry-run] would create ${newEmails} new contacts and append "${SHARED_EVENT_NAME}" to ${dbHits} existing contacts.`);
  } else {
    const r = await upsertEventContacts(db, byEmail, false);
    console.log(`  Created: ${r.created}, Updated (event appended): ${r.updated}, Already had this event: ${r.alreadyHasEvent}`);
  }

  // --- hackathonLumaRegistrants (May 26 page leaderboard) ---
  console.log(`\n=== hackathonLumaRegistrants (eventId=${SPORTS_HACK_EVENT_ID}) ===`);
  if (dryRun) {
    const approvedCount = [...byEmail.values()].filter((r) => r.status === "approved").length;
    console.log(`  [dry-run] would seed ${approvedCount} approved/going rows.`);
    if (prune) console.log(`  [dry-run] --prune skipped (requires --write).`);
  } else {
    const r = await seedHackathonLumaRegistrants(db, byEmail, false, prune);
    console.log(`  Seeded: ${r.seeded}${prune ? `, Pruned stale rows: ${r.pruned}` : ""}`);
  }

  if (dryRun) {
    console.log("\n--dry-run complete. Re-run with --write [--prune] to apply.");
  } else {
    console.log("\nAll writes complete.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
