/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

// Pure encode/decode helpers for the world-snapshot doc shape. Lives in
// its own file (no firebase-admin dependency) so both the server-only
// writer in `world-snapshot.ts` and the client listener in
// `app/game/_lib/use-world-snapshot-listener.ts` can share one codec.

import type { LandType, MapTile } from "./types";
import { tileIdFromAxial } from "./world-gen";

// Bumped when on-disk shape changes. Reader code should accept any version
// it knows how to decode; v2 (current) reads compactTiles, v1 (legacy)
// read tiles. Doc-shape rollbacks would require deploying a reader that
// understands both — same pattern as today's reader.
export const WORLD_SNAPSHOT_SCHEMA_VERSION = 2;

// Single-character codes for LandType. The on-wire form pays a per-tile
// price for the type string in 4,000+ array entries; trimming "unrevealed"
// (10 chars) → "u" (1 char) shaves ~5–9 bytes per tile.
const TYPE_TO_CODE: Record<LandType, string> = {
  unrevealed: "u",
  unassigned: "x",
  military: "m",
  food: "f",
  magic: "g",
};
const CODE_TO_TYPE: Record<string, LandType> = {
  u: "unrevealed",
  x: "unassigned",
  m: "military",
  f: "food",
  g: "magic",
};

/**
 * On-wire form of a MapTile inside a v2 snapshot doc. All fields except
 * q, r, t are omitted when at their zero/null default — most map tiles are
 * "unrevealed empty", which compresses from ~140 B to ~22 B per entry.
 *
 * Layout choices favor readability over absolute density: short keys + omit
 * defaults. Estimate at current scale (4,419 tiles, mostly empty):
 *   v1 (`MapTile[]`):       ~660 KB
 *   v2 (`CompactTile[]`):   ~200 KB  (~70% reduction)
 */
export interface CompactTile {
  q: number;
  r: number;
  /** LandType code — see TYPE_TO_CODE. */
  t: string;
  /** Owner userId. Omitted when null (unowned). */
  o?: string;
  /** Ground units. Omitted when 0. */
  g?: number;
  /** Siege units. Omitted when 0. */
  s?: number;
  /** Air units. Omitted when 0. */
  a?: number;
  /** Armed defense spell id. Omitted when null. */
  d?: string;
}

/** Encode a MapTile into its compact form. Pure. */
export function compactTile(tile: MapTile): CompactTile {
  const code = TYPE_TO_CODE[tile.type];
  if (!code) throw new Error(`Unknown LandType: ${tile.type}`);
  const c: CompactTile = { q: tile.q, r: tile.r, t: code };
  if (tile.ownerId) c.o = tile.ownerId;
  // tile.units may be undefined on legacy docs that predate the field.
  if (tile.units?.ground) c.g = tile.units.ground;
  if (tile.units?.siege) c.s = tile.units.siege;
  if (tile.units?.air) c.a = tile.units.air;
  if (tile.armedDefenseSpellId) c.d = tile.armedDefenseSpellId;
  return c;
}

/** Decode a CompactTile back into a MapTile. Pure. */
export function expandTile(c: CompactTile): MapTile {
  const type = CODE_TO_TYPE[c.t];
  if (!type) throw new Error(`Unknown CompactTile type code: ${c.t}`);
  return {
    tileId: tileIdFromAxial(c.q, c.r),
    q: c.q,
    r: c.r,
    type,
    ownerId: c.o ?? null,
    units: { ground: c.g ?? 0, siege: c.s ?? 0, air: c.a ?? 0 },
    armedDefenseSpellId: c.d ?? null,
  };
}
