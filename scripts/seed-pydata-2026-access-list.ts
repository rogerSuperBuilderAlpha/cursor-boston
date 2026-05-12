#!/usr/bin/env node
/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * One-shot: seed the final May 13 PyData door list into Firestore.
 *
 * Reads a CSV with columns `First Name,Last Name,Email,Organization` and
 * writes one doc per row into the `pydataHack2026AccessList` collection.
 *
 *   - doc ID = lowercased, trimmed email (so /api/events/pydata-2026/access
 *     can `.doc(email).get()` in O(1) without scanning the whole list)
 *   - doc body holds the original-cased email + import timestamp +
 *     organization, purely for ops debugging — the gate API only checks
 *     for doc existence.
 *
 * `--dry-run` parses + reports a preview without writing.
 * Pass --replace to delete any pre-existing docs in the collection first
 * (safe for a one-shot final list; not safe for incremental updates).
 *
 * Usage:
 *   npx tsx scripts/seed-pydata-2026-access-list.ts "/path/to/attendance.csv"
 *   npx tsx scripts/seed-pydata-2026-access-list.ts "/path/to/attendance.csv" --dry-run
 *   npx tsx scripts/seed-pydata-2026-access-list.ts "/path/to/attendance.csv" --replace
 */

import { readFileSync } from "node:fs";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { loadEnvConfig } from "@next/env";
import {
  PYDATA_2026_ACCESS_LIST_COLLECTION,
  normalizePydataEmail,
} from "../lib/pydata-2026-access";

loadEnvConfig(process.cwd());

interface CliArgs {
  csvPath: string;
  dryRun: boolean;
  replace: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const positional = args.filter((a) => !a.startsWith("--"));
  if (positional.length !== 1) {
    console.error(
      "Usage: npx tsx scripts/seed-pydata-2026-access-list.ts <csv-path> [--dry-run] [--replace]"
    );
    process.exit(2);
  }
  return {
    csvPath: positional[0],
    dryRun: args.includes("--dry-run"),
    replace: args.includes("--replace"),
  };
}

/** Minimal CSV parser that handles quoted fields containing commas. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (ch === "\r") continue;
    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }
    field += ch;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

interface AttendeeRow {
  firstName: string;
  lastName: string;
  email: string;
  organization: string;
  normalizedEmail: string;
}

function rowsToAttendees(rows: string[][]): AttendeeRow[] {
  if (rows.length === 0) throw new Error("CSV is empty");
  const header = rows[0].map((c) => c.trim().toLowerCase());
  const colIdx = (...names: string[]): number => {
    for (const n of names) {
      const idx = header.indexOf(n);
      if (idx !== -1) return idx;
    }
    return -1;
  };
  const iFirst = colIdx("first name", "firstname");
  const iLast = colIdx("last name", "lastname");
  const iEmail = colIdx("email", "email address");
  const iOrg = colIdx("organization", "company", "organisation");
  if (iEmail === -1) {
    throw new Error(`CSV missing required Email column. Found: ${header.join(", ")}`);
  }

  const attendees: AttendeeRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const rawEmail = (r[iEmail] ?? "").trim();
    const normalized = normalizePydataEmail(rawEmail);
    if (!normalized) {
      console.warn(`Row ${i + 1}: blank email, skipping`);
      continue;
    }
    attendees.push({
      firstName: (iFirst === -1 ? "" : r[iFirst] ?? "").trim(),
      lastName: (iLast === -1 ? "" : r[iLast] ?? "").trim(),
      email: rawEmail,
      organization: (iOrg === -1 ? "" : r[iOrg] ?? "").trim(),
      normalizedEmail: normalized,
    });
  }
  return attendees;
}

async function main(): Promise<void> {
  const { csvPath, dryRun, replace } = parseArgs();
  const text = readFileSync(csvPath, "utf8");
  const rows = parseCsv(text);
  const attendees = rowsToAttendees(rows);

  // Detect duplicate emails (same normalized form) and report — the Map
  // collapse below will keep only the last occurrence, which matches a
  // Firestore set() semantic, but it's worth flagging so we notice.
  const seen = new Map<string, AttendeeRow>();
  const dupes: string[] = [];
  for (const a of attendees) {
    if (seen.has(a.normalizedEmail)) dupes.push(a.normalizedEmail);
    seen.set(a.normalizedEmail, a);
  }

  console.log(`Parsed ${attendees.length} rows from ${csvPath}`);
  console.log(`Unique normalized emails: ${seen.size}`);
  if (dupes.length > 0) {
    console.log(`Duplicates (kept last occurrence): ${dupes.length}`);
    for (const d of dupes) console.log(`  - ${d}`);
  }

  if (dryRun) {
    console.log("--dry-run: not writing to Firestore.");
    console.log(`First 3 docs that would be written:`);
    Array.from(seen.values())
      .slice(0, 3)
      .forEach((a) => console.log(`  ${a.normalizedEmail} (${a.firstName} ${a.lastName}, ${a.organization})`));
    process.exit(0);
  }

  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!json) throw new Error("missing FIREBASE_SERVICE_ACCOUNT_JSON");
  const credentials = JSON.parse(json);
  if (!getApps().length) {
    initializeApp({ credential: cert(credentials), projectId: credentials.project_id });
  }
  const db = getFirestore();
  const col = db.collection(PYDATA_2026_ACCESS_LIST_COLLECTION);

  if (replace) {
    console.log(`--replace: deleting existing docs in ${PYDATA_2026_ACCESS_LIST_COLLECTION}…`);
    const existing = await col.listDocuments();
    if (existing.length > 0) {
      // Firestore batch limit is 500; this list is at most ~150, so one
      // batch is fine. Stay generic anyway in case --replace gets used
      // again later with a larger residue.
      let batch = db.batch();
      let opsInBatch = 0;
      for (const ref of existing) {
        batch.delete(ref);
        opsInBatch++;
        if (opsInBatch >= 450) {
          await batch.commit();
          batch = db.batch();
          opsInBatch = 0;
        }
      }
      if (opsInBatch > 0) await batch.commit();
    }
    console.log(`  deleted ${existing.length} pre-existing docs`);
  }

  let batch = db.batch();
  let opsInBatch = 0;
  let written = 0;
  for (const a of seen.values()) {
    const ref = col.doc(a.normalizedEmail);
    batch.set(
      ref,
      {
        email: a.email,
        normalizedEmail: a.normalizedEmail,
        firstName: a.firstName,
        lastName: a.lastName,
        organization: a.organization,
        importedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    opsInBatch++;
    written++;
    if (opsInBatch >= 450) {
      await batch.commit();
      batch = db.batch();
      opsInBatch = 0;
    }
  }
  if (opsInBatch > 0) await batch.commit();

  console.log(`Wrote ${written} access-list docs to ${PYDATA_2026_ACCESS_LIST_COLLECTION}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
