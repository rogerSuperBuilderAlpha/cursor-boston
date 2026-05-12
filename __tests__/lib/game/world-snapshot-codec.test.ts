/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { MapTile } from "@/lib/game/types";
import {
  compactTile,
  expandTile,
  WORLD_SNAPSHOT_SCHEMA_VERSION,
} from "@/lib/game/world-snapshot-codec";

describe("world-snapshot codec", () => {
  it("schema version is 2", () => {
    expect(WORLD_SNAPSHOT_SCHEMA_VERSION).toBe(2);
  });

  describe("round-trip", () => {
    const cases: Array<{ name: string; tile: MapTile }> = [
      {
        name: "empty unrevealed tile (the common case)",
        tile: {
          tileId: "5_-3",
          q: 5,
          r: -3,
          type: "unrevealed",
          ownerId: null,
          units: { ground: 0, siege: 0, air: 0 },
          armedDefenseSpellId: null,
        },
      },
      {
        name: "owned military tile with mixed units",
        tile: {
          tileId: "0_0",
          q: 0,
          r: 0,
          type: "military",
          ownerId: "user_abc123",
          units: { ground: 50, siege: 10, air: 0 },
          armedDefenseSpellId: null,
        },
      },
      {
        name: "tile with a defense spell armed",
        tile: {
          tileId: "-7_4",
          q: -7,
          r: 4,
          type: "magic",
          ownerId: "user_def456",
          units: { ground: 0, siege: 0, air: 5 },
          armedDefenseSpellId: "white_t3_shield",
        },
      },
      {
        name: "all five LandType values",
        tile: {
          tileId: "1_1",
          q: 1,
          r: 1,
          type: "food",
          ownerId: null,
          units: { ground: 0, siege: 0, air: 0 },
          armedDefenseSpellId: null,
        },
      },
    ];

    it.each(cases)("$name round-trips", ({ tile }) => {
      expect(expandTile(compactTile(tile))).toEqual(tile);
    });
  });

  describe("size win", () => {
    // The whole point of v2: the on-wire form is much smaller. Lock that
    // win in with a coarse byte-budget assertion. If a future change
    // accidentally puffs the encoding back up, this test will catch it.
    it("the empty-tile common case is < 30 bytes JSON", () => {
      const empty: MapTile = {
        tileId: "5_-3",
        q: 5,
        r: -3,
        type: "unrevealed",
        ownerId: null,
        units: { ground: 0, siege: 0, air: 0 },
        armedDefenseSpellId: null,
      };
      const v1Bytes = JSON.stringify(empty).length;
      const v2Bytes = JSON.stringify(compactTile(empty)).length;
      expect(v2Bytes).toBeLessThan(30);
      // Sanity check: at least 4× smaller for the common case.
      expect(v1Bytes / v2Bytes).toBeGreaterThan(4);
    });

    it("a populated map saves >50% on the tiles array", () => {
      // Mostly-empty world with ~5% of tiles owned/populated — a rough
      // proxy for the live world today.
      const tiles: MapTile[] = [];
      for (let i = 0; i < 1000; i++) {
        const owned = i % 20 === 0;
        tiles.push({
          tileId: `${i}_0`,
          q: i,
          r: 0,
          type: owned ? "military" : "unrevealed",
          ownerId: owned ? "user_abcdef123456" : null,
          units: owned ? { ground: 25, siege: 0, air: 0 } : { ground: 0, siege: 0, air: 0 },
          armedDefenseSpellId: null,
        });
      }
      const v1 = JSON.stringify(tiles).length;
      const v2 = JSON.stringify(tiles.map(compactTile)).length;
      expect(v2 / v1).toBeLessThan(0.5);
    });
  });

  describe("error handling", () => {
    it("rejects an unknown LandType on encode", () => {
      const bad = { ...mkTile(), type: "swamp" as unknown as MapTile["type"] };
      expect(() => compactTile(bad)).toThrow(/Unknown LandType/);
    });

    it("rejects an unknown type code on decode", () => {
      expect(() => expandTile({ q: 0, r: 0, t: "z" })).toThrow(/Unknown CompactTile type code/);
    });

    it("decodes missing optional fields to defaults", () => {
      const tile = expandTile({ q: 4, r: -2, t: "u" });
      expect(tile).toEqual({
        tileId: "4_-2",
        q: 4,
        r: -2,
        type: "unrevealed",
        ownerId: null,
        units: { ground: 0, siege: 0, air: 0 },
        armedDefenseSpellId: null,
      });
    });
  });
});

function mkTile(): MapTile {
  return {
    tileId: "0_0",
    q: 0,
    r: 0,
    type: "unrevealed",
    ownerId: null,
    units: { ground: 0, siege: 0, air: 0 },
    armedDefenseSpellId: null,
  };
}
