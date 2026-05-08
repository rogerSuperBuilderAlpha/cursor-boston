/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import {
  buildIntelReportServer,
  pickWeakFace,
} from "@/lib/game/intel";
import type {
  GamePlayer,
  GameTile,
  UnitStack,
} from "@/lib/game/types";

function units(g = 0, s = 0, a = 0): UnitStack {
  return { ground: g, siege: s, air: a };
}

describe("pickWeakFace", () => {
  it("returns undefined for an empty stack", () => {
    expect(pickWeakFace(units(0, 0, 0))).toBeUndefined();
  });
  it("counters a ground-heavy defender with air", () => {
    expect(pickWeakFace(units(50, 10, 5))).toBe("air");
  });
  it("counters a siege-heavy defender with ground", () => {
    expect(pickWeakFace(units(10, 50, 5))).toBe("ground");
  });
  it("counters an air-heavy defender with siege", () => {
    expect(pickWeakFace(units(5, 10, 50))).toBe("siege");
  });
  it("respects the first-seen tie-break (UNIT_TYPES ordering: ground/siege/air)", () => {
    // Equal counts in all three slots → "ground" wins by being checked first
    // and the strict > comparison keeps it as the dominant. Counter is "air".
    expect(pickWeakFace(units(10, 10, 10))).toBe("air");
  });
});

