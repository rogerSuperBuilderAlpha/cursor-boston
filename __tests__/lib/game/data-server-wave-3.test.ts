/**
 * @jest-environment node
 *
 * OpenSSF 80% sprint — wave 3 data-server mutations and reads.
 */
jest.mock("@/lib/firebase-admin", () => ({ getAdminDb: jest.fn() }));

jest.mock("@/lib/game/turn-report", () => ({
  buildArmDefenseReport: jest.fn(() => ({ kind: "arm" })),
  buildProduceReport: jest.fn(() => ({ kind: "intel" })),
  buildExploreReport: jest.fn(() => ({ kind: "explore" })),
  buildArtifactReport: jest.fn(() => ({ kind: "artifact" })),
}));
jest.mock("@/lib/game/artifacts", () => ({ rollArtifact: jest.fn(() => null) }));
jest.mock("@/lib/game/community", () => ({ logCommunityEventInTx: jest.fn() }));
jest.mock("@/lib/game/intel-effects", () => ({
  recordIntelEffectInTx: jest.fn(),
}));
jest.mock("@/lib/game/heroes", () => {
  const actual = jest.requireActual<typeof import("@/lib/game/heroes")>("@/lib/game/heroes");
  return { ...actual, maybeEmergeHero: jest.fn(() => null) };
});
jest.mock("@/lib/game/intel", () => ({
  buildIntelReportServer: jest.fn().mockResolvedValue({
    id: "ir1",
    targetTileId: "t1",
    scope: "weak-face",
    capturedAtTurn: 1,
    lines: [],
  }),
}));
jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), logError: jest.fn() },
}));
jest.mock("@/lib/firestore-pagination", () => ({
  paginateFirestoreQuery: jest.fn(async () => ({ items: [], nextCursor: null, hasMore: false })),
  paginateInMemory: jest.requireActual("@/lib/firestore-pagination").paginateInMemory,
}));

import { getAdminDb } from "@/lib/firebase-admin";
import {
  armDefenseSpellServer,
  castIntelSpellServer,
  isGeneralNameTakenServer,
  setTileInscriptionServer,
  spendArtifactServer,
  adminGrantUnitsServer,
} from "@/lib/game/data-server";
import { makeChain } from "@/__tests__/_helpers/firebase-admin-mock";
import { BASE_PLAYER, BASE_TILE, buildGameMutationDb } from "@/__tests__/_helpers/game-mutation-db";

const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;

describe("armDefenseSpellServer", () => {
  it("arms a red defense spell on owned tile", async () => {
    const { db, tx } = buildGameMutationDb({
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          phase: "play",
          caste: "red",
          turnsRemaining: 10,
          stats: { ...BASE_PLAYER.stats, tilesHeld: 500 },
        },
      },
      tile: {
        exists: true,
        data: {
          ...BASE_TILE,
          type: "military",
          armedDefenseSpellId: null,
        },
      },
    });
    mockGetAdminDb.mockReturnValue(db);
    const result = await armDefenseSpellServer(
      "u1",
      "t1",
      "red-defense-fire-wall",
    );
    expect(result.report).toEqual({ kind: "arm" });
    expect(result.tile.armedDefenseSpellId).toBe("red-defense-fire-wall");
    expect(tx.update).toHaveBeenCalled();
  });
});

describe("castIntelSpellServer", () => {
  it("casts intel spell when eligible", async () => {
    const { db, tx } = buildGameMutationDb({
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          phase: "play",
          caste: "red",
          turnsRemaining: 10,
          stats: { ...BASE_PLAYER.stats, tilesHeld: 2000 },
        },
      },
      tile: {
        exists: true,
        data: { ...BASE_TILE, type: "magic", ownerId: "u2" },
      },
    });
    mockGetAdminDb.mockReturnValue(db);
    const result = await castIntelSpellServer(
      "u1",
      "red-intel-forge-sight-t2",
      "t1",
    );
    expect(result.report.action).toBe("spell-arm");
    expect(result.intelReport.id).toBe("ir1");
    expect(tx.update).toHaveBeenCalled();
  });
});

describe("setTileInscriptionServer", () => {
  it("sets inscription on owned tile", async () => {
    const { db, tx } = buildGameMutationDb({
      player: { exists: true, data: BASE_PLAYER },
      tile: { exists: true, data: BASE_TILE },
    });
    mockGetAdminDb.mockReturnValue(db);
    const tile = await setTileInscriptionServer("u1", "t1", "Hello");
    expect(tile.inscription).toBe("Hello");
    expect(tx.update).toHaveBeenCalled();
  });
});

describe("isGeneralNameTakenServer", () => {
  it("returns false when no name collision", async () => {
    const chain = makeChain({ docs: [] });
    mockGetAdminDb.mockReturnValue({
      collection: jest.fn(() => ({
        where: jest.fn(() => chain),
      })),
    });
    const taken = await isGeneralNameTakenServer("NewName", "u1");
    expect(taken).toBe(false);
  });
});

describe("adminGrantUnitsServer", () => {
  it("grants units to player tile", async () => {
    const { db, tx } = buildGameMutationDb({
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          stats: { ...BASE_PLAYER.stats, unitsAlive: 10 },
        },
      },
      tile: {
        exists: true,
        data: {
          ...BASE_TILE,
          units: { ground: 0, air: 0, siege: 0 },
        },
      },
    });
    mockGetAdminDb.mockReturnValue(db);
    const out = await adminGrantUnitsServer({
      ownerId: "u1",
      tileId: "t1",
      unitType: "ground",
      count: 5,
    });
    expect(out.tile.units.ground).toBe(5);
    expect(out.player.stats.unitsAlive).toBe(15);
    expect(tx.update).toHaveBeenCalled();
  });
});

describe("spendArtifactServer", () => {
  it("spends staged artifact", async () => {
    const artifactRef = { __kind: "artifact" };
    const playerRef = { __kind: "player" };
    const db = {
      collection: jest.fn((name: string) => {
        if (name === "game_artifacts") {
          return { doc: jest.fn(() => artifactRef) };
        }
        if (name === "game_players") {
          return { doc: jest.fn(() => playerRef) };
        }
        return { doc: jest.fn() };
      }),
      runTransaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          get: jest.fn((ref: { __kind?: string }) => {
            if (ref.__kind === "artifact") {
              return Promise.resolve({
                exists: true,
                data: () => ({
                  id: "art-1",
                  ownerId: "u1",
                  used: false,
                  definitionId: "common-ember-flask",
                  foundAtTurn: 3,
                }),
              });
            }
            return Promise.resolve({
              exists: true,
              data: () => ({ ...BASE_PLAYER, turnsRemaining: 5 }),
            });
          }),
          update: jest.fn(),
        };
        return cb(tx);
      }),
    };
    mockGetAdminDb.mockReturnValue(db);
    const result = await spendArtifactServer({
      userId: "u1",
      artifactId: "art-1",
    });
    expect(result.artifact.used).toBe(true);
  });
});
