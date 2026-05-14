/**
 * @jest-environment node
 */

/**
 * Tests for the error-path branches of the data-server mutation functions.
 * Each mutation goes through a Firestore transaction with several
 * pre-condition checks (player exists, tile exists, ownership, phase,
 * turns remaining). These tests exercise each guard.
 *
 * The success paths are deferred — they require mocking the per-action
 * report builders (./turn-report), the artifact roller, and the post-tx
 * state plumbing, all of which deserves its own focused PR.
 */

import {
  distributeTileServer,
  GameInvalidLandTypeError,
  GamePlayerNotFoundError,
  GameTileNotFoundError,
  GameTileNotOwnedError,
  GameTileUnrevealedError,
  GameInvalidPhaseError,
  GameInsufficientTurnsError,
} from "@/lib/game/data-server";
import { getAdminDb } from "@/lib/firebase-admin";

jest.mock("@/lib/firebase-admin", () => ({ getAdminDb: jest.fn() }));

// The mutation imports several helper modules; mock them as no-ops so the
// transaction body can run without requiring real implementations.
jest.mock("@/lib/game/turn-report", () => ({
  buildArmDefenseReport: jest.fn(),
  buildAttackReport: jest.fn(),
  buildBuildReport: jest.fn(),
  buildCastSpellReport: jest.fn(),
  buildDistributeReport: jest.fn(() => ({ kind: "distribute" })),
  buildExploreReport: jest.fn(),
  buildFlyoverReport: jest.fn(),
  buildProduceReport: jest.fn(),
  buildSiegeReport: jest.fn(),
}));
jest.mock("@/lib/game/artifacts", () => ({
  rollArtifact: jest.fn(() => null),
}));
jest.mock("@/lib/game/community", () => ({
  logCommunityEventInTx: jest.fn(),
}));
jest.mock("@/lib/game/intel", () => ({
  buildIntelReportServer: jest.fn(),
}));
jest.mock("@/lib/game/discord-game", () => ({
  notifyConquest: jest.fn(),
}));
jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), logError: jest.fn() },
}));

const mockAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;

/**
 * Build a transaction-mock-friendly Firestore stub. `getDocs` maps doc refs
 * (looked up by the route's `tileId` and `userId`) to the snapshots the
 * transaction should see. `runTransaction` invokes the supplied callback
 * synchronously with a `tx` object whose `get/update/set/delete` are mocks.
 */
function buildTxDb(snapshotsByPath: {
  tile?: { exists: boolean; data?: Record<string, unknown> };
  player?: { exists: boolean; data?: Record<string, unknown> };
}) {
  const tileSnap = {
    exists: snapshotsByPath.tile?.exists ?? false,
    data: () => snapshotsByPath.tile?.data,
  };
  const playerSnap = {
    exists: snapshotsByPath.player?.exists ?? false,
    data: () => snapshotsByPath.player?.data,
  };

  // Distinguishable doc refs so the tx.get() mock can branch on which one
  // it's asked for.
  const tileRef = { __kind: "tile" };
  const playerRef = { __kind: "player" };

  const tx = {
    get: jest.fn((ref: any) => {
      if (ref === tileRef) return Promise.resolve(tileSnap);
      if (ref === playerRef) return Promise.resolve(playerSnap);
      return Promise.resolve({ exists: false, data: () => undefined });
    }),
    update: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  };

  const db: any = {
    collection: jest.fn((name: string) => ({
      doc: jest.fn(() => {
        if (name === "game_tiles") return tileRef;
        if (name === "game_players") return playerRef;
        return { __kind: "other" };
      }),
    })),
    runTransaction: jest.fn(async (cb: any) => cb(tx)),
  };

  return { db, tx };
}

const VALID_PLAYER = {
  userId: "u1",
  phase: "play",
  turnsRemaining: 10,
  turnsSpentTotal: 5,
};

const VALID_TILE = {
  tileId: "t1",
  ownerId: "u1",
  type: "military" as const,
  q: 0,
  r: 0,
  units: 0,
};

