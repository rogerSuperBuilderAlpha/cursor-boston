/**
 * @jest-environment node
 *
 * OpenSSF sprint — additional data-server exports (distribute, leaderboard, bio, etc.).
 */
jest.mock("@/lib/firebase-admin", () => ({ getAdminDb: jest.fn() }));

jest.mock("@/lib/game/turn-report", () => ({
  buildDistributeReport: jest.fn(() => ({ kind: "distribute" })),
  buildArmDefenseReport: jest.fn(() => ({ kind: "arm" })),
  buildProduceReport: jest.fn(() => ({ kind: "intel" })),
}));
jest.mock("@/lib/game/artifacts", () => ({ rollArtifact: jest.fn(() => null) }));
jest.mock("@/lib/game/community", () => ({ logCommunityEventInTx: jest.fn() }));
jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), logError: jest.fn() },
}));
jest.mock("@/lib/firestore-pagination", () => ({
  paginateFirestoreQuery: jest.fn(async ({ mapDoc }: { mapDoc: (d: { data: () => unknown }) => unknown }) => ({
    items: [
      mapDoc({
        data: () => ({
          userId: "u1",
          displayName: "A",
          stats: { tilesHeld: 10 },
        }),
      }),
    ],
    nextCursor: null,
    hasMore: false,
  })),
}));

import { getAdminDb } from "@/lib/firebase-admin";
import {
  distributeTileServer,
  getLeaderboardServer,
  getPublicPlayerProfileServer,
  setPlayerBioServer,
} from "@/lib/game/data-server";
import { makeChain, makeDoc, makeQuerySnap } from "@/__tests__/_helpers/firebase-admin-mock";
import { BASE_PLAYER, BASE_TILE, buildGameMutationDb } from "@/__tests__/_helpers/game-mutation-db";

const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;

describe("distributeTileServer", () => {
  it("assigns food type on owned tile in distribute phase", async () => {
    const { db, tx } = buildGameMutationDb({
      player: {
        exists: true,
        data: { ...BASE_PLAYER, phase: "distribute", turnsRemaining: 5 },
      },
      tile: {
        exists: true,
        data: { ...BASE_TILE, type: "military" },
      },
    });
    mockGetAdminDb.mockReturnValue(db);
    const result = await distributeTileServer("u1", "t1", "food");
    expect(result.tile.type).toBe("food");
    expect(result.player.turnsRemaining).toBe(4);
    expect(result.report).toEqual({ kind: "distribute" });
    expect(tx.update).toHaveBeenCalled();
  });
});

describe("getLeaderboardServer", () => {
  it("returns sorted player rows", async () => {
    const chain = makeChain({
      docs: [
        makeDoc("u1", {
          userId: "u1",
          displayName: "A",
          stats: { tilesHeld: 10 },
        }),
      ],
    });
    chain.orderBy = jest.fn().mockReturnValue({
      limit: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue(makeQuerySnap(chain.docs ?? [])),
      }),
    });
    mockGetAdminDb.mockReturnValue({ collection: jest.fn(() => chain) });
    const page = await getLeaderboardServer({ limit: 10, cursor: null });
    expect(Array.isArray(page.items)).toBe(true);
  });
});

describe("setPlayerBioServer", () => {
  it("updates bio text", async () => {
    const { db, tx } = buildGameMutationDb({
      player: { exists: true, data: BASE_PLAYER },
    });
    mockGetAdminDb.mockReturnValue(db);
    const out = await setPlayerBioServer("u1", "Hello bio");
    expect(out.bio).toBe("Hello bio");
    expect(tx.update).toHaveBeenCalled();
  });
});

describe("getPublicPlayerProfileServer", () => {
  it("returns profile for player doc", async () => {
    const db = {
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              ...BASE_PLAYER,
              displayName: "Hero",
              bio: "bio",
            }),
          }),
        })),
      })),
    };
    mockGetAdminDb.mockReturnValue(db);
    const profile = await getPublicPlayerProfileServer("u1");
    expect(profile?.displayName).toBe("Hero");
  });
});
