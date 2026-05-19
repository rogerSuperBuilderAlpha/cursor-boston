/**
 * @jest-environment node
 *
 * OpenSSF Silver coverage push #76 — list/admin/read paths in data-server.
 */
const mockGetAdminDb = jest.fn();
const mockPaginate = jest.fn();

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: () => mockGetAdminDb(),
}));

jest.mock("@/lib/firestore-pagination", () => {
  const actual = jest.requireActual<typeof import("@/lib/firestore-pagination")>(
    "@/lib/firestore-pagination",
  );
  return {
    ...actual,
    paginateFirestoreQuery: (...args: unknown[]) => mockPaginate(...args),
  };
});

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
jest.mock("@/lib/game/artifacts", () => ({ rollArtifact: jest.fn(() => null) }));
jest.mock("@/lib/game/community", () => ({ logCommunityEventInTx: jest.fn() }));
jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), logError: jest.fn() },
}));

import {
  adminGrantTurnsServer,
  chooseCasteServer,
  getRecentAttacksServer,
  listArtifactsServer,
  setGeneralNameServer,
} from "@/lib/game/data-server";
import { makeChain, makeDoc, makeFakeDb, makeQuerySnap } from "@/__tests__/_helpers/firebase-admin-mock";
import { BASE_PLAYER, buildGameMutationDb } from "@/__tests__/_helpers/game-mutation-db";

beforeEach(() => {
  mockGetAdminDb.mockReset();
  mockPaginate.mockReset();
  mockPaginate.mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
});

describe("listArtifactsServer", () => {
  it("delegates to paginateFirestoreQuery", async () => {
    mockGetAdminDb.mockReturnValue(
      makeFakeDb({ collections: { game_artifacts: makeChain({}) } }).db,
    );
    await listArtifactsServer({ userId: "u1", limit: 10, cursor: null });
    expect(mockPaginate).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 10, cursor: null }),
    );
  });
});

describe("getRecentAttacksServer", () => {
  it("paginates sent attacks", async () => {
    mockGetAdminDb.mockReturnValue(
      makeFakeDb({ collections: { game_attacks: makeChain({}) } }).db,
    );
    await getRecentAttacksServer({
      userId: "u1",
      side: "sent",
      limit: 5,
      cursor: null,
    });
    expect(mockPaginate).toHaveBeenCalled();
  });

  it("merges sent+received for side=all", async () => {
    const attacksChain = makeChain({});
    attacksChain.where = jest.fn().mockReturnValue({
      limit: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue(
          makeQuerySnap([
            makeDoc("a1", {
              id: "a1",
              attackerId: "u1",
              defenderId: "u2",
              createdAt: new Date("2026-05-01"),
            }),
          ]),
        ),
      }),
    });
    mockGetAdminDb.mockReturnValue(
      makeFakeDb({ collections: { game_attacks: attacksChain } }).db,
    );
    const result = await getRecentAttacksServer({
      userId: "u1",
      side: "all",
      limit: 10,
      cursor: null,
    });
    expect(result.items.length).toBeGreaterThanOrEqual(1);
  });
});

describe("adminGrantTurnsServer", () => {
  it("applies weekly grant inside a transaction", async () => {
    const player = {
      ...BASE_PLAYER,
      lastWeeklyGrantWeekStart: undefined,
    };
    const { db, tx } = buildGameMutationDb({
      player: { exists: true, data: player },
    });
    mockGetAdminDb.mockReturnValue(db);
    const out = await adminGrantTurnsServer("u1", "2026-05-18");
    expect(out.turnsRemaining).toBeGreaterThan(player.turnsRemaining);
    expect(tx.update).toHaveBeenCalled();
  });
});

describe("chooseCasteServer", () => {
  it("locks caste and advances to play", async () => {
    const { db, tx } = buildGameMutationDb({
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          caste: null,
          phase: "distribute",
        },
      },
    });
    mockGetAdminDb.mockReturnValue(db);
    const out = await chooseCasteServer("u1", "blue");
    expect(out.caste).toBe("blue");
    expect(out.phase).toBe("play");
    expect(tx.update).toHaveBeenCalled();
  });
});

describe("setGeneralNameServer", () => {
  it("writes displayName when name is available", async () => {
    const playersChain = makeChain({});
    playersChain.get = jest.fn().mockResolvedValue(makeQuerySnap([]));
    const { db } = buildGameMutationDb({
      player: { exists: true, data: { ...BASE_PLAYER, displayName: "" } },
    });
    mockGetAdminDb.mockImplementation(() => {
      const base = db;
      const origCollection = base.collection;
      base.collection = jest.fn((name: string) => {
        if (name === "game_players") {
          return {
            ...origCollection(name),
            where: playersChain.where,
          };
        }
        return origCollection(name);
      });
      return base;
    });

    const out = await setGeneralNameServer("u1", "New General");
    expect(out.displayName).toBe("New General");
  });
});
