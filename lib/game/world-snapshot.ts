/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

// Periodic denormalized snapshot of the entire game world. The map read
// path (`/api/game/world` and `/api/game/map/me`) reads this single doc
// instead of scanning `game_tiles` + `game_players` on every request.
//
// Doc cost (per Firestore pricing): 1 read per fetch instead of ~3K reads
// at today's tile count. At 1K humans this is the difference between
// $50/yr and $500+/yr in just-the-map costs.
//
// Doc shape lives at `game_world_snapshots/latest`.
//
// Staleness budget: 5 minutes (TTL_MS). Game is weekly-paced; player
// actions update local client state from their own response so a player's
// own changes are reflected immediately. Staleness only affects how soon
// other players' changes (incoming attacks, captures) become visible.

import type { Firestore } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { logger } from "@/lib/logger";
import { isShieldActive } from "./turns";
import type { Caste, GamePlayer, MapTile } from "./types";
import {
  compactTile,
  expandTile,
  WORLD_SNAPSHOT_SCHEMA_VERSION,
  type CompactTile,
} from "./world-snapshot-codec";
import { neighborTileIds } from "./world-gen";

// Re-export the codec so existing callers that pull these from
// `world-snapshot` keep working.
export {
  compactTile,
  expandTile,
  WORLD_SNAPSHOT_SCHEMA_VERSION,
} from "./world-snapshot-codec";
export type { CompactTile } from "./world-snapshot-codec";

export const WORLD_SNAPSHOT_COLLECTION = "game_world_snapshots";
export const WORLD_SNAPSHOT_DOC = "latest";
// Soft TTL — readers tolerate serving stale snapshots a bit past this
// window (CDN cache will revalidate eventually). The cron / weekly-NPC
// hooks rebuild well within this budget so the staleness flag is rare.
export const WORLD_SNAPSHOT_TTL_MS = 5 * 60 * 1000;

export interface WorldSnapshotOwner {
  userId: string;
  displayName: string;
  caste: Caste | null;
  shielded: boolean;
  /** True for seeded NPCs. Real humans surface `false` (their player doc
   *  has no `isNpc` field; we coerce the missing case to `false` for the
   *  client). Used by the map's audience filter. */
  isNpc: boolean;
}

export interface WorldSnapshot {
  tiles: MapTile[];
  owners: WorldSnapshotOwner[];
  // Wall-clock time the snapshot was assembled. Used for the
  // `X-World-Snapshot-Stale` response header.
  generatedAt: string; // ISO
  tileCount: number;
  ownerCount: number;
}

// On-disk form. v2 stores `compactTiles`; v1 stored `tiles`. The reader
// detects format via `schemaVersion` (defaulting to v1 for legacy docs)
// and decodes accordingly.
interface StoredWorldSnapshot {
  schemaVersion?: number;
  // v2 (current writer always emits this):
  compactTiles?: CompactTile[];
  // v1 (still readable; written until the first v2 rebuild lands):
  tiles?: MapTile[];
  owners: WorldSnapshotOwner[];
  generatedAt: FirebaseFirestore.Timestamp | Date;
  expiresAt: FirebaseFirestore.Timestamp | Date;
  tileCount: number;
  ownerCount: number;
}

// Reads every tile and every player to build a snapshot. Mirrors the
// projections used by `getAllMapTilesServer` and `getAllOwnerSummariesServer`,
// so the snapshot's payload is identical to what those functions returned
// pre-snapshot — just delivered in one doc.
export async function computeWorldSnapshot(
  db: Firestore,
  now: Date = new Date()
): Promise<WorldSnapshot> {
  const [tilesSnap, playersSnap] = await Promise.all([
    db
      .collection("game_tiles")
      .select("tileId", "q", "r", "type", "ownerId", "units", "armedDefenseSpellId")
      .get(),
    db
      .collection("game_players")
      .select(
        "userId",
        "displayName",
        "caste",
        "shieldUntil",
        "shieldDropAtTurn",
        "turnsSpentTotal",
        "isNpc"
      )
      .get(),
  ]);

  const tiles: MapTile[] = tilesSnap.docs.map((d) => {
    const data = d.data();
    return {
      tileId: data.tileId,
      q: data.q,
      r: data.r,
      type: data.type,
      ownerId: data.ownerId ?? null,
      units: data.units,
      armedDefenseSpellId: data.armedDefenseSpellId ?? null,
    };
  });

  const owners: WorldSnapshotOwner[] = playersSnap.docs.map((d) => {
    const p = d.data() as GamePlayer & { isNpc?: boolean };
    return {
      userId: p.userId,
      displayName: p.displayName ?? "",
      caste: p.caste ?? null,
      shielded: isShieldActive(p, now),
      isNpc: p.isNpc === true,
    };
  });

  return {
    tiles,
    owners,
    generatedAt: now.toISOString(),
    tileCount: tiles.length,
    ownerCount: owners.length,
  };
}

