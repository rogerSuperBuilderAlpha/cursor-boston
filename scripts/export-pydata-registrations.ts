#!/usr/bin/env node
/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * One-shot: export all PyData 2026 site registrations to CSV.
 *
 * Output columns (in this order):
 *   First Name, Last Name, Email, Phone, Organization, Status,
 *   Registered At (ISO UTC), Updated At (ISO UTC), UID
 *
 * Rows are ordered by createdAt ascending — same order Moderna's badge
 * cap (PYDATA_2026_CAPACITY) is applied in.
 *
 * Usage:
 *   npx tsx scripts/export-pydata-registrations.ts
 *   npx tsx scripts/export-pydata-registrations.ts --out=/tmp/pydata.csv
 *   npx tsx scripts/export-pydata-registrations.ts --include-cancelled
 *
 * Default output path: scripts/data/pydata-2026-registrations-<YYYY-MM-DD>.csv
 */

import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { loadEnvConfig } from "@next/env";
import {
  PYDATA_2026_REGISTRATIONS_COLLECTION,
  type PydataRegistrationStatus,
} from "../lib/pydata-2026";

loadEnvConfig(process.cwd());

interface CliArgs {
  outPath: string;
  includeCancelled: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const includeCancelled = args.includes("--include-cancelled");
  const outArg = args.find((a) => a.startsWith("--out="));
  const today = new Date().toISOString().slice(0, 10);
  const defaultOut = path.join(
    process.cwd(),
    `scripts/data/pydata-2026-registrations-${today}.csv`
  );
  return {
    outPath: outArg ? outArg.slice("--out=".length) : defaultOut,
    includeCancelled,
  };
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function tsToIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") return new Date(value).toISOString();
  return "";
}

function tsToMs(value: unknown): number {
  if (value instanceof Timestamp) return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  return 0;
}

async function main(): Promise<void> {
  const { outPath, includeCancelled } = parseArgs();
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!json) throw new Error("missing FIREBASE_SERVICE_ACCOUNT_JSON");
  const credentials = JSON.parse(json);
  if (!getApps().length) {
    initializeApp({ credential: cert(credentials), projectId: credentials.project_id });
  }
  const db = getFirestore();

  const snap = await db.collection(PYDATA_2026_REGISTRATIONS_COLLECTION).get();
  const rows = snap.docs.map((d) => {
    const data = d.data();
    return {
      uid: d.id,
      firstName: typeof data.firstName === "string" ? data.firstName : "",
      lastName: typeof data.lastName === "string" ? data.lastName : "",
      email: typeof data.email === "string" ? data.email : "",
      phone: typeof data.phone === "string" ? data.phone : "",
      organization: typeof data.organization === "string" ? data.organization : "",
      status: (typeof data.status === "string" ? data.status : "awaiting-badge") as PydataRegistrationStatus,
      createdAtMs: tsToMs(data.createdAt),
      createdAtIso: tsToIso(data.createdAt),
      updatedAtIso: tsToIso(data.updatedAt) || tsToIso(data.createdAt),
    };
  });

  const filtered = includeCancelled
    ? rows
    : rows.filter((r) => r.status !== "cancelled");

  filtered.sort((a, b) => a.createdAtMs - b.createdAtMs);

  const header = [
    "First Name",
    "Last Name",
    "Email",
    "Phone",
    "Organization",
    "Status",
    "Registered At",
    "Updated At",
    "UID",
  ];
  const lines = [header.map(csvEscape).join(",")];
  for (const r of filtered) {
    lines.push(
      [
        r.firstName,
        r.lastName,
        r.email,
        r.phone,
        r.organization,
        r.status,
        r.createdAtIso,
        r.updatedAtIso,
        r.uid,
      ]
        .map(csvEscape)
        .join(",")
    );
  }

  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, lines.join("\n") + "\n", "utf8");

  const byStatus: Record<string, number> = {};
  for (const r of filtered) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
  const cancelledCount = rows.length - filtered.length;

  console.log(`Wrote ${outPath}`);
  console.log(`Total rows in CSV: ${filtered.length}`);
  console.log(`By status:`, byStatus);
  if (!includeCancelled && cancelledCount > 0) {
    console.log(`(excluded ${cancelledCount} cancelled — pass --include-cancelled to include)`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
