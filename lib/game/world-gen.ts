/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

export interface AxialCoord {
  q: number;
  r: number;
}

const NEIGHBOR_DIRS: ReadonlyArray<AxialCoord> = [
  { q: 1, r: 0 },
  { q: 0, r: 1 },
  { q: -1, r: 1 },
  { q: -1, r: 0 },
  { q: 0, r: -1 },
  { q: 1, r: -1 },
];

export function tileIdFromAxial(q: number, r: number): string {
  return `${q}_${r}`;
}

export function axialFromTileId(tileId: string): AxialCoord {
  const [qStr, rStr] = tileId.split("_");
  const q = Number.parseInt(qStr ?? "", 10);
  const r = Number.parseInt(rStr ?? "", 10);
  if (!Number.isFinite(q) || !Number.isFinite(r)) {
    throw new Error(`Invalid tileId: ${tileId}`);
  }
  return { q, r };
}

export function neighbors(q: number, r: number): AxialCoord[] {
  return NEIGHBOR_DIRS.map((d) => ({ q: q + d.q, r: r + d.r }));
}

export function neighborTileIds(q: number, r: number): string[] {
  return neighbors(q, r).map((n) => tileIdFromAxial(n.q, n.r));
}

// Cube-distance between two axial coords. Equivalent to hex Manhattan distance.
export function hexDistance(a: AxialCoord, b: AxialCoord): number {
  const aq = a.q;
  const ar = a.r;
  const as = -aq - ar;
  const bq = b.q;
  const br = b.r;
  const bs = -bq - br;
  return (Math.abs(aq - bq) + Math.abs(ar - br) + Math.abs(as - bs)) / 2;
}

// Coords on the hex ring at exactly distance `r` from `center`. r<=0 returns
// just the center; r=1 returns 6 coords; r=N returns 6N. Order is stable
// (clockwise starting from the north neighbor scaled out by r).
export function ringCoords(center: AxialCoord, r: number): AxialCoord[] {
  if (r <= 0) return [{ ...center }];
  const out: AxialCoord[] = [];
  for (const c of hexRingCoords(center, r)) out.push(c);
  return out;
}

// Lay spawn centers on a hex spiral in axial space, scaled by `spacing`.
// Index 0 lands on the origin, then the spiral fans out one hex-ring at a
// time (6 slots on ring 1, 12 on ring 2, ...). This keeps new kingdoms
// hex-symmetric around the origin instead of marching along a single axis,
// which kept early players bunched on the q-axis under the old grid layout.
export function spawnCenterForPlayerIndex(
  index: number,
  spacing = 50
): AxialCoord {
  if (index <= 0) return { q: 0, r: 0 };
  // Cumulative slots through ring k (k>=1) = 1 + 3k(k+1). Find the smallest
  // k whose cumulative count covers `index`.
  let k = 1;
  while (1 + 3 * k * (k + 1) <= index) k++;
  const slotInRing = index - (1 + 3 * (k - 1) * k);
  const ring = ringCoords({ q: 0, r: 0 }, k);
  const c = ring[slotInRing % ring.length];
  return { q: c.q * spacing, r: c.r * spacing };
}

export interface SpawnPlayerLandsRequest {
  center: AxialCoord;
  claimedTileIds: ReadonlySet<string>;
  rng: () => number;
  totalTiles?: number;
  contiguousTarget?: number;
  exclavesMin?: number;
  exclavesMax?: number;
  scatterRadius?: number;
  contiguousMaxIterations?: number;
}

export interface SpawnPlayerLandsResult {
  tileIds: string[];
  contiguousTileIds: string[];
  exclaveTileIds: string[];
  centerTileId: string;
}

function shuffleInPlace<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
}

function* hexRingCoords(
  center: AxialCoord,
  radius: number
): Generator<AxialCoord> {
  if (radius === 0) {
    yield { ...center };
    return;
  }
  let cur: AxialCoord = {
    q: center.q + NEIGHBOR_DIRS[4].q * radius,
    r: center.r + NEIGHBOR_DIRS[4].r * radius,
  };
  for (let side = 0; side < 6; side++) {
    const dir = NEIGHBOR_DIRS[side];
    for (let step = 0; step < radius; step++) {
      yield { ...cur };
      cur = { q: cur.q + dir.q, r: cur.r + dir.r };
    }
  }
}

function findUnclaimedNear(
  center: AxialCoord,
  claimed: ReadonlySet<string>,
  maxRadius: number
): AxialCoord | null {
  if (!claimed.has(tileIdFromAxial(center.q, center.r))) return { ...center };
  for (let r = 1; r <= maxRadius; r++) {
    for (const c of hexRingCoords(center, r)) {
      if (!claimed.has(tileIdFromAxial(c.q, c.r))) return c;
    }
  }
  return null;
}

