/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

// Pure parser for a snapshot doc as delivered by the Firestore Web SDK
// (`onSnapshot` data payload). Lives in its own file so it's testable
// without React or the SDK transport. The hook in
// `use-world-snapshot-listener.ts` is a thin wrapper around this.

import { Timestamp } from "firebase/firestore";
import type { Caste, MapTile } from "@/lib/game/types";
import {
  expandTile,
  type CompactTile,
} from "@/lib/game/world-snapshot-codec";

export interface ClientWorldSnapshotOwner {
  userId: string;
  displayName: string;
  caste: Caste | null;
  shielded: boolean;
  isNpc: boolean;
}

export interface ClientWorldSnapshot {
  tiles: MapTile[];
  owners: ClientWorldSnapshotOwner[];
  generatedAt: string;
  tileCount: number;
  ownerCount: number;
}

/**
 * Decode a snapshot doc payload. Handles both schema versions:
 *   - v2 (current writer): tiles in `compactTiles[]`, decoded via expandTile.
 *   - v1 (legacy): tiles in `tiles[]`, used as-is.
 *
 * Tolerates malformed input by returning empty arrays — the listener
 * surfaces parser errors via React state instead of throwing.
 */
export function parseSnapshotDoc(
  data: Record<string, unknown>
): ClientWorldSnapshot {
  const generatedAtRaw = data.generatedAt;
  let generatedAt: string;
  if (generatedAtRaw instanceof Timestamp) {
    generatedAt = generatedAtRaw.toDate().toISOString();
  } else if (generatedAtRaw instanceof Date) {
    generatedAt = generatedAtRaw.toISOString();
  } else if (typeof generatedAtRaw === "string") {
    generatedAt = generatedAtRaw;
  } else {
    generatedAt = new Date().toISOString();
  }
  // v2 docs store `compactTiles`; v1 docs store `tiles`. Either is OK.
  let tiles: MapTile[];
  if (Array.isArray(data.compactTiles)) {
    tiles = (data.compactTiles as CompactTile[]).map(expandTile);
  } else if (Array.isArray(data.tiles)) {
    tiles = data.tiles as MapTile[];
  } else {
    tiles = [];
  }
  const owners = Array.isArray(data.owners)
    ? (data.owners as ClientWorldSnapshotOwner[])
    : [];
  return {
    tiles,
    owners,
    generatedAt,
    tileCount: typeof data.tileCount === "number" ? data.tileCount : tiles.length,
    ownerCount:
      typeof data.ownerCount === "number" ? data.ownerCount : owners.length,
  };
}
