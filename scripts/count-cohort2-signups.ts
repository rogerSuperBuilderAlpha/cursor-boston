#!/usr/bin/env node
/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Read-only: count Cohort 2 signups (docs whose `cohorts` includes "cohort-2")
 * broken down by status. No writes.
 *
 *   npx tsx scripts/count-cohort2-signups.ts
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { getAdminDb } from "../lib/firebase-admin";
import { SUMMER_COHORT_COLLECTION } from "../lib/summer-cohort";

async function main(): Promise<void> {
  const db = getAdminDb();
  if (!db) {
    console.error("Firebase Admin not configured.");
    process.exit(1);
  }

  const snap = await db.collection(SUMMER_COHORT_COLLECTION).get();
  let totalDocs = 0;
  let cohort2 = 0;
  const byStatus: Record<string, number> = {};

  for (const doc of snap.docs) {
    totalDocs++;
    const d = doc.data() as { cohorts?: string[]; status?: string };
    const cohorts = Array.isArray(d.cohorts) ? d.cohorts : [];
    if (!cohorts.includes("cohort-2")) continue;
    cohort2++;
    const status = d.status ?? "pending";
    byStatus[status] = (byStatus[status] ?? 0) + 1;
  }

  console.log(`Collection scanned: ${SUMMER_COHORT_COLLECTION} (${totalDocs} total docs)`);
  console.log(`\nCohort 2 signups (cohorts includes "cohort-2"): ${cohort2}`);
  console.log(`\nBreakdown by status:`);
  for (const [status, n] of Object.entries(byStatus).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${status.padEnd(12)} ${n}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
