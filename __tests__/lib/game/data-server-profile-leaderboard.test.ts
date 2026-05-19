/**
 * @jest-environment node
 *
 * OpenSSF Silver coverage push #74 — profile, name, inscription, leaderboard
 * helpers in lib/game/data-server.ts.
 */
const mockGetAdminDb = jest.fn();
jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: () => mockGetAdminDb(),
}));

jest.mock("@/lib/game/turn-report", () => ({
  buildArmDefenseReport: jest.fn(),
  buildAttackReport: jest.fn(),
  buildBuildReport: jest.fn(),
  buildCastSpellReport: jest.fn(),
  buildDistributeReport: jest.fn(),
  buildExploreReport: jest.fn(),
  buildFlyoverReport: jest.fn(),
  buildProduceReport: jest.fn(),
  buildSiegeReport: jest.fn(),
}));
jest.mock("@/lib/game/artifacts", () => ({ rollArtifact: jest.fn(() => null) }));
jest.mock("@/lib/game/community", () => ({ logCommunityEventInTx: jest.fn() }));
jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), logError: jest.fn() },
}));

import {
  GameInscriptionTooLongError,
  GameInvalidNameError,
  GameNameTakenError,
  GamePlayerBioTooLongError,
  GamePlayerNotFoundError,
  GameTileNotFoundError,
  GameTileNotOwnedError,
  getLeaderboardServer,
  getPublicPlayerProfileServer,
  isGeneralNameTakenServer,
  setGeneralNameServer,
  setPlayerBioServer,
  setTileInscriptionServer,
} from "@/lib/game/data-server";
import {
  makeChain,
  makeDoc,
  makeDocRef,
  makeFakeDb,
  makeQuerySnap,
} from "@/__tests__/_helpers/firebase-admin-mock";

beforeEach(() => {
  mockGetAdminDb.mockReset();
});

describe("isGeneralNameTakenServer", () => {
  it("returns false for blank names without querying", async () => {
    const { db } = makeFakeDb({ collections: {} });
    mockGetAdminDb.mockReturnValue(db);
    await expect(isGeneralNameTakenServer("   ")).resolves.toBe(false);
  });

  it("returns false when no player has the name", async () => {
    const playersChain = makeChain({});
    playersChain.get = jest.fn().mockResolvedValue(makeQuerySnap([]));
    const { db } = makeFakeDb({
      collections: { game_players: playersChain },
    });
    mockGetAdminDb.mockReturnValue(db);

    await expect(isGeneralNameTakenServer("Alice")).resolves.toBe(false);
    expect(playersChain.where).toHaveBeenCalledWith(
      "displayNameLower",
      "==",
      "alice",
    );
  });

  it("returns true when another player owns the name", async () => {
    const playersChain = makeChain({});
    playersChain.get = jest
      .fn()
      .mockResolvedValue(makeQuerySnap([makeDoc("u2", { displayName: "Alice" })]));
    mockGetAdminDb.mockReturnValue(
      makeFakeDb({ collections: { game_players: playersChain } }).db,
    );

    await expect(isGeneralNameTakenServer("Alice")).resolves.toBe(true);
  });

  it("returns false when the only match is excludeUserId", async () => {
    const playersChain = makeChain({});
    playersChain.get = jest
      .fn()
      .mockResolvedValue(makeQuerySnap([makeDoc("u1", { displayName: "Alice" })]));
    mockGetAdminDb.mockReturnValue(
      makeFakeDb({ collections: { game_players: playersChain } }).db,
    );

    await expect(isGeneralNameTakenServer("Alice", "u1")).resolves.toBe(false);
  });
});

describe("setGeneralNameServer", () => {
  it("throws GameInvalidNameError for invalid names", async () => {
    const { db } = makeFakeDb({ collections: {} });
    mockGetAdminDb.mockReturnValue(db);
    await expect(setGeneralNameServer("u1", "")).rejects.toBeInstanceOf(
      GameInvalidNameError,
    );
  });

  it("throws GameNameTakenError when the name is taken", async () => {
    const playersChain = makeChain({});
    playersChain.get = jest
      .fn()
      .mockResolvedValue(makeQuerySnap([makeDoc("u2", {})]));
    mockGetAdminDb.mockReturnValue(
      makeFakeDb({ collections: { game_players: playersChain } }).db,
    );

    await expect(setGeneralNameServer("u1", "TakenName")).rejects.toBeInstanceOf(
      GameNameTakenError,
    );
  });
});

