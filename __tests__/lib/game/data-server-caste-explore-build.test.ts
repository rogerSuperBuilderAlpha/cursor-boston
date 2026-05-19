/**
 * @jest-environment node
 *
 * OpenSSF Silver coverage push #75 — caste, explore, and build mutations.
 */
jest.mock("@/lib/firebase-admin", () => ({ getAdminDb: jest.fn() }));

jest.mock("@/lib/game/turn-report", () => ({
  buildArmDefenseReport: jest.fn(),
  buildAttackReport: jest.fn(),
  buildBuildReport: jest.fn(() => ({ kind: "build" })),
  buildCastSpellReport: jest.fn(),
  buildDistributeReport: jest.fn(),
  buildExploreReport: jest.fn(() => ({ kind: "explore" })),
  buildFlyoverReport: jest.fn(),
  buildProduceReport: jest.fn(),
  buildSiegeReport: jest.fn(),
}));
jest.mock("@/lib/game/artifacts", () => ({ rollArtifact: jest.fn(() => null) }));
jest.mock("@/lib/game/community", () => ({ logCommunityEventInTx: jest.fn() }));
jest.mock("@/lib/game/intel", () => ({ buildIntelReportServer: jest.fn() }));
jest.mock("@/lib/game/discord-game", () => ({ notifyConquest: jest.fn() }));
jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), logError: jest.fn() },
}));

import { getAdminDb } from "@/lib/firebase-admin";
import {
  buildUnitsServer,
  changeCasteServer,
  chooseCasteServer,
  exploreNextTileServer,
  GameCasteAlreadySetError,
  GameCasteChangeUnavailableError,
  GameInsufficientTurnsError,
  GameInvalidCasteError,
  GameInvalidPhaseError,
  GameNoUnrevealedTilesError,
  GamePlayerNotFoundError,
  GameTileNotFoundError,
  GameTileNotOwnedError,
  GameTileTypeError,
} from "@/lib/game/data-server";
import { BASE_PLAYER, BASE_TILE, buildGameMutationDb } from "@/__tests__/_helpers/game-mutation-db";

const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("changeCasteServer", () => {
  it("throws GameInvalidCasteError for unknown castes", async () => {
    mockGetAdminDb.mockReturnValue(buildGameMutationDb({}).db);
    await expect(changeCasteServer("u1", "invalid" as never)).rejects.toBeInstanceOf(
      GameInvalidCasteError,
    );
  });

  it("throws GamePlayerNotFoundError when player is missing", async () => {
    const { db } = buildGameMutationDb({ player: { exists: false } });
    mockGetAdminDb.mockReturnValue(db);
    await expect(changeCasteServer("u1", "blue")).rejects.toBeInstanceOf(
      GamePlayerNotFoundError,
    );
  });

  it("throws GameCasteChangeUnavailableError when tilesHeld is below threshold", async () => {
    const { db } = buildGameMutationDb({
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          caste: "red",
          stats: { ...BASE_PLAYER.stats, tilesHeld: 10 },
        },
      },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(changeCasteServer("u1", "blue")).rejects.toBeInstanceOf(
      GameCasteChangeUnavailableError,
    );
  });
});

