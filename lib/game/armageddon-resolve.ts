/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Armageddon resolution orchestrator. Fired from the API route AFTER the
 * cast transaction that broke the 7th seal commits — i.e. with
 * worldMeta.armageddonState === "resolving" already in place. Runs as a
 * fire-and-forget background job so the casting player's response is not
 * blocked on the full wipe.
 *
 * Steps, in order:
 *   1. Read all participants → compute weighted tickets.
 *   2. Weighted top-N draw without replacement (seeded RNG → reproducible).
 *   3. Write the hall-of-fame doc (game_armageddon_events/{season}). This
 *      lands BEFORE any deletes so the record survives a mid-wipe crash.
 *   4. Log armageddon_completed + per-winner armageddon_winner events.
 *   5. Batch-delete all tiles, attacks, artifacts, intel-effects, AND
 *      player docs. Returning players spawn fresh via the normal
 *      createPlayerWithSpawnServer flow on their next /game visit.
 *   6. Bump worldMeta: seasonNumber++, sealsBroken=0, seals reset,
 *      armageddonState="active", armageddonResolvedAt=now.
 *
 * Idempotency: if the hall-of-fame doc already exists for this season,
 * the resolver assumes it ran already and re-enters at step 5 to clean
 * up any straggler docs and ensure the worldMeta is bumped. Safe to call
 * twice.
 */

import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import type {
  CollectionReference,
  Firestore,
  Query,
} from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { logger } from "@/lib/logger";
import { makeSeededRng } from "./combat";
import {
  SEAL_COUNT,
  TOP_BY_TILES_SNAPSHOT_COUNT,
  WINNER_COUNT,
  computeLotteryTickets,
} from "./content/armageddon";
import {
  HEROES_COLLECTION,
  heroEvent,
  heroEventsCollection,
} from "./hero-registry";
import type {
  ArmageddonEventRecord,
  ArmageddonWinner,
  Caste,
  GameHeroDoc,
  GamePlayer,
  GameWorldMeta,
  SealRecord,
} from "./types";

const COLLECTIONS = {
  PLAYERS: "game_players",
  TILES: "game_tiles",
  ATTACKS: "game_attacks",
  WORLD_META: "game_world_meta",
  ARTIFACTS: "game_artifacts",
  INTEL_EFFECTS: "game_intel_effects",
  COMMUNITY_EVENTS: "game_community_events",
  ARMAGEDDON_EVENTS: "game_armageddon_events",
} as const;
const WORLD_META_DOC = "singleton";

/** Firestore batched-write limit is 500; leave headroom. */
const BATCH_SIZE = 400;

function adminDbOrThrow(): Firestore {
  const db = getAdminDb();
  if (!db) throw new Error("Firebase Admin not initialized");
  return db;
}

interface Participant {
  userId: string;
  displayName: string;
  caste: Caste;
  tilesHeld: number;
  sealsBroken: number;
  tickets: number;
}

/** Weighted draw of `count` winners without replacement, using a seeded
 *  RNG so the same season's seal-7 break always yields the same winners
 *  (reproducibility + auditability — anyone can verify the draw). */
function drawWinners(
  participants: Participant[],
  count: number,
  rng: () => number
): ArmageddonWinner[] {
  // Mutable copy of weights so we can zero-out picked players.
  const pool = participants.map((p) => ({ p, weight: p.tickets }));
  const winners: ArmageddonWinner[] = [];
  for (let rank = 1; rank <= count; rank++) {
    let total = 0;
    for (const e of pool) total += e.weight;
    if (total <= 0) break;
    let roll = rng() * total;
    for (const e of pool) {
      roll -= e.weight;
      if (roll <= 0 && e.weight > 0) {
        winners.push({
          rank,
          userId: e.p.userId,
          displayName: e.p.displayName,
          caste: e.p.caste,
          tilesHeld: e.p.tilesHeld,
          sealsBroken: e.p.sealsBroken,
          tickets: e.p.tickets,
        });
        e.weight = 0;
        break;
      }
    }
  }
  return winners;
}

