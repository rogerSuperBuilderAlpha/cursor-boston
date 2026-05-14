#!/usr/bin/env node
/**
 * One-off: flip regorhunt02052@gmail.com's summerCohortApplications doc back
 * to status: "pending" so the new ClaimSpotByPRCard UI is visible during
 * local preview.
 *
 * Idempotent — re-running on a doc that's already pending is a no-op.
 *
 * Usage:
 *   npx tsx scripts/reset-roger-to-pending.ts
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "../lib/firebase-admin";
import { SUMMER_COHORT_COLLECTION } from "../lib/summer-cohort";

const TARGET_EMAIL = "regorhunt02052@gmail.com";

async function main() {
  const db = getAdminDb();
  if (!db) {
    console.error("Firebase Admin not configured.");
    process.exit(1);
  }

  const snap = await db
    .collection(SUMMER_COHORT_COLLECTION)
    .where("email", "==", TARGET_EMAIL)
    .get();

  if (snap.empty) {
    console.error(`No application found for ${TARGET_EMAIL}.`);
    process.exit(1);
  }

  for (const doc of snap.docs) {
    const data = doc.data();
    const before = data.status ?? "(unset)";
    if (before === "pending") {
      console.log(`${doc.id}: already pending, skipping.`);
      continue;
    }
    await doc.ref.update({
      status: "pending",
      // Keep the prior admit timestamps as breadcrumbs, but clear the active
      // admit metadata so a future PR-merge auto-admit fires cleanly.
      admittedAt: FieldValue.delete(),
      admittedVia: FieldValue.delete(),
      admittedFromPR: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log(`${doc.id}: status ${before} → pending.`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
