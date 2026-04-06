#!/usr/bin/env node
/**
 * Sync Luma CSV exports into the Firestore `eventContacts` collection.
 *
 * Reads one or more Luma guest-export CSVs, deduplicates by email, and
 * upserts each contact into Firestore. Existing documents are merged so
 * re-running the script with new event exports is safe and additive.
 *
 * Usage:
 *   npx tsx scripts/sync-event-contacts.ts --dry-run <csv1> [csv2 ...]
 *   npx tsx scripts/sync-event-contacts.ts --write  <csv1> [csv2 ...]
 *
 * Requires: FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS
 */
import { readFileSync } from "fs";
import { basename } from "path";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "../lib/firebase-admin";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CsvRow = Record<string, string>;

interface EventAttendance {
  eventName: string;
  csvFile: string;
  registeredAt: string;
  approvalStatus: string;
  checkedIn: boolean;
  checkedInAt: string | null;
  ticketType: string | null;
}

interface ContactRecord {
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  events: EventAttendance[];
  eventNames: string[];
  totalEvents: number;
  firstSeenAt: string;
  lastSeenAt: string;
  updatedAt: FieldValue;
}

// ---------------------------------------------------------------------------
// CSV parser (reused from send-hack-a-sprint-emails.ts)
// ---------------------------------------------------------------------------

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
  if (row.some((cell) => cell.length > 0)) {
    rows.push(row);
  }

  if (rows.length < 2) return [];

  const header = rows[0]!.map((h) => h.trim());
  const out: CsvRow[] = [];
  for (let r = 1; r < rows.length; r++) {
    const line = rows[r]!;
    const obj: CsvRow = {};
    for (let j = 0; j < header.length; j++) {
      obj[header[j]!] = (line[j] ?? "").trim();
    }
    out.push(obj);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Event name inference from CSV filename
// ---------------------------------------------------------------------------

/** Infer event name from a Luma CSV filename like
 *  "Cursor Boston Hack-a-Sprint - Guests - 2026-04-06-13-49-16.csv"
 *  → "Cursor Boston Hack-a-Sprint" */
function inferEventName(csvPath: string): string {
  const base = basename(csvPath, ".csv");
  const guestsIdx = base.indexOf(" - Guests");
  if (guestsIdx > 0) return base.slice(0, guestsIdx).trim();
  return base.trim();
}

// ---------------------------------------------------------------------------
// Build contact map from CSVs
// ---------------------------------------------------------------------------

function buildContactMap(
  csvPaths: string[]
): Map<string, { name: string; firstName: string; lastName: string; events: EventAttendance[] }> {
  const contacts = new Map<
    string,
    { name: string; firstName: string; lastName: string; events: EventAttendance[] }
  >();

  for (const csvPath of csvPaths) {
    let raw: string;
    try {
      raw = readFileSync(csvPath, "utf8");
    } catch (e) {
      console.error(`Cannot read CSV: ${csvPath}`, e);
      process.exit(1);
    }

    // Strip BOM
    if (raw.charCodeAt(0) === 0xfeff) {
      raw = raw.slice(1);
    }

    const rows = parseCsv(raw);
    if (rows.length === 0) {
      console.warn(`[warn] No data rows in ${csvPath}, skipping.`);
      continue;
    }

    const eventName = inferEventName(csvPath);
    const csvFile = basename(csvPath);
    console.log(`  ${csvFile}: ${rows.length} rows → "${eventName}"`);

    for (const row of rows) {
      const emailRaw = row.email?.trim();
      if (!emailRaw) continue;
      const email = emailRaw.toLowerCase();

      const firstName = row.first_name?.trim() || "";
      const lastName = row.last_name?.trim() || "";
      const name = row.name?.trim() || [firstName, lastName].filter(Boolean).join(" ");

      const attendance: EventAttendance = {
        eventName,
        csvFile,
        registeredAt: row.created_at?.trim() || "",
        approvalStatus: (row.approval_status || "").trim().toLowerCase(),
        checkedIn: !!(row.checked_in_at?.trim()),
        checkedInAt: row.checked_in_at?.trim() || null,
        ticketType: row.ticket_name?.trim() || null,
      };

      const existing = contacts.get(email);
      if (existing) {
        // Avoid duplicate event entries for the same event
        const alreadyHasEvent = existing.events.some(
          (e) => e.eventName === eventName
        );
        if (alreadyHasEvent) {
          // Merge: prefer the entry with a check-in if current one doesn't have it
          const idx = existing.events.findIndex((e) => e.eventName === eventName);
          if (idx >= 0 && attendance.checkedIn && !existing.events[idx]!.checkedIn) {
            existing.events[idx] = attendance;
          }
        } else {
          existing.events.push(attendance);
        }
        // Update name if we have a better one
        if (!existing.name && name) {
          existing.name = name;
          existing.firstName = firstName;
          existing.lastName = lastName;
        }
      } else {
        contacts.set(email, {
          name,
          firstName,
          lastName,
          events: [attendance],
        });
      }
    }
  }

  return contacts;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]) {
  const dryRun = argv.includes("--dry-run");
  const write = argv.includes("--write");

  if ((dryRun && write) || (!dryRun && !write)) {
    console.error("Specify exactly one of: --dry-run | --write");
    process.exit(1);
  }

  const csvPaths = argv.filter((a) => !a.startsWith("--"));
  if (csvPaths.length === 0) {
    console.error("Provide at least one CSV file path.");
    process.exit(1);
  }

  return { dryRun, write, csvPaths };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const COLLECTION = "eventContacts";
const BATCH_SIZE = 500; // Firestore batch limit

async function main() {
  const { dryRun, csvPaths } = parseArgs(process.argv.slice(2));

  console.log(`\nParsing ${csvPaths.length} CSV file(s)…`);
  const contacts = buildContactMap(csvPaths);
  console.log(`\nUnique emails: ${contacts.size}`);

  // Summary table
  const eventCounts = new Map<string, number>();
  for (const [, c] of contacts) {
    for (const e of c.events) {
      eventCounts.set(e.eventName, (eventCounts.get(e.eventName) ?? 0) + 1);
    }
  }
  console.log("\nPer-event breakdown:");
  for (const [name, count] of [...eventCounts.entries()].sort()) {
    console.log(`  ${name}: ${count} registrants`);
  }

  // Multi-event contacts
  const multiEvent = [...contacts.values()].filter((c) => c.events.length > 1);
  console.log(`\nContacts at 2+ events: ${multiEvent.length}`);

  // Checked-in stats
  const checkedInAny = [...contacts.values()].filter((c) =>
    c.events.some((e) => e.checkedIn)
  );
  console.log(`Contacts who checked in at least once: ${checkedInAny.length}`);

  if (dryRun) {
    console.log("\n--dry-run: no Firestore writes. Preview:\n");
    const sorted = [...contacts.entries()].sort((a, b) =>
      b[1].events.length - a[1].events.length || a[0].localeCompare(b[0])
    );
    const pad = (s: string, n: number) => s.slice(0, n).padEnd(n);
    for (const [email, c] of sorted) {
      const events = c.events.map((e) => {
        const check = e.checkedIn ? "✓" : "○";
        return `${check} ${e.eventName}`;
      });
      console.log(
        `${pad(email, 42)} ${pad(c.name || "(no name)", 25)} [${events.join(", ")}]`
      );
    }
    console.log(`\nTotal: ${contacts.size} unique contacts`);
    return;
  }

  // Write to Firestore
  const db = getAdminDb();
  if (!db) {
    console.error(
      "Firebase Admin not configured (FIREBASE_SERVICE_ACCOUNT_JSON / GOOGLE_APPLICATION_CREDENTIALS)."
    );
    process.exit(1);
  }

  console.log(`\nWriting ${contacts.size} contacts to Firestore "${COLLECTION}"…`);

  const entries = [...contacts.entries()];
  let written = 0;
  let updated = 0;

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const chunk = entries.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const [email, c] of chunk) {
      const docRef = db.collection(COLLECTION).doc(email);
      const existing = await docRef.get();

      const allDates = c.events
        .map((e) => e.registeredAt)
        .filter(Boolean)
        .sort();
      const firstSeenAt = allDates[0] || "";
      const lastSeenAt = allDates[allDates.length - 1] || "";

      if (existing.exists) {
        // Merge: append new events, update metadata
        const data = existing.data()!;
        const existingEvents: EventAttendance[] = data.events || [];

        const mergedEvents = [...existingEvents];
        for (const newEvt of c.events) {
          const idx = mergedEvents.findIndex(
            (e) => e.eventName === newEvt.eventName
          );
          if (idx >= 0) {
            // Prefer entry with check-in data
            if (newEvt.checkedIn && !mergedEvents[idx]!.checkedIn) {
              mergedEvents[idx] = newEvt;
            }
          } else {
            mergedEvents.push(newEvt);
          }
        }

        const mergedEventNames = [
          ...new Set(mergedEvents.map((e) => e.eventName)),
        ];

        const mergedDates = mergedEvents
          .map((e) => e.registeredAt)
          .filter(Boolean)
          .sort();

        batch.update(docRef, {
          name: c.name || data.name || "",
          firstName: c.firstName || data.firstName || "",
          lastName: c.lastName || data.lastName || "",
          events: mergedEvents,
          eventNames: mergedEventNames,
          totalEvents: mergedEventNames.length,
          firstSeenAt: mergedDates[0] || data.firstSeenAt || "",
          lastSeenAt: mergedDates[mergedDates.length - 1] || data.lastSeenAt || "",
          updatedAt: FieldValue.serverTimestamp(),
        });
        updated++;
      } else {
        const eventNames = [...new Set(c.events.map((e) => e.eventName))];
        const record: ContactRecord = {
          email,
          name: c.name,
          firstName: c.firstName,
          lastName: c.lastName,
          events: c.events,
          eventNames,
          totalEvents: eventNames.length,
          firstSeenAt,
          lastSeenAt,
          updatedAt: FieldValue.serverTimestamp(),
        };
        batch.set(docRef, record);
        written++;
      }
    }

    await batch.commit();
    console.log(
      `  Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${chunk.length} docs committed`
    );
  }

  console.log(
    `\nDone. Created ${written}, updated ${updated} (total ${contacts.size} contacts in "${COLLECTION}").`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
