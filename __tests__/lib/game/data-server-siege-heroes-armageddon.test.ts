/**
 * @jest-environment node
 */
jest.mock("@/lib/firebase-admin", () => ({ getAdminDb: jest.fn() }));

jest.mock("@/lib/game/turn-report", () => ({
  buildSiegeReport: jest.fn(() => ({ kind: "siege" })),
}));
jest.mock("@/lib/game/artifacts", () => ({ rollArtifact: jest.fn(() => null) }));
jest.mock("@/lib/game/community", () => ({ logCommunityEventInTx: jest.fn() }));
jest.mock("@/lib/game/intel-effects", () => ({
  readAttackContextEffects: jest.fn().mockResolvedValue({
    forgeSightOffenseBonus: 0,
    alertVsCasterDefenseBonus: 0,
    siegeDebuffMagnitude: 0,
    preCastOffenseBonus: 0,
    defenseDisarmFraction: 0,
    consumeEffectIds: [],
  }),
  recordSiegeDebuffInTx: jest.fn(),
}));
jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), logError: jest.fn() },
}));

import { getAdminDb } from "@/lib/firebase-admin";
import {
  listArmageddonHistoryServer,
  siegeTileServer,
  toggleDefensiveStanceServer,
} from "@/lib/game/data-server";
import { makeDoc, makeQuerySnap } from "@/__tests__/_helpers/firebase-admin-mock";
import {
  BASE_ATTACKER,
  BASE_DEFENDER,
  BASE_PLAYER,
  BASE_TILE,
  buildCombatMutationDb,
  buildGameMutationDb,
  makeAdjacentCombatTiles,
} from "@/__tests__/_helpers/game-mutation-db";
import { makeChain } from "@/__tests__/_helpers/firebase-admin-mock";

const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;

describe("siegeTileServer", () => {
  it("applies siege debuff on adjacent enemy tile", async () => {
    const tiles = makeAdjacentCombatTiles();
    const { db, tx } = buildCombatMutationDb({
      attacker: { ...BASE_ATTACKER, turnsRemaining: 10 },
      defender: BASE_DEFENDER,
      source: tiles.source,
      target: tiles.target,
      sourceTileId: tiles.sourceTileId,
      targetTileId: tiles.targetTileId,
    });
    mockGetAdminDb.mockReturnValue(db);

    const result = await siegeTileServer({
      attackerId: "u1",
      sourceTileId: tiles.sourceTileId,
      targetTileId: tiles.targetTileId,
    });
    expect(result.report).toEqual({ kind: "siege" });
    expect(result.siegeTotalMagnitude).toBeGreaterThan(0);
    expect(tx.update).toHaveBeenCalled();
  });
});

describe("toggleDefensiveStanceServer", () => {
  it("activates defensive stance on owned tile", async () => {
    const { db, tx } = buildGameMutationDb({
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          activeDefensiveStanceCount: 0,
          stats: { ...BASE_PLAYER.stats, tilesHeld: 200 },
        },
      },
      tile: {
        exists: true,
        data: { ...BASE_TILE, defensiveStance: null },
      },
    });
    mockGetAdminDb.mockReturnValue(db);

    const tile = await toggleDefensiveStanceServer({
      callerUserId: "u1",
      tileId: "t1",
      desiredActive: true,
    });
    expect(tile.defensiveStance).toBeTruthy();
    expect(tx.update).toHaveBeenCalled();
  });
});

describe("listArmageddonHistoryServer", () => {
  it("returns season rows from Firestore", async () => {
    const chain = makeChain({});
    chain.orderBy = jest.fn().mockReturnValue({
      limit: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue(
          makeQuerySnap([makeDoc("1", { seasonNumber: 2 })]),
        ),
      }),
    });
    mockGetAdminDb.mockReturnValue({
      collection: jest.fn(() => chain),
    });
    const rows = await listArmageddonHistoryServer(5);
    expect(rows[0]?.seasonNumber).toBe(2);
  });
});
