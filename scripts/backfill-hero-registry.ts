#!/usr/bin/env node
/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * One-off backfill for the v2 Heroes registry.
 *
 * v1 shipped with hero data stored only inline on `GameTile.hero?`. v2
 * introduces a persistent `game_heroes` collection (with an `events`
 * subcollection) that survives Armageddon. This script scans every
 * `game_tiles` document with `hero != null` and:
 *   1. Creates a `game_heroes/{hero.id}` doc if one doesn't exist
 *   2. Appends a single `emerged` event so each hero has at least one
 *      history entry to render in the new lore views.
 *
 * Idempotent: re-running with --apply skips any hero whose registry doc
 * already exists. Use --force to rewrite anyway.
 *
 * Usage:
 *   npx tsx scripts/backfill-hero-registry.ts                # dry-run
 *   npx tsx scripts/backfill-hero-registry.ts --apply        # commit
 *   npx tsx scripts/backfill-hero-registry.ts --apply --force
 *   npx tsx scripts/backfill-hero-registry.ts --limit=20
 *
 * Requires: FIREBASE_SERVICE_ACCOUNT_JSON
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { randomUUID } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "../lib/firebase-admin";
import {
  HEROES_COLLECTION,
  heroEvent,
  heroEventsCollection,
} from "../lib/game/hero-registry";
import type { GameHeroDoc, GameTile, GameWorldMeta } from "../lib/game/types";

const TILES = "game_tiles";
const WORLD_META = "game_world_meta";
const BATCH_CHUNK = 200; // 2 writes per hero (doc + event); stay under 500.

function toDate(value: GameTile["updatedAt"] | undefined): Date {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  const ts = value as Timestamp;
  if (typeof ts?.toDate === "function") return ts.toDate();
  return new Date();
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
    console.error(
      "Firebase Admin not initialized — set FIREBASE_SERVICE_ACCOUNT_JSON."
    );
    process.exit(1);
  }

  // Current world season — used for `emergedSeasonNumber` on heroes we
  // can't otherwise place in time. The doc may legitimately not exist on
  // a freshly-deployed world, in which case we default to season 1.
  const metaSnap = await db.collection(WORLD_META).doc("singleton").get();
  const meta = metaSnap.exists ? (metaSnap.data() as GameWorldMeta) : null;
  const currentSeason = meta?.seasonNumber ?? 1;

  console.log(
    `[backfill-hero-registry] mode=${dryRun ? "DRY-RUN" : "APPLY"} force=${force} season=${currentSeason}` +
      (limit ? ` limit=${limit}` : "")
  );

  // Scan tiles with a non-null hero. Firestore doesn't support `!= null`
  // directly across non-existing fields, so we filter in-memory after a
  // full scan. v1 hero-bearing tiles are <100 per world; this is cheap.
  let query = db.collection(TILES);
  const snap = await query.get();
  const tilesWithHero = snap.docs
    .map((d) => d.data() as GameTile)
    .filter((t) => t.hero != null);

  console.log(
    `[backfill-hero-registry] scanned ${snap.size} tiles, ${tilesWithHero.length} hero-bearing`
  );

  let skipped = 0;
  let wrote = 0;
  let batched = 0;
  let batch = db.batch();
  const heroes = limit ? tilesWithHero.slice(0, limit) : tilesWithHero;

  for (const tile of heroes) {
    const hero = tile.hero!;
    const heroRef = db.collection(HEROES_COLLECTION).doc(hero.id);
    if (!force) {
      const existing = await heroRef.get();
      if (existing.exists) {
        skipped++;
        continue;
      }
    }

    const now = toDate(tile.updatedAt);
    const heroDoc: GameHeroDoc = {
      id: hero.id,
      name: hero.name,
      class: hero.class,
      specialty: hero.specialty,
      caste: hero.caste,
      currentOwnerId: hero.ownerId,
      currentTileId: hero.tileId,
      stamina: hero.stamina,
      staminaMax: hero.staminaMax,
      isDeceased: false,
      awaitingResurrection: false,
      emergedAtTurn: hero.emergedAtTurn,
      emergedSeasonNumber: currentSeason,
      survivedSeasons: [],
      lastEventAt: now,
      createdAt: now,
      updatedAt: now,
    };

    if (dryRun) {
      console.log(
        `[backfill-hero-registry] would create ${HEROES_COLLECTION}/${hero.id} (${hero.name}, ${hero.class}/${hero.specialty}, owner=${hero.ownerId}, tile=${hero.tileId})`
      );
      wrote++;
      continue;
    }

    batch.set(heroRef, heroDoc, { merge: true });
    const eventId = randomUUID();
    const eventBody = heroEvent.emerged(
      { tileId: hero.tileId, ownerId: hero.ownerId },
      currentSeason
    );
    batch.set(heroEventsCollection(db, hero.id).doc(eventId), {
      id: eventId,
      ...eventBody,
      createdAt: now,
    });
    wrote++;
    batched++;

    if (batched >= BATCH_CHUNK) {
      await batch.commit();
      console.log(`[backfill-hero-registry] committed ${batched} heroes`);
      batch = db.batch();
      batched = 0;
    }
  }

  if (!dryRun && batched > 0) {
    await batch.commit();
    console.log(`[backfill-hero-registry] committed final ${batched} heroes`);
  }

  console.log(
    `[backfill-hero-registry] done. wrote=${wrote}, skipped=${skipped} (already in registry)`
  );
}

main().catch((err) => {
  console.error("[backfill-hero-registry] failed:", err);
  process.exit(1);
});