// Cheap pre-check: are there any tile or player writes since the current
// snapshot's `generatedAt`? Both queries are `.where(...).limit(1)` so
// each costs at most 1 Firestore read (Firestore charges 1 read for an
// empty result set). Skipping the rebuild on a no-op cron tick saves
// ~3K reads — at 12 ticks/hr that's the dominant cost in the system.
async function worldHasChangedSince(
  db: Firestore,
  since: Date
): Promise<boolean> {
  const [tilesSnap, playersSnap] = await Promise.all([
    db
      .collection("game_tiles")
      .where("updatedAt", ">", since)
      .limit(1)
      .get(),
    db
      .collection("game_players")
      .where("updatedAt", ">", since)
      .limit(1)
      .get(),
  ]);
  return !tilesSnap.empty || !playersSnap.empty;
}

// Reads + writes the snapshot doc. Idempotent. Skips the (~3K-read)
// recompute when no game_tiles or game_players have been updated since
// the existing snapshot's generatedAt — the cron fires every 5 minutes
// and most ticks have nothing to do. Logs the size so we can monitor
// when we approach the 1MB Firestore doc limit (will need sharding
// around ~12K tiles — see comment at end of file).
//
// Pass `force: true` to rebuild unconditionally (used by the post-action
// freshness path so a player's own attack capture is reflected on the
// map without waiting for the next cron tick).
export async function rebuildWorldSnapshotServer(
  now: Date = new Date(),
  opts: { force?: boolean } = {}
): Promise<{
  tileCount: number;
  ownerCount: number;
  bytes: number;
  skipped: boolean;
}> {
  const db = getAdminDb();
  if (!db) throw new Error("Firebase Admin not initialized");

  // Cheap gate — only check when we have a previous snapshot to compare
  // against. Empty-snapshot case (first deploy) falls through to rebuild.
  if (!opts.force) {
    const ref = db
      .collection(WORLD_SNAPSHOT_COLLECTION)
      .doc(WORLD_SNAPSHOT_DOC);
    const existing = await ref.get();
    if (existing.exists) {
      const data = existing.data() as StoredWorldSnapshot;
      const generatedAt =
        data.generatedAt instanceof Date
          ? data.generatedAt
          : (data.generatedAt as FirebaseFirestore.Timestamp).toDate();
      const changed = await worldHasChangedSince(db, generatedAt);
      if (!changed) {
        logger.info("Game world snapshot rebuild skipped — no changes", {
          lastGeneratedAt: generatedAt.toISOString(),
          tileCount: data.tileCount,
          ownerCount: data.ownerCount,
        });
        return {
          tileCount: data.tileCount ?? 0,
          ownerCount: data.ownerCount ?? 0,
          bytes: 0,
          skipped: true,
        };
      }
    }
  }

  const snapshot = await computeWorldSnapshot(db, now);
  const stored: StoredWorldSnapshot = {
    schemaVersion: WORLD_SNAPSHOT_SCHEMA_VERSION,
    compactTiles: snapshot.tiles.map(compactTile),
    owners: snapshot.owners,
    generatedAt: now,
    expiresAt: new Date(now.getTime() + WORLD_SNAPSHOT_TTL_MS),
    tileCount: snapshot.tileCount,
    ownerCount: snapshot.ownerCount,
  };

  const ref = db.collection(WORLD_SNAPSHOT_COLLECTION).doc(WORLD_SNAPSHOT_DOC);
  await ref.set(stored);

  // Approximate size as JSON; close enough for capacity monitoring without
  // pulling in a Firestore-byte-counter library. Firestore's 1MB limit is
  // on the binary-encoded doc, which is typically ~70-90% of JSON length.
  const bytes = JSON.stringify(stored).length;

  logger.info("Game world snapshot rebuilt", {
    schemaVersion: WORLD_SNAPSHOT_SCHEMA_VERSION,
    tileCount: snapshot.tileCount,
    ownerCount: snapshot.ownerCount,
    approxBytes: bytes,
    capacityPctOf1MB: Math.round((bytes / (1024 * 1024)) * 100),
  });

  return {
    tileCount: snapshot.tileCount,
    ownerCount: snapshot.ownerCount,
    bytes,
    skipped: false,
  };
}