describe("chooseCasteServer", () => {
  it("throws GameCasteAlreadySetError when caste is already chosen", async () => {
    const { db } = buildGameMutationDb({
      player: {
        exists: true,
        data: { ...BASE_PLAYER, caste: "red", phase: "distribute" },
      },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(chooseCasteServer("u1", "blue")).rejects.toBeInstanceOf(
      GameCasteAlreadySetError,
    );
  });

  it("throws GameInvalidPhaseError outside distribute/caste phases", async () => {
    const { db } = buildGameMutationDb({
      player: {
        exists: true,
        data: { ...BASE_PLAYER, caste: null, phase: "explore" },
      },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(chooseCasteServer("u1", "blue")).rejects.toBeInstanceOf(
      GameInvalidPhaseError,
    );
  });
});

describe("exploreNextTileServer", () => {
  it("throws GameNoUnrevealedTilesError when the player has none left", async () => {
    const { db } = buildGameMutationDb({ unrevealedDocs: [] });
    mockGetAdminDb.mockReturnValue(db);
    await expect(exploreNextTileServer("u1")).rejects.toBeInstanceOf(
      GameNoUnrevealedTilesError,
    );
  });

  it("throws GameInvalidPhaseError when not in explore phase", async () => {
    const { db } = buildGameMutationDb({
      unrevealedDocs: [{ id: "t1", data: { ...BASE_TILE, type: "unrevealed" } }],
      player: { exists: true, data: { ...BASE_PLAYER, phase: "play" } },
      tile: { exists: true, data: { ...BASE_TILE, type: "unrevealed" } },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(exploreNextTileServer("u1")).rejects.toBeInstanceOf(
      GameInvalidPhaseError,
    );
  });

  it("reveals a tile and decrements turns in explore phase", async () => {
    const { db, tx } = buildGameMutationDb({
      unrevealedDocs: [{ id: "t1", data: { ...BASE_TILE, type: "unrevealed" } }],
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          phase: "explore",
          turnsRemaining: 3,
          tilesExplored: 10,
          caste: "red",
        },
      },
      tile: { exists: true, data: { ...BASE_TILE, type: "unrevealed" } },
    });
    mockGetAdminDb.mockReturnValue(db);

    const result = await exploreNextTileServer("u1");
    expect(result.player.turnsRemaining).toBe(2);
    expect(result.player.tilesExplored).toBe(11);
    expect(result.report).toEqual({ kind: "explore" });
    expect(tx.update).toHaveBeenCalled();
  });
});

describe("buildUnitsServer", () => {
  it("throws GamePlayerNotFoundError when player is missing", async () => {
    const { db } = buildGameMutationDb({
      ownedTileDocs: [],
      player: { exists: false },
      tile: { exists: true, data: BASE_TILE },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(buildUnitsServer("u1", "t1", "ground")).rejects.toBeInstanceOf(
      GamePlayerNotFoundError,
    );
  });

  it("throws GameTileNotFoundError when tile is missing", async () => {
    const { db } = buildGameMutationDb({
      player: { exists: true, data: BASE_PLAYER },
      tile: { exists: false },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(buildUnitsServer("u1", "t1", "ground")).rejects.toBeInstanceOf(
      GameTileNotFoundError,
    );
  });

  it("throws GameTileNotOwnedError for another owner's tile", async () => {
    const { db } = buildGameMutationDb({
      player: { exists: true, data: BASE_PLAYER },
      tile: { exists: true, data: { ...BASE_TILE, ownerId: "u2" } },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(buildUnitsServer("u1", "t1", "ground")).rejects.toBeInstanceOf(
      GameTileNotOwnedError,
    );
  });

  it("throws GameTileTypeError on non-recruitable land", async () => {
    const { db } = buildGameMutationDb({
      player: { exists: true, data: BASE_PLAYER },
      tile: { exists: true, data: { ...BASE_TILE, type: "unassigned" } },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(buildUnitsServer("u1", "t1", "ground")).rejects.toBeInstanceOf(
      GameTileTypeError,
    );
  });

  it("throws GameInvalidPhaseError when not in play phase", async () => {
    const { db } = buildGameMutationDb({
      ownedTileDocs: [{ id: "t1", data: BASE_TILE }],
      player: {
        exists: true,
        data: { ...BASE_PLAYER, phase: "explore" },
      },
      tile: { exists: true, data: BASE_TILE },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(buildUnitsServer("u1", "t1", "ground")).rejects.toBeInstanceOf(
      GameInvalidPhaseError,
    );
  });

  it("throws GameInsufficientTurnsError when out of turns", async () => {
    const { db } = buildGameMutationDb({
      ownedTileDocs: [{ id: "t1", data: BASE_TILE }],
      player: {
        exists: true,
        data: { ...BASE_PLAYER, turnsRemaining: 0 },
      },
      tile: { exists: true, data: BASE_TILE },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(buildUnitsServer("u1", "t1", "ground")).rejects.toBeInstanceOf(
      GameInsufficientTurnsError,
    );
  });

  it("throws GameUnitCapExceededError when at cap", async () => {
    const { db } = buildGameMutationDb({
      ownedTileDocs: [{ id: "t1", data: { ...BASE_TILE, type: "food" as const } }],
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          stats: { ...BASE_PLAYER.stats, unitsAlive: 999_999 },
        },
      },
      tile: { exists: true, data: BASE_TILE },
    });
    mockGetAdminDb.mockReturnValue(db);
    const { GameUnitCapExceededError } = await import("@/lib/game/data-server");
    await expect(buildUnitsServer("u1", "t1", "ground")).rejects.toBeInstanceOf(
      GameUnitCapExceededError,
    );
  });
});
