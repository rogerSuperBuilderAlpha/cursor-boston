#!/usr/bin/env node
/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Bulk-admit every PENDING Cohort 2 application. Scoped to status === "pending"
 * only (121 as of 2026-06-11) — already-admitted and withdrawn docs are left
 * untouched. Differs from the Cohort 1 bulk-admit, which also swept
 * waitlist/rejected; here the user asked to admit exactly the pending set.
 *
 * Idempotent: re-running is a no-op for already-admitted docs.
 *
 * Usage:
 *   npx tsx scripts/admit-all-cohort2-pending.ts --dry-run
 *   npx tsx scripts/admit-all-cohort2-pending.ts --apply
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
  let notCohort2 = 0;
  const otherStatuses: Record<string, number> = {};

  for (const doc of snap.docs) {
    scanned++;
    const d = doc.data() as {
      cohorts?: string[];
      status?: string;
      email?: string;
      name?: string;
    };
    const cohorts = Array.isArray(d.cohorts) ? d.cohorts : [];
    if (!cohorts.includes("cohort-2")) {
      notCohort2++;
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
    if (status !== "pending") {
      // Leave waitlist/rejected/other untouched — user asked for the pending set only.
      otherStatuses[status] = (otherStatuses[status] ?? 0) + 1;
      continue;
    }
    candidates.push({
      applicationId: doc.id,
      email: (d.email ?? "").trim(),
      name: (d.name ?? "").trim(),
      status,
    });
  }

  console.log(`Scanned: ${scanned}`);
  console.log(`Not cohort-2: ${notCohort2}`);
  console.log(`Already admitted: ${alreadyAdmitted}`);
  console.log(`Withdrawn (skipped): ${withdrawn}`);
  console.log(`Other non-pending statuses (skipped):`, otherStatuses);
  console.log(`To be admitted (pending): ${candidates.length}`);

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
        admittedVia: "bulk-cohort2-jun11",
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
