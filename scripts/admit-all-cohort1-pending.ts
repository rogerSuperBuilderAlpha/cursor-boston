#!/usr/bin/env node
/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Bulk-admit every Cohort 1 application that isn't already admitted or
 * withdrawn. Includes pending, waitlist, AND rejected — the user explicitly
 * chose "everyone except withdrawn" semantics on 2026-05-10 to lock the
 * roster before the May 11 kickoff.
 *
 * Idempotent: re-running is a no-op for already-admitted docs.
 *
 * Usage:
 *   npx tsx scripts/admit-all-cohort1-pending.ts --dry-run
 *   npx tsx scripts/admit-all-cohort1-pending.ts --apply
 *
 * Requires: FIREBASE_SERVICE_ACCOUNT_JSON
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "../lib/firebase-admin";
import { SUMMER_COHORT_COLLECTION } from "../lib/summer-cohort";

interface Candidate {
  applicationId: string;
  email: string;
  name: string;
  status: string;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const apply = process.argv.includes("--apply");
  if (!dryRun && !apply) {
    console.error("Pass --dry-run or --apply.");
    process.exit(1);
  }

  const db = getAdminDb();
  if (!db) {
    console.error("Firebase Admin not configured.");
    process.exit(1);
  }

  const snap = await db.collection(SUMMER_COHORT_COLLECTION).get();
  const candidates: Candidate[] = [];
  let scanned = 0;
  let alreadyAdmitted = 0;
  let withdrawn = 0;
  let notCohort1 = 0;
  const breakdown: Record<string, number> = {};

  for (const doc of snap.docs) {
    scanned++;
    const d = doc.data() as {
      cohorts?: string[];
      status?: string;
      email?: string;
      name?: string;
    };
    const cohorts = Array.isArray(d.cohorts) ? d.cohorts : [];
    if (!cohorts.includes("cohort-1")) {
      notCohort1++;
      continue;
    }
    const status = d.status ?? "pending";
    if (status === "admitted") {
      alreadyAdmitted++;
      continue;
    }
    if (status === "withdrawn") {
      withdrawn++;
      continue;
    }
    breakdown[status] = (breakdown[status] ?? 0) + 1;
    candidates.push({
      applicationId: doc.id,
      email: (d.email ?? "").trim(),
      name: (d.name ?? "").trim(),
      status,
    });
  }

  console.log(`Scanned: ${scanned}`);
  console.log(`Not cohort-1: ${notCohort1}`);
  console.log(`Already admitted: ${alreadyAdmitted}`);
  console.log(`Already withdrawn (skipped): ${withdrawn}`);
  console.log(`To be admitted: ${candidates.length}`);
  console.log(`  Breakdown of from-statuses:`, breakdown);

  if (candidates.length > 0) {
    console.log("\nFirst 10 candidates:");
    for (const c of candidates.slice(0, 10)) {
      console.log(`  ${c.status.padEnd(10)}  ${c.email.padEnd(40)}  ${c.name}`);
    }
  }

  if (dryRun) {
    console.log("\n--dry-run: no writes made.");
    return;
  }

  let admitted = 0;
  let failed = 0;
  for (const c of candidates) {
    try {
      await db.collection(SUMMER_COHORT_COLLECTION).doc(c.applicationId).update({
        status: "admitted",
        admittedAt: FieldValue.serverTimestamp(),
        admittedVia: "bulk-may10",
        statusUpdatedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      admitted++;
    } catch (e) {
      failed++;
      console.error(`Failed to admit ${c.email}:`, e);
    }
  }
  console.log(`\nDone. Admitted ${admitted}, failed ${failed}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