describe("buildIntelReportServer", () => {
  function tile(overrides: Partial<GameTile>): GameTile {
    const now = new Date("2026-05-08T00:00:00Z");
    return {
      tileId: "0_0",
      q: 0,
      r: 0,
      ownerId: "defender-1",
      type: "military",
      level: 0,
      units: units(50, 25, 0),
      armedDefenseSpellId: null,
      neighborTileIds: [],
      upgradeIds: [],
      createdAt: now,
      updatedAt: now,
      ...overrides,
    };
  }

  function player(overrides: Partial<GamePlayer>): GamePlayer {
    const now = new Date("2026-05-08T00:00:00Z");
    return {
      userId: "defender-1",
      displayName: "Test",
      caste: "white",
      turnsRemaining: 100,
      turnsSpentTotal: 0,
      phase: "play",
      tilesExplored: 0,
      shieldUntil: now,
      shieldDropAtTurn: 0,
      productionSpellsActive: [],
      stats: { attacksWon: 0, attacksLost: 0, tilesHeld: 10, unitsAlive: 100 },
      createdAt: now,
      updatedAt: now,
      ...overrides,
    };
  }

  /**
   * Minimal Firestore fake: collection(name).doc(id).get() returns the
   * configured data. db.getAll(...refs) batches a list of refs.
   */
  function makeDb(args: {
    tiles?: Record<string, GameTile>;
    players?: Record<string, GamePlayer>;
    artifactsByOwner?: Record<string, number>;
  }): unknown {
    const tiles = args.tiles ?? {};
    const players = args.players ?? {};
    const artifactsByOwner = args.artifactsByOwner ?? {};

    interface DocRef {
      __collection: string;
      __id: string;
      get: () => Promise<{ exists: boolean; data: () => unknown }>;
    }
    function makeDocRef(collection: string, id: string): DocRef {
      return {
        __collection: collection,
        __id: id,
        get: () => {
          if (collection === "game_tiles") {
            const t = tiles[id];
            return Promise.resolve({
              exists: !!t,
              data: () => t,
            });
          }
          if (collection === "game_players") {
            const p = players[id];
            return Promise.resolve({
              exists: !!p,
              data: () => p,
            });
          }
          return Promise.resolve({ exists: false, data: () => undefined });
        },
      };
    }

    function makeArtifactQuery(ownerId: string) {
      const count = artifactsByOwner[ownerId] ?? 0;
      const docs = Array.from({ length: count }, (_, i) => ({
        data: () => ({ id: `art-${i}` }),
      }));
      const q: { where: jest.Mock; get: jest.Mock; size: number } = {
        where: jest.fn(() => q),
        get: jest.fn(() => Promise.resolve({ docs, size: docs.length })),
        size: docs.length,
      };
      return q;
    }

    let lastArtifactOwnerId: string | null = null;
    const collection = jest.fn((name: string) => {
      if (name === "game_artifacts") {
        return {
          where: (field: string, _op: string, value: string) => {
            if (field === "ownerId") lastArtifactOwnerId = value;
            return makeArtifactQuery(lastArtifactOwnerId ?? "");
          },
        };
      }
      return {
        doc: (id: string) => makeDocRef(name, id),
      };
    });

    const getAll = jest.fn((...refs: DocRef[]) => {
      return Promise.all(refs.map((r) => r.get()));
    });

    return { collection, getAll };
  }

  it("scope=tile returns target unit/landType/armed-spell with no neighbors", async () => {
    const db = makeDb({
      tiles: {
        "0_0": tile({
          tileId: "0_0",
          armedDefenseSpellId: "white-defense-sanctuary",
        }),
      },
    });
    const r = await buildIntelReportServer({
      db: db as never,
      targetTileId: "0_0",
      scope: "tile",
      source: "spell",
      sourceId: "white-intel-watchers-vigil-t2",
      capturedAtTurn: 200,
    });
    expect(r.targetTileId).toBe("0_0");
    expect(r.target.armedDefenseSpellId).toBe("white-defense-sanctuary");
    expect(r.target.units.ground).toBe(50);
    expect(r.target.isolatedSpawn).toBe(false);
    expect(r.neighbors).toBeUndefined();
    expect(r.kingdomDefender).toBeUndefined();
    expect(r.weakFace).toBeUndefined();
  });

  it("scope=ring populates neighbors (skipping non-existent ones)", async () => {
    const db = makeDb({
      tiles: {
        "0_0": tile({ tileId: "0_0" }),
        // Only one neighbor exists in the cache; the other 5 are unrevealed.
        "1_0": tile({
          tileId: "1_0",
          q: 1,
          r: 0,
          ownerId: "defender-1",
          type: "food",
          units: units(0, 0, 0),
        }),
      },
    });
    const r = await buildIntelReportServer({
      db: db as never,
      targetTileId: "0_0",
      scope: "ring",
      source: "spell",
      sourceId: "blue-intel-tide-of-whispers-t2",
      capturedAtTurn: 200,
    });
    expect(r.neighbors).toBeDefined();
    expect(r.neighbors).toHaveLength(1);
    expect(r.neighbors?.[0].tileId).toBe("1_0");
    expect(r.neighbors?.[0].landType).toBe("food");
  });

  it("scope=kingdom adds defender stats + artifact count", async () => {
    const db = makeDb({
      tiles: {
        "0_0": tile({ tileId: "0_0", ownerId: "defender-1" }),
      },
      players: {
        "defender-1": player({
          stats: {
            attacksWon: 0,
            attacksLost: 0,
            tilesHeld: 200,
            unitsAlive: 1500,
          },
          productionSpellsActive: [
            { spellId: "blue-prod-1", expiresAtTurn: 999 },
          ],
        }),
      },
      artifactsByOwner: { "defender-1": 3 },
    });
    const r = await buildIntelReportServer({
      db: db as never,
      targetTileId: "0_0",
      scope: "kingdom",
      source: "spell",
      sourceId: "black-intel-vein-of-truth-t2",
      capturedAtTurn: 200,
    });
    expect(r.kingdomDefender).toBeDefined();
    expect(r.kingdomDefender?.tilesHeld).toBe(200);
    expect(r.kingdomDefender?.unitsAlive).toBe(1500);
    expect(r.kingdomDefender?.activeProductionSpellIds).toEqual(["blue-prod-1"]);
    expect(r.kingdomDefender?.artifactCount).toBe(3);
  });

  it("scope=weak-face fills weakFace from defender unit composition", async () => {
    const db = makeDb({
      tiles: {
        // Mostly air → counter is siege.
        "0_0": tile({ tileId: "0_0", units: units(5, 5, 80) }),
      },
    });
    const r = await buildIntelReportServer({
      db: db as never,
      targetTileId: "0_0",
      scope: "weak-face",
      source: "spell",
      sourceId: "red-intel-forge-sight-t2",
      capturedAtTurn: 200,
    });
    expect(r.weakFace).toBe("siege");
  });

  it("scope=kingdom+supply adds the supply graph", async () => {
    const db = makeDb({
      tiles: {
        "0_0": tile({ tileId: "0_0", ownerId: "defender-1", type: "military" }),
        "1_0": tile({
          tileId: "1_0",
          q: 1,
          r: 0,
          ownerId: "defender-1",
          type: "military",
        }),
        "0_1": tile({
          tileId: "0_1",
          q: 0,
          r: 1,
          ownerId: "defender-1",
          type: "food",
        }),
      },
      players: {
        "defender-1": player({ caste: "green" }),
      },
    });
    const r = await buildIntelReportServer({
      db: db as never,
      targetTileId: "0_0",
      scope: "kingdom+supply",
      source: "spell",
      sourceId: "green-intel-root-whisper-t2",
      capturedAtTurn: 200,
    });
    expect(r.supply).toBeDefined();
    expect(r.supply?.friendlyNeighbors).toHaveLength(2);
    // Green: 1.5 caste mult × (1.0 military + 0.3 food) × 5% = +9.75% → 1.0975.
    expect(r.supply?.supplyMultiplier).toBeCloseTo(1.0975, 3);
  });

  it("throws when the target tile does not exist", async () => {
    const db = makeDb({});
    await expect(
      buildIntelReportServer({
        db: db as never,
        targetTileId: "missing",
        scope: "tile",
        source: "artifact",
        sourceId: "x",
        capturedAtTurn: 0,
      })
    ).rejects.toThrow(/Intel target tile not found/);
  });
});