// Reads the snapshot doc. Returns null if no snapshot exists yet (e.g.
// before the first cron run). Caller falls back to live queries.
export async function readWorldSnapshotServer(): Promise<{
  snapshot: WorldSnapshot;
  isStale: boolean;
} | null> {
  const db = getAdminDb();
  if (!db) return null;

  const ref = db.collection(WORLD_SNAPSHOT_COLLECTION).doc(WORLD_SNAPSHOT_DOC);
  const doc = await ref.get();
  if (!doc.exists) return null;

  const data = doc.data() as StoredWorldSnapshot | undefined;
  if (!data || !Array.isArray(data.owners)) return null;

  // Decode tiles from whichever format is present. v2 docs store
  // `compactTiles`; legacy v1 docs store `tiles` directly. Either is OK.
  let tiles: MapTile[];
  if (Array.isArray(data.compactTiles)) {
    tiles = data.compactTiles.map(expandTile);
  } else if (Array.isArray(data.tiles)) {
    tiles = data.tiles;
  } else {
    return null;
  }

  const generatedAt =
    data.generatedAt instanceof Date
      ? data.generatedAt
      : data.generatedAt?.toDate?.() ?? new Date(0);
  const expiresAt =
    data.expiresAt instanceof Date
      ? data.expiresAt
      : data.expiresAt?.toDate?.() ?? new Date(0);

  return {
    snapshot: {
      tiles,
      owners: data.owners,
      generatedAt: generatedAt.toISOString(),
      tileCount: data.tileCount ?? tiles.length,
      ownerCount: data.ownerCount ?? data.owners.length,
    },
    isStale: Date.now() >= expiresAt.getTime(),
  };
}

// Filters the snapshot down to a bbox. Pure in-memory — no Firestore read.
export function filterSnapshotToBbox(
  snapshot: WorldSnapshot,
  bounds: { qMin: number; qMax: number; rMin: number; rMax: number }
): MapTile[] {
  return snapshot.tiles.filter(
    (t) =>
      t.q >= bounds.qMin &&
      t.q <= bounds.qMax &&
      t.r >= bounds.rMin &&
      t.r <= bounds.rMax
  );
}

// Builds the personal map view (my tiles + enemy border + owner summaries
// for those enemies) entirely from the snapshot. Pure in-memory — no
// Firestore reads. Mirrors the shape returned by `getMyMapServer` so the
// route can swap implementations without changing the API contract.
//
// Staleness contract: the snapshot may be up to WORLD_SNAPSHOT_TTL_MS
// behind reality. Action handlers return live updated tiles in their own
// responses, so a player's own builds/attacks/etc. are reflected
// immediately on the client; only OTHER players' changes ride the
// snapshot delay.
export function deriveMyMapFromSnapshot(
  snapshot: WorldSnapshot,
  userId: string
): {
  myTiles: MapTile[];
  borderTiles: MapTile[];
  owners: WorldSnapshotOwner[];
} {
  const tilesById = new Map<string, MapTile>();
  for (const t of snapshot.tiles) tilesById.set(t.tileId, t);

  const myTiles: MapTile[] = [];
  for (const t of snapshot.tiles) {
    if (t.ownerId === userId) myTiles.push(t);
  }

  const myIds = new Set(myTiles.map((t) => t.tileId));
  const borderTiles: MapTile[] = [];
  const enemyOwnerIds = new Set<string>();
  const seen = new Set<string>();

  for (const t of myTiles) {
    for (const nid of neighborTileIds(t.q, t.r)) {
      if (myIds.has(nid)) continue;
      if (seen.has(nid)) continue;
      seen.add(nid);
      const neighbor = tilesById.get(nid);
      if (!neighbor) continue; // unrevealed
      if (!neighbor.ownerId || neighbor.ownerId === userId) continue;
      borderTiles.push(neighbor);
      enemyOwnerIds.add(neighbor.ownerId);
    }
  }

  const owners: WorldSnapshotOwner[] = [];
  for (const o of snapshot.owners) {
    if (enemyOwnerIds.has(o.userId)) owners.push(o);
  }

  return { myTiles, borderTiles, owners };
}

// Future work: schemaVersion 2 (compact per-tile encoding) brought the doc
// from ~660 KB → ~200 KB at 4,419 tiles. The next ceiling is still the
// Firestore 1MB single-doc limit — at the v2 size that's ~25K tiles, but
// past ~15K worth pre-emptively sharding. Plan: hash by
// `tileId.charCodeAt(0) % N` into `game_world_snapshots/shard-{n}` and
// fan-out reads. Owners stay unsharded (player count grows much slower
// than tile count). The reader API can stay the same —
// `readWorldSnapshotServer` just gets all shards in parallel and concats.
