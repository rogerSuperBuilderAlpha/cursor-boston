/**
 * @jest-environment node
 *
 * OpenSSF Silver sprint — production spell + bulk build success paths.
 */
jest.mock("@/lib/firebase-admin", () => ({ getAdminDb: jest.fn() }));

jest.mock("@/lib/game/turn-report", () => ({
  buildBuildReport: jest.fn(() => ({ kind: "build" })),
  buildProduceReport: jest.fn(() => ({ kind: "produce" })),
}));
jest.mock("@/lib/game/artifacts", () => ({ rollArtifact: jest.fn(() => null) }));
jest.mock("@/lib/game/community", () => ({ logCommunityEventInTx: jest.fn() }));
jest.mock("@/lib/game/heroes", () => {
  const actual = jest.requireActual<typeof import("@/lib/game/heroes")>("@/lib/game/heroes");
  return { ...actual, maybeEmergeHero: jest.fn(() => null) };
});
jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), logError: jest.fn() },
}));

import { getAdminDb } from "@/lib/firebase-admin";
import {
  bulkBuildUnitsServer,
  buildUnitsServer,
  castProductionSpellServer,
} from "@/lib/game/data-server";
import {
  BASE_PLAYER,
  BASE_TILE,
  buildBulkMutationDb,
  buildGameMutationDb,
} from "@/__tests__/_helpers/game-mutation-db";

const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;

describe("castProductionSpellServer", () => {
  it("casts a red production spell and updates active spells", async () => {
    const { db, tx } = buildGameMutationDb({
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          caste: "red",
          phase: "play",
          turnsRemaining: 20,
          stats: { ...BASE_PLAYER.stats, tilesHeld: 500 },
          productionSpellsActive: [],
        },
      },
    });
    mockGetAdminDb.mockReturnValue(db);

    const result = await castProductionSpellServer("u1", "red-production-forge-boon");
    expect(result.report).toEqual({ kind: "produce" });
    expect(result.player.productionSpellsActive.length).toBeGreaterThan(0);
    expect(tx.update).toHaveBeenCalled();
  });
});

function foodLandDocs(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `f${i}`,
    data: {
      ...BASE_TILE,
      tileId: `f${i}`,
      type: "food" as const,
      units: { ground: 0, air: 0, siege: 0 },
    },
  }));
}

describe("bulkBuildUnitsServer", () => {
  it("builds units across a military tile plan", async () => {
    const mil = {
      ...BASE_TILE,
      tileId: "t1",
      type: "military" as const,
      units: { ground: 0, air: 0, siege: 0 },
    };
    const foodDocs = foodLandDocs(10);
    const { db, tx } = buildBulkMutationDb({
      player: {
        ...BASE_PLAYER,
        phase: "play",
        turnsRemaining: 100,
        stats: { unitsAlive: 0, tilesHeld: 100 },
      },
      tiles: [{ id: "t1", data: mil }],
      ownedTileDocs: [{ id: "t1", data: mil }, ...foodDocs],
    });
    mockGetAdminDb.mockReturnValue(db);

    const result = await bulkBuildUnitsServer("u1", [
      { tileId: "t1", unitType: "ground", cycles: 2 },
    ]);
    expect(result.produced).toBeGreaterThan(0);
    expect(result.tiles).toHaveLength(1);
    expect(tx.update).toHaveBeenCalled();
  });
});

describe("buildUnitsServer success", () => {
  it("recruits ground units when food cap allows", async () => {
    const mil = { ...BASE_TILE, type: "military" as const };
    const { db, tx } = buildGameMutationDb({
      ownedTileDocs: [{ id: "t1", data: mil }, ...foodLandDocs(10)],
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          phase: "play",
          turnsRemaining: 10,
          stats: { unitsAlive: 0, tilesHeld: 100 },
        },
      },
      tile: { exists: true, data: mil },
    });
    mockGetAdminDb.mockReturnValue(db);

    const result = await buildUnitsServer("u1", "t1", "ground");
    expect(result.produced).toBeGreaterThan(0);
    expect(result.report).toEqual({ kind: "build" });
    expect(tx.update).toHaveBeenCalled();
  });
});
