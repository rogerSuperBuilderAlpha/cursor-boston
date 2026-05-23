/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

// Daily, view-optimized snapshot of the world for the public 3D flyover
// page (`/game/world`). Lives at `game_world_snapshots/daily-3d` and is
// rebuilt once per day by a Vercel cron (see vercel.json). Stable, cheap,
// and shaped for direct WebGL rendering.
//
// Why a separate doc from the 5-min `latest` snapshot:
//  - The 3D page is a public marketing surface; serving from a frozen
//    daily artifact (via 24h ISR) gives zero Firestore reads in steady
//    state and immune to mid-rebuild blips on `latest`.
//  - The shape here is denormalized for the renderer: tile × owner joined
//    inline, units flattened to a single `hasExtraForces` boolean. No
//    decoder, no second fetch.
//
// Unrevealed tiles are excluded — they have nothing to render and shipping
// them just inflates the payload.

import type { Firestore } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { logger } from "@/lib/logger";
import { isShieldActive } from "./turns";
import type { Caste, GamePlayer, LandType, UnitStack } from "./types";

export const WORLD_3D_SNAPSHOT_COLLECTION = "game_world_snapshots";
export const WORLD_3D_SNAPSHOT_DOC = "daily-3d";
// v2: owner-deduped storage. v1 inlined owner fields on every tile and
// blew past Firestore's 1MB doc ceiling at ~4.5K tiles. The reader still
// returns the denormalized public shape — only the on-disk layout
// changed.
export const WORLD_3D_SNAPSHOT_SCHEMA_VERSION = 2;

// Bit flags packed into World3DTile.flags for on-disk storage.
const FLAG_HAS_EXTRA_FORCES = 1 << 0;
const FLAG_HAS_HERO = 1 << 1;

export interface World3DTile {
  tileId: string;
  q: number;
  r: number;
  type: LandType;
  ownerId: string | null;
  ownerName: string | null;
  caste: Caste | null;
  /** True for seeded NPC owners; false for humans and for unowned tiles. */
  isNpc: boolean;
  /** Fortification level (1..10). */
  level: number;
  /** True when the tile carries any recruited unit beyond its base garrison. */
  hasExtraForces: boolean;
  /** True when a hero is stationed on this tile. */
  hasHero: boolean;
  /** True when the owner currently has an active shield. Drives a defensive
   *  visual treatment on the tile so the camera flythrough reads honestly. */
  ownerShielded: boolean;
}

export interface World3DSnapshot {
  tiles: World3DTile[];
  generatedAt: string; // ISO
  tileCount: number;
}

// Owner row in the deduped lookup table. Indexed by position in the
// `owners` array; tiles reference by `ownerIdx` (-1 = unclaimed).
interface StoredOwner {
  ownerId: string;
  ownerName: string | null;
  caste: Caste | null;
  isNpc: boolean;
  shielded: boolean;
}

// Compact on-disk tile. Owner attributes are looked up via ownerIdx
// (saves ~60 bytes/tile vs. inlining them — the difference between
// fitting in Firestore's 1MB doc ceiling and not).
interface StoredCompactTile {
  tileId: string;
  q: number;
  r: number;
  type: LandType;
  ownerIdx: number; // -1 means unclaimed
  level: number;
  flags: number; // bitfield: see FLAG_* constants
}

interface StoredWorld3DSnapshot {
  schemaVersion: number;
  owners: StoredOwner[];
  tiles: StoredCompactTile[];
  generatedAt: FirebaseFirestore.Timestamp | Date;
  expiresAt: FirebaseFirestore.Timestamp | Date;
  tileCount: number;
}

interface OwnerJoin {
  displayName: string | null;
  caste: Caste | null;
  isNpc: boolean;
  shielded: boolean;
}

function unitsSum(u: UnitStack | undefined): number {
  if (!u) return 0;
  return (u.ground ?? 0) + (u.siege ?? 0) + (u.air ?? 0);
}