/** Deletes every doc in `query`'s result set, batched to BATCH_SIZE per
 *  write. Returns the total deletion count. Safe to call multiple times
 *  (a second call on an empty collection is a no-op). */
async function deleteAllInQuery(
  db: Firestore,
  query: Query | CollectionReference
): Promise<number> {
  let total = 0;
  while (true) {
    const snap = await query.limit(BATCH_SIZE).get();
    if (snap.empty) break;
    const batch = db.batch();
    for (const doc of snap.docs) batch.delete(doc.ref);
    await batch.commit();
    total += snap.size;
    if (snap.size < BATCH_SIZE) break;
  }
  return total;
}

/** Write one community event out-of-transaction. The resolver runs
 *  outside any tx (the wipe is too large for a single tx), so we don't
 *  use logCommunityEventInTx; we just write directly. */
async function logEvent(
  db: Firestore,
  fields: Record<string, unknown>,
  now: Date
): Promise<void> {
  const id = randomUUID();
  await db
    .collection(COLLECTIONS.COMMUNITY_EVENTS)
    .doc(id)
    .set({ id, createdAt: now, ...fields });
}

/**
 * Resolves the Armageddon for the given expected season number. Caller
 * should be the API route handler that observed `shouldTriggerResolve`
 * from castArmageddonServer. The function is idempotent — calling twice
 * for the same season is safe.
 */
