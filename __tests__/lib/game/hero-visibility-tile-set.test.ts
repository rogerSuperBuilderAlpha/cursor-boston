/**
 * @jest-environment node
 *
 * Async/Firestore-coupled helpers in lib/game/hero-visibility.ts:
 * computeViewerNeighborTileSet, computeViewerOwnedTileIds.
 * Complements __tests__/lib/game/hero-visibility.test.ts which covers
 * the pure projection helpers.
 */
import type { Firestore } from "firebase-admin/firestore";
import {
  computeViewerNeighborTileSet,
  computeViewerOwnedTileIds,
} from "@/lib/game/hero-visibility";

type TileDoc = { q?: number; r?: number; tileId?: string };

function fakeDb(docs: TileDoc[]): Firestore {
  return {
    collection: (_name: string) => ({
      where: () => ({
        select: () => ({
          get: async () => ({
            docs: docs.map((d) => ({ data: () => d })),
          }),
        }),
      }),
    }),
  } as unknown as Firestore;
}

describe("hero-visibility — async helpers", () => {
  describe("computeViewerNeighborTileSet", () => {
    it("returns an empty set when the viewer owns no tiles", async () => {
      const out = await computeViewerNeighborTileSet(fakeDb([]), "u1");
      expect(out.size).toBe(0);
    });

    it("includes the owned tile itself in the neighbor set", async () => {
      const out = await computeViewerNeighborTileSet(fakeDb([{ q: 0, r: 0 }]), "u1");
      // The viewer's own tile is part of the set so a hero standing there
      // is trivially visible.
      expect(out.has("0_0")).toBe(true);
    });

    it("includes all 6 hex neighbors of an owned tile", async () => {
      const out = await computeViewerNeighborTileSet(fakeDb([{ q: 0, r: 0 }]), "u1");
      // A hex with axial (0,0) has 6 neighbors + itself = 7 entries.
      expect(out.size).toBe(7);
    });

    it("skips docs with non-numeric q or r", async () => {
      const out = await computeViewerNeighborTileSet(
        fakeDb([{ q: "x" as unknown as number, r: 0 }, { q: 0, r: 0 }]),
        "u1"
      );
      // Only the valid (0,0) tile contributes; size = 7.
      expect(out.size).toBe(7);
    });

    it("merges neighbor sets from multiple owned tiles (de-duplicated)", async () => {
      const out = await computeViewerNeighborTileSet(
        fakeDb([{ q: 0, r: 0 }, { q: 0, r: 1 }]),
        "u1"
      );
      // (0,0) and (0,1) are adjacent hexes — the unioned neighbor set is
      // smaller than 14 because of overlap.
      expect(out.size).toBeGreaterThan(7);
      expect(out.size).toBeLessThan(14);
    });
  });

  describe("computeViewerOwnedTileIds", () => {
    it("returns an empty set when the viewer owns no tiles", async () => {
      const out = await computeViewerOwnedTileIds(fakeDb([]), "u1");
      expect(out.size).toBe(0);
    });

    it("collects tileId fields from every owned doc", async () => {
      const out = await computeViewerOwnedTileIds(
        fakeDb([{ tileId: "a" }, { tileId: "b" }, { tileId: "c" }]),
        "u1"
      );
      expect([...out].sort()).toEqual(["a", "b", "c"]);
    });

    it("ignores docs with no tileId", async () => {
      const out = await computeViewerOwnedTileIds(
        fakeDb([{ tileId: "a" }, {}, { tileId: "b" }]),
        "u1"
      );
      expect([...out].sort()).toEqual(["a", "b"]);
    });
  });
});