// Same single-collection-read pattern as computeWorldSnapshot(), but with
// `level` and `hero` projected in and units collapsed to a single boolean.
// Cost is one read per tile + one read per player, same as the live
// snapshot — the cron runs once per day, so steady-state read budget is
// ~5K reads/day from this writer.
export async function computeWorld3DSnapshot(
  db: Firestore,
  now: Date = new Date()
): Promise<World3DSnapshot> {
  const [tilesSnap, playersSnap] = await Promise.all([
    db
      .collection("game_tiles")
      .select("tileId", "q", "r", "type", "ownerId", "level", "units", "hero")
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

  const owners = new Map<string, OwnerJoin>();
  for (const d of playersSnap.docs) {
    const p = d.data() as GamePlayer & { isNpc?: boolean };
    owners.set(p.userId, {
      displayName: p.displayName ?? null,
      caste: p.caste ?? null,
      isNpc: p.isNpc === true,
      shielded: isShieldActive(p, now),
    });
  }

  const tiles: World3DTile[] = [];
  for (const d of tilesSnap.docs) {
    const data = d.data() as Partial<{
      tileId: string;
      q: number;
      r: number;
      type: LandType;
      ownerId: string | null;
      level: number;
      units: UnitStack;
      hero: unknown;
    }>;
    if (data.type === "unrevealed") continue;

    const ownerId = data.ownerId ?? null;
    const join = ownerId ? owners.get(ownerId) : undefined;

    tiles.push({
      tileId: data.tileId ?? d.id,
      q: data.q ?? 0,
      r: data.r ?? 0,
      type: (data.type ?? "unassigned") as LandType,
      ownerId,
      ownerName: join?.displayName ?? null,
      caste: join?.caste ?? null,
      isNpc: join?.isNpc ?? false,
      level: data.level ?? 1,
      hasExtraForces: unitsSum(data.units) > 0,
      hasHero: data.hero != null,
      ownerShielded: join?.shielded ?? false,
    });
  }

  return {
    tiles,
    generatedAt: now.toISOString(),
    tileCount: tiles.length,
  };
}

// Idempotent writer. Mirrors rebuildWorldSnapshotServer in world-snapshot.ts
// but without the "changed since" gate — this only runs once per day, so a
// no-op skip isn't worth the extra metadata complexity.
export async function rebuildWorld3DSnapshotServer(
  now: Date = new Date()
): Promise<{ tileCount: number; bytes: number }> {
  const db = getAdminDb();
  if (!db) throw new Error("Firebase Admin not initialized");

  const snapshot = await computeWorld3DSnapshot(db, now);

  // 24h soft expiry. The reader serves a stale doc rather than 500ing if
  // the cron skips a day.
  const expiresAt = new Date(now.getTime() + 25 * 60 * 60 * 1000);

  // Build the owner lookup table, then compact each tile to reference
  // the owner by index. Saves ~60 bytes/tile vs. inlining owner fields.
  const ownerIdxById = new Map<string, number>();
  const owners: StoredOwner[] = [];
  const compactTiles: StoredCompactTile[] = snapshot.tiles.map((t) => {
    let ownerIdx = -1;
    if (t.ownerId) {
      const existing = ownerIdxById.get(t.ownerId);
      if (existing !== undefined) {
        ownerIdx = existing;
      } else {
        ownerIdx = owners.length;
        ownerIdxById.set(t.ownerId, ownerIdx);
        owners.push({
          ownerId: t.ownerId,
          ownerName: t.ownerName,
          caste: t.caste,
          isNpc: t.isNpc,
          shielded: t.ownerShielded,
        });
      }
    }
    let flags = 0;
    if (t.hasExtraForces) flags |= FLAG_HAS_EXTRA_FORCES;
    if (t.hasHero) flags |= FLAG_HAS_HERO;
    return {
      tileId: t.tileId,
      q: t.q,
      r: t.r,
      type: t.type,
      ownerIdx,
      level: t.level,
      flags,
    };
  });

  const stored: StoredWorld3DSnapshot = {
    schemaVersion: WORLD_3D_SNAPSHOT_SCHEMA_VERSION,
    owners,
    tiles: compactTiles,
    generatedAt: now,
    expiresAt,
    tileCount: snapshot.tileCount,
  };

  const ref = db
    .collection(WORLD_3D_SNAPSHOT_COLLECTION)
    .doc(WORLD_3D_SNAPSHOT_DOC);
  await ref.set(stored);

  const bytes = JSON.stringify(stored).length;

  logger.info("Game world 3D snapshot rebuilt", {
    schemaVersion: WORLD_3D_SNAPSHOT_SCHEMA_VERSION,
    tileCount: snapshot.tileCount,
    approxBytes: bytes,
    capacityPctOf1MB: Math.round((bytes / (1024 * 1024)) * 100),
  });

  return { tileCount: snapshot.tileCount, bytes };
}

export async function readWorld3DSnapshotServer(): Promise<World3DSnapshot | null> {
  const db = getAdminDb();
  if (!db) return null;

  const ref = db
    .collection(WORLD_3D_SNAPSHOT_COLLECTION)
    .doc(WORLD_3D_SNAPSHOT_DOC);
  const doc = await ref.get();
  if (!doc.exists) return null;

  const data = doc.data() as StoredWorld3DSnapshot | undefined;
  if (!data || !Array.isArray(data.tiles)) return null;

  const generatedAt =
    data.generatedAt instanceof Date
      ? data.generatedAt
      : data.generatedAt?.toDate?.() ?? new Date(0);

  // Expand the compact on-disk format back to the public denormalized
  // shape. v1 legacy docs (no `owners` array) are no longer expected in
  // production but the writer always emits v2 now.
  const owners: StoredOwner[] = Array.isArray(data.owners) ? data.owners : [];
  const tiles: World3DTile[] = data.tiles.map((t) => {
    const o = t.ownerIdx >= 0 ? owners[t.ownerIdx] : undefined;
    return {
      tileId: t.tileId,
      q: t.q,
      r: t.r,
      type: t.type,
      ownerId: o?.ownerId ?? null,
      ownerName: o?.ownerName ?? null,
      caste: o?.caste ?? null,
      isNpc: o?.isNpc ?? false,
      level: t.level,
      hasExtraForces: (t.flags & FLAG_HAS_EXTRA_FORCES) !== 0,
      hasHero: (t.flags & FLAG_HAS_HERO) !== 0,
      ownerShielded: o?.shielded ?? false,
    };
  });

  return {
    tiles,
    generatedAt: generatedAt.toISOString(),
    tileCount: data.tileCount ?? tiles.length,
  };
}
