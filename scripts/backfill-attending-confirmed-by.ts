#!/usr/bin/env node
/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * One-shot backfill for the new `attendingConfirmedBy` field on
 * `hackathonEventSignups`. Defaults to `"user"` for every existing doc that
 * has `attendingConfirmedAt` set but no `attendingConfirmedBy`.
 *
 * Why "user" is the safe default: this script ships before any door
 * check-in flow has run for sports-hack-2026 (event is May 26). All current
 * `attendingConfirmedAt` rows were written by POST /api/.../confirm-attendance
 * which is the user-initiated path. Once this backfill lands, new writes are
 * tagged at the source (POST tags "user", checkin route tags "admin").
 *
 * Idempotent: re-runs only touch docs that lack the field.
 *
 * Usage:
 *   npx tsx scripts/backfill-attending-confirmed-by.ts --dry-run
 *   npx tsx scripts/backfill-attending-confirmed-by.ts --write
 *
 * Optional: --event=<id> restricts to one event. Default: all events.
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { getAdminDb } from "../lib/firebase-admin";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const write = args.includes("--write");
  const eventArg = args.find((a) => a.startsWith("--event="));
  const eventFilter = eventArg ? eventArg.slice("--event=".length) : null;

  if ((dryRun && write) || (!dryRun && !write)) {
    console.error("Specify exactly one of: --dry-run | --write");
    process.exit(1);
  }

  const db = getAdminDb();
  if (!db) {
    console.error(
      "Firebase Admin not configured (FIREBASE_SERVICE_ACCOUNT_JSON / GOOGLE_APPLICATION_CREDENTIALS)."
    );
    process.exit(1);
  }

  let query: FirebaseFirestore.Query = db.collection("hackathonEventSignups");
  if (eventFilter) {
    query = query.where("eventId", "==", eventFilter);
    console.log(`Filtering to eventId="${eventFilter}"`);
  }
  const snap = await query.get();
  console.log(`Total signup docs scanned: ${snap.size}`);

  let alreadyTagged = 0;
  let noConfirmAt = 0;
  let toBackfill: { id: string; eventId: string }[] = [];

  for (const doc of snap.docs) {
    const data = doc.data();
    if (!data.attendingConfirmedAt) {
      noConfirmAt++;
      continue;
    }
    if (data.attendingConfirmedBy === "user" || data.attendingConfirmedBy === "admin") {
      alreadyTagged++;
      continue;
    }
    toBackfill.push({ id: doc.id, eventId: data.eventId ?? "?" });
  }

  console.log(`Already tagged:           ${alreadyTagged}`);
  console.log(`No attendingConfirmedAt:  ${noConfirmAt}`);
  console.log(`Would backfill to "user": ${toBackfill.length}`);

  if (toBackfill.length > 0) {
    const byEvent = new Map<string, number>();
    for (const r of toBackfill) byEvent.set(r.eventId, (byEvent.get(r.eventId) ?? 0) + 1);
    console.log("\nBy event:");
    for (const [eid, n] of [...byEvent].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${eid.padEnd(28)} ${n}`);
    }
  }

  if (dryRun) {
    console.log("\n--dry-run: no writes.");
    return;
  }

  let updated = 0;
  let failed = 0;
  for (const r of toBackfill) {
    try {
      await db
        .collection("hackathonEventSignups")
        .doc(r.id)
        .update({ attendingConfirmedBy: "user" });
      updated++;
      if (updated % 25 === 0) {
        console.log(`  Progress: ${updated}/${toBackfill.length}`);
      }
    } catch (e) {
      failed++;
      console.error(`  [fail] ${r.id}`, e);
    }
  }

  console.log(`\nDone. Updated ${updated}, failed ${failed}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
