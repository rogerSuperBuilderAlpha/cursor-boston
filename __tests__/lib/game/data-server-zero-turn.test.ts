/**
 * @jest-environment node
 *
 * OpenSSF Silver coverage push #76 — zero-turn + misc data-server paths.
 */
jest.mock("@/lib/firebase-admin", () => ({ getAdminDb: jest.fn() }));

jest.mock("@/lib/game/community", () => ({ logCommunityEventInTx: jest.fn() }));
jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), logError: jest.fn() },
}));

import { getAdminDb } from "@/lib/firebase-admin";
import {
  changeCasteServer,
  GameCasteChangeUnavailableError,
  GameHeroNotFoundError,
  GameMeditationSlotFullError,
  GamePepTalkRequiresZeroTurnsError,
  GamePlayerNotFoundError,
  listArmageddonHistoryServer,
  meditateHeroServer,
  pepTalkHeroServer,
} from "@/lib/game/data-server";
import { makeChain, makeDoc, makeQuerySnap } from "@/__tests__/_helpers/firebase-admin-mock";
import { BASE_PLAYER, BASE_TILE, buildGameMutationDb } from "@/__tests__/_helpers/game-mutation-db";

const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;

const heroOnTile = {
  ...BASE_TILE,
  hero: {
    id: "hero-1",
    ownerId: "u1",
    class: "farm" as const,
    stamina: 10,
    staminaMax: 20,
    ownerCaste: "red" as const,
    tileId: "t1",
    lastEngagedAtTurn: 0,
  },
};

describe("pepTalkHeroServer", () => {
  it("throws when player still has turns", async () => {
    const { db } = buildGameMutationDb({
      player: { exists: true, data: { ...BASE_PLAYER, turnsRemaining: 5 } },
      tile: { exists: true, data: heroOnTile },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      pepTalkHeroServer({ callerUserId: "u1", tileId: "t1" }),
    ).rejects.toBeInstanceOf(GamePepTalkRequiresZeroTurnsError);
  });

  it("throws GameHeroNotFoundError when tile has no hero", async () => {
    const { db } = buildGameMutationDb({
      player: { exists: true, data: { ...BASE_PLAYER, turnsRemaining: 0 } },
      tile: { exists: true, data: BASE_TILE },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      pepTalkHeroServer({ callerUserId: "u1", tileId: "t1" }),
    ).rejects.toBeInstanceOf(GameHeroNotFoundError);
  });

  it("boosts hero stamina at zero turns", async () => {
    const db = {
      collection: jest.fn((name: string) => {
        if (name === "game_players") {
          return { doc: jest.fn(() => ({ __kind: "player" })) };
        }
        if (name === "game_tiles") {
          return { doc: jest.fn(() => ({ __kind: "tile" })) };
        }
        if (name === "game_heroes") {
          return { doc: jest.fn(() => ({})) };
        }
        return { doc: jest.fn() };
      }),
      runTransaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          get: jest.fn((ref: { __kind?: string }) => {
            if (ref.__kind === "player") {
              return Promise.resolve({
                exists: true,
                data: () => ({ ...BASE_PLAYER, turnsRemaining: 0 }),
              });
            }
            return Promise.resolve({ exists: true, data: () => heroOnTile });
          }),
          update: jest.fn(),
        };
        return cb(tx);
      }),
    };
    mockGetAdminDb.mockReturnValue(db);
    const out = await pepTalkHeroServer({ callerUserId: "u1", tileId: "t1" });
    expect(out.hero?.stamina).toBeGreaterThan(heroOnTile.hero!.stamina);
  });
});

describe("meditateHeroServer", () => {
  it("throws GameMeditationSlotFullError when cap reached", async () => {
    const meditatingTile = {
      ...heroOnTile,
      hero: {
        ...heroOnTile.hero!,
        meditatingUntil: new Date(Date.now() + 60_000),
      },
    };
    mockGetAdminDb.mockReturnValue({
      collection: jest.fn((name: string) => {
        if (name === "game_tiles") {
          return {
            doc: jest.fn(() => ({ __kind: "tile" })),
            where: jest.fn(() => ({
              get: jest.fn().mockResolvedValue(
                makeQuerySnap([makeDoc("t1", meditatingTile)]),
              ),
            })),
          };
        }
        if (name === "game_players") {
          return { doc: jest.fn(() => ({ __kind: "player" })) };
        }
        return { doc: jest.fn() };
      }),
      runTransaction: jest.fn(),
    });
    await expect(meditateHeroServer({ callerUserId: "u1", tileId: "t1" })).rejects.toMatchObject({
      name: "GameMeditationSlotFullError",
    });
  });
});

describe("changeCasteServer success", () => {
  it("updates caste when eligible", async () => {
    const { db, tx } = buildGameMutationDb({
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          caste: "red",
          phase: "play",
          casteChangesUsed: 0,
          stats: { ...BASE_PLAYER.stats, tilesHeld: 1000 },
        },
      },
    });
    mockGetAdminDb.mockReturnValue(db);
    const out = await changeCasteServer("u1", "blue");
    expect(out.caste).toBe("blue");
    expect(tx.update).toHaveBeenCalled();
  });

  it("throws when caste change already used", async () => {
    const { db } = buildGameMutationDb({
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          caste: "red",
          casteChangesUsed: 1,
          stats: { ...BASE_PLAYER.stats, tilesHeld: 1000 },
        },
      },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(changeCasteServer("u1", "blue")).rejects.toBeInstanceOf(
      GameCasteChangeUnavailableError,
    );
  });
});

describe("listArmageddonHistoryServer", () => {
  it("returns mapped docs", async () => {
    const chain = makeChain({});
    chain.orderBy = jest.fn().mockReturnValue({
      limit: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue(
          makeQuerySnap([makeDoc("1", { seasonNumber: 1 })]),
        ),
      }),
    });
    mockGetAdminDb.mockReturnValue({
      collection: jest.fn(() => chain),
    });
    const rows = await listArmageddonHistoryServer(10);
    expect(rows).toHaveLength(1);
    expect(rows[0].seasonNumber).toBe(1);
  });
});

describe("admin paths", () => {
  it("pepTalk throws GamePlayerNotFoundError", async () => {
    const { db } = buildGameMutationDb({
      player: { exists: false },
      tile: { exists: true, data: heroOnTile },
    });
    mockGetAdminDb.mockReturnValue(db);
    await expect(
      pepTalkHeroServer({ callerUserId: "u1", tileId: "t1" }),
    ).rejects.toBeInstanceOf(GamePlayerNotFoundError);
  });
});