export async function resolveArmageddon(args: {
  expectedSeason: number;
  triggeredBy: { userId: string; displayName: string; caste: Caste };
  now?: Date;
}): Promise<void> {
  const now = args.now ?? new Date();
  const db = adminDbOrThrow();

  // ── Step 1: snapshot worldMeta + sanity-check we're the right caller.
  const metaRef = db.collection(COLLECTIONS.WORLD_META).doc(WORLD_META_DOC);
  const metaSnap = await metaRef.get();
  const meta = (metaSnap.data() ?? {}) as Partial<GameWorldMeta>;
  const currentSeason = meta.seasonNumber ?? 1;
  if (currentSeason !== args.expectedSeason) {
    logger.warn(
      `[armageddon-resolve] season drift: expected ${args.expectedSeason}, current ${currentSeason} — skipping`
    );
    return;
  }
  if (meta.armageddonState !== "resolving") {
    logger.warn(
      `[armageddon-resolve] state is ${meta.armageddonState ?? "unset"}, expected "resolving" — skipping`
    );
    return;
  }

  const hallRef = db
    .collection(COLLECTIONS.ARMAGEDDON_EVENTS)
    .doc(String(currentSeason));
  const hallSnap = await hallRef.get();

  // Skip the snapshot/draw/log if we've already done it for this season
  // (idempotent re-entry after a partial-success run).
  if (!hallSnap.exists) {
    // ── Step 2: snapshot participants (read ALL players).
    const playersSnap = await db.collection(COLLECTIONS.PLAYERS).get();
    const participants: Participant[] = [];
    for (const doc of playersSnap.docs) {
      const p = doc.data() as GamePlayer;
      if (!p.caste) continue;          // skip unsetup accounts
      const sealsBroken = p.armageddonSealsBroken ?? 0;
      const tickets = computeLotteryTickets(p.stats.tilesHeld, sealsBroken);
      if (tickets <= 0) continue;
      participants.push({
        userId: p.userId,
        displayName: p.displayName,
        caste: p.caste,
        tilesHeld: p.stats.tilesHeld,
        sealsBroken,
        tickets,
      });
    }

    // ── Step 3: weighted top-N draw.
    const rng = makeSeededRng(`armageddon-resolve-s${currentSeason}`);
    const winners = drawWinners(participants, WINNER_COUNT, rng);

    // ── Step 4: top-by-tiles snapshot (separate from lottery; preserves
    // who had the biggest kingdom regardless of luck).
    const topByTiles = [...participants]
      .sort((a, b) => b.tilesHeld - a.tilesHeld)
      .slice(0, TOP_BY_TILES_SNAPSHOT_COUNT)
      .map((p, i) => ({
        rank: i + 1,
        userId: p.userId,
        displayName: p.displayName,
        caste: p.caste,
        tilesHeld: p.tilesHeld,
        sealsBroken: p.sealsBroken,
      }));

    const totalTickets = participants.reduce((s, p) => s + p.tickets, 0);
    const seals: SealRecord[] = (meta.seals ?? []).slice(0, SEAL_COUNT);

    const record: ArmageddonEventRecord = {
      seasonNumber: currentSeason,
      triggeredAt: now,
      triggeredBy: args.triggeredBy,
      seals,
      totalParticipants: participants.length,
      totalTickets,
      winners,
      topByTilesSnapshot: topByTiles,
    };

    // ── Step 5: persist hall-of-fame BEFORE any destructive operation.
    await hallRef.set(record);

    // ── Step 6: community events. armageddon_completed + per-winner rows.
    await logEvent(
      db,
      {
        kind: "armageddon_completed",
        actorUserId: args.triggeredBy.userId,
        actorDisplayName: args.triggeredBy.displayName,
        actorCaste: args.triggeredBy.caste,
        seasonNumber: currentSeason,
      },
      now
    );
    for (const w of winners) {
      await logEvent(
        db,
        {
          kind: "armageddon_winner",
          actorUserId: w.userId,
          actorDisplayName: w.displayName,
          actorCaste: w.caste,
          seasonNumber: currentSeason,
          winnerRank: w.rank,
          tilesHeld: w.tilesHeld,
          sealsBroken: w.sealsBroken,
          tickets: w.tickets,
        },
        now
      );
    }
    logger.info(
      `[armageddon-resolve] season ${currentSeason}: ${participants.length} participants, ${winners.length} winners drawn`
    );
  } else {
    logger.info(
      `[armageddon-resolve] hall-of-fame for season ${currentSeason} already exists — skipping draw, resuming wipe`
    );
  }

  // ── Step 6.5: hero limbo. The game_heroes collection survives the
  // wipe by design (NOT in COLLECTIONS above). Every living hero flips
  // to no-owner / no-tile / awaitingResurrection=true; every hero
  // (alive or dead) gets a `season_ended` event so the hall-of-the-
  // fallen reflects which seasons they witnessed. See lib/game/types.ts
  // for the GameHeroDoc shape and the v3 resurrection placeholder.
  const heroesDeltaSummary = await clearHeroesForArmageddon(
    db,
    currentSeason,
    now
  );
  logger.info(
    `[armageddon-resolve] hero limbo: ${heroesDeltaSummary.living} living → limbo, ${heroesDeltaSummary.deceased} deceased (events appended)`
  );

  // ── Step 7: batch-delete the world. Order matters for surprise: tiles
  // first (largest), then artifacts/intel-effects (mid), attacks last
  // (small but most numerous per-player). Players LAST so any straggler
  // tile-attribution code that reads owner has a chance to fail cleanly.
  const tilesDeleted = await deleteAllInQuery(
    db,
    db.collection(COLLECTIONS.TILES)
  );
  const artifactsDeleted = await deleteAllInQuery(
    db,
    db.collection(COLLECTIONS.ARTIFACTS)
  );
  const intelDeleted = await deleteAllInQuery(
    db,
    db.collection(COLLECTIONS.INTEL_EFFECTS)
  );
  const attacksDeleted = await deleteAllInQuery(
    db,
    db.collection(COLLECTIONS.ATTACKS)
  );
  const playersDeleted = await deleteAllInQuery(
    db,
    db.collection(COLLECTIONS.PLAYERS)
  );

  logger.info(
    `[armageddon-resolve] wipe summary: tiles=${tilesDeleted}, artifacts=${artifactsDeleted}, intel=${intelDeleted}, attacks=${attacksDeleted}, players=${playersDeleted}`
  );

  // ── Step 8: bump worldMeta — fresh seals, new season, state=active.
  // playerCount is NOT reset; it remains the lifetime spawn counter that
  // drives the hex-spiral spawn placement. The next season's players will
  // spawn at indices N, N+1, N+2... — distinct from any pre-Armageddon
  // location (the tiles are gone anyway).
  const freshSeals: SealRecord[] = Array.from({ length: SEAL_COUNT }, (_, i) => ({
    index: i,
    broken: false,
  }));
  await metaRef.set(
    {
      seasonNumber: currentSeason + 1,
      sealsBroken: 0,
      seals: freshSeals,
      armageddonState: "active",
      armageddonResolvedAt: now,
      updatedAt: now,
    },
    { merge: true }
  );

  logger.info(
    `[armageddon-resolve] season ${currentSeason} → ${currentSeason + 1} complete`
  );
}

