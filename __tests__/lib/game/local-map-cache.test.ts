/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import {
  REFRESH_INTERVAL_MS,
  clearCachedMap,
  loadCachedMap,
  mayRefresh,
  mergeOwners,
  mergeTiles,
  msUntilRefresh,
  saveCachedMap,
  type CachedMapView,
  type CachedOwnerSummary,
} from "@/lib/game/local-map-cache";
import type { LandType, MapTile } from "@/lib/game/types";
import { tileIdFromAxial } from "@/lib/game/world-gen";

function tile(
  q: number,
  r: number,
  ownerId: string | null,
  type: LandType = "military"
): MapTile {
  return {
    tileId: tileIdFromAxial(q, r),
    q,
    r,
    type,
    ownerId,
    units: { ground: 0, siege: 0, air: 0 },
    armedDefenseSpellId: null,
  };
}

const USER = "user-1";
const OTHER = "user-2";
const ENEMY_A = "enemyA";

class MemStorage implements Storage {
  private data = new Map<string, string>();
  get length(): number {
    return this.data.size;
  }
  clear(): void {
    this.data.clear();
  }
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  key(idx: number): string | null {
    return Array.from(this.data.keys())[idx] ?? null;
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

describe("local-map-cache", () => {
  let originalLocalStorage: Storage | undefined;
  let mem: MemStorage;

  beforeEach(() => {
    mem = new MemStorage();
    // jsdom provides window.localStorage; replace it with our in-memory impl.
    originalLocalStorage = (globalThis as { localStorage?: Storage }).localStorage;
    Object.defineProperty(globalThis, "localStorage", {
      value: mem,
      configurable: true,
      writable: true,
    });
    // Also set on window if defined (jsdom).
    if (typeof window !== "undefined") {
      Object.defineProperty(window, "localStorage", {
        value: mem,
        configurable: true,
        writable: true,
      });
    }
  });

  afterEach(() => {
    if (originalLocalStorage) {
      Object.defineProperty(globalThis, "localStorage", {
        value: originalLocalStorage,
        configurable: true,
        writable: true,
      });
      if (typeof window !== "undefined") {
        Object.defineProperty(window, "localStorage", {
          value: originalLocalStorage,
          configurable: true,
          writable: true,
        });
      }
    }
  });

  describe("save/load round-trip", () => {
    it("persists and reads back a view", () => {
      const view: CachedMapView = {
        myTiles: [tile(0, 0, USER), tile(1, 0, USER)],
        borderTiles: [tile(2, 0, ENEMY_A)],
        owners: [
          {
            userId: ENEMY_A,
            displayName: "Enemy A",
            caste: "iron",
            shielded: false,
          },
        ],
        lastFetchedAt: 1_000_000,
      };
      saveCachedMap(USER, view);
      const loaded = loadCachedMap(USER);
      expect(loaded).not.toBeNull();
      expect(loaded?.myTiles).toHaveLength(2);
      expect(loaded?.borderTiles).toHaveLength(1);
      expect(loaded?.owners[0]?.userId).toBe(ENEMY_A);
      expect(loaded?.lastFetchedAt).toBe(1_000_000);
    });

    it("returns null for a missing entry", () => {
      expect(loadCachedMap(USER)).toBeNull();
    });

    it("does not return another user's cache", () => {
      saveCachedMap(USER, {
        myTiles: [tile(0, 0, USER)],
        borderTiles: [],
        owners: [],
        lastFetchedAt: 1_000_000,
      });
      expect(loadCachedMap(OTHER)).toBeNull();
    });

    it("rejects an entry with a corrupt JSON payload", () => {
      mem.setItem("cb-game-map-v1:" + USER, "not-json");
      expect(loadCachedMap(USER)).toBeNull();
    });

    it("rejects an entry with a mismatched embedded userId", () => {
      saveCachedMap(USER, {
        myTiles: [],
        borderTiles: [],
        owners: [],
        lastFetchedAt: 1_000_000,
      });
      // Tamper: load, swap, write back under USER's key.
      const raw = mem.getItem("cb-game-map-v1:" + USER)!;
      const parsed = JSON.parse(raw);
      parsed.userId = OTHER;
      mem.setItem("cb-game-map-v1:" + USER, JSON.stringify(parsed));
      expect(loadCachedMap(USER)).toBeNull();
    });
  });

  describe("clearCachedMap", () => {
    it("removes the entry for a user", () => {
      saveCachedMap(USER, {
        myTiles: [tile(0, 0, USER)],
        borderTiles: [],
        owners: [],
        lastFetchedAt: 1_000_000,
      });
      clearCachedMap(USER);
      expect(loadCachedMap(USER)).toBeNull();
    });
  });

  describe("mergeTiles", () => {
    function seed(): void {
      saveCachedMap(USER, {
        myTiles: [tile(0, 0, USER), tile(1, 0, USER)],
        borderTiles: [tile(2, 0, ENEMY_A)],
        owners: [],
        lastFetchedAt: 1_000_000,
      });
    }

    it("returns null when there is no cache to merge into", () => {
      expect(mergeTiles(USER, [tile(0, 0, USER)])).toBeNull();
    });

    it("updates an existing owned tile in place", () => {
      seed();
      const updated: MapTile = {
        ...tile(0, 0, USER),
        units: { ground: 5, siege: 0, air: 0 },
      };
      const next = mergeTiles(USER, [updated]);
      expect(next?.myTiles).toHaveLength(2);
      const t = next?.myTiles.find((m) => m.tileId === tileIdFromAxial(0, 0));
      expect(t?.units.ground).toBe(5);
    });

    it("moves a conquered border tile from border → my tiles", () => {
      seed();
      const conquered = tile(2, 0, USER); // was ENEMY_A's
      const next = mergeTiles(USER, [conquered]);
      expect(
        next?.myTiles.some((t) => t.tileId === tileIdFromAxial(2, 0))
      ).toBe(true);
      expect(
        next?.borderTiles.some((t) => t.tileId === tileIdFromAxial(2, 0))
      ).toBe(false);
    });

    it("moves a lost own tile from my tiles → border (if it touches another own tile)", () => {
      seed();
      const lost = tile(1, 0, ENEMY_A); // was USER's, still touches (0,0)
      const next = mergeTiles(USER, [lost]);
      expect(
        next?.myTiles.some((t) => t.tileId === tileIdFromAxial(1, 0))
      ).toBe(false);
      expect(
        next?.borderTiles.some((t) => t.tileId === tileIdFromAxial(1, 0))
      ).toBe(true);
    });

    it("drops an enemy update that does not border any of my tiles", () => {
      seed();
      const remote = tile(10, 10, ENEMY_A);
      const next = mergeTiles(USER, [remote]);
      expect(
        next?.borderTiles.some((t) => t.tileId === tileIdFromAxial(10, 10))
      ).toBe(false);
    });

    it("drops a tile that becomes unowned (null ownerId) from both buckets", () => {
      seed();
      const cleared = tile(2, 0, null);
      const next = mergeTiles(USER, [cleared]);
      expect(
        next?.borderTiles.some((t) => t.tileId === tileIdFromAxial(2, 0))
      ).toBe(false);
      expect(
        next?.myTiles.some((t) => t.tileId === tileIdFromAxial(2, 0))
      ).toBe(false);
    });

    it("does not bump lastFetchedAt", () => {
      seed();
      const before = loadCachedMap(USER)?.lastFetchedAt;
      mergeTiles(USER, [tile(0, 0, USER)]);
      const after = loadCachedMap(USER)?.lastFetchedAt;
      expect(after).toBe(before);
    });
  });

  describe("mergeOwners", () => {
    it("adds new owner summaries and replaces existing ones", () => {
      saveCachedMap(USER, {
        myTiles: [],
        borderTiles: [],
        owners: [
          {
            userId: ENEMY_A,
            displayName: "Old Name",
            caste: "iron",
            shielded: false,
          },
        ],
        lastFetchedAt: 1_000_000,
      });
      const updates: CachedOwnerSummary[] = [
        {
          userId: ENEMY_A,
          displayName: "New Name",
          caste: "iron",
          shielded: true,
        },
        {
          userId: "enemyB",
          displayName: "Enemy B",
          caste: "stone",
          shielded: false,
        },
      ];
      const next = mergeOwners(USER, updates);
      expect(next?.owners).toHaveLength(2);
      expect(
        next?.owners.find((o) => o.userId === ENEMY_A)?.displayName
      ).toBe("New Name");
      expect(
        next?.owners.find((o) => o.userId === ENEMY_A)?.shielded
      ).toBe(true);
    });

    it("returns null when no cache exists", () => {
      expect(mergeOwners(USER, [])).toBeNull();
    });
  });

  describe("mayRefresh / msUntilRefresh", () => {
    const view: CachedMapView = {
      myTiles: [],
      borderTiles: [],
      owners: [],
      lastFetchedAt: 1_000_000,
    };

    it("permits refresh when no view is cached", () => {
      expect(mayRefresh(null)).toBe(true);
      expect(msUntilRefresh(null)).toBe(0);
    });

    it("blocks refresh inside the rate-limit window", () => {
      const now = view.lastFetchedAt + REFRESH_INTERVAL_MS - 1;
      expect(mayRefresh(view, now)).toBe(false);
      expect(msUntilRefresh(view, now)).toBe(1);
    });

    it("permits refresh once the window has elapsed", () => {
      const now = view.lastFetchedAt + REFRESH_INTERVAL_MS;
      expect(mayRefresh(view, now)).toBe(true);
      expect(msUntilRefresh(view, now)).toBe(0);
    });
  });
});
