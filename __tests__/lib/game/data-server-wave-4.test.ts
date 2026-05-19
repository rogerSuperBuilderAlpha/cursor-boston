/**
 * @jest-environment node
 *
 * OpenSSF 80% sprint — upgrades, summons, eligibility, map bounds.
 */
jest.mock("@/lib/firebase-admin", () => ({ getAdminDb: jest.fn() }));

jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), logError: jest.fn() },
}));

import { getAdminDb } from "@/lib/firebase-admin";
import {
  applyUpgradeServer,
  removeUpgradeServer,
  summonSpecialUnitServer,
  unsummonSpecialUnitServer,
  getPlayerEligibilityServer,
  getMapTilesInBoundsServer,
} from "@/lib/game/data-server";
import {
  makeChain,
  makeDoc,
  makeFakeDb,
  makeQuerySnap,
} from "@/__tests__/_helpers/firebase-admin-mock";
import { BASE_PLAYER, BASE_TILE, buildGameMutationDb } from "@/__tests__/_helpers/game-mutation-db";

const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;

describe("applyUpgradeServer / removeUpgradeServer", () => {
  const upgradeId = "red-ground-marauder-upgrade-1";
  const targetId = "red-ground-marauder";

  it("applies a unit upgrade", async () => {
    const { db, tx } = buildGameMutationDb({
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          phase: "play",
          caste: "red",
          turnsRemaining: 10,
          activeUpgrades: {},
        },
      },
    });
    mockGetAdminDb.mockReturnValue(db);
    const { player } = await applyUpgradeServer({
      userId: "u1",
      targetId,
      upgradeId,
    });
    expect(player.activeUpgrades?.[targetId]).toBe(upgradeId);
    expect(tx.update).toHaveBeenCalled();
  });

  it("removes an active upgrade", async () => {
    const { db, tx } = buildGameMutationDb({
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          phase: "play",
          caste: "red",
          turnsRemaining: 10,
          activeUpgrades: { [targetId]: upgradeId },
        },
      },
    });
    mockGetAdminDb.mockReturnValue(db);
    const { player } = await removeUpgradeServer({
      userId: "u1",
      targetId,
    });
    expect(player.activeUpgrades?.[targetId]).toBeUndefined();
    expect(tx.update).toHaveBeenCalled();
  });
});

describe("summonSpecialUnitServer / unsummonSpecialUnitServer", () => {
  const poolEntry = {
    instanceId: "spec-1",
    definitionId: "red-special-1",
    stationedTileId: undefined as string | undefined,
  };

  it("stations a summonable unit on an owned tile", async () => {
    const { db, tx } = buildGameMutationDb({
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          phase: "play",
          summonableSpecialUnits: [poolEntry],
        },
      },
      tile: { exists: true, data: BASE_TILE },
    });
    mockGetAdminDb.mockReturnValue(db);
    const out = await summonSpecialUnitServer({
      userId: "u1",
      instanceId: "spec-1",
      targetTileId: "t1",
    });
    expect(out.tileId).toBe("t1");
    expect(out.player.summonableSpecialUnits?.[0].stationedTileId).toBe("t1");
    expect(tx.update).toHaveBeenCalled();
  });

  it("recalls a stationed special unit", async () => {
    const { db, tx } = buildGameMutationDb({
      player: {
        exists: true,
        data: {
          ...BASE_PLAYER,
          phase: "play",
          summonableSpecialUnits: [
            { ...poolEntry, stationedTileId: "t1" },
          ],
        },
      },
    });
    mockGetAdminDb.mockReturnValue(db);
    const { player } = await unsummonSpecialUnitServer({
      userId: "u1",
      instanceId: "spec-1",
    });
    expect(player.summonableSpecialUnits?.[0].stationedTileId).toBeUndefined();
    expect(tx.update).toHaveBeenCalled();
  });
});

describe("getPlayerEligibilityServer", () => {
  it("returns github login and PR count", async () => {
    const prsChain = makeChain({
      docs: [makeDoc("pr1", { userId: "u1", state: "merged" })],
    });
    mockGetAdminDb.mockReturnValue(
      makeFakeDb({
        collections: {
          users: {
            byId: {
              u1: makeDoc("u1", { github: { login: "octo" } }),
            },
          },
          pullRequests: prsChain,
        },
      }).db,
    );
    const result = await getPlayerEligibilityServer("u1");
    expect(result.githubLogin).toBe("octo");
    expect(result.mergedPrCountThisWeek).toBe(1);
    expect(result.nextRolloverIso).toMatch(/^\d{4}-/);
  });
});

describe("getMapTilesInBoundsServer", () => {
  it("filters tiles inside r bounds", async () => {
    const tilesChain = makeChain({
      docs: [
        makeDoc("0_0", {
          tileId: "0_0",
          q: 0,
          r: 0,
          type: "military",
          ownerId: "u1",
          units: { ground: 1, air: 0, siege: 0 },
        }),
        makeDoc("0_5", {
          tileId: "0_5",
          q: 0,
          r: 99,
          type: "food",
          ownerId: null,
          units: { ground: 0, air: 0, siege: 0 },
        }),
      ],
    });
    mockGetAdminDb.mockReturnValue(
      makeFakeDb({ collections: { game_tiles: tilesChain } }).db,
    );
    const tiles = await getMapTilesInBoundsServer({
      qMin: -1,
      qMax: 1,
      rMin: -1,
      rMax: 1,
    });
    expect(tiles).toHaveLength(1);
    expect(tiles[0].tileId).toBe("0_0");
  });
});