/**
 * Step 6.5 implementation. Iterates every hero in `game_heroes`:
 *   - Living heroes flip to `currentOwnerId: null`, `currentTileId: null`,
 *     `awaitingResurrection: true`, and `survivedSeasons` gets the current
 *     season pushed.
 *   - Deceased heroes are left functionally alone but still receive a
 *     `season_ended` event so the hall-of-the-fallen reads naturally.
 *
 * Batched commits at BATCH_SIZE/2 to leave headroom for both the doc
 * update + the event subcollection write per hero (2 writes each).
 */
async function clearHeroesForArmageddon(
  db: Firestore,
  seasonNumber: number,
  now: Date
): Promise<{ living: number; deceased: number }> {
  const snap = await db.collection(HEROES_COLLECTION).get();
  let living = 0;
  let deceased = 0;
  let batch = db.batch();
  let pending = 0;
  // Each hero needs up to 2 writes (doc patch + event). Budget at most
  // BATCH_SIZE/2 heroes per batch to stay well under the 500-op limit.
  const HEROES_PER_BATCH = Math.floor(BATCH_SIZE / 2);
  for (const doc of snap.docs) {
    const hero = doc.data() as GameHeroDoc;
    const wasAlive = !hero.isDeceased;
    if (wasAlive) living++;
    else deceased++;

    // Doc patch: push season into survivedSeasons; flip to limbo if alive.
    const docPatch: Record<string, unknown> = {
      survivedSeasons: FieldValue.arrayUnion(seasonNumber),
      updatedAt: now,
    };
    if (wasAlive) {
      docPatch.currentOwnerId = null;
      docPatch.currentTileId = null;
      docPatch.awaitingResurrection = true;
    }
    batch.set(doc.ref, docPatch, { merge: true });

    // Event: season_ended. tileId records the LAST known location (limbo
    // means no current tile; we keep the historical one for the event).
    const eventId = randomUUID();
    const tileIdAtEnd = hero.currentTileId ?? hero.deceasedTileId ?? "limbo";
    const ownerIdAtEnd = hero.currentOwnerId;
    const eventDoc = heroEvent.seasonEnded({
      tileId: tileIdAtEnd,
      ownerIdAtTime: ownerIdAtEnd,
      seasonNumber,
    });
    batch.set(heroEventsCollection(db, hero.id).doc(eventId), {
      id: eventId,
      ...eventDoc,
      createdAt: now,
    });
    batch.set(
      doc.ref,
      { lastEventAt: now },
      { merge: true }
    );

    pending++;
    if (pending >= HEROES_PER_BATCH) {
      await batch.commit();
      batch = db.batch();
      pending = 0;
    }
  }
  if (pending > 0) await batch.commit();
  return { living, deceased };
}
