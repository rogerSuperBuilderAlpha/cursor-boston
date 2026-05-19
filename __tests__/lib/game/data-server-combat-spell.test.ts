/**
 * @jest-environment node
 *
 * OpenSSF Silver coverage push #76 — attack, cast spell, redistribute guards.
 */
jest.mock("@/lib/firebase-admin", () => ({ getAdminDb: jest.fn() }));

jest.mock("@/lib/game/turn-report", () => ({
  buildAttackReport: jest.fn(() => ({ kind: "attack" })),
  buildCastSpellReport: jest.fn(() => ({ kind: "cast" })),
}));
jest.mock("@/lib/game/artifacts", () => ({ rollArtifact: jest.fn(() => null) }));
jest.mock("@/lib/game/community", () => ({ logCommunityEventInTx: jest.fn() }));
jest.mock("@/lib/game/intel-effects", () => ({
  readAttackContextEffects: jest.fn().mockResolvedValue({}),
  deleteIntelEffectsInTx: jest.fn(),
  recordDefenseDisarmInTx: jest.fn(),
  recordIntelEffectInTx: jest.fn(),
  recordSiegeDebuffInTx: jest.fn(),
}));
jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), logError: jest.fn() },
}));

import { getAdminDb } from "@/lib/firebase-admin";
import {
  attackTileServer,
  castSpellServer,
  GameInvalidSpellError,
  GameNotAdjacentError,
  GamePlayerNotFoundError,
  GameSelfAttackError,
  GameTileNotFoundError,
  GameTileNotOwnedError,
  redistributeUnitsServer,
} from "@/lib/game/data-server";
import { BASE_PLAYER, BASE_TILE } from "@/__tests__/_helpers/game-mutation-db";

const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;

function tileDocDb(targetData: Record<string, unknown> | null) {
  return {
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn().mockResolvedValue(
          targetData
            ? { exists: true, data: () => targetData }
            : { exists: false, data: () => undefined },
        ),
      })),
    })),
  };
}

const units = { ground: 5, air: 0, siege: 0 };

describe("attackTileServer guards", () => {
  it("rejects an empty unit stack", async () => {
    await expect(
      attackTileServer({
        attackerId: "u1",
        sourceTileId: "s",
        targetTileId: "t",
        units: { ground: 0, air: 0, siege: 0 },
        offenseSpellId: null,
      }),
    ).rejects.toThrow("Must send at least 1 unit");
  });

  it("rejects an invalid offense spell id", async () => {
    mockGetAdminDb.mockReturnValue(tileDocDb({ ...BASE_TILE, ownerId: "u2" }));
    await expect(
      attackTileServer({
        attackerId: "u1",
        sourceTileId: "s",
        targetTileId: "t",
        units,
        offenseSpellId: "not-a-real-spell",
      }),
    ).rejects.toBeInstanceOf(GameInvalidSpellError);
  });

  it("throws GameTileNotFoundError when target is missing", async () => {
    mockGetAdminDb.mockReturnValue(tileDocDb(null));
    await expect(
      attackTileServer({
        attackerId: "u1",
        sourceTileId: "s",
        targetTileId: "t",
        units,
        offenseSpellId: null,
      }),
    ).rejects.toBeInstanceOf(GameTileNotFoundError);
  });

  it("throws GameSelfAttackError when attacking own tile", async () => {
    mockGetAdminDb.mockReturnValue(tileDocDb({ ...BASE_TILE, ownerId: "u1" }));
    await expect(
      attackTileServer({
        attackerId: "u1",
        sourceTileId: "s",
        targetTileId: "t",
        units,
        offenseSpellId: null,
      }),
    ).rejects.toBeInstanceOf(GameSelfAttackError);
  });

  it("throws GamePlayerNotFoundError when attacker doc is missing", async () => {
    const target = { ...BASE_TILE, ownerId: "u2" };
    mockGetAdminDb.mockReturnValue({
      collection: jest.fn(() => ({
        doc: jest.fn((id: string) => ({
          get: jest.fn().mockImplementation(() => {
            if (id === "t") return Promise.resolve({ exists: true, data: () => target });
            return Promise.resolve({ exists: false, data: () => undefined });
          }),
        })),
      })),
    });
    await expect(
      attackTileServer({
        attackerId: "u1",
        sourceTileId: "s",
        targetTileId: "t",
        units,
        offenseSpellId: null,
      }),
    ).rejects.toBeInstanceOf(GamePlayerNotFoundError);
  });
});

describe("castSpellServer guards", () => {
  it("throws on unknown spellId", async () => {
    mockGetAdminDb.mockReturnValue(tileDocDb({ ...BASE_TILE, ownerId: "u2" }));
    await expect(
      castSpellServer({
        attackerId: "u1",
        spellId: "bogus",
        sourceTileId: "s",
        targetTileId: "t",
      }),
    ).rejects.toBeInstanceOf(GameInvalidSpellError);
  });

  it("rejects production spells", async () => {
    mockGetAdminDb.mockReturnValue(tileDocDb({ ...BASE_TILE, ownerId: "u2" }));
    await expect(
      castSpellServer({
        attackerId: "u1",
        spellId: "red-production-1",
        sourceTileId: "s",
        targetTileId: "t",
      }),
    ).rejects.toBeInstanceOf(GameInvalidSpellError);
  });
});

describe("redistributeUnitsServer", () => {
  it("throws GameNotAdjacentError for non-neighbors", async () => {
    const sourceRef = { __kind: "source" as const };
    const destRef = { __kind: "dest" as const };
    const playerRef = { __kind: "player" as const };
    const sourceTile = {
      ...BASE_TILE,
      tileId: "s",
      neighborTileIds: [] as string[],
      units: { ground: 10, air: 0, siege: 0 },
    };
    const destTile = { ...BASE_TILE, tileId: "d", ownerId: "u1" };

    const db = {
      collection: jest.fn((name: string) => {
        if (name === "game_players") return { doc: jest.fn(() => playerRef) };
        if (name === "game_tiles") {
          return {
            doc: jest.fn((id: string) =>
              id === "s" ? sourceRef : id === "d" ? destRef : {},
            ),
          };
        }
        return { doc: jest.fn() };
      }),
      runTransaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          get: jest.fn((ref: { __kind?: string }) => {
            if (ref === playerRef) {
              return Promise.resolve({ exists: true, data: () => BASE_PLAYER });
            }
            if (ref === sourceRef) {
              return Promise.resolve({ exists: true, data: () => sourceTile });
            }
            if (ref === destRef) {
              return Promise.resolve({ exists: true, data: () => destTile });
            }
            return Promise.resolve({ exists: false });
          }),
          update: jest.fn(),
        };
        return cb(tx);
      }),
    };
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      redistributeUnitsServer({
        callerUserId: "u1",
        sourceTileId: "s",
        destTileId: "d",
        units: { ground: 1, air: 0, siege: 0 },
      }),
    ).rejects.toBeInstanceOf(GameNotAdjacentError);
  });

});