describe("distributeTileServer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("throws GameInvalidLandTypeError when the type is not a distributable land", async () => {
    await expect(
      distributeTileServer("u1", "t1", "unrevealed" as any)
    ).rejects.toBeInstanceOf(GameInvalidLandTypeError);
  });

  it("throws GamePlayerNotFoundError when the player doc doesn't exist", async () => {
    const { db } = buildTxDb({
      tile: { exists: true, data: VALID_TILE },
      player: { exists: false },
    });
    mockAdminDb.mockReturnValue(db);
    await expect(
      distributeTileServer("u1", "t1", "food")
    ).rejects.toBeInstanceOf(GamePlayerNotFoundError);
  });

  it("throws GameTileNotFoundError when the tile doc doesn't exist", async () => {
    const { db } = buildTxDb({
      tile: { exists: false },
      player: { exists: true, data: VALID_PLAYER },
    });
    mockAdminDb.mockReturnValue(db);
    await expect(
      distributeTileServer("u1", "t1", "food")
    ).rejects.toBeInstanceOf(GameTileNotFoundError);
  });

  it("throws GameTileNotOwnedError when the tile belongs to someone else", async () => {
    const { db } = buildTxDb({
      tile: { exists: true, data: { ...VALID_TILE, ownerId: "u2" } },
      player: { exists: true, data: VALID_PLAYER },
    });
    mockAdminDb.mockReturnValue(db);
    await expect(
      distributeTileServer("u1", "t1", "food")
    ).rejects.toBeInstanceOf(GameTileNotOwnedError);
  });

  it("throws GameTileUnrevealedError when distributing an unrevealed tile", async () => {
    const { db } = buildTxDb({
      tile: { exists: true, data: { ...VALID_TILE, type: "unrevealed" } },
      player: { exists: true, data: VALID_PLAYER },
    });
    mockAdminDb.mockReturnValue(db);
    await expect(
      distributeTileServer("u1", "t1", "food")
    ).rejects.toBeInstanceOf(GameTileUnrevealedError);
  });

  it("throws GameInvalidPhaseError when the player is in 'explore' or 'setup' phase", async () => {
    const { db } = buildTxDb({
      tile: { exists: true, data: VALID_TILE },
      player: { exists: true, data: { ...VALID_PLAYER, phase: "explore" } },
    });
    mockAdminDb.mockReturnValue(db);
    await expect(
      distributeTileServer("u1", "t1", "food")
    ).rejects.toBeInstanceOf(GameInvalidPhaseError);
  });

  it("throws GameInsufficientTurnsError when player has 0 turns remaining", async () => {
    const { db } = buildTxDb({
      tile: { exists: true, data: VALID_TILE },
      player: { exists: true, data: { ...VALID_PLAYER, turnsRemaining: 0 } },
    });
    mockAdminDb.mockReturnValue(db);
    await expect(
      distributeTileServer("u1", "t1", "food")
    ).rejects.toBeInstanceOf(GameInsufficientTurnsError);
  });

  it("on success: updates the tile type, decrements turnsRemaining, and returns the new state", async () => {
    const { db, tx } = buildTxDb({
      tile: { exists: true, data: VALID_TILE },
      player: { exists: true, data: VALID_PLAYER },
    });
    mockAdminDb.mockReturnValue(db);

    const result = await distributeTileServer("u1", "t1", "food");

    expect(result.tile.type).toBe("food");
    expect(result.player.turnsRemaining).toBe(9);
    expect(result.player.turnsSpentTotal).toBe(6);
    expect(result.report).toEqual({ kind: "distribute" });

    // Tile + player both updated within the transaction
    expect(tx.update).toHaveBeenCalledWith(
      expect.objectContaining({ __kind: "tile" }),
      expect.objectContaining({ type: "food" })
    );
    expect(tx.update).toHaveBeenCalledWith(
      expect.objectContaining({ __kind: "player" }),
      expect.objectContaining({
        turnsRemaining: 9,
        turnsSpentTotal: 6,
      })
    );
  });
});
