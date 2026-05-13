#!/usr/bin/env node
/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * One-off backfill: stamp `baseUnits`, `baseRegenedAt`, `intrinsicBuffs` on
 * every existing `game_tiles` document so the BASE+SUPER combat redesign
 * has data to read against. Computes `baseUnits` via `baseUnitsTarget()`
 * with the owner's caste + tile's age (entrenchment).
 *
 * Idempotent via `_baseFieldsBackfillKey === BACKFILL_KEY` — re-running is
 * a no-op for tiles already stamped. Pass --force to re-stamp regardless
 * (useful after rebalancing LAND_TYPE_BASE numbers).
 *
 * Usage:
 *   npx tsx scripts/backfill-tile-base-units.ts             # dry-run (default)
 *   npx tsx scripts/backfill-tile-base-units.ts --apply     # commit
 *   npx tsx scripts/backfill-tile-base-units.ts --apply --force
 *   npx tsx scripts/backfill-tile-base-units.ts --limit=50  # sample N tiles
 *
 * Requires: FIREBASE_SERVICE_ACCOUNT_JSON
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "../lib/firebase-admin";
import { baseUnitsTarget } from "../lib/game/combat";
import type { GamePlayer, GameTile, UnitStack } from "../lib/game/types";

const BACKFILL_KEY = "2026-05-13-base-units";
const STAMP_FIELD = "_baseFieldsBackfillKey";
const PLAYERS = "game_players";
const TILES = "game_tiles";
const BATCH_CHUNK = 400; // Firestore caps a single batch at 500 ops; leave headroom.

function sumStack(s: UnitStack): number {
  return s.ground + s.siege + s.air;
}

function toDate(t: GameTile["createdAt"]): Date {
  if (t instanceof Date) return t;
  const ts = t as Timestamp;
  return ts.toDate();
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const force = process.argv.includes("--force");
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg
    ? Number.parseInt(limitArg.slice("--limit=".length), 10)
    : null;
  const dryRun = !apply;

  const db = getAdminDb();
  if (!db) {
    console.error("Firebase Admin not configured.");
    process.exit(1);
  }

  console.log(
    `[backfill-base-units] mode=${dryRun ? "DRY-RUN" : "APPLY"} ` +
      `stamp=${STAMP_FIELD}=${BACKFILL_KEY} force=${force} limit=${limit ?? "all"}`
  );

  // Load every player so we can look up caste + activeUpgrades for owned
  // tiles. Single read; cheap relative to the 5k+ tile sweep.
  const playersSnap = await db.collection(PLAYERS).get();
  const players = new Map<string, GamePlayer>();
  for (const d of playersSnap.docs) {
    players.set(d.id, d.data() as GamePlayer);
  }
  console.log(`[backfill-base-units] Loaded ${players.size} player(s).`);

  const tilesSnap = await db.collection(TILES).get();
  console.log(`[backfill-base-units] Loaded ${tilesSnap.size} tile(s).`);

  const now = new Date();
  let alreadyStamped = 0;
  let plannedUpdates: Array<{
    tileId: string;
    tile: GameTile;
    baseUnits: UnitStack;
    ownerLabel: string;
  }> = [];

  for (const doc of tilesSnap.docs) {
    const tile = doc.data() as GameTile & {
      [STAMP_FIELD]?: string;
    };
    if (!force && tile[STAMP_FIELD] === BACKFILL_KEY) {
      alreadyStamped += 1;
      continue;
    }
    const owner = tile.ownerId ? players.get(tile.ownerId) ?? null : null;
    const baseUnits = baseUnitsTarget({
      landType: tile.type,
      caste: owner?.caste ?? null,
      upgradeIds: tile.upgradeIds,
      intrinsicBuffs: tile.intrinsicBuffs,
      createdAt: toDate(tile.createdAt),
      activeUpgrades: owner?.activeUpgrades ?? {},
      productionSpellsActive: owner?.productionSpellsActive,
      now,
    });
    plannedUpdates.push({
      tileId: doc.id,
      tile,
      baseUnits,
      ownerLabel: owner?.displayName ?? (tile.ownerId ? tile.ownerId.slice(0, 6) : "—"),
    });
  }
  if (limit !== null) plannedUpdates = plannedUpdates.slice(0, limit);

  // ── Summary distribution
  const byType = new Map<string, { count: number; sumBase: number }>();
  for (const p of plannedUpdates) {
    const k = p.tile.type;
    const cur = byType.get(k) ?? { count: 0, sumBase: 0 };
    cur.count += 1;
    cur.sumBase += sumStack(p.baseUnits);
    byType.set(k, cur);
  }
  console.log(
    `[backfill-base-units] Plan: ${plannedUpdates.length} update(s), already-stamped: ${alreadyStamped}`
  );
  for (const [type, s] of [...byType.entries()].sort()) {
    const avg = s.count === 0 ? 0 : (s.sumBase / s.count).toFixed(1);
    console.log(
      `  ${type.padEnd(12)} count=${String(s.count).padStart(5)} avg-base=${avg}`
    );
  }
  if (plannedUpdates.length > 0) {
    console.log("\n[backfill-base-units] Sample (first 5):");
    for (const p of plannedUpdates.slice(0, 5)) {
      const bu = p.baseUnits;
      console.log(
        `  ${p.tileId.padEnd(10)} type=${p.tile.type.padEnd(11)} owner=${p.ownerLabel.padEnd(22)} ` +
          `base=g${bu.ground}/s${bu.siege}/a${bu.air} (Σ${sumStack(bu)})`
      );
    }
  }

  if (dryRun) {
    console.log("\n[backfill-base-units] DRY-RUN: no writes.");
    return;
  }

  // ── Commit in batches
  let written = 0;
  let batch = db.batch();
  let opsInBatch = 0;
  for (const p of plannedUpdates) {
    const ref = db.collection(TILES).doc(p.tileId);
    batch.update(ref, {
      baseUnits: p.baseUnits,
      baseRegenedAt: now,
      intrinsicBuffs: p.tile.intrinsicBuffs ?? [],
      [STAMP_FIELD]: BACKFILL_KEY,
      updatedAt: FieldValue.serverTimestamp(),
    });
    opsInBatch += 1;
    if (opsInBatch >= BATCH_CHUNK) {
      await batch.commit();
      written += opsInBatch;
      console.log(`[backfill-base-units] Committed ${written}/${plannedUpdates.length}`);
      batch = db.batch();
      opsInBatch = 0;
    }
  }
  if (opsInBatch > 0) {
    await batch.commit();
    written += opsInBatch;
  }
  console.log(`\n[backfill-base-units] Done. Updated ${written} tile(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