describe("setTileInscriptionServer", () => {
  it("throws GameInscriptionTooLongError when inscription exceeds limit", async () => {
    const { db } = makeFakeDb({ collections: {} });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      setTileInscriptionServer("u1", "t1", "x".repeat(200)),
    ).rejects.toBeInstanceOf(GameInscriptionTooLongError);
  });

  it("throws GameTileNotFoundError when tile is missing", async () => {
    const tileRef = makeDocRef("t1", { snap: makeDoc("t1", undefined) });
    const tilesChain = makeChain({});
    (tilesChain as { doc: jest.Mock }).doc = jest.fn(() => tileRef);
    const db = {
      collection: jest.fn((name: string) =>
        name === "game_tiles" ? tilesChain : makeChain({}),
      ),
      runTransaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          get: jest.fn().mockResolvedValue(makeDoc("t1", undefined)),
          update: jest.fn(),
        };
        return cb(tx);
      }),
    };
    mockGetAdminDb.mockReturnValue(db);

    await expect(
      setTileInscriptionServer("u1", "t1", "hello"),
    ).rejects.toBeInstanceOf(GameTileNotFoundError);
  });

  it("throws GameTileNotOwnedError when tile belongs to another player", async () => {
    const tileData = {
      tileId: "t1",
      ownerId: "u2",
      type: "military",
      q: 0,
      r: 0,
      units: 0,
    };
    mockGetAdminDb.mockReturnValue({
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({})),
      })),
      runTransaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => tileData,
          }),
          update: jest.fn(),
        };
        return cb(tx);
      }),
    });

    await expect(
      setTileInscriptionServer("u1", "t1", "hello"),
    ).rejects.toBeInstanceOf(GameTileNotOwnedError);
  });
});

describe("getPublicPlayerProfileServer", () => {
  it("returns null when the player doc does not exist", async () => {
    const playerRef = makeDocRef("u1", { snap: makeDoc("u1", undefined) });
    const playersChain = makeChain({});
    (playersChain as { doc: jest.Mock }).doc = jest.fn(() => playerRef);
    mockGetAdminDb.mockReturnValue(
      makeFakeDb({ collections: { game_players: playersChain } }).db,
    );

    await expect(getPublicPlayerProfileServer("u1")).resolves.toBeNull();
  });

  it("returns player data when the doc exists", async () => {
    const player = { userId: "u1", displayName: "Gen" };
    const playerRef = makeDocRef("u1", { snap: makeDoc("u1", player) });
    const playersChain = makeChain({});
    (playersChain as { doc: jest.Mock }).doc = jest.fn(() => playerRef);
    mockGetAdminDb.mockReturnValue(
      makeFakeDb({ collections: { game_players: playersChain } }).db,
    );

    await expect(getPublicPlayerProfileServer("u1")).resolves.toEqual(player);
  });
});

describe("setPlayerBioServer", () => {
  it("throws GamePlayerBioTooLongError when bio exceeds limit", async () => {
    const { db } = makeFakeDb({ collections: {} });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      setPlayerBioServer("u1", "x".repeat(600)),
    ).rejects.toBeInstanceOf(GamePlayerBioTooLongError);
  });

  it("updates bio on success", async () => {
    const player = { userId: "u1", displayName: "Gen" };
    mockGetAdminDb.mockReturnValue({
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({})),
      })),
      runTransaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          get: jest.fn().mockResolvedValue({ exists: true, data: () => player }),
          update: jest.fn(),
        };
        return cb(tx);
      }),
    });

    const out = await setPlayerBioServer("u1", "  hello world  ");
    expect(out.bio).toBe("hello world");
  });
});

describe("setTileInscriptionServer success", () => {
  it("writes inscription when owner matches", async () => {
    const tileData = {
      tileId: "t1",
      ownerId: "u1",
      type: "military",
      q: 0,
      r: 0,
      units: { ground: 0, air: 0, siege: 0 },
    };
    mockGetAdminDb.mockReturnValue({
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({})),
      })),
      runTransaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => tileData,
          }),
          update: jest.fn(),
        };
        return cb(tx);
      }),
    });

    const out = await setTileInscriptionServer("u1", "t1", "hold the line");
    expect(out.inscription).toBe("hold the line");
  });
});

describe("getLeaderboardServer", () => {
  it("filters to real players when audience is real", async () => {
    const docs = [
      makeDoc("npc-1", { isNpc: true, stats: { tilesHeld: 10 } }),
      makeDoc("u1", { userId: "u1", stats: { tilesHeld: 5 } }),
    ];
    const playersChain = makeChain({});
    playersChain.orderBy = jest.fn().mockReturnValue(playersChain);
    playersChain.limit = jest.fn().mockReturnValue(playersChain);
    playersChain.get = jest.fn().mockResolvedValue(makeQuerySnap(docs));
    mockGetAdminDb.mockReturnValue(
      makeFakeDb({ collections: { game_players: playersChain } }).db,
    );

    const result = await getLeaderboardServer({
      limit: 10,
      cursor: null,
      audience: "real",
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].userId).toBe("u1");
  });
});
