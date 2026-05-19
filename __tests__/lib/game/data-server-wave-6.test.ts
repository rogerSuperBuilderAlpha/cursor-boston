/**
 * @jest-environment node
 *
 * OpenSSF 80% sprint — far expedition + weekly rollover.
 */
jest.mock("@/lib/firebase-admin", () => ({ getAdminDb: jest.fn() }));

jest.mock("@/lib/game/turn-report", () => ({
  buildExploreReport: jest.fn(() => ({
    action: "explore",
    narrative: ["explored"],
    outcome: {},
  })),
}));
jest.mock("@/lib/game/artifacts", () => ({ rollArtifact: jest.fn(() => null) }));
jest.mock("@/lib/game/community", () => ({ logCommunityEventInTx: jest.fn() }));
jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), logError: jest.fn() },
}));

import { getAdminDb } from "@/lib/firebase-admin";
import {
  farExpeditionExploreServer,
  runWeeklyRolloverServer,
} from "@/lib/game/data-server";
import { makeDoc } from "@/__tests__/_helpers/firebase-admin-mock";
import { BASE_PLAYER } from "@/__tests__/_helpers/game-mutation-db";
import { neighborTileIds } from "@/lib/game/world-gen";

const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;

function buildFarExpeditionDb() {
  const playerData = {
    ...BASE_PLAYER,
    userId: "u1",
    phase: "play",
    caste: "red",
    turnsRemaining: 20,
    turnsSpentTotal: 10,
    stats: { ...BASE_PLAYER.stats, tilesHeld: 5 },
    tilesExplored: 3,
  };
  const enemyPlayer = {
    userId: "u2",
    phase: "play",
    stats: { tilesHeld: 50, unitsAlive: 0 },
  };
  const ownedTile = {
    tileId: "0_0",
    q: 0,
    r: 0,
    ownerId: "u1",
    type: "military",
    units: { ground: 1, air: 0, siege: 0 },
  };
  const enemyTile = {
    tileId: "1_0",
    q: 1,
    r: 0,
    ownerId: "u2",
    type: "military",
    units: { ground: 2, air: 0, siege: 0 },
  };
  const existingTiles = new Map<string, Record<string, unknown>>([
    ["0_0", ownedTile],
    ["1_0", enemyTile],
  ]);

  const playerRef = { __kind: "player" as const, id: "u1" };
  const tileDoc = (id: string) => ({ __tileId: id });

  const db = {
    collection: jest.fn((name: string) => {
      if (name === "game_players") {
        return {
          doc: jest.fn((id: string) => ({
            get: jest.fn().mockResolvedValue(
              makeDoc(id, id === "u1" ? playerData : undefined),
            ),
          })),
          where: jest.fn((field: string) => {
            if (field === "phase") {
              return {
                get: jest.fn().mockResolvedValue({
                  docs: [
                    makeDoc("u1", playerData),
                    makeDoc("u2", enemyPlayer),
                  ],
                }),
              };
            }
            return { get: jest.fn().mockResolvedValue({ docs: [] }) };
          }),
        };
      }
      if (name === "game_tiles") {
        return {
          doc: jest.fn((id: string) => tileDoc(id)),
          where: jest.fn((_f: string, _op: string, value: string) => {
            if (value === "u1") {
              return {
                get: jest.fn().mockResolvedValue({
                  docs: [makeDoc("0_0", ownedTile)],
                }),
              };
            }
            if (value === "u2") {
              return {
                limit: jest.fn().mockReturnValue({
                  get: jest.fn().mockResolvedValue({
                    docs: [makeDoc("1_0", enemyTile)],
                  }),
                }),
              };
            }
            return { get: jest.fn().mockResolvedValue({ docs: [] }) };
          }),
        };
      }
      return { doc: jest.fn() };
    }),
    getAll: jest.fn(async (...refs: Array<{ __tileId?: string }>) =>
      refs.map((ref) => {
        const id = ref.__tileId ?? "";
        const data = existingTiles.get(id);
        return makeDoc(id, data);
      }),
    ),
    runTransaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        get: jest.fn(async (ref: { __tileId?: string }) => {
          if (ref?.__tileId) {
            const id = ref.__tileId;
            return makeDoc(id, existingTiles.get(id));
          }
          return makeDoc("u1", playerData);
        }),
        set: jest.fn(),
        update: jest.fn(),
      };
      return cb(tx);
    }),
  };

  return { db, existingTiles, playerData };
}

describe("farExpeditionExploreServer", () => {
  it("claims a vacant neighbor beside an enemy tile", async () => {
    const { db, existingTiles } = buildFarExpeditionDb();
    mockGetAdminDb.mockReturnValue(db);

    const result = await farExpeditionExploreServer("u1");
    expect(result.player.turnsRemaining).toBeLessThan(20);
    expect(result.tile.ownerId).toBe("u1");
    expect(result.targetEnemyTileId).toBe("1_0");
    expect(neighborTileIds(1, 0)).toContain(result.tile.tileId);
    expect(existingTiles.has(result.tile.tileId)).toBe(false);
  });
});

describe("runWeeklyRolloverServer", () => {
  it("grants turns when merged PR exists in window", async () => {
    const player = {
      ...BASE_PLAYER,
      userId: "u1",
      turnsRemaining: 2,
      lastWeeklyGrantWeekStart: undefined,
    };
    const prChain = {
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue({
          empty: false,
          docs: [makeDoc("pr1", {})],
        }),
      }),
    };
    const db = {
      collection: jest.fn((name: string) => {
        if (name === "game_players") {
          return {
            get: jest.fn().mockResolvedValue({
              size: 1,
              docs: [makeDoc("u1", player)],
            }),
            doc: jest.fn(() => ({})),
          };
        }
        if (name === "pullRequests") return prChain;
        return { doc: jest.fn() };
      }),
      runTransaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          get: jest.fn().mockResolvedValue(makeDoc("u1", player)),
          update: jest.fn(),
        };
        return cb(tx);
      }),
    };
    mockGetAdminDb.mockReturnValue(db);

    const summary = await runWeeklyRolloverServer("2026-05-12T00:00:00.000Z");
    expect(summary.scanned).toBe(1);
    expect(summary.granted).toBeGreaterThanOrEqual(1);
    expect(summary.skippedNoPrs).toBe(0);
  });

  it("skips players with no merged PRs in window", async () => {
    const player = {
      ...BASE_PLAYER,
      userId: "u1",
      lastWeeklyGrantWeekStart: undefined,
    };
    const prChain = {
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue({ empty: true, docs: [] }),
      }),
    };
    const db = {
      collection: jest.fn((name: string) => {
        if (name === "game_players") {
          return {
            get: jest.fn().mockResolvedValue({
              docs: [makeDoc("u1", player)],
            }),
          };
        }
        if (name === "pullRequests") return prChain;
        return { doc: jest.fn() };
      }),
    };
    mockGetAdminDb.mockReturnValue(db);

    const summary = await runWeeklyRolloverServer("2026-05-12T00:00:00.000Z");
    expect(summary.skippedNoPrs).toBe(1);
    expect(summary.granted).toBe(0);
  });
});
