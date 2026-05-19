/**
 * @jest-environment node
 *
 * OpenSSF Silver coverage push #76 — bulkDistributeTilesServer.
 */
jest.mock("@/lib/firebase-admin", () => ({ getAdminDb: jest.fn() }));

jest.mock("@/lib/game/turn-report", () => ({
  buildDistributeReport: jest.fn(() => ({ kind: "distribute" })),
}));
jest.mock("@/lib/game/artifacts", () => ({ rollArtifact: jest.fn(() => null) }));
jest.mock("@/lib/game/community", () => ({ logCommunityEventInTx: jest.fn() }));
jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), logError: jest.fn() },
}));

import { getAdminDb } from "@/lib/firebase-admin";
import {
  bulkDistributeTilesServer,
  GameInvalidLandTypeError,
  GamePlayerNotFoundError,
  GameTileNotFoundError,
} from "@/lib/game/data-server";
import { BASE_PLAYER, BASE_TILE } from "@/__tests__/_helpers/game-mutation-db";

const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;

function buildBulkDb(opts: {
  player: Record<string, unknown>;
  tiles: Array<Record<string, unknown>>;
}) {
  const playerSnap = { exists: true, data: () => opts.player };
  const tileSnaps = opts.tiles.map((t) => ({
    exists: true,
    data: () => t,
  }));
  const playerRef = { __kind: "player" };
  const tileIds = opts.tiles.map(
    (t, i) => (typeof t.tileId === "string" ? t.tileId : `t${i}`),
  );
  const tileRefs = tileIds.map((id) => ({ __kind: "tile" as const, id }));

  const db = {
    collection: jest.fn((name: string) => {
      if (name === "game_players") {
        return { doc: jest.fn(() => playerRef) };
      }
      if (name === "game_tiles") {
        return {
          doc: jest.fn((id: string) => {
            const ref = tileRefs.find((r) => r.id === id);
            return ref ?? tileRefs[0];
          }),
        };
      }
      return { doc: jest.fn() };
    }),
    runTransaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        getAll: jest.fn().mockResolvedValue([playerSnap, ...tileSnaps]),
        update: jest.fn(),
        set: jest.fn(),
      };
      return cb(tx);
    }),
  };
  return { db };
}

describe("bulkDistributeTilesServer", () => {
  beforeEach(() => jest.clearAllMocks());

  it("throws GameInvalidLandTypeError for bad types", async () => {
    mockGetAdminDb.mockReturnValue(buildBulkDb({ player: BASE_PLAYER, tiles: [] }).db);
    await expect(
      bulkDistributeTilesServer("u1", ["t1"], "unrevealed" as never),
    ).rejects.toBeInstanceOf(GameInvalidLandTypeError);
  });

  it("throws when tileIds is empty", async () => {
    mockGetAdminDb.mockReturnValue(buildBulkDb({ player: BASE_PLAYER, tiles: [] }).db);
    await expect(bulkDistributeTilesServer("u1", [], "food")).rejects.toThrow(
      "must not be empty",
    );
  });

  it("throws GamePlayerNotFoundError when player missing", async () => {
    const db = {
      collection: jest.fn(() => ({ doc: jest.fn(() => ({})) })),
      runTransaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          getAll: jest.fn().mockResolvedValue([
            { exists: false, data: () => undefined },
            { exists: true, data: () => BASE_TILE },
          ]),
          update: jest.fn(),
        };
        return cb(tx);
      }),
    };
    mockGetAdminDb.mockReturnValue(db);
    await expect(bulkDistributeTilesServer("u1", ["t1"], "food")).rejects.toBeInstanceOf(
      GamePlayerNotFoundError,
    );
  });

  it("throws GameTileNotFoundError when first tile missing", async () => {
    const db = {
      collection: jest.fn(() => ({ doc: jest.fn(() => ({})) })),
      runTransaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          getAll: jest.fn().mockResolvedValue([
            { exists: true, data: () => ({ ...BASE_PLAYER, phase: "play" }) },
            { exists: false, data: () => undefined },
          ]),
          update: jest.fn(),
        };
        return cb(tx);
      }),
    };
    mockGetAdminDb.mockReturnValue(db);
    await expect(bulkDistributeTilesServer("u1", ["t1"], "food")).rejects.toBeInstanceOf(
      GameTileNotFoundError,
    );
  });

  it("distributes one tile on success", async () => {
    const tile = { ...BASE_TILE, type: "unassigned" as const };
    const { db } = buildBulkDb({
      player: { ...BASE_PLAYER, phase: "play", turnsRemaining: 5 },
      tiles: [tile],
    });
    mockGetAdminDb.mockReturnValue(db);
    const result = await bulkDistributeTilesServer("u1", ["t1"], "food");
    expect(result.tiles).toHaveLength(1);
    expect(result.tiles[0].type).toBe("food");
    expect(result.player.turnsRemaining).toBe(4);
  });
});
