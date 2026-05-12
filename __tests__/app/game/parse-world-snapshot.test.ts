/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { Timestamp } from "firebase/firestore";
import { parseSnapshotDoc } from "@/app/game/_lib/parse-world-snapshot";
import type { MapTile } from "@/lib/game/types";
import { compactTile } from "@/lib/game/world-snapshot-codec";

describe("parseSnapshotDoc", () => {
  const sampleTile: MapTile = {
    tileId: "3_-2",
    q: 3,
    r: -2,
    type: "military",
    ownerId: "user_alpha",
    units: { ground: 12, siege: 0, air: 0 },
    armedDefenseSpellId: null,
  };

  const sampleOwner = {
    userId: "user_alpha",
    displayName: "Alpha",
    caste: "white" as const,
    shielded: false,
    isNpc: false,
  };

  describe("schemaVersion 2 (compactTiles)", () => {
    it("decodes compactTiles back into MapTile[]", () => {
      const out = parseSnapshotDoc({
        schemaVersion: 2,
        compactTiles: [compactTile(sampleTile)],
        owners: [sampleOwner],
        generatedAt: "2026-05-12T12:00:00.000Z",
        tileCount: 1,
        ownerCount: 1,
      });
      expect(out.tiles).toEqual([sampleTile]);
      expect(out.owners).toEqual([sampleOwner]);
      expect(out.generatedAt).toBe("2026-05-12T12:00:00.000Z");
      expect(out.tileCount).toBe(1);
      expect(out.ownerCount).toBe(1);
    });
  });

  describe("schemaVersion 1 (legacy tiles)", () => {
    it("uses tiles directly when compactTiles is absent", () => {
      const out = parseSnapshotDoc({
        tiles: [sampleTile],
        owners: [sampleOwner],
        generatedAt: "2026-05-08T00:00:00.000Z",
        tileCount: 1,
        ownerCount: 1,
      });
      expect(out.tiles).toEqual([sampleTile]);
    });

    it("prefers v2 compactTiles when both fields are present", () => {
      const v2Tile: MapTile = { ...sampleTile, q: 99, r: 99, tileId: "99_99" };
      const out = parseSnapshotDoc({
        compactTiles: [compactTile(v2Tile)],
        tiles: [sampleTile], // should be ignored
        owners: [sampleOwner],
        generatedAt: "2026-05-12T12:00:00.000Z",
        tileCount: 1,
        ownerCount: 1,
      });
      expect(out.tiles).toEqual([v2Tile]);
    });
  });

  describe("generatedAt coercion", () => {
    it("accepts a Firestore Timestamp", () => {
      const ts = Timestamp.fromDate(new Date("2026-05-10T12:00:00.000Z"));
      const out = parseSnapshotDoc({
        compactTiles: [],
        owners: [],
        generatedAt: ts,
        tileCount: 0,
        ownerCount: 0,
      });
      expect(out.generatedAt).toBe("2026-05-10T12:00:00.000Z");
    });

    it("accepts a plain Date", () => {
      const out = parseSnapshotDoc({
        compactTiles: [],
        owners: [],
        generatedAt: new Date("2026-05-09T12:00:00.000Z"),
        tileCount: 0,
        ownerCount: 0,
      });
      expect(out.generatedAt).toBe("2026-05-09T12:00:00.000Z");
    });

    it("accepts an ISO string", () => {
      const out = parseSnapshotDoc({
        compactTiles: [],
        owners: [],
        generatedAt: "2026-05-08T12:00:00.000Z",
        tileCount: 0,
        ownerCount: 0,
      });
      expect(out.generatedAt).toBe("2026-05-08T12:00:00.000Z");
    });

    it("falls back to now when generatedAt is missing", () => {
      const before = Date.now();
      const out = parseSnapshotDoc({
        compactTiles: [],
        owners: [],
        tileCount: 0,
        ownerCount: 0,
      });
      const parsed = Date.parse(out.generatedAt);
      expect(parsed).toBeGreaterThanOrEqual(before);
      expect(parsed).toBeLessThanOrEqual(Date.now() + 100);
    });
  });

  describe("malformed input", () => {
    it("returns empty arrays when neither tiles nor compactTiles is present", () => {
      const out = parseSnapshotDoc({
        owners: [],
        generatedAt: "2026-05-12T12:00:00.000Z",
      });
      expect(out.tiles).toEqual([]);
      expect(out.tileCount).toBe(0);
    });

    it("treats missing owners as empty", () => {
      const out = parseSnapshotDoc({
        compactTiles: [],
        generatedAt: "2026-05-12T12:00:00.000Z",
      });
      expect(out.owners).toEqual([]);
      expect(out.ownerCount).toBe(0);
    });

    it("derives counts from arrays when count fields are missing", () => {
      const out = parseSnapshotDoc({
        compactTiles: [compactTile(sampleTile), compactTile({ ...sampleTile, q: 4 })],
        owners: [sampleOwner],
        generatedAt: "2026-05-12T12:00:00.000Z",
      });
      expect(out.tileCount).toBe(2);
      expect(out.ownerCount).toBe(1);
    });
  });
});