export function spawnPlayerLands(
  req: SpawnPlayerLandsRequest
): SpawnPlayerLandsResult {
  const total = req.totalTiles ?? 100;
  const contiguousTarget = req.contiguousTarget ?? 85;
  const exclavesMin = req.exclavesMin ?? 10;
  const exclavesMax = req.exclavesMax ?? Math.max(exclavesMin, 15);
  const scatterRadius = req.scatterRadius ?? 25;
  const contiguousMaxIter = req.contiguousMaxIterations ?? 5000;

  if (contiguousTarget + exclavesMax > total + (exclavesMax - exclavesMin)) {
    // contiguousTarget + exclaves can sum to less than total (we'll pad), but
    // contiguousTarget + exclavesMin must be <= total.
    if (contiguousTarget + exclavesMin > total) {
      throw new Error(
        `contiguousTarget + exclavesMin (${
          contiguousTarget + exclavesMin
        }) exceeds totalTiles (${total})`
      );
    }
  }

  const startCenter = findUnclaimedNear(
    req.center,
    req.claimedTileIds,
    scatterRadius
  );
  if (!startCenter) {
    throw new Error("Could not find an unclaimed tile near the spawn center");
  }

  const owned = new Set<string>();
  const contiguous: AxialCoord[] = [];
  const queue: AxialCoord[] = [startCenter];

  let iters = 0;
  while (
    contiguous.length < contiguousTarget &&
    queue.length > 0 &&
    iters < contiguousMaxIter
  ) {
    iters++;
    const c = queue.shift() as AxialCoord;
    const id = tileIdFromAxial(c.q, c.r);
    if (owned.has(id) || req.claimedTileIds.has(id)) continue;
    contiguous.push(c);
    owned.add(id);

    const ns = neighbors(c.q, c.r);
    shuffleInPlace(ns, req.rng);
    for (const n of ns) {
      const nid = tileIdFromAxial(n.q, n.r);
      if (!owned.has(nid) && !req.claimedTileIds.has(nid)) queue.push(n);
    }
  }

  const exclaveCountTarget = Math.min(
    total - contiguous.length,
    exclavesMin + Math.floor(req.rng() * (exclavesMax - exclavesMin + 1))
  );

  const exclaves: AxialCoord[] = [];
  const scatterMaxAttempts = exclaveCountTarget * 200 + 2000;
  let scatterAttempts = 0;

  while (exclaves.length < exclaveCountTarget && scatterAttempts < scatterMaxAttempts) {
    scatterAttempts++;
    const dq = Math.floor(req.rng() * (2 * scatterRadius + 1)) - scatterRadius;
    const dr = Math.floor(req.rng() * (2 * scatterRadius + 1)) - scatterRadius;
    const c = { q: startCenter.q + dq, r: startCenter.r + dr };
    const id = tileIdFromAxial(c.q, c.r);
    if (owned.has(id) || req.claimedTileIds.has(id)) continue;
    exclaves.push(c);
    owned.add(id);
  }

  // Pad if both BFS and scatter under-delivered (extremely dense world).
  let padAttempts = 0;
  const padMaxAttempts = 5000;
  while (contiguous.length + exclaves.length < total && padAttempts < padMaxAttempts) {
    padAttempts++;
    const reach = scatterRadius * 2 + 1;
    const dq = Math.floor(req.rng() * (2 * reach + 1)) - reach;
    const dr = Math.floor(req.rng() * (2 * reach + 1)) - reach;
    const c = { q: startCenter.q + dq, r: startCenter.r + dr };
    const id = tileIdFromAxial(c.q, c.r);
    if (owned.has(id) || req.claimedTileIds.has(id)) continue;
    exclaves.push(c);
    owned.add(id);
  }

  if (contiguous.length + exclaves.length < total) {
    throw new Error(
      `Could not allocate ${total} tiles for player; world too dense near (${startCenter.q},${startCenter.r})`
    );
  }

  const contiguousIds = contiguous.map((c) => tileIdFromAxial(c.q, c.r));
  const exclaveIds = exclaves.map((c) => tileIdFromAxial(c.q, c.r));

  return {
    tileIds: [...contiguousIds, ...exclaveIds],
    contiguousTileIds: contiguousIds,
    exclaveTileIds: exclaveIds,
    centerTileId: tileIdFromAxial(startCenter.q, startCenter.r),
  };
}
