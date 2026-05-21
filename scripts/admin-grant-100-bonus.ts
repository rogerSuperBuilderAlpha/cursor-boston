#!/usr/bin/env node
/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * One-shot bonus grant: +100 turns to every real (non-NPC) player, layered on
 * top of whatever they already had. Unlike admin-grant-100-this-week.ts, this
 * does NOT touch lastWeeklyGrantWeekStart — Sunday's regular weekly grant
 * still fires normally for anyone who merged a PR this week.
 *
 * Idempotent via `bonusGrantsApplied` map on the player doc, keyed by
 * BONUS_KEY. Re-running with the same key is a no-op for already-granted
 * players. Pair with scripts/send-game-bonus-100.ts to email recipients.
 *
 * Usage:
 *   npx tsx scripts/admin-grant-100-bonus.ts --dry-run
 *   npx tsx scripts/admin-grant-100-bonus.ts --apply
 *   npx tsx scripts/admin-grant-100-bonus.ts --apply --force
 *
 * Requires: FIREBASE_SERVICE_ACCOUNT_JSON
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "../lib/firebase-admin";

const BONUS_KEY = "2026-05-20-bonus-100";
const BONUS_AMOUNT = 100;

interface PlayerDoc {
  isNpc?: boolean;
  displayName?: string;
  turnsRemaining?: number;
  bonusGrantsApplied?: Record<string, unknown>;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const apply = process.argv.includes("--apply");
  const force = process.argv.includes("--force");
  if (!dryRun && !apply) {
    console.error("Pass --dry-run or --apply.");
    process.exit(1);
  }

  const db = getAdminDb();
  if (!db) {
    console.error("Firebase Admin not configured.");
    process.exit(1);
  }

  console.log(`Bonus key: ${BONUS_KEY}  amount: +${BONUS_AMOUNT}`);
  const snap = await db.collection("game_players").get();

  const eligible: Array<{ userId: string; name: string; before: number; after: number }> = [];
  let skippedNpc = 0;
  let skippedAlreadyGranted = 0;

  for (const doc of snap.docs) {
    const d = doc.data() as PlayerDoc;
    if (d.isNpc === true) {
      skippedNpc++;
      continue;
    }
    const already = !!d.bonusGrantsApplied?.[BONUS_KEY];
    if (already && !force) {
      skippedAlreadyGranted++;
      continue;
    }
    const before = d.turnsRemaining ?? 0;
    eligible.push({
      userId: doc.id,
      name: d.displayName?.trim() || "(unnamed)",
      before,
      after: before + BONUS_AMOUNT,
    });
  }

  console.log(`Eligible real players: ${eligible.length}`);
  console.log(`Skipped — NPC: ${skippedNpc}`);
  console.log(`Skipped — already granted (${BONUS_KEY}): ${skippedAlreadyGranted}`);

  if (dryRun) {
    console.log("\n--dry-run: no writes.");
    const preview = eligible.slice(0, 10);
    for (const e of preview) {
      console.log(`  ${e.name}: ${e.before} -> ${e.after}`);
    }
    if (eligible.length > preview.length) {
      console.log(`  ...and ${eligible.length - preview.length} more`);
    }
    return;
  }

  let applied = 0;
  let failed = 0;
  for (const e of eligible) {
    try {
      await db.collection("game_players").doc(e.userId).update({
        turnsRemaining: FieldValue.increment(BONUS_AMOUNT),
        [`bonusGrantsApplied.${BONUS_KEY}`]: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      applied++;
    } catch (err) {
      failed++;
      console.error(`Failed: ${e.userId} (${e.name})`, err);
    }
  }

  console.log(JSON.stringify({ bonusKey: BONUS_KEY, applied, failed, skippedNpc, skippedAlreadyGranted }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
