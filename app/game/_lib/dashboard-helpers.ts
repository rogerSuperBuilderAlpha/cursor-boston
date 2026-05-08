/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { GamePlayer, MapTile } from "@/lib/game/types";
import type {
  OwnerSummary,
  ShieldStatus,
  ThreatSummary,
} from "./dashboard-types";

/**
 * Coerce a Firestore Timestamp / Date / ISO string / millis-number into a
 * plain Date. Returns epoch (1970) for nullish/unknown shapes — callers
 * should treat that as "no value" and not as a real timestamp.
 */
export function asDate(value: unknown): Date {
  if (!value) return new Date(0);
  if (value instanceof Date) return value;
  if (
    typeof value === "object" &&
    value !== null &&
    "_seconds" in (value as Record<string, unknown>)
  ) {
    const v = value as { _seconds: number; _nanoseconds?: number };
    return new Date(v._seconds * 1000 + (v._nanoseconds ?? 0) / 1e6);
  }
  if (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { toDate?: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === "string" || typeof value === "number") {
    return new Date(value);
  }
  return new Date(0);
}

/**
 * Compute the shield's current state (active vs down, days/turns left,
 * which condition is the bottleneck). The shield drops as soon as either
 * the time clock or the turn-spend counter hits zero — both have to stay
 * positive for it to remain up.
 */
export function deriveShieldStatus(player: GamePlayer): ShieldStatus {
  const shieldUntil = asDate(player.shieldUntil);
  const now = Date.now();
  const msLeft = shieldUntil.getTime() - now;
  const daysLeft = Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
  const turnsLeft = Math.max(
    0,
    player.shieldDropAtTurn - player.turnsSpentTotal
  );
  const timeStillUp = msLeft > 0;
  const turnsStillUp = turnsLeft > 0;
  const shielded = timeStillUp && turnsStillUp;
  let bottleneck: ShieldStatus["bottleneck"] = "none";
  if (timeStillUp && turnsStillUp) bottleneck = "both";
  else if (timeStillUp) bottleneck = "time";
  else if (turnsStillUp) bottleneck = "turns";
  return { shielded, daysLeft, turnsLeft, bottleneck };
}

export function describeShieldRemaining(s: ShieldStatus): string {
  if (!s.shielded) return "Down";
  const parts: string[] = [];
  if (s.bottleneck === "both" || s.bottleneck === "time") {
    parts.push(`${s.daysLeft}d left`);
  }
  if (s.bottleneck === "both" || s.bottleneck === "turns") {
    parts.push(`${s.turnsLeft} more turns to spend`);
  }
  return `Drops in ${parts.join(" and ")}`;
}

// Six axial neighbor offsets for a pointy-top hex grid.
const HEX_NEIGHBORS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, -1],
  [-1, 1],
] as const;

/**
 * Walk every owned tile and find foreign generals on the immediate border.
 * `unshieldedNeighbors` is the number of *generals* (not tiles) you can
 * actually attack right now.
 */
export function countUnshieldedNeighbors(
  myUserId: string,
  myTiles: MapTile[],
  worldTiles: MapTile[],
  worldOwners: Map<string, OwnerSummary>
): ThreatSummary {
  if (worldTiles.length === 0) {
    return {
      unshieldedNeighbors: 0,
      totalForeignNeighbors: 0,
      topNeighborNames: [],
    };
  }
  const tilesByCoord = new Map<string, MapTile>();
  for (const t of worldTiles) {
    tilesByCoord.set(`${t.q},${t.r}`, t);
  }
  const foreignOwnerIds = new Set<string>();
  const unshieldedOwnerIds = new Set<string>();
  for (const t of myTiles) {
    for (const [dq, dr] of HEX_NEIGHBORS) {
      const neighbor = tilesByCoord.get(`${t.q + dq},${t.r + dr}`);
      if (!neighbor) continue;
      if (!neighbor.ownerId || neighbor.ownerId === myUserId) continue;
      foreignOwnerIds.add(neighbor.ownerId);
      const owner = worldOwners.get(neighbor.ownerId);
      if (owner && !owner.shielded) unshieldedOwnerIds.add(neighbor.ownerId);
    }
  }
  const topNeighborNames: string[] = [];
  for (const id of unshieldedOwnerIds) {
    const o = worldOwners.get(id);
    if (o?.displayName) topNeighborNames.push(o.displayName);
    if (topNeighborNames.length >= 3) break;
  }
  return {
    unshieldedNeighbors: unshieldedOwnerIds.size,
    totalForeignNeighbors: foreignOwnerIds.size,
    topNeighborNames,
  };
}

/**
 * Format a positive ms duration as `Nd Xh Ym` / `Xh Ym Zs` / `Ym Zs`.
 * Negative or zero → "any moment now" (used by the rollover countdown).
 */
export function formatCountdown(msRemaining: number): string {
  if (msRemaining <= 0) return "any moment now";
  const totalSeconds = Math.floor(msRemaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  return `${minutes}m ${seconds}s`;
}
